'use client';

/**
 * AjoContext — React runtime layer connecting the Ajo domain/rules engine
 * to the Pollar payment adapter.
 *
 * ARCHITECTURE:
 *   UI → AjoContext → executeAjoPayout() → PollarPaymentAdapter → runTx() → Stellar XLM
 *
 * CONCURRENCY SAFETY:
 *   All authoritative mutable state is stored in refs (not useState).
 *   The executor's pre-await synchronous reservation into `payoutsRef.current`
 *   prevents double-payout race conditions within a single JS runtime.
 *   useState is NOT used for the payouts/contributions/circles arrays.
 *   A version counter (useState<number>) triggers re-renders after mutations.
 *
 * DOMAIN ISOLATION:
 *   No business logic lives in this file. All validation, contribution recording,
 *   payout eligibility, cycle advancement, and concurrency protection are delegated
 *   to the existing lib/ajo/ modules.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePollar } from '@pollar/react';

import { PollarPaymentAdapter, DemoPaymentAdapter } from './adapter';
import type { PaymentAdapter } from './adapter';
import { executeAjoPayout, type ExecutePayoutResult } from './executor';
import { createAjoCircle, recordContribution as domainRecordContribution } from './rules';
import type { AjoCircle, Asset, Contribution, Payout } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Native Stellar XLM — the confirmed hackathon asset. */
const NATIVE_XLM: Asset = { type: 'native' };

const DEMO_MEMBER_IDS = [
  'member_1', 'member_2', 'member_3', 'member_4', 'member_5',
  'member_6', 'member_7', 'member_8', 'member_9', 'member_10',
  'member_11', 'member_12'
] as const;

const DEMO_MEMBER_NAMES = [
  'You', 'Ada [Demo]', 'Chika [Demo]', 'Emeka [Demo]', 'Funke [Demo]',
  'Bayo [Demo]', 'Ngozi [Demo]', 'Kwame [Demo]', 'Amara [Demo]', 'Tunde [Demo]',
  'Zainab [Demo]', 'Obi [Demo]'
] as const;

/**
 * Placeholder wallet addresses for demo participants.
 * Member 1 is replaced at runtime with wallet.address from usePollar().
 */
const DEMO_PLACEHOLDER_WALLETS = [
  '',
  'DEMO_PARTICIPANT_2_NO_REAL_WALLET',
  'DEMO_PARTICIPANT_3_NO_REAL_WALLET',
  'DEMO_PARTICIPANT_4_NO_REAL_WALLET',
  'DEMO_PARTICIPANT_5_NO_REAL_WALLET',
  'DEMO_PARTICIPANT_6_NO_REAL_WALLET',
  'DEMO_PARTICIPANT_7_NO_REAL_WALLET',
  'DEMO_PARTICIPANT_8_NO_REAL_WALLET',
  'DEMO_PARTICIPANT_9_NO_REAL_WALLET',
  'DEMO_PARTICIPANT_10_NO_REAL_WALLET',
  'DEMO_PARTICIPANT_11_NO_REAL_WALLET',
  'DEMO_PARTICIPANT_12_NO_REAL_WALLET',
] as const;

// ─── Context Types ──────────────────────────────────────────────────────────

interface AjoContextValue {
  /** The currently active circle, or null if none created. */
  activeCircle: AjoCircle | null;
  /** All circles (currently only one demo circle is supported). */
  circles: AjoCircle[];
  /** All contributions across all circles. */
  contributions: Contribution[];
  /** All payouts across all circles. Authoritative shared mutable reference. */
  payouts: Payout[];

  /**
   * Creates the hackathon demo Ajo circle based on user configuration.
   * Requires the user to be authenticated (wallet connected).
   */
  createDemoAjoCircle: (config: {
    memberCount: number;
    contributionAmount: string;
    frequency: 'weekly' | 'biweekly' | 'monthly';
    payoutOrderIndices: number[];
  }) => void;

  /**
   * Records a contribution for a member in the active circle.
   * Delegates all validation to the domain rules engine.
   * @param memberId - The member making the contribution.
   * @param amount - The contribution amount as a string.
   * @param transactionHash - Optional real transaction hash (undefined for simulated).
   */
  recordContribution: (
    memberId: string,
    amount: string,
    transactionHash?: string,
  ) => { success: boolean; error?: string };

  /**
   * Executes the payout for the active circle's current cycle.
   * Uses PollarPaymentAdapter (real mode) or DemoPaymentAdapter (demo mode).
   * Passes the authoritative payoutsRef.current to the executor.
   */
  executePayout: () => Promise<ExecutePayoutResult>;

  /** Resets all in-memory Ajo state. */
  resetAjoDemo: () => void;

  /** Set of member IDs that are simulated demo participants (not real wallets). */
  simulatedMemberIds: ReadonlySet<string>;

  /** Whether the connected user's wallet is available for real transactions. */
  isWalletConnected: boolean;

  /** Whether the context is in demo-adapter mode (no real Pollar transactions). */
  isDemoMode: boolean;
}

const AjoContext = createContext<AjoContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

interface AjoProviderProps {
  children: ReactNode;
  /**
   * When true, uses DemoPaymentAdapter instead of PollarPaymentAdapter.
   * Fallback for when Pollar testnet is unavailable.
   */
  demoMode?: boolean;
}

export function AjoProvider({ children, demoMode = false }: AjoProviderProps) {
  const { wallet, runTx, isAuthenticated } = usePollar();

  // ── Authoritative mutable refs (NOT useState) ───────────────────────────
  // These are the single shared array references the executor operates on.
  // They are NEVER replaced — only mutated in-place or spliced.
  const circlesRef = useRef<AjoCircle[]>([]);
  const contributionsRef = useRef<Contribution[]>([]);
  const payoutsRef = useRef<Payout[]>([]);

  // A counter that increments after any state mutation to trigger re-renders.
  // The actual data is read from the refs, not from this state.
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // ── Active circle (derived from ref) ────────────────────────────────────
  // Read from the ref on every render (version bump ensures freshness).
  const activeCircle = circlesRef.current.length > 0 ? circlesRef.current[0] : null;

  // ── Simulated member tracking ───────────────────────────────────────────
  const simulatedMemberIds = useMemo<ReadonlySet<string>>(
    () => new Set(DEMO_MEMBER_IDS.slice(1)), // All members except the first
    [],
  );

  // ── Payment adapter ─────────────────────────────────────────────────────
  // Constructed fresh when runTx or demoMode changes.
  // PollarPaymentAdapter receives the runTx function from usePollar().
  // DemoPaymentAdapter is the fallback.
  const adapter = useMemo<PaymentAdapter>(() => {
    if (demoMode) {
      return new DemoPaymentAdapter();
    }
    // runTx comes from usePollar() — it's the hook's stable reference.
    // PollarPaymentAdapter wraps it without importing React or @pollar/react.
    return new PollarPaymentAdapter(runTx as any);
  }, [runTx, demoMode]);

  // ── createDemoAjoCircle ─────────────────────────────────────────────────
  const createDemoAjoCircle = useCallback((config: {
    memberCount: number;
    contributionAmount: string;
    frequency: 'weekly' | 'biweekly' | 'monthly';
    payoutOrderIndices: number[];
  }) => {
    const connectedAddress = wallet?.address;
    if (!connectedAddress) {
      throw new Error(
        'Cannot create demo circle: no wallet connected. Log in first.',
      );
    }

    // Build members array: Member 1 = connected wallet, Members 2–N = demo
    const activeMemberIds = DEMO_MEMBER_IDS.slice(0, config.memberCount);
    
    const members = activeMemberIds.map((id, index) => ({
      memberId: id,
      name: DEMO_MEMBER_NAMES[index],
      walletAddress: index === 0 ? connectedAddress : DEMO_PLACEHOLDER_WALLETS[index],
      payoutPosition: 0, // Will be overridden by createAjoCircle
    }));

    // Map the selected indices to their actual member IDs
    const payoutOrder = config.payoutOrderIndices.map(index => DEMO_MEMBER_IDS[index]);

    // Delegate to the domain rules engine
    const circle = createAjoCircle({
      id: `ajo_demo_${Date.now()}`,
      name: 'Ajo Demo Circle',
      contributionAmount: config.contributionAmount,
      asset: NATIVE_XLM,
      frequency: config.frequency,
      members,
      payoutOrder,
    });

    // Mutate in-place, then bump version for re-render.
    circlesRef.current.splice(0, circlesRef.current.length, circle);
    contributionsRef.current.length = 0;
    payoutsRef.current.length = 0;
    bump();
  }, [wallet, bump]);

  // ── recordContribution ──────────────────────────────────────────────────
  const recordContributionFn = useCallback(
    (
      memberId: string,
      amount: string,
      transactionHash?: string,
    ): { success: boolean; error?: string } => {
      const circle = circlesRef.current[0];
      if (!circle) {
        return { success: false, error: 'No active circle' };
      }

      try {
        // Delegate all validation to the domain rules engine.
        const contribution = domainRecordContribution(
          circle,
          memberId,
          amount,
          circle.asset,
          contributionsRef.current,
          transactionHash,
        );

        // Mutate the authoritative array in-place.
        contributionsRef.current.push(contribution);
        bump();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [bump],
  );

  // ── executePayout ───────────────────────────────────────────────────────
  const executePayoutFn = useCallback(async (): Promise<ExecutePayoutResult> => {
    const circle = circlesRef.current[0];
    if (!circle) {
      return {
        success: false,
        circle: null as unknown as AjoCircle,
        reason: 'No active circle',
      };
    }

    // Pass the EXACT authoritative shared array references.
    // Do NOT copy — the executor's pre-await synchronous push into
    // payoutsRef.current is the concurrency protection mechanism.
    const result = await executeAjoPayout({
      circle,
      contributions: contributionsRef.current,
      payouts: payoutsRef.current,
      adapter,
    });

    // If the executor returned an updated circle (cycle advanced),
    // replace the circle in the authoritative array.
    if (result.success && result.circle) {
      circlesRef.current[0] = result.circle;
    }

    bump();
    return result;
  }, [adapter, bump]);

  // ── resetAjoDemo ────────────────────────────────────────────────────────
  const resetAjoDemo = useCallback(() => {
    circlesRef.current.length = 0;
    contributionsRef.current.length = 0;
    payoutsRef.current.length = 0;
    bump();
  }, [bump]);

  // ── Context value ───────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the render trigger
  const value = useMemo<AjoContextValue>(
    () => ({
      activeCircle,
      circles: circlesRef.current,
      contributions: contributionsRef.current,
      payouts: payoutsRef.current,
      createDemoAjoCircle,
      recordContribution: recordContributionFn,
      executePayout: executePayoutFn,
      resetAjoDemo,
      simulatedMemberIds,
      isWalletConnected: isAuthenticated && wallet !== null,
      isDemoMode: demoMode,
    }),
    // version is intentionally included to trigger re-computation when refs mutate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      version,
      createDemoAjoCircle,
      recordContributionFn,
      executePayoutFn,
      resetAjoDemo,
      simulatedMemberIds,
      isAuthenticated,
      wallet,
      demoMode,
    ],
  );

  return <AjoContext.Provider value={value}>{children}</AjoContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAjo(): AjoContextValue {
  const ctx = useContext(AjoContext);
  if (!ctx) {
    throw new Error('useAjo must be used within an <AjoProvider>');
  }
  return ctx;
}

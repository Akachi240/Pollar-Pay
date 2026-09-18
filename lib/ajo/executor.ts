/**
 * Ajo Payout Executor
 * Handles the complete payout execution lifecycle:
 * eligible (transient) -> pending (persisted in shared array pre-await) -> paid/failed (post-await) -> advance cycle.
 */

import { PaymentAdapter } from './adapter';
import { advanceAjoCycle, checkAjoPayoutEligibility, createPayoutRecord } from './rules';
import { AjoCircle, Contribution, Payout } from './types';

export interface ExecutePayoutParams {
  circle: AjoCircle;
  contributions: Contribution[];
  payouts: Payout[]; // Shared mutable array reference
  adapter: PaymentAdapter;
}

export interface ExecutePayoutResult {
  success: boolean;
  circle: AjoCircle;
  payout?: Payout;
  reason?: string;
  error?: string;
}

/**
 * Executes an Ajo payout for the current active cycle.
 * 
 * ARCHITECTURAL CONSTRAINTS:
 * 1. Pre-await Synchronous Reservation: Pushes a 'pending' Payout into the passed `payouts` array
 *    IN-PLACE synchronously before the first `await`. This guarantees single-runtime race protection.
 * 2. Shared Reference: `payouts` MUST be a shared mutable reference (e.g. `useRef` in React).
 * 3. Single-Runtime Scope: Concurrency protection holds within one JS runtime/tab instance.
 */
export async function executeAjoPayout(params: ExecutePayoutParams): Promise<ExecutePayoutResult> {
  const { circle, contributions, payouts, adapter } = params;

  // 1. SYNCHRONOUS PRE-AWAIT ELIGIBILITY CHECK
  const eligibility = checkAjoPayoutEligibility(circle, contributions, payouts);
  if (!eligibility.eligible) {
    return {
      success: false,
      circle,
      reason: eligibility.reason,
    };
  }

  // 2. SYNCHRONOUS PRE-AWAIT DUPLICATE CHECK
  const existingPendingOrPaid = payouts.find(
    (p) =>
      p.circleId === circle.id &&
      p.cycle === circle.currentCycle &&
      (p.status === 'pending' || p.status === 'paid')
  );

  if (existingPendingOrPaid) {
    return {
      success: false,
      circle,
      reason: `Payout for cycle ${circle.currentCycle} is already ${existingPendingOrPaid.status}`,
    };
  }

  // 3. SYNCHRONOUS PRE-AWAIT PAYOUT RECORD CREATION & IN-PLACE RESERVATION
  let pendingPayout: Payout;
  try {
    const rawPayout = createPayoutRecord(circle, contributions, payouts);
    pendingPayout = {
      ...rawPayout,
      status: 'pending',
    };
  } catch (err) {
    return {
      success: false,
      circle,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Find destination wallet for recipient
  const recipientMember = circle.members.find((m) => m.memberId === pendingPayout.recipientId);
  if (!recipientMember) {
    pendingPayout.status = 'failed';
    pendingPayout.updatedAt = new Date().toISOString();
    return {
      success: false,
      circle,
      payout: pendingPayout,
      error: `Recipient member "${pendingPayout.recipientId}" not found in circle members`,
    };
  }

  // SYNCHRONOUS IN-PLACE MUTATION BEFORE FIRST AWAIT (Crucial for race condition safety)
  payouts.push(pendingPayout);

  // 4. ASYNC PAYMENT EXECUTION
  try {
    const paymentResult = await adapter.sendPayment({
      destination: recipientMember.walletAddress,
      amount: pendingPayout.amount,
      asset: pendingPayout.asset,
    });

    if (paymentResult.status === 'success') {
      // Transition pending -> paid
      pendingPayout.status = 'paid';
      pendingPayout.transactionHash = paymentResult.hash;
      pendingPayout.updatedAt = new Date().toISOString();

      // Advance cycle only after confirmed success
      const updatedCircle = advanceAjoCycle(circle, pendingPayout);

      return {
        success: true,
        circle: updatedCircle,
        payout: pendingPayout,
      };
    }

    if (paymentResult.status === 'pending') {
      // Keep status as pending, do NOT advance cycle
      pendingPayout.status = 'pending';
      if (paymentResult.hash) {
        pendingPayout.transactionHash = paymentResult.hash;
      }
      pendingPayout.updatedAt = new Date().toISOString();

      return {
        success: false,
        circle,
        payout: pendingPayout,
        reason: 'Payment transaction is pending on-chain',
      };
    }

    // Status is 'error'
    pendingPayout.status = 'failed';
    pendingPayout.updatedAt = new Date().toISOString();
    const errorMsg = paymentResult.error || 'Payment execution failed';

    return {
      success: false,
      circle,
      payout: pendingPayout,
      error: errorMsg,
    };
  } catch (err) {
    // Handle thrown async exceptions (e.g. network disconnects)
    pendingPayout.status = 'failed';
    pendingPayout.updatedAt = new Date().toISOString();
    const errorMsg = err instanceof Error ? err.message : String(err);

    return {
      success: false,
      circle,
      payout: pendingPayout,
      error: errorMsg,
    };
  }
}

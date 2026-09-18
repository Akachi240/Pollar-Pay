'use client';

// App-wide wallet wiring for the navbar login. Hands the Pollar client a
// combined `walletAdapters` stack:
//   • the official Privy adapter (`@pollar/privy-adapter`) — an
//     InteractiveAuthAdapter that drives email/Google login as a sub-modal
//     inside Pollar's own login modal, then runs SEP-10, and
//   • the Stellar Wallets Kit adapters (xBull, Lobstr, Freighter, Albedo…),
//     collapsed behind a shared "Wallet" gateway via their meta `group`, and
//   • the hand-written Cosmos Wallet adapter (the CosmosPay browser extension,
//     `window.cosmosWallet`) — it has no meta `group`, so it renders as its own
//     button in the root login view.
// `<PrivyAdapterProvider>` mounts Privy + its runtime bridge as a SIBLING of
// `<PollarProvider>` (the bridge renders null and wires the runtime onto the
// shared adapter); the SAME adapter instance is registered in `walletAdapters`,
// so the login modal renders the Privy sub-modal.
//
// When NEXT_PUBLIC_PRIVY_APP_ID is unset, `privyDisabled` is passed, or before
// client mount, Privy is simply omitted and the navbar offers the kit wallets
// only.

import { Networks } from '@creit.tech/stellar-wallets-kit';
import type { PollarAdapters, WalletAdapter } from '@pollar/core';
import { createPrivyAdapter, PrivyAdapterProvider } from '@pollar/privy-adapter';
import { PollarProvider } from '@pollar/react';
import '@pollar/react/styles.css';
import { stellarWalletsKitAdapters } from '@pollar/stellar-wallets-kit-adapter';
import { useEffect, useMemo, useState } from 'react';
import { createCosmosWalletAdapter } from './wallet-adapters/cosmos-wallet/adapter';
import { AjoProvider } from '@/lib/ajo/AjoContext';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// One shared adapter instance: handed to `<PrivyAdapterProvider>` (which mounts
// Privy + the bridge) and registered in every Pollar client's `walletAdapters`
// (including the /wallet-adapters/privy tab's own client). `null` when no app id
// is configured. Built once at module scope so the instance identity is stable.
export const privyAdapter = PRIVY_APP_ID
  ? createPrivyAdapter({
    appId: PRIVY_APP_ID,
    loginMethods: [ 'email', 'google' ],
    meta: { label: 'Privy' },
    debug: true,
  })
  : null;

type StellarNetwork = 'testnet' | 'mainnet';

function kitNetwork(network: StellarNetwork): Networks {
  return network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
}

type StackProps = {
  apiKey: string;
  baseUrl: string;
  network: StellarNetwork;
  adapters: PollarAdapters;
  // Leaves Privy out of the stack entirely (kit wallets only), even when
  // NEXT_PUBLIC_PRIVY_APP_ID is set — the demo mainnet key has no Privy app
  // behind it.
  privyDisabled?: boolean;
  children: React.ReactNode;
};

// ── Single, always-mounted stack ─────────────────────────────────────────────
// One PollarProvider for the whole app, mounted once and never swapped — so
// exactly one PollarClient is constructed per apiKey (no "Another PollarClient
// is already active" warning, no doubled OAuth flow).
//
// Privy can't SSR, so its bridge mounts client-side only. But rather than swap
// the PollarProvider into a Privy-wrapped subtree (which would tear down the
// kit-only client and build a second one — the source of the duplication), we
// mount `<PrivyAdapterProvider>` as a SIBLING. Its component renders `null` and
// only attaches the runtime to the shared `privyAdapter` singleton, so
// PollarProvider never needs PrivyProvider as an ancestor and keeps its identity
// (and its single client) across the mount transition.
export function AppWalletProvider({
                                    apiKey,
                                    baseUrl,
                                    network,
                                    adapters,
                                    privyDisabled = false,
                                    children,
                                  }: StackProps) {
  // Privy mounts client-side only; until then the bridge is absent and the
  // registered Privy adapter is simply inert.
  const [ mounted, setMounted ] = useState(false);
  useEffect(() => setMounted(true), []);

  const privyEnabled = Boolean(privyAdapter) && !privyDisabled;
  const privyOn = privyEnabled && mounted;

  const walletAdapters = useMemo<WalletAdapter[]>(() => {
    const kit = stellarWalletsKitAdapters({
      network: kitNetwork(network),
      picker: { groupLabel: 'Stellar Wallets Kit' },
    });
    // The extension keeps its own network setting, so the adapter is built per
    // network and refuses to log in when the two disagree.
    const cosmos = createCosmosWalletAdapter(network);
    return privyEnabled
      ? [ privyAdapter!, cosmos, ...kit ]
      : [ cosmos, ...kit ];
  }, [ network, privyEnabled ]);

  return (
    <>
      {/* Sibling of PollarProvider: mounts Privy + the runtime bridge (which
          renders null), wiring the shared adapter without re-parenting — so
          PollarProvider does not remount when Privy turns on. */}
      {privyOn && <PrivyAdapterProvider adapter={privyAdapter!} />}
      <PollarProvider
        key={apiKey}
        client={{
          apiKey,
          baseUrl,
          stellarNetwork: network,
          logLevel: 'debug',
          walletAdapters,
        }}
        adapters={adapters}
      >
        <AjoProvider>{children}</AjoProvider>
      </PollarProvider>
    </>
  );
}

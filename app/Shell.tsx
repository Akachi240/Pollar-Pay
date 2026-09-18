'use client';

import { WalletButton } from '@pollar/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import '@pollar/react/styles.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppWalletProvider } from './_AppWalletProvider';
import { ApiKeyModal } from './_components/ApiKeyModal';
import { ComingSoon } from './_components/ComingSoon';
import { InvalidApiKeyModal } from './_components/InvalidApiKeyModal';
import { LanguageSwitcher } from './_components/LanguageSwitcher';
import { NetworkLockedModal } from './_components/NetworkLockedModal';
import { OriginNotAllowedModal } from './_components/OriginNotAllowedModal';
import { useI18n } from './_i18n/LanguageProvider';
import { useLabUnlocked } from './_LabGateProvider';
import { SIDEBAR_SECTIONS, visibleGroups } from './_nav';
import { useApiKeyHref } from './_useApiKeyHref';
import { createCosmosPayAdapter } from './adapters/cosmos-pay/pay/adapter';
import { createNiriumAdapter } from './adapters/nirium/x402/adapter';
import { trustlessWorkAdapter } from './adapters/trustless-work/escrow/adapter';
import { useNekoUnlocked } from './neko/_GateProvider';

const DEFAULT_API_KEY_TESTNET = 'pub_testnet_3baa2ddfbf84199941744be4014b255b'; // pub_testnet_ef0660c44a72d909af99f5b09b53935b
const DEFAULT_API_KEY_MAINNET = 'pub_mainnet_921399523168e5775276241dc1c786b2';
const BASE_URL = 'https://sdk.api.pollar.xyz';

// The logo that drifts across a locked group's ComingSoon overlay (hover it to
// peek — see ComingSoon). Keyed by nav group; only groups with an asset show it.
const GROUP_LOGOS: Record<string, string> = {
  neko: '/neko.png',
  cosmosPay: '/cosmos.png',
  nirium: '/nirium.png',
  acceslyAdapter: '/accesly.jpg',
};

type StellarNetwork = 'mainnet' | 'testnet';

// Toggle that switches the active Stellar network. Selecting a network swaps
// in the matching hardcoded default API key (which carries the network prefix),
// so the SDK client and the derived `stellarNetwork` follow along.
function NetworkToggle({
                         network,
                         onSelect,
                         block = false,
                       }: {
  network: StellarNetwork;
  onSelect: (network: StellarNetwork) => void;
  // When true, the toggle fills its container and its two options split the
  // width evenly — used inside the mobile menu so it doesn't look sparse.
  block?: boolean;
}) {
  const options: StellarNetwork[] = [ 'testnet', 'mainnet' ];
  return (
    <div
      role="group"
      aria-label="Stellar network"
      className={`items-center rounded-lg border border-border p-0.5 ${
        block ? 'flex w-full' : 'inline-flex'
      }`}
    >
      {options.map((opt) => {
        const active = network === opt;
        const isMainnet = opt === 'mainnet';
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            aria-pressed={active}
            title={`Stellar ${opt}`}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
              block ? 'flex-1' : ''
            } ${
              active
                ? isMainnet
                  ? 'bg-success-light text-success'
                  : 'bg-warning-light text-warning'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                active
                  ? isMainnet
                    ? 'bg-success'
                    : 'bg-warning'
                  : 'bg-muted-light'
              }`}
            />
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ThemeToggle() {
  const { t } = useI18n();
  const [ dark, setDark ] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    // Read from the DOM, not state — two instances render (mobile + desktop)
    // and only the DOM class is shared between them.
    const next = !document.documentElement.classList.contains('dark');
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('pollar-demo-theme', next ? 'dark' : 'light');
    } catch {
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? t.shell.switchToLight : t.shell.switchToDark}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface transition-colors"
    >
      {dark ? (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1.5m0 15V21m9-9h-1.5m-15 0H3m15.36 6.36l-1.06-1.06M6.7 6.7 5.64 5.64m12.72 0-1.06 1.06M6.7 17.3l-1.06 1.06M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.752 15.002A9.718 9.718 0 0118 15.75 9.75 9.75 0 018.25 6c0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25 9.75 9.75 0 0012.75 21a9.753 9.753 0 009.002-5.998z"
          />
        </svg>
      )}
    </button>
  );
}

// A horizontally-scrollable row that fades an edge only while there's more
// content to reach on that side — the standard affordance for scrollable
// tab/pill bars on mobile. Backs the group pills and the sub-tab bar so a
// clipped item (e.g. "KYC") reads as "there's more, scroll".
function ScrollFadeRow({
                         wrapperClassName,
                         className,
                         children,
                       }: {
  wrapperClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ edges, setEdges ] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  }, []);

  useEffect(() => {
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [ update ]);
  // Re-measure on every render too, since the tab set can change (e.g. the
  // active group switches out its sub-tabs). `update` no-ops when unchanged.
  useEffect(() => {
    update();
  });

  return (
    <div className={`relative ${wrapperClassName ?? ''}`}>
      <div
        ref={ref}
        onScroll={update}
        className={`overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden ${
          className ?? ''
        }`}
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity ${
          edges.left ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity ${
          edges.right ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const withApiKey = useApiKeyHref();

  const customKey = searchParams.get('apiKey');

  // Network for the built-in demo keys when no custom key is set. Toggling the
  // network in this mode never touches the URL; we persist the choice in
  // localStorage so it survives a refresh (the custom-key network already does,
  // since it's derived from the key carried in the URL).
  const [ demoNetwork, setDemoNetwork ] = useState<StellarNetwork>('testnet');
  const demoKey =
    demoNetwork === 'mainnet'
      ? DEFAULT_API_KEY_MAINNET
      : DEFAULT_API_KEY_TESTNET;

  const apiKey = customKey ?? demoKey;

  // "Custom" means a user-supplied key that isn't one of the demo defaults
  // (the green dot lights up only for these).
  const isCustomKey =
    apiKey !== DEFAULT_API_KEY_TESTNET && apiKey !== DEFAULT_API_KEY_MAINNET;

  // Stellar network is derived from the API key prefix (e.g. `pub_testnet_…`,
  // `pub_mainnet_…`); fall back to mainnet for any unrecognized prefix.
  const stellarNetwork: StellarNetwork =
    apiKey.split('_')[1] === 'testnet' ? 'testnet' : 'mainnet';

  // Nirium and Cosmos Pay build their own XDR, so they need the network the
  // session runs on (Horizon URL + passphrase); Trustless Work builds its XDR
  // server-side and takes none. Memoized so the adapter identities stay stable
  // across renders and only change when the network does.
  const adapters = useMemo(
    () => ({
      escrow: trustlessWorkAdapter,
      niriumX402: createNiriumAdapter(stellarNetwork),
      cosmosPay: createCosmosPayAdapter(stellarNetwork),
    }),
    [ stellarNetwork ],
  );

  const GROUPS = visibleGroups(useNekoUnlocked(), useLabUnlocked());

  // The group that owns the current path — matched by its tabs (null on `/`).
  // Groups no longer share a single route prefix (several live under /pollar),
  // so we match the active tab rather than a basePath.
  const activeGroup =
    GROUPS.find((g) =>
      g.tabs.some(
        (tab) => pathname === tab.href || pathname.startsWith(tab.href + '/'),
      ),
    ) ?? null;

  const [ keyModalOpen, setKeyModalOpen ] = useState(false);
  const [ menuOpen, setMenuOpen ] = useState(false);
  // The mobile/tablet page-navigation drawer (the collapsed left sidebar).
  const [ navOpen, setNavOpen ] = useState(false);
  const [ originBlocked, setOriginBlocked ] = useState(false);
  const [ keyInvalid, setKeyInvalid ] = useState(false);
  const [ networkLocked, setNetworkLocked ] = useState(false);

  // Close the mobile menu + nav drawer when navigating to another tab.
  useEffect(() => {
    setMenuOpen(false);
    setNavOpen(false);
  }, [ pathname ]);

  // Restore the demo-key network saved on a previous toggle. Read after mount
  // (not in the initializer) to keep the server-rendered markup deterministic.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pollar-demo-network');
      if (saved === 'mainnet' || saved === 'testnet') setDemoNetwork(saved);
    } catch {
    }
  }, []);

  // The SDK fetches `/applications/config` internally and doesn't surface its
  // error, so we probe the same endpoint with the same auth header
  // (`x-pollar-api-key`). A 403 ORIGIN_NOT_ALLOWED means this page's origin
  // isn't registered in the app's allowed domains; a 401 API_KEY_NOT_FOUND
  // means the key itself isn't recognized — prompt the user to fix whichever
  // applies in the dashboard.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${BASE_URL}/v1/applications/config`, {
      headers: { 'x-pollar-api-key': apiKey },
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.ok) {
          setOriginBlocked(false);
          setKeyInvalid(false);
          return;
        }
        const body = await res.json().catch(() => null);
        setOriginBlocked(
          res.status === 403 && body?.code === 'ORIGIN_NOT_ALLOWED',
        );
        setKeyInvalid(res.status === 401 && body?.code === 'API_KEY_NOT_FOUND');
      })
      .catch(() => {
        // network/abort errors are unrelated to the config check — ignore.
      });
    return () => controller.abort();
  }, [ apiKey ]);

  // Write the key into the URL so PollarProvider picks it up on remount.
  function applyApiKey(next: string) {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    const trimmed = next.trim();
    if (trimmed) params.set('apiKey', trimmed);
    else params.delete('apiKey');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setKeyModalOpen(false);
  }

  // Switch networks. With a demo key, just flip local state (no URL change).
  // A custom key is bound to one network by its prefix, so it can't be
  // toggled — point the user at the key dialog instead.
  function selectNetwork(next: StellarNetwork) {
    if (next === stellarNetwork) return;
    if (isCustomKey) {
      setNetworkLocked(true);
      return;
    }
    setDemoNetwork(next);
    try {
      localStorage.setItem('pollar-demo-network', next);
    } catch {
    }
  }

  // The grouped nav list — section headers with their group links beneath.
  // Shared by the desktop sidebar and the mobile drawer; `onNavigate` lets the
  // drawer close itself when a group is tapped (including the already-active
  // one, where the pathname effect wouldn't fire).
  const navGroups = (onNavigate?: () => void) =>
    SIDEBAR_SECTIONS.map((section) => {
      const sectionGroups = GROUPS.filter((g) => g.section === section);
      if (sectionGroups.length === 0) return null;
      return (
        <div key={section}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-light">
            {t.shell[section]}
          </p>
          <nav className="space-y-1">
            {sectionGroups.map((g) => {
              const active = activeGroup?.key === g.key;
              return (
                <Link
                  key={g.key}
                  href={withApiKey(g.tabs[0].href)}
                  onClick={onNavigate}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary-light text-primary'
                      : 'text-muted hover:text-foreground hover:bg-surface'
                  }`}
                >
                  <span>{t.nav.groups[g.key]}</span>
                  {g.soon && (
                    <span className="shrink-0 rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                      {t.common.soon}
                    </span>
                  )}
                  {g.isNew && !g.soon && (
                    <span className="shrink-0 rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {t.common.new}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      );
    });

  // The active group's body: its tab bar (hidden for single-tab groups, where
  // the sidebar entry already names it) plus the routed page. Extracted so a
  // "soon" group can wrap the whole thing in ComingSoon. While locked we also
  // drop the sub-tab bar — only the root (overview) shows behind the overlay.
  const groupBody = (
    <>
      {activeGroup && activeGroup.tabs.length > 1 && !activeGroup.soon && (
        <ScrollFadeRow
          wrapperClassName="mt-4 lg:mt-8"
          className="flex items-center gap-5 sm:gap-6 border-b border-border"
        >
          {activeGroup.tabs.map(({ href, label }) => (
            <Link
              key={href}
              href={withApiKey(href)}
              className={`shrink-0 whitespace-nowrap text-xs sm:text-sm font-medium py-2.5 border-b-2 transition-colors ${
                pathname === href
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {t.nav[label]}
            </Link>
          ))}
        </ScrollFadeRow>
      )}

      <main className="py-6 sm:py-10">{children}</main>
    </>
  );

  return (
    // Mounts the global PrivyProvider + the Pollar client, wired with a combined
    // wallet stack (Privy adapter + Stellar Wallets Kit) for the navbar login.
    // The inner PollarProvider is keyed by apiKey so it remounts on key change.
    <AppWalletProvider
      apiKey={apiKey}
      baseUrl={BASE_URL}
      network={stellarNetwork}
      privyDisabled={apiKey === DEFAULT_API_KEY_MAINNET}
      adapters={adapters}
    >
      <header className="bg-background/80 backdrop-blur-sm sticky top-0 z-50 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* row 1: logo + api key + theme + wallet button */}
          <div className="flex items-center justify-between py-3">
            <Link
              href={withApiKey('/')}
              className="flex items-center gap-2 sm:gap-3"
            >
              <Image
                src="/logo.png"
                alt="Pollar"
                width={40}
                height={40}
                className="w-8 h-8 sm:w-9 sm:h-9"
              />
              <span className="text-lg sm:text-xl font-bold text-foreground">
                Pollar
              </span>
              <span className="hidden sm:inline-block rounded-md bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                Demo
              </span>
            </Link>
            {/* desktop controls */}
            <div className="hidden sm:flex items-center gap-3">
              <button
                onClick={() => setKeyModalOpen(true)}
                title={t.shell.apiKeyTitle}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    isCustomKey ? 'bg-success' : 'bg-muted-light'
                  }`}
                />
                {t.shell.apiKey}
              </button>
              <NetworkToggle
                network={stellarNetwork}
                onSelect={selectNetwork}
              />
              <LanguageSwitcher />
              <ThemeToggle />
              <WalletButton />
            </div>
            {/* mobile: everything collapses behind the hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? t.shell.closeMenu : t.shell.openMenu}
              aria-expanded={menuOpen}
              className="sm:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface transition-colors"
            >
              {menuOpen ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5m-16.5 5.25h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              )}
            </button>
          </div>
          {/* mobile menu panel */}
          {menuOpen && (
            <div className="sm:hidden flex flex-col gap-3 border-t border-border py-3">
              {/* Force the SDK wallet button to fill the row — its connected
                  state renders an inline-block pill that would otherwise sit
                  left with dead space beside it. */}
              <div className="[&_.wallet-wrapper]:block [&_.wallet-wrapper]:w-full [&_.wallet-btn]:w-full [&_.wallet-btn]:justify-center [&_.wallet-login-btn]:w-full [&_.wallet-login-btn]:justify-center">
                <WalletButton />
              </div>
              <NetworkToggle
                block
                network={stellarNetwork}
                onSelect={selectNetwork}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setKeyModalOpen(true);
                    setMenuOpen(false);
                  }}
                  title={t.shell.apiKeyTitle}
                  className="flex flex-1 h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      isCustomKey ? 'bg-success' : 'bg-muted-light'
                    }`}
                  />
                  {t.shell.apiKey}
                </button>
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 lg:flex lg:gap-8">
        {/* sidebar: grouped under section headers (desktop) */}
        <aside className="hidden lg:block w-56 shrink-0 self-start lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto py-8 space-y-6">
          {navGroups()}
        </aside>

        <div className="min-w-0 flex-1">
          {/* group selector (mobile/tablet): the sidebar collapses behind a
              burger button that opens the full grouped nav in a left drawer. */}
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label={t.shell.openMenu}
            aria-expanded={navOpen}
            className="lg:hidden mt-4 flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            <svg
              className="h-4 w-4 shrink-0 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5m-16.5 5.25h16.5m-16.5 5.25h16.5"
              />
            </svg>
            <span className="min-w-0 flex-1 truncate text-left">
              {activeGroup ? t.nav.groups[activeGroup.key] : t.shell.browse}
            </span>
            <svg
              className="h-4 w-4 shrink-0 text-muted-light"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19.5 8.25-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>

          {/* A "soon" group blurs its whole body — tabs included — behind the
              ComingSoon overlay; otherwise the tabs + content render normally. */}
          {activeGroup?.soon ? (
            <ComingSoon logo={GROUP_LOGOS[activeGroup.key]}>
              {groupBody}
            </ComingSoon>
          ) : (
            groupBody
          )}
        </div>
      </div>

      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          {/* backdrop — tap to dismiss */}
          <button
            type="button"
            aria-label={t.shell.closeMenu}
            onClick={() => setNavOpen(false)}
            className="animate-backdrop-in absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          {/* panel */}
          <div className="animate-drawer-in absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">
                {t.shell.browse}
              </span>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label={t.shell.closeMenu}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-2 py-4">
              {navGroups(() => setNavOpen(false))}
            </div>
          </div>
        </div>
      )}

      {keyModalOpen && (
        <ApiKeyModal
          currentKey={apiKey}
          isCustom={isCustomKey}
          onClose={() => setKeyModalOpen(false)}
          onSave={applyApiKey}
        />
      )}

      {originBlocked && (
        <OriginNotAllowedModal
          origin={typeof window !== 'undefined' ? window.location.origin : ''}
          onClose={() => setOriginBlocked(false)}
        />
      )}

      {keyInvalid && (
        <InvalidApiKeyModal
          apiKey={apiKey}
          onClose={() => setKeyInvalid(false)}
        />
      )}

      {networkLocked && (
        <NetworkLockedModal
          onClose={() => setNetworkLocked(false)}
          onChangeKey={() => {
            setNetworkLocked(false);
            setKeyModalOpen(true);
          }}
        />
      )}
    </AppWalletProvider>
  );
}

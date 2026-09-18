"use client";

// The pool detail experience, as a modal instead of a route: header + stats,
// the Overview / Advanced / Activity tabs, and the action panel whose tabs are
// driven by the pool's `supportedActions` (Blend lends/borrows, Aqua is a
// two-sided AMM deposit). Every on-chain call goes through Pollar's runTx.

import { usePollar } from "@pollar/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/app/_i18n/LanguageProvider";
import {
  nekoGet,
  recordAudit,
  type ContractActivity,
  type PoolEntry,
  type PoolRatePoint,
  type Positions,
  type PriceMap,
} from "./_lib";
import { fmtPct, fmtUsd, shortHash } from "./_format";
import { toRaw, type ScArg } from "./_vault";
import { useNekoMainnet } from "./_MainnetGate";
import { TokenBadge, TokenBadges } from "./_ui";
import {
  aquaClaimArgs,
  aquaDepositArgs,
  aquaWithdrawArgs,
  blendAssetAddress,
  blendClaimArgs,
  blendLendRequests,
  blendPositionOf,
  blendSubmitArgs,
  blendWithdrawRequests,
  collateralOptions,
  poolActions,
  poolContractId,
  REQUEST_TYPE,
  type BlendRequest,
} from "./_poolActions";
import { poolBorrowApy, poolSupplyApy, poolUsdLabel } from "./_poolData";

type InfoTab = "overview" | "advanced" | "activity";
type Result = { status: string; hash?: string; error?: string };

// Neko records pool actions in its audit log; `lend_deposit` is the one shape we
// can see in existing records, so borrow/repay reuse Neko's own on-chain event
// vocabulary (see /v1/contract-activity) rather than inventing new names.
const AUDIT_ACTION: Record<string, string> = {
  lend: "lend_deposit",
  deposit: "lend_deposit",
  withdraw: "lend_withdraw",
  borrow: "borrow",
  repay: "repay",
  claim: "claim_rewards",
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-2.5 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs font-medium text-foreground">{children}</span>
    </div>
  );
}

// An amount input with the wallet's spendable balance and a MAX fill. `max` is
// null when the ceiling isn't knowable for that action (e.g. how much you can
// borrow depends on the collateral you post).
function AmountField({
  code,
  value,
  onChange,
  max,
  disabled,
  maxLabel,
  invalid = false,
}: {
  code: string;
  value: string;
  onChange: (v: string) => void;
  max: number | null;
  disabled: boolean;
  maxLabel: string;
  invalid?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <TokenBadge symbol={code} size={18} /> {code}
        </span>
        {max != null && (
          <span className="text-[11px] font-mono text-muted-light">
            {max.toLocaleString(undefined, { maximumFractionDigits: 7 })} {code}
          </span>
        )}
      </div>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          disabled={disabled}
          className={`w-full rounded-lg border bg-transparent px-3 py-2 pr-14 text-sm font-mono outline-none placeholder:text-muted-light ${
            invalid
              ? "border-error focus:border-error"
              : "border-border focus:border-primary"
          }`}
        />
        {max != null && max > 0 && (
          <button
            type="button"
            onClick={() => onChange(String(max))}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-surface px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary-light"
          >
            {maxLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  valueClass = "text-foreground",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-light">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${valueClass}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-light">{sub}</p>}
    </div>
  );
}

export function PoolDetailModal({
  pool,
  allPools,
  prices,
  positions,
  onClose,
  onDone,
  onRefresh,
}: {
  pool: PoolEntry;
  allPools: PoolEntry[];
  prices: PriceMap | null;
  positions: Positions | null;
  onClose: () => void;
  onDone: () => void;
  /** Reloads the parent's catalog/prices/positions, which this modal reads. */
  onRefresh: () => Promise<void> | void;
}) {
  const { t } = useI18n();
  const p = t.nekoPools;
  const {
    wallet,
    getClient,
    openTxModal,
    walletBalance,
    refreshWalletBalance,
  } = usePollar();
  const walletAddress = wallet?.address ?? "";
  const isMainnet = useNekoMainnet();

  const isBlend = pool.type === "blend";
  const actions = useMemo(() => poolActions(pool), [pool]);

  const [infoTab, setInfoTab] = useState<InfoTab>("overview");
  const [action, setAction] = useState(actions[0] ?? "");
  const [rates, setRates] = useState<PoolRatePoint[]>([]);
  const [activity, setActivity] = useState<ContractActivity | null>(null);
  const [rateKind, setRateKind] = useState<"supply" | "borrow">("supply");
  const [copied, setCopied] = useState(false);

  // amounts — Aqua deposits are two-sided, so amounts are per pool token
  const [amount, setAmount] = useState("");
  const [amount2, setAmount2] = useState("");
  const [collateral, setCollateral] = useState("");
  const [collateralAmount, setCollateralAmount] = useState("");

  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const collOptions = useMemo(
    () => collateralOptions(pool, allPools),
    [pool, allPools],
  );
  // Default to the first sibling reserve until the user picks one — derived
  // rather than seeded via an effect, which would cascade an extra render.
  const activeCollateral = collateral || (collOptions[0]?.id ?? "");

  useEffect(() => {
    if (walletBalance.step === "idle") refreshWalletBalance().catch(() => {});
  }, [walletBalance.step, refreshWalletBalance]);

  // Pool-scoped reads: APY history (Advanced) and on-chain events (Activity).
  const loadDetail = useCallback(async () => {
    const id = encodeURIComponent(pool.id);
    const [r, a] = await Promise.allSettled([
      nekoGet<PoolRatePoint[]>(`/v1/pool-rates/${id}`),
      nekoGet<ContractActivity>(`/v1/contract-activity/${id}`),
    ]);
    setRates(r.status === "fulfilled" && Array.isArray(r.value) ? r.value : []);
    setActivity(a.status === "fulfilled" ? a.value : null);
  }, [pool.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDetail();
  }, [loadDetail]);

  // Everything the modal shows: its own reads (rates/activity), the wallet's
  // balances, and the parent's catalog/prices/positions — which is what feeds
  // the withdraw/repay ceilings.
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      loadDetail(),
      refreshWalletBalance(),
      onRefresh(),
    ]);
    setRefreshing(false);
  }, [loadDetail, refreshWalletBalance, onRefresh]);

  const balanceOf = useCallback(
    (code: string): number | null => {
      if (walletBalance.step !== "loaded") return null;
      const rec = walletBalance.data.balances.find((b) => b.code === code);
      // A null `balance` means the chain couldn't be read, not an empty wallet —
      // keep it as "unknown" instead of letting Number(null) report a real 0.
      return rec?.balance != null ? Number(rec.balance) : null;
    },
    [walletBalance],
  );

  const token0 = pool.tokens[0];
  const token1 = pool.tokens[1];
  const collPool = collOptions.find((c) => c.id === activeCollateral);

  // This wallet's stake in the reserve, split by bucket. It decides both the
  // withdraw request_type and the ceilings shown on the withdraw/repay fields.
  const blendPos = useMemo(
    () => blendPositionOf(pool, positions),
    [pool, positions],
  );
  const dec0 = token0?.decimals ?? 7;
  const scale = (v: bigint) => Number(v) / 10 ** dec0;

  // `null` means "not known yet" — positions load after the catalog, and a 0
  // ceiling would otherwise be indistinguishable from an empty position (which
  // silently disabled the MAX button and skipped validation entirely).
  const posLoaded = positions != null;
  const maxWithdraw = posLoaded
    ? scale(blendPos.supplied + blendPos.collateral)
    : null;
  const maxRepay = posLoaded ? scale(blendPos.liabilities) : null;

  // The ceiling that applies to the amount field for the action on screen.
  const walletMax = balanceOf(token0?.code ?? "");
  const activeMax = useMemo(() => {
    if (isBlend && action === "withdraw") return maxWithdraw;
    if (action === "repay") {
      // You can't repay more than you owe, nor more than you hold.
      if (maxRepay == null) return walletMax;
      return walletMax == null ? maxRepay : Math.min(maxRepay, walletMax);
    }
    return walletMax;
  }, [isBlend, action, maxWithdraw, maxRepay, walletMax]);

  // Compare at the asset's precision so a MAX fill never trips its own check.
  const overMax =
    activeMax != null &&
    !!amount.trim() &&
    Number(amount) - activeMax > 1 / 10 ** dec0;
  const overMaxMsg =
    action === "withdraw" || action === "repay"
      ? t.nekoVaults.exceedsPosition
      : t.nekoVaults.exceedsBalance;

  const chartData = useMemo(
    () =>
      rates.map((pt) => ({
        t: new Date(pt.recorded_at).getTime(),
        supply: pt.supply_apy,
        borrow: pt.borrow_apy,
      })),
    [rates],
  );
  const hasBorrowSeries = chartData.some((d) => d.borrow != null);

  async function run() {
    if (!walletAddress) return;
    setError(null);
    setResult(null);

    // Never sign an amount the user didn't actually ask for: the Blend request
    // builders clamp to the position, so submitting an over-max amount would
    // silently move a different number than the one on screen.
    if (overMax) {
      setError(overMaxMsg);
      return;
    }

    try {
      const contractId = poolContractId(pool);
      if (!contractId) throw new Error("Missing pool contract id");

      let method: string;
      let args: ScArg[];
      let auditAmount = Number(amount) || 0;
      const auditAsset = token0?.code ?? "";

      if (action === "claim") {
        // Aqua's claim takes just the user; Blend needs the emission token ids,
        // which only the wallet's own position knows (`claimedTokens`).
        if (isBlend && blendPos.claimTokens.length === 0) {
          throw new Error(p.noRewards);
        }
        method = "claim";
        args = isBlend
          ? blendClaimArgs(walletAddress, blendPos.claimTokens)
          : aquaClaimArgs(walletAddress);
        auditAmount = 0;
      } else if (isBlend) {
        const asset = blendAssetAddress(pool);
        const dec = token0?.decimals ?? 7;
        const raw = toRaw(amount || "0", dec);
        if (raw <= BigInt(0)) throw new Error(p.enterAmount);

        const requests: BlendRequest[] = [];
        if (action === "lend") {
          requests.push(...blendLendRequests(asset, raw));
        } else if (action === "withdraw") {
          // The request_type depends on which bucket the funds are in — a plain
          // supply withdraws with type 1, collateral with type 3.
          requests.push(...blendWithdrawRequests(asset, raw, blendPos));
        } else if (action === "repay") {
          requests.push({ asset, amount: raw, type: REQUEST_TYPE.repay });
        } else if (action === "borrow") {
          // Borrow posts collateral and draws the loan in ONE submit — this is
          // exactly what Neko's own borrow transactions do on-chain.
          if (collPool && Number(collateralAmount) > 0) {
            requests.push({
              asset: blendAssetAddress(collPool),
              amount: toRaw(
                collateralAmount,
                collPool.tokens[0]?.decimals ?? 7,
              ),
              type: REQUEST_TYPE.supplyCollateral,
            });
          }
          requests.push({ asset, amount: raw, type: REQUEST_TYPE.borrow });
        } else {
          throw new Error(`Unsupported action: ${action}`);
        }
        method = "submit";
        args = blendSubmitArgs(walletAddress, requests);
      } else if (action === "deposit") {
        const a0 = toRaw(amount || "0", token0?.decimals ?? 7);
        const a1 = toRaw(amount2 || "0", token1?.decimals ?? 7);
        if (a0 <= BigInt(0) && a1 <= BigInt(0)) throw new Error(p.enterAmount);
        method = "deposit";
        args = aquaDepositArgs(walletAddress, [a0, a1]);
      } else {
        // Aqua withdraw burns LP shares (7dp), not an underlying amount.
        const shares = toRaw(amount || "0", 7);
        if (shares <= BigInt(0)) throw new Error(p.enterAmount);
        method = "withdraw";
        args = aquaWithdrawArgs(walletAddress, shares, pool.tokens.length);
      }

      setBusy(true);
      openTxModal();
      const outcome = await getClient().runTx("invoke_contract", {
        contractId,
        method,
        args,
      } as never);

      const status =
        outcome.status === "success"
          ? "SUCCESS"
          : outcome.status === "pending"
            ? "PENDING"
            : "FAILED";
      setResult({
        status,
        hash: "hash" in outcome ? outcome.hash : undefined,
        error: "details" in outcome ? outcome.details : undefined,
      });

      if (outcome.status === "success") {
        // Record it so Neko's audit log stays in sync with the chain. Unlike the
        // vault flow this is awaited and surfaced — a silently dropped audit is
        // what left the vault ledger out of sync before.
        try {
          await recordAudit({
            wallet_address: walletAddress,
            action_type: AUDIT_ACTION[action] ?? action,
            asset_in: auditAsset,
            token_amount_in: auditAmount,
            asset_out: null,
            amount_out: null,
            pool_id: pool.id,
            tx_hash: outcome.hash ?? "",
          });
        } catch (e) {
          setError(
            `${p.auditFailed} ${
              e instanceof Error ? e.message : String(e)
            } — tx ${outcome.hash ?? "?"}`,
          );
        }
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <TokenBadges symbols={pool.tokens.map((tk) => tk.code)} size={34} />
            <div>
              <h2 className="text-lg font-bold text-foreground">{pool.name}</h2>
              <div className="mt-0.5 flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(pool.id);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                  className="font-mono text-[10px] text-muted-light hover:text-foreground"
                  title={pool.id}
                >
                  {shortHash(pool.id, 10, 4)} {copied ? "✓" : "⧉"}
                </button>
                <span className="text-[10px] text-muted-light">
                  {t.nekoVaults.stellar}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshAll}
              disabled={refreshing}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-40"
            >
              {refreshing ? p.loading : p.refresh}
            </button>
            <button
              onClick={onClose}
              className="text-sm text-muted hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </div>

        {/* stats */}
        <div className="mt-5 grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-4">
          <Stat
            label={p.liquidity}
            value={poolUsdLabel(pool.tvl, token0, prices)}
          />
          {isBlend ? (
            <Stat
              label={p.borrowed}
              value={poolUsdLabel(
                pool.metadata?.totalLiabilities,
                token0,
                prices,
              )}
            />
          ) : (
            <Stat
              label={p.poolType}
              value={
                <span className="text-base">
                  {String(pool.metadata?.aquaPoolType ?? "—").replace("_", " ")}
                </span>
              }
            />
          )}
          <Stat
            label={p.supplyApy}
            value={fmtPct(poolSupplyApy(pool))}
            valueClass="text-success"
          />
          {isBlend ? (
            <Stat label={p.borrowApy} value={fmtPct(poolBorrowApy(pool))} />
          ) : (
            <Stat
              label={p.issuer}
              value={<span className="text-base">Aqua</span>}
            />
          )}
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* ── info tabs ── */}
          <div>
            <div className="flex gap-4 border-b border-border">
              {(["overview", "advanced", "activity"] as InfoTab[]).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setInfoTab(tab)}
                    className={`-mb-px border-b-2 px-1 pb-2 text-xs font-medium transition-colors ${
                      infoTab === tab
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted hover:text-foreground"
                    }`}
                  >
                    {p[tab]}
                  </button>
                ),
              )}
            </div>

            {infoTab === "overview" && (
              <div className="mt-4">
                <p className="mb-1 text-xs text-muted">{p.marketAttributes}</p>
                {isBlend ? (
                  <>
                    <Row label={p.collateral}>{token0?.code}</Row>
                    <Row label={p.collateralFactor}>
                      {fmtPct((pool.metadata?.cFactor as number) * 100)}
                    </Row>
                    <Row label={p.liabilityFactor}>
                      {fmtPct((pool.metadata?.lFactor as number) * 100)}
                    </Row>
                    <Row label={p.utilization}>
                      {fmtPct((pool.metadata?.utilization as number) * 100)}
                    </Row>
                    <Row label={p.oraclePrice}>
                      {token0?.code} ={" "}
                      {prices?.prices?.[token0?.code ?? ""]?.price != null
                        ? fmtUsd(prices.prices[token0.code].price)
                        : "—"}
                    </Row>
                  </>
                ) : (
                  <>
                    {pool.tokens.map((tk, i) => (
                      <Row key={tk.address} label={`${p.token} ${i + 1}`}>
                        {tk.code}
                      </Row>
                    ))}
                    <Row label={p.poolType}>
                      {String(pool.metadata?.aquaPoolType ?? "—").replace(
                        "_",
                        " ",
                      )}
                    </Row>
                    <Row label={p.fee}>{String(pool.metadata?.fee ?? "—")}</Row>
                  </>
                )}
              </div>
            )}

            {infoTab === "advanced" && (
              <div className="mt-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted">{p.instantRate}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {fmtPct(
                        rateKind === "supply"
                          ? poolSupplyApy(pool)
                          : poolBorrowApy(pool),
                      )}
                    </p>
                  </div>
                  {hasBorrowSeries && (
                    <div className="flex gap-1">
                      {(["borrow", "supply"] as const).map((k) => (
                        <button
                          key={k}
                          onClick={() => setRateKind(k)}
                          className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
                            rateKind === k
                              ? "bg-primary text-white"
                              : "bg-surface text-muted"
                          }`}
                        >
                          {k === "borrow" ? p.borrowApy : p.supplyApy}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {chartData.length === 0 ? (
                  <p className="py-8 text-center text-xs font-mono text-muted-light">
                    {p.noRates}
                  </p>
                ) : (
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="currentColor"
                          className="text-border"
                        />
                        <XAxis
                          dataKey="t"
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                            })
                          }
                          tick={{ fontSize: 10 }}
                          stroke="currentColor"
                          className="text-muted-light"
                        />
                        <YAxis
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontSize: 10 }}
                          width={44}
                          stroke="currentColor"
                          className="text-muted-light"
                        />
                        <Tooltip
                          formatter={(v) => [
                            typeof v === "number" ? `${v.toFixed(4)}%` : "—",
                            "",
                          ]}
                          labelFormatter={(v) => new Date(v as string | number).toLocaleString()}
                        />
                        <Line
                          type="monotone"
                          dataKey={rateKind}
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {infoTab === "activity" && (
              <div className="mt-4 max-h-72 overflow-y-auto">
                {!activity?.events?.length ? (
                  <p className="py-8 text-center text-xs font-mono text-muted-light">
                    {p.noActivity}
                  </p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-light">
                        <th className="py-2 font-medium">{p.date}</th>
                        <th className="py-2 font-medium">{p.type}</th>
                        <th className="py-2 text-right font-medium">
                          {p.amountCol}
                        </th>
                        <th className="py-2 text-right font-medium">
                          {p.user}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.events.slice(0, 50).map((e) => (
                        <tr
                          key={e.id}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2 font-mono text-muted-light">
                            {new Date(e.ts * 1000).toLocaleString()}
                          </td>
                          <td className="py-2 text-foreground">{e.type}</td>
                          <td className="py-2 text-right font-mono text-foreground">
                            {e.amount?.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            }) ?? "—"}
                          </td>
                          <td className="py-2 text-right font-mono text-muted-light">
                            {shortHash(e.user, 4, 4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* ── action panel ── */}
          <div className="rounded-2xl border border-border p-4">
            {actions.length === 0 ? (
              <p className="text-xs text-muted">{p.noActions}</p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-1">
                  {actions.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAction(a)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        action === a
                          ? "bg-primary text-white"
                          : "border border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {p[a as keyof typeof p] ?? a}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {action === "claim" ? (
                    <p className="text-xs text-muted">{p.claimNote}</p>
                  ) : (
                    <>
                      <AmountField
                        code={token0?.code ?? ""}
                        value={amount}
                        onChange={setAmount}
                        max={activeMax}
                        invalid={overMax}
                        disabled={busy}
                        maxLabel={t.nekoVaults.maxBtn}
                      />
                      {overMax && (
                        <p className="text-[11px] font-mono text-error">
                          {overMaxMsg}
                        </p>
                      )}

                      {/* Aqua deposits are two-sided: one amount per pool token */}
                      {!isBlend && action === "deposit" && token1 && (
                        <AmountField
                          code={token1.code}
                          value={amount2}
                          onChange={setAmount2}
                          max={balanceOf(token1.code)}
                          disabled={busy}
                          maxLabel={t.nekoVaults.maxBtn}
                        />
                      )}

                      {/* Borrowing requires posting collateral from another reserve */}
                      {isBlend && action === "borrow" && (
                        <div className="rounded-xl bg-surface p-3">
                          <p className="mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-light">
                            {p.collateral}
                          </p>
                          <div className="mb-2 flex flex-wrap gap-1">
                            {collOptions.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => setCollateral(c.id)}
                                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                                  activeCollateral === c.id
                                    ? "bg-primary text-white"
                                    : "border border-border text-muted"
                                }`}
                              >
                                <TokenBadge
                                  symbol={c.tokens[0].code}
                                  size={16}
                                />
                                {c.tokens[0].code}
                              </button>
                            ))}
                          </div>
                          {collPool && (
                            <AmountField
                              code={collPool.tokens[0].code}
                              value={collateralAmount}
                              onChange={setCollateralAmount}
                              max={balanceOf(collPool.tokens[0].code)}
                              disabled={busy}
                              maxLabel={t.nekoVaults.maxBtn}
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* summary */}
                  <div className="space-y-1 border-t border-border pt-3">
                    <Row label={p.network}>{t.nekoVaults.stellar}</Row>
                    {isBlend ? (
                      <>
                        <Row label={p.collateralFactor}>
                          {fmtPct((pool.metadata?.cFactor as number) * 100)}
                        </Row>
                        <Row
                          label={
                            action === "borrow" || action === "repay"
                              ? p.borrowApy
                              : p.supplyApy
                          }
                        >
                          {fmtPct(
                            action === "borrow" || action === "repay"
                              ? poolBorrowApy(pool)
                              : poolSupplyApy(pool),
                          )}
                        </Row>
                      </>
                    ) : (
                      <Row label={p.supplyApy}>
                        {fmtPct(poolSupplyApy(pool))}
                      </Row>
                    )}
                  </div>

                  <button
                    onClick={run}
                    disabled={busy || !isMainnet || !walletAddress || overMax}
                    className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
                  >
                    {busy
                      ? t.nekoVaults.working
                      : ((p[action as keyof typeof p] as string) ?? action)}
                  </button>

                  {error && (
                    <p className="break-all text-xs font-mono text-error">
                      {error}
                    </p>
                  )}
                  {result && (
                    <div className="rounded-lg border border-border bg-surface p-3">
                      <p className="text-xs font-mono">
                        <span className="text-muted">
                          {t.nekoVaults.statusCol}:{" "}
                        </span>
                        <span
                          className={`font-semibold ${
                            result.status === "SUCCESS"
                              ? "text-success"
                              : result.status === "FAILED"
                                ? "text-error"
                                : "text-warning"
                          }`}
                        >
                          {result.status}
                        </span>
                      </p>
                      {result.hash && (
                        <p className="mt-1 break-all font-mono text-[10px] text-muted-light">
                          {t.nekoVaults.txLabel}: {result.hash}
                        </p>
                      )}
                      {result.error && (
                        <p className="mt-1 break-all font-mono text-[10px] text-error">
                          {result.error}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

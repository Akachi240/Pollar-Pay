# Pollar Pay — Product Requirements Document

*Set the rules once. Let your money follow them.*

Pollar Hackathon — "Build on Pollar" · Prepared by Aka (Akachi Chukwuma) · Sep 16–18, 2026

> **This is the source-of-truth PRD for the Antigravity workspace.** Prompts, tests, and code should defer to this document over any earlier draft.

---

## 1. The Product, in One Sentence

The product is the **Pollar Pay rules engine**, a programmable money app that turns financial routines into rules.

Three modes for the hackathon, demonstrating different rule sets:

- **PERSONAL** — One wallet → rule-defined destinations.
- **AJO** — Many wallets → coordinated contribution + rotating payout. (Ajo is the flagship live demonstration of the engine).
- **SHARED GOAL** (roadmap only, not built this hackathon) — Many wallets → flexible contributions toward a named purpose with release conditions.

## 2. The Problem

**Personal** — People already know what they want their money to do. The problem is repeated manual execution — saving, paying bills, contributing to savings groups, moving money between accounts, every single time money comes in.

**Ajo** — Ajo groups already understand the model. The problem is that coordination and execution are manual: tracking contributions, remembering whose turn it is, calculating the pot, chasing people on WhatsApp.

## 3. Our Solution

A rules engine sitting on top of Pollar's wallet and transaction infrastructure.

### Relatable Templates
Users create a money rule by choosing a purpose template and answering a short guided form (not free-form rule language). Templates must feel local and useful:
- Family Support
- Class / Group Contribution
- Burial / Emergency Fund
- Birthday / Wedding
- Church / Project Building Fund
- Personal Budget Split
- Classic Rotating Ajo
- Custom

**UX principle to follow:** People should describe what they want their money to do, not program the behaviour themselves. A Money Policy is the human-readable intent; the rules engine translates that intent into deterministic financial actions.

**Personal Budget Policy**

- When my money becomes available:
  - 20% goes to Savings
  - 10 XLM goes to Giving
  - the remainder stays for Spending.

**Family Support Policy**

- Set aside a fixed amount for Mum whenever my monthly money becomes available.

- Every 25th of the month: 20% → Savings, 30 XLM → Ajo, 50 XLM → Rent, remainder → Spending.

**Ajo Money Policy**

- 5 members, 10 XLM/week, rotating payout, predetermined order — the rules engine determines when a payout is eligible; the demo triggers execution manually. *(Hackathon uses native XLM — see note after §6.)*

**Class Contribution Policy**

- Let members contribute different amounts toward a common target and release the funds according to the group's policy.

**Project / Event Policy**

- Collect contributions for a named purpose and release the funds when the configured conditions are satisfied.

## 4. What Pollar Does vs. What We Build

Verified directly against docs.pollar.xyz — critical for the dev team, since nobody should spend hours recreating something Pollar already provides, or assume it provides something it doesn't.

| **Pollar provides (SDK)** | **We build (our product logic)** |
|---|---|
| Login + wallet creation per user (`login({ provider })`) | Rules engine (Personal splits, Ajo cycles) |
| Sending — `runTx('payment', {...})`, one call per transfer | Contribution tracking & payout-order logic |
| Transaction history — via state subscriptions (`getTxHistoryState()` / `onTxHistoryStateChange()`), not a `fetchTxHistory()` call | Circle / cycle state machine |
| Balances — `refreshWalletBalance()` | Validation (overspend, % totals, payout gating) |
| Earn (Blend / DeFindex yield) | Business-model layer (see §13) |
| Distribution Rules modal — CLAIM only, not push (see note below) | Multi-destination split execution (loop of `runTx` calls) |

**Important correction:** Pollar's Distribution Rules feature (`DistributionRulesModal` / `listDistributionRules` / `claimDistributionRule`) is a CLAIM flow, not a push flow. You configure claimable rules in the Dashboard and users pull from a distribution wallet — there is no app-initiated "send to 5 people by percentage" primitive. This means our Personal-mode splitting and Ajo payouts must be built entirely as our own logic: one `runTx('payment', ...)` call per destination/recipient. Current understanding: Pollar's Distribution Rules APIs are claim-based. Our MVP should not depend on them for push-based multi-recipient execution. **Re-test against the installed SDK version before implementation** — do not assume this PRD's API descriptions are still identical to what's installed.

**Starting point — don't build from scratch**

Clone `github.com/pollar-xyz/demo-nextjs` as the project skeleton. It already has `PollarProvider` setup, login, send, and transaction history wired correctly — saves Hour 0–3 of boilerplate. Live reference: `demo-nextjs.pollar.xyz` (testnet).

## 5. User Journey — Personal

**Pipeline:** MONEY POLICY &rarr; RULES &rarr; CONDITIONS &rarr; CALCULATION &rarr; VALIDATION &rarr; ACTION &rarr; HISTORY (same conceptual pipeline as Ajo).

Login &rarr; Dashboard &rarr; Personal &rarr; Create a Money Policy (Choose guided template) &rarr; Add allocations &rarr; What the policy produces &rarr; Preview &rarr; Activate &rarr; Policy saved &rarr; Execute manually (hackathon - *no real execution unless already supported without new complexity*) &rarr; Transactions &rarr; Transaction history

**Worked example — 300 XLM available balance**

| **Destination** | **Rule** | **Amount** |
|---|---|---|
| Savings | 20% | 60 XLM |
| Rent | Fixed | 50 XLM |
| Ajo | Fixed | 30 XLM |
| Spending | Remainder | 160 XLM |

*(All amounts are in XLM throughout, matching the hackathon implementation. Earlier drafts mixed in ₦-naira and USDC figures using the same digits — those were units errors, not real naira/USDC examples; if a fiat- or USDC-denominated version is ever wanted for pitch framing, it must be explicitly labeled "conceptual, not executed." See the asset-choice rationale in §6.)*

The system previews this allocation before the user activates it.

## 6. User Journey — Ajo (Hero Demo)

*Ajo is one Money Policy expressed through the engine.*

Dashboard → Ajo → Create Circle → Set contribution → Set frequency → Add members → Set payout order → Circle created → Members contribute → Pot updates → All contributions received → Payout eligible → Recipient paid → Next cycle begins

**Worked example — 5 members × 10 XLM**

- Pot per cycle: 50 XLM
- Cycle 1 → Ada receives 50 XLM
- Cycle 2 → Chika receives 50 XLM
- ...continues through payout order

> **Hackathon asset choice — native XLM, not USDC**
>
> The rules engine is asset-agnostic (the `Asset` type supports native, credit, and custom assets). For the hackathon Ajo demo, native XLM is used instead of USDC because:
>
> 1. No verified Stellar testnet USDC issuer address was found in the installed Pollar SDK (`@pollar/core`, `@pollar/react`) or the `demo-nextjs` starter repository.
> 2. USDC would require establishing trustlines on every recipient wallet before payments can be received, adding setup complexity and a failure surface.
> 3. Native XLM requires zero trustlines, is directly funded by Stellar testnet Friendbot, and is fully supported by the existing Pollar `runTx('payment', ...)` path.
>
> A production build could adopt USDC or any other Stellar asset once issuer addresses and trustline provisioning are confirmed. The engine, adapter, and executor code require no changes — only the `asset` parameter passed to `runTx` would differ.

## 7. Screen Inventory

Not all of these are separate pages — several are states within one screen. Screens marked (MVP) are what we actually build this hackathon.

**Shared**
- Landing / Homepage (MVP): 
  1. Pollar Pay
  2. Tagline: "Set the rules once. Let your money follow them."
  3. Mode Cards: Personal / Ajo / Shared Goal (Ajo visually prominent as flagship live proof).
  4. Compact engine pipeline
- Authentication — via Pollar's built-in login (MVP)
- Dashboard (MVP)
- Wallet (MVP — via Pollar `WalletButton`)
- Transactions (MVP — via Pollar `TxHistoryModal`)

**Ajo**
- Ajo overview (MVP)
- Create circle (MVP)
- Circle details / contribution status (MVP)
- Payout status + Execute Payout action (MVP)
- Cycle history (MVP, can be a tab within circle details)

**Personal** (stretch — build only if Ajo is fully working first)
- Personal overview
- Create a Money Policy / allocation builder
- Rule preview + activate

**Shared Goal** (roadmap — mockup only, explicitly static/not functional)
- One static screen showing broader use cases (class contributions, burial/emergency, birthday/wedding, church/project building, trust/family funds): goal name, target, current amount, release date, contributors, status — no working logic behind it.

## 8. MVP Definition

**MUST WORK**
- Pollar: auth, wallet, balance, one real send on testnet, transaction history
- Ajo: create circle, add members, track contributions, payout gate, execute payout, advance cycle

**NICE TO HAVE (High-leverage stretch items)**
- Personal mode fully functional
- Countdown to next payout
- Notifications
- Polished empty/loading/error states
- Real Stellar Testnet transaction card with explorer link
- One additional Pollar surface if time allows (live balance or transaction history prominence or a static Earn/Yield teaser)
- Short "Why Pollar" explanation (we didn't build wallets/auth/settlement — Pollar gave us the rails, we built the rules layer)
- Visual consistency between Personal and Ajo (same pipeline language)

**NOT BUILDING**
- AI financial adviser · investment platform · lending · chat · social feed
- Full KYC flow (Pollar's `KycModal` is UI-preview only — do not depend on it)
- Mobile app · crypto exchange
- Cross-border LatAm demo (Do NOT add corridor functionality. At most, add a clearly marked roadmap note that the same rules layer could eventually sit on top of an Africa–Latin America payment corridor).

## 9. Team Structure & Roles

| **Role** | **Owns** | **Notes** |
|---|---|---|
| You (Product Lead) | Rules engine logic, Pollar integration proof-of-concept, final integration, demo/pitch | Test-run the Pollar SDK + rules engine alone before onboarding the team |
| UI/UX | Wireframes → hi-fi screens for MVP screens, empty/loading/error/success states | Design against the data model in §10, not from memory |
| Dev A — Pollar/Infra | Project setup, `@pollar/react` provider, wallet, send, tx history | Prove one real testnet transaction end-to-end first |
| Dev B — Product Logic | Ajo circle/cycle state, contribution tracking, payout gating, calling the rules engine | Rules engine functions should be pure — no direct Pollar calls |

You + whichever dev is free own final integration — where Dev A's Pollar layer and Dev B's product logic meet is the highest-risk seam.

## 10. Data Model

TypeScript, not Python — Pollar's SDK is JS/TS-native (`@pollar/core`, `@pollar/react`). The rules engine logic below is simple enough to live entirely in TS alongside the frontend.

| **Entity** | **Fields** |
|---|---|
| User | id, name, walletId (Pollar-managed) |
| PersonalRule | id, userId, frequency, executionDate, status, allocations[] |
| Allocation | destination, type: 'percentage' \| 'fixed', value |
| AjoCircle | id, name, contributionAmount, frequency, members[], payoutOrder[], currentCycle, status |
| Contribution | circleId, memberId, amount, cycle, status, pollarTransactionId |
| Payout | circleId, recipientId, cycle, amount, status, pollarTransactionId |

*(See `docs/DATA_MODEL.md` for the full TypeScript type file.)*

## 11. The Rules Engine (Core Product Logic)

Pure functions — no ML, no Python needed. They take state in and return a plan out; a separate thin executor layer loops over that plan calling Pollar's `runTx('payment', ...)` once per destination/recipient (confirmed: Pollar has no native multi-recipient split — see §4). This separation lets the math be unit-tested with zero Pollar dependency, and lets Dev A and Dev B build in parallel.

```
function executePersonalRule(availableBalance, allocations) {
  ...calculates amounts per destination, validates total does not exceed
  availableBalance, returns { destinations, remainder }
}

function checkAjoPayout(circle) {
  ...checks all members paid this cycle; if not, returns locked;
  if yes, returns { recipient, amount } from payoutOrder
}

// executor layer — the only part that touches Pollar
async function executePlan(plan, runTx) {
  for (const { destination, amount, asset } of plan.destinations) {
    const result = await runTx('payment', { destination, amount, asset });
    if (result.status === 'error') {
      /* surface result.details, do not continue silently */
    }
  }
}
```

**Validation the engine must enforce**

- No negative remainder (allocations cannot exceed `availableBalance`)
- Percentage allocations must not sum past 100%
- Ajo payout only fires when: every member has contributed for the current cycle AND the current cycle has not already been paid — **this is the single highest-risk piece of logic; read it yourself before demo day, and treat it as critical acceptance logic (see the Contribution Verification Rule in §14), not merely documentation**

**Pollar-specific execution notes**

- No scheduling primitive exists — a scheduled date is our own trigger (demo: manual button; production: cron/backend calling `runTx`)
- Each Ajo member should log in individually (or be simulated via 5 pre-created test accounts) so contributions are wallet-attributed by sender, not by parsing labels — resolves the attribution question from earlier in planning. A contribution is considered received only after a successful payment is recorded for the correct circle, cycle, member, amount, and asset type.
- `runTx` does not throw on failure — always check `result.status === 'error'` and read `result.details`/`resultCode`; do not assume success

## 12. Hackathon Demo Script

Everyone on the team should be able to repeat this — one story, not five unrelated features.

**Opening line**

"Pollar Pay – set the rules once."

**Demo 1 — Personal**

- Pick a template, change one number, show live calculation.

**Demo 2 — Ajo (hero)**

- Show eligibility → real Stellar payout via Pollar → transaction hash.

**Demo 3 — Shared Goal**

- Show static mockup — "Same engine, different rule set (class, burial, church, etc.)."

**Closing line**

"Same rules engine. Multiple financial behaviours. Real money on Pollar."

## 13. Business Model Notes (for Q&A, not built this hackathon)

Ajo's cultural trust model means a visible per-transaction fee undermines the product. **Potential monetization paths to validate:**

- Yield/partner economics: subject to custody, regulatory, product, and Pollar terms, eligible idle funds could potentially generate yield, with disclosed economics supporting the platform (future hypothesis, not MVP), and directly showcases an underused part of the SDK
- Spread on the fiat↔stablecoin on/off-ramp leg, not on the Ajo pot itself
- Freemium tiers (free for small circles; paid for scale, multiple circles, advanced reporting)
- B2B: cooperatives, churches, employers running many circles pay a flat SaaS fee

## 14. Hour-by-Hour Checkpoints

| **Checkpoint** | **Deliverable** | **If missed** |
|---|---|---|
| Hour 0–2 (Technical Spike, hard gate — see below) | SDK verified, one real testnet transaction confirmed | Do not proceed to Ajo build; freeze on Demo mode |
| Hour 2–3 | You: confirm login + tx history working, working solo | Do not onboard the team until this works |
| Hour 3 | Team onboarded with this PRD | — |
| Hour 3–8 | Ajo circle creation, contribution tracking, payout gate | Cut Personal mode entirely |
| Hour 8–12 | Ajo payout execution + UI polish | Cut Shared Goal mockup |
| Hour 12+ | Personal mode (if time), Shared Goal mockup (if time), demo rehearsal | Rehearse Ajo-only demo |

**Submission deadline: September 18, 2026, 1:00 PM UTC.**

### Contribution Verification Rule (Critical acceptance logic — not just documentation)

A member is marked 'paid' **only if ALL** of these are true:

1. Transaction executed and succeeded (`status = 'SUCCESS'`)
2. Sender wallet address matches member's registered wallet
3. Amount ≥ required contribution amount
4. Asset type matches expected asset (e.g., native XLM for hackathon; USDC or other assets in production)
5. Circle ID matches the contribution target
6. Cycle number matches current cycle

IF all members are 'paid' AND current cycle has not been paid → payout eligible.
ELSE → payout locked (no button execution).

> This rule is an **acceptance criterion**, not a nice-to-have comment in the code. Antigravity should write a unit test for each of the six conditions (see `tests/AJO_TEST_CASES.md`) and treat any circle that can be marked 'paid' without satisfying all six as a failed build, not a minor bug.

### 🔧 Payment Adapter Pattern (Architecture for resilience)

To isolate Pollar SDK integration from core business logic and enable emergency fallback:

```typescript
interface PaymentAdapter {
  sendPayment(params: {destination, amount, asset}): Promise<{hash, status}>
}
```

- **Real Adapter:** `PollarPaymentAdapter` → Pollar → Stellar → testnet
- **Demo Adapter:** `DemoPaymentAdapter` → mock deterministic hash, no blockchain

Benefit: If Pollar testnet breaks 2 hours before demo, switch the adapter configuration in one line. The Ajo logic, validation, and UI remain untouched.

**MVP Safety Rule:** The app ships with both adapters wired. REAL mode targets Pollar testnet (production demo). DEMO mode (labeled clearly in UI) is the fallback.

### Definition of Done — Ajo MVP

- ☐ Circle creation UI works with 5 hardcoded members
- ☐ Each member's contribution status is independently tracked
- ☐ Pot total = sum of verified contributions (amount-matched)
- ☐ Payout remains LOCKED while any member is unpaid
- ☐ Correct recipient selected from `payoutOrder[currentCycle]`
- ☐ Duplicate payout prevented — button disabled during execution
- ☐ Payout executes via Pollar (real) or Demo adapter (fallback)
- ☐ Successful payout recorded with transaction hash
- ☐ Cycle advances exactly once after successful payout
- ☐ Failed payout does NOT advance the cycle
- ☐ Team can reproduce entire flow from clean start in <5 min

### Execution Modes: Real vs Demo Fallback

- **REAL mode:** Pollar SDK → `PollarPaymentAdapter` → Stellar testnet → real transaction hash
- **DEMO mode:** `DemoPaymentAdapter` → mock hash → UI shows '[DEMO]' badge, all logic works identically

**MVP rule:** Final demo uses REAL mode if Pollar is stable. Switch to DEMO mode only if Pollar authentication or testnet breaks. No code changes required — configuration switch only.

### Transaction Safety (Partial failure & Idempotency)

For Personal rules with multiple destinations: each destination is a separate `runTx()` call. If one fails after others succeed, the plan state becomes `PARTIAL_FAILURE` and no remaining transfers are silently attempted. The UI shows which destinations succeeded and which failed.

For Ajo (MVP): only one payout transaction per cycle, so partial failure risk is minimal. But duplicate execution is prevented: once a payout executes, the cycle is marked 'paid' and the button is disabled.

### Hour 0–2: Technical Spike with Decision Gate (HARD REQUIREMENT)

**This gate is mandatory. Nothing in §7–11 gets built until it passes.**

You + Dev A work in parallel:

- Clone `pollar-xyz/demo-nextjs`
- Install `@pollar/react`, `@pollar/core`
- Set testnet publishable key in `.env`
- Wire `PollarProvider` at app root
- Confirm login works (Google or email OTP)
- Send ONE real testnet payment via `sendPayment()`
- Verify transaction appears in history

**⚠️ Decision at Hour 2:**

- If Pollar works: continue to real integration (Hour 3–8).
- If Pollar blocks: freeze SDK integration, build against `DemoPaymentAdapter`. Core Ajo logic remains unchanged either way.

*(See `PROMPT_0_TECHNICAL_SPIKE.md` in the workspace root — this is the first instruction Antigravity should receive, before any of `ANTIGRAVITY_PROMPTS_1-10.md`.)*

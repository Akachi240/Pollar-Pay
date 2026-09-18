import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createAjoCircle, recordContribution } from './rules';
import { AjoCircle, AjoMember, Asset, Contribution, Payout } from './types';
import { DemoPaymentAdapter, PollarPaymentAdapter, RunTxFn } from './adapter';
import { executeAjoPayout } from './executor';

const USDC_ASSET: Asset = {
  type: 'credit_alphanum4',
  code: 'USDC',
  issuer: 'GA5ZSEFB3L2BEVJ52HVX25CGBWTLRFQ4DFQAHFA26KBXAED62PCHXMT3',
};

const FIXTURE_MEMBERS: AjoMember[] = [
  { memberId: 'm1', name: 'Member 1', walletAddress: 'G_MEMBER_1', payoutPosition: 0 },
  { memberId: 'm2', name: 'Member 2', walletAddress: 'G_MEMBER_2', payoutPosition: 1 },
  { memberId: 'm3', name: 'Member 3', walletAddress: 'G_MEMBER_3', payoutPosition: 2 },
  { memberId: 'm4', name: 'Member 4', walletAddress: 'G_MEMBER_4', payoutPosition: 3 },
  { memberId: 'm5', name: 'Member 5', walletAddress: 'G_MEMBER_5', payoutPosition: 4 },
];

const FIXTURE_PAYOUT_ORDER = ['m1', 'm2', 'm3', 'm4', 'm5'];

describe('Ajo Payout Executor Unit Tests', () => {
  let circle: AjoCircle;
  let contributions: Contribution[];
  let payouts: Payout[];

  beforeEach(() => {
    circle = createAjoCircle({
      id: 'executor_circle_1',
      name: 'Executor Test Circle',
      contributionAmount: '10',
      asset: USDC_ASSET,
      frequency: 'weekly',
      members: FIXTURE_MEMBERS,
      payoutOrder: FIXTURE_PAYOUT_ORDER,
    });
    contributions = [];
    payouts = [];
  });

  function populateAllContributions(c: AjoCircle, targetList: Contribution[]) {
    for (let i = 0; i < FIXTURE_MEMBERS.length; i++) {
      const m = FIXTURE_MEMBERS[i];
      const contrib = recordContribution(
        c,
        m.memberId,
        '10',
        USDC_ASSET,
        targetList,
        `tx_contrib_c${c.currentCycle}_${m.memberId}`
      );
      targetList.push(contrib);
    }
  }

  it('1. rejects execution when locked because a member has not contributed', async () => {
    // Only 3 of 5 members contribute
    for (let i = 0; i < 3; i++) {
      const m = FIXTURE_MEMBERS[i];
      contributions.push(
        recordContribution(circle, m.memberId, '10', USDC_ASSET, contributions, `tx_${i}`)
      );
    }

    const adapter = new DemoPaymentAdapter();
    const result = await executeAjoPayout({
      circle,
      contributions,
      payouts,
      adapter,
    });

    assert.equal(result.success, false);
    assert.match(result.reason!, /Not all members have contributed/);
    assert.equal(payouts.length, 0); // No payout record created
    assert.equal(result.circle.currentCycle, 0); // Cycle unchanged
  });

  it('2. executes a successful payout through the full lifecycle', async () => {
    populateAllContributions(circle, contributions);
    const adapter = new DemoPaymentAdapter();

    const result = await executeAjoPayout({
      circle,
      contributions,
      payouts,
      adapter,
    });

    assert.equal(result.success, true);
    assert.ok(result.payout);
    assert.equal(result.payout!.status, 'paid');
    assert.ok(result.payout!.transactionHash);
    assert.equal(result.payout!.recipientId, 'm1');
    assert.equal(result.payout!.amount, '50');
    assert.equal(result.circle.currentCycle, 1); // Cycle advanced to 1
  });

  it('3. preserves transaction hash on successful payment execution', async () => {
    populateAllContributions(circle, contributions);
    const mockHash = 'tx_hash_stellar_testnet_abc123';
    const mockRunTx: RunTxFn = async () => ({
      status: 'success',
      hash: mockHash,
    });
    const adapter = new PollarPaymentAdapter(mockRunTx);

    const result = await executeAjoPayout({
      circle,
      contributions,
      payouts,
      adapter,
    });

    assert.equal(result.success, true);
    assert.equal(result.payout!.transactionHash, mockHash);
  });

  it('4. handles Pollar adapter error, marks payout failed, and does NOT advance cycle', async () => {
    populateAllContributions(circle, contributions);
    const adapter = new DemoPaymentAdapter({
      shouldFail: true,
      errorMessage: 'op_underfunded: Insufficient XLM reserve',
    });

    const result = await executeAjoPayout({
      circle,
      contributions,
      payouts,
      adapter,
    });

    assert.equal(result.success, false);
    assert.ok(result.payout);
    assert.equal(result.payout!.status, 'failed');
    assert.match(result.error!, /op_underfunded/);
    assert.equal(payouts.length, 1);
    assert.equal(payouts[0].status, 'failed');
    assert.equal(result.circle.currentCycle, 0); // Cycle remains 0
  });

  it('5. handles adapter thrown exception gracefully, marks payout failed, and does NOT advance cycle', async () => {
    populateAllContributions(circle, contributions);
    const mockRunTxThrows: RunTxFn = async () => {
      throw new Error('Pollar SDK server connection timed out');
    };
    const adapter = new PollarPaymentAdapter(mockRunTxThrows);

    const result = await executeAjoPayout({
      circle,
      contributions,
      payouts,
      adapter,
    });

    assert.equal(result.success, false);
    assert.ok(result.payout);
    assert.equal(result.payout!.status, 'failed');
    assert.equal(result.error, 'Pollar SDK server connection timed out');
    assert.equal(result.circle.currentCycle, 0); // Cycle remains 0
  });

  it('6. handles Pollar pending result, keeps payout pending, and does NOT treat pending as paid or advance cycle', async () => {
    populateAllContributions(circle, contributions);
    const mockRunTxPending: RunTxFn = async () => ({
      status: 'pending',
      hash: 'tx_pending_hash_789',
    });
    const adapter = new PollarPaymentAdapter(mockRunTxPending);

    const result = await executeAjoPayout({
      circle,
      contributions,
      payouts,
      adapter,
    });

    assert.equal(result.success, false);
    assert.ok(result.payout);
    assert.equal(result.payout!.status, 'pending');
    assert.equal(result.payout!.transactionHash, 'tx_pending_hash_789');
    assert.equal(result.circle.currentCycle, 0); // Cycle NOT advanced
  });

  it('7. rejects repeated execution after a pending payout exists', async () => {
    populateAllContributions(circle, contributions);
    const mockRunTxPending: RunTxFn = async () => ({
      status: 'pending',
      hash: 'tx_pending_hash_789',
    });
    const adapter = new PollarPaymentAdapter(mockRunTxPending);

    // First execution leaves payout in 'pending'
    await executeAjoPayout({ circle, contributions, payouts, adapter });
    assert.equal(payouts[0].status, 'pending');

    // Second execution attempt
    const secondResult = await executeAjoPayout({ circle, contributions, payouts, adapter });
    assert.equal(secondResult.success, false);
    assert.match(secondResult.reason!, /already pending/);
    assert.equal(payouts.length, 1); // No second payout added
  });

  it('8. rejects repeated execution after a paid payout exists', async () => {
    populateAllContributions(circle, contributions);
    const adapter = new DemoPaymentAdapter();

    // First execution completes successfully -> status: 'paid'
    const firstResult = await executeAjoPayout({ circle, contributions, payouts, adapter });
    assert.equal(firstResult.success, true);
    assert.equal(payouts[0].status, 'paid');

    // Second execution attempt against the updated circle / payouts list
    const secondResult = await executeAjoPayout({
      circle,
      contributions,
      payouts,
      adapter,
    });

    assert.equal(secondResult.success, false);
    assert.match(secondResult.reason!, /already paid/);
  });

  it('9. prevents concurrent/double execution when called simultaneously with exact same shared payouts reference', async () => {
    populateAllContributions(circle, contributions);

    let sendPaymentCallCount = 0;
    const mockRunTxDelayed: RunTxFn = async () => {
      sendPaymentCallCount++;
      // Simulate artificial async latency (e.g. network round-trip)
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        status: 'success',
        hash: 'tx_concurrent_success_hash',
      };
    };
    const adapter = new PollarPaymentAdapter(mockRunTxDelayed);

    // Invoke TWO executions in parallel with the EXACT SAME shared payouts array reference
    const [res1, res2] = await Promise.all([
      executeAjoPayout({ circle, contributions, payouts, adapter }),
      executeAjoPayout({ circle, contributions, payouts, adapter }),
    ]);

    // Exactly ONE sendPayment call must have been made
    assert.equal(sendPaymentCallCount, 1);

    // One execution succeeds and one fails due to duplicate pending reservation
    const successCount = (res1.success ? 1 : 0) + (res2.success ? 1 : 0);
    assert.equal(successCount, 1);

    const failedRes = res1.success ? res2 : res1;
    assert.match(failedRes.reason!, /already pending|already paid/);

    // Exactly one payout record in payouts list
    assert.equal(payouts.length, 1);
    assert.equal(payouts[0].status, 'paid');

    // Cycle advances exactly once
    const finalCircle = res1.success ? res1.circle : res2.circle;
    assert.equal(finalCircle.currentCycle, 1);
  });

  it('10. advances cycle exactly once after successful payout', async () => {
    populateAllContributions(circle, contributions);
    const adapter = new DemoPaymentAdapter();

    const result = await executeAjoPayout({ circle, contributions, payouts, adapter });
    assert.equal(result.success, true);
    assert.equal(result.circle.currentCycle, 1);
  });

  it('11. preserves cycle safety: failed or pending payout does NOT advance cycle', async () => {
    populateAllContributions(circle, contributions);
    const failingAdapter = new DemoPaymentAdapter({ shouldFail: true });

    const result = await executeAjoPayout({ circle, contributions, payouts, adapter: failingAdapter });
    assert.equal(result.success, false);
    assert.equal(result.circle.currentCycle, 0); // Cycle stays 0
  });

  it('12. selects correct recipient for next cycle after cycle advances', async () => {
    // Complete Cycle 0
    populateAllContributions(circle, contributions);
    const adapter = new DemoPaymentAdapter();
    const resultC0 = await executeAjoPayout({ circle, contributions, payouts, adapter });

    assert.equal(resultC0.success, true);
    let circleC1 = resultC0.circle;
    assert.equal(circleC1.currentCycle, 1);

    // Populate contributions for Cycle 1
    populateAllContributions(circleC1, contributions);

    // Execute Cycle 1 payout
    const resultC1 = await executeAjoPayout({ circle: circleC1, contributions, payouts, adapter });
    assert.equal(resultC1.success, true);
    assert.equal(resultC1.payout!.recipientId, 'm2'); // Member 2 is recipient for cycle 1!
    assert.equal(resultC1.circle.currentCycle, 2);
  });

  it('13. works seamlessly with DemoPaymentAdapter', async () => {
    populateAllContributions(circle, contributions);
    const adapter = new DemoPaymentAdapter();

    const result = await executeAjoPayout({ circle, contributions, payouts, adapter });
    assert.equal(result.success, true);
    assert.match(result.payout!.transactionHash!, /^demo_tx_/);
  });

  it('14. works seamlessly with PollarPaymentAdapter (interchangeable interface)', async () => {
    populateAllContributions(circle, contributions);
    const mockRunTx: RunTxFn = async (op, params) => {
      assert.equal(op, 'payment');
      assert.equal(params.destination, 'G_MEMBER_1');
      assert.equal(params.amount, '50');
      return {
        status: 'success',
        hash: 'tx_pollar_stellar_hash_999',
      };
    };
    const adapter = new PollarPaymentAdapter(mockRunTx);

    const result = await executeAjoPayout({ circle, contributions, payouts, adapter });
    assert.equal(result.success, true);
    assert.equal(result.payout!.transactionHash, 'tx_pollar_stellar_hash_999');
  });
});

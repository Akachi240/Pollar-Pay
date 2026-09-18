import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createAjoCircle,
  getContributionStatus,
  checkAjoPayoutEligibility,
  recordContribution,
  createPayoutRecord,
  advanceAjoCycle,
} from './rules';
import { AjoCircle, AjoMember, Asset, Contribution, Payout } from './types';
import { DemoPaymentAdapter, PollarPaymentAdapter, PaymentAdapter, RunTxFn } from './adapter';

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

const MEMBERS_3: AjoMember[] = [
  { memberId: 'm1', name: 'Member 1', walletAddress: 'G_MEMBER_1', payoutPosition: 0 },
  { memberId: 'm2', name: 'Member 2', walletAddress: 'G_MEMBER_2', payoutPosition: 1 },
  { memberId: 'm3', name: 'Member 3', walletAddress: 'G_MEMBER_3', payoutPosition: 2 },
];
const PAYOUT_ORDER_3 = ['m1', 'm2', 'm3'];

const MEMBERS_12: AjoMember[] = Array.from({ length: 12 }, (_, i) => ({
  memberId: `m${i+1}`, name: `Member ${i+1}`, walletAddress: `G_MEMBER_${i+1}`, payoutPosition: i
}));
const PAYOUT_ORDER_12 = MEMBERS_12.map(m => m.memberId);

describe('Ajo Circle Creation', () => {
  it('creates a valid 5-member circle', () => {
    const circle = createAjoCircle({
      id: 'circle_1',
      name: 'Test Ajo Circle',
      contributionAmount: '10',
      asset: USDC_ASSET,
      frequency: 'weekly',
      members: FIXTURE_MEMBERS,
      payoutOrder: FIXTURE_PAYOUT_ORDER,
    });

    assert.equal(circle.id, 'circle_1');
    assert.equal(circle.members.length, 5);
    assert.equal(circle.currentCycle, 0);
    assert.equal(circle.status, 'active');
  });

  it('rejects duplicate member IDs', () => {
    const duplicateMembers: AjoMember[] = [
      ...FIXTURE_MEMBERS.slice(0, 4),
      { memberId: 'm1', name: 'Dup Member', walletAddress: 'G_MEMBER_DUP', payoutPosition: 4 },
    ];

    assert.throws(
      () =>
        createAjoCircle({
          id: 'circle_dup_id',
          name: 'Dup Circle',
          contributionAmount: '10',
          asset: USDC_ASSET,
          frequency: 'weekly',
          members: duplicateMembers,
          payoutOrder: ['m1', 'm2', 'm3', 'm4', 'm1'],
        }),
      /Duplicate member ID rejected/
    );
  });

  it('rejects duplicate wallet addresses', () => {
    const duplicateWallets: AjoMember[] = [
      ...FIXTURE_MEMBERS.slice(0, 4),
      { memberId: 'm5', name: 'Member 5', walletAddress: 'G_MEMBER_1', payoutPosition: 4 },
    ];

    assert.throws(
      () =>
        createAjoCircle({
          id: 'circle_dup_wallet',
          name: 'Dup Wallet Circle',
          contributionAmount: '10',
          asset: USDC_ASSET,
          frequency: 'weekly',
          members: duplicateWallets,
          payoutOrder: FIXTURE_PAYOUT_ORDER,
        }),
      /Duplicate wallet address rejected/
    );
  });

  it('rejects invalid payout order', () => {
    assert.throws(
      () =>
        createAjoCircle({
          id: 'circle_bad_order',
          name: 'Bad Order Circle',
          contributionAmount: '10',
          asset: USDC_ASSET,
          frequency: 'weekly',
          members: FIXTURE_MEMBERS,
          payoutOrder: ['m1', 'm2', 'm3', 'm4', 'UNKNOWN_MEMBER'],
        }),
      /Payout order contains invalid member ID/
    );
  });

  it('creates a valid 3-member circle', () => {
    const circle = createAjoCircle({
      id: 'circle_3', name: '3 Member Circle', contributionAmount: '25',
      asset: USDC_ASSET, frequency: 'weekly', members: MEMBERS_3, payoutOrder: PAYOUT_ORDER_3,
    });
    assert.equal(circle.members.length, 3);
  });

  it('creates a valid 12-member circle', () => {
    const circle = createAjoCircle({
      id: 'circle_12', name: '12 Member Circle', contributionAmount: '5',
      asset: USDC_ASSET, frequency: 'weekly', members: MEMBERS_12, payoutOrder: PAYOUT_ORDER_12,
    });
    assert.equal(circle.members.length, 12);
  });

  it('rejects a 2-member circle', () => {
    assert.throws(
      () => createAjoCircle({
        id: 'circle_2', name: '2 Member Circle', contributionAmount: '10',
        asset: USDC_ASSET, frequency: 'weekly', members: MEMBERS_3.slice(0, 2), payoutOrder: PAYOUT_ORDER_3.slice(0, 2),
      }),
      /Circle must have between 3 and 12 members/
    );
  });

  it('rejects a 13-member circle', () => {
    const members13 = [...MEMBERS_12, { memberId: 'm13', name: 'Member 13', walletAddress: 'G_MEMBER_13', payoutPosition: 12 }];
    assert.throws(
      () => createAjoCircle({
        id: 'circle_13', name: '13 Member Circle', contributionAmount: '10',
        asset: USDC_ASSET, frequency: 'weekly', members: members13, payoutOrder: [...PAYOUT_ORDER_12, 'm13'],
      }),
      /Circle must have between 3 and 12 members/
    );
  });

  it('accepts weekly frequency', () => {
    const circle = createAjoCircle({
      id: 'circle_weekly', name: 'Weekly Circle', contributionAmount: '10',
      asset: USDC_ASSET, frequency: 'weekly', members: MEMBERS_3, payoutOrder: PAYOUT_ORDER_3,
    });
    assert.equal(circle.frequency, 'weekly');
  });

  it('accepts biweekly frequency', () => {
    const circle = createAjoCircle({
      id: 'circle_biweekly', name: 'Biweekly Circle', contributionAmount: '10',
      asset: USDC_ASSET, frequency: 'biweekly', members: MEMBERS_3, payoutOrder: PAYOUT_ORDER_3,
    });
    assert.equal(circle.frequency, 'biweekly');
  });

  it('accepts monthly frequency', () => {
    const circle = createAjoCircle({
      id: 'circle_monthly', name: 'Monthly Circle', contributionAmount: '10',
      asset: USDC_ASSET, frequency: 'monthly', members: MEMBERS_3, payoutOrder: PAYOUT_ORDER_3,
    });
    assert.equal(circle.frequency, 'monthly');
  });

  it('rejects payout order with duplicate member ID', () => {
    assert.throws(
      () => createAjoCircle({
        id: 'circle_dup_payout', name: 'Dup Payout Circle', contributionAmount: '10',
        asset: USDC_ASSET, frequency: 'weekly', members: MEMBERS_3, payoutOrder: ['m1', 'm2', 'm1'],
      }),
      /Payout order contains duplicate member IDs/
    );
  });

  it('rejects payout order missing a circle member', () => {
    assert.throws(
      () => createAjoCircle({
        id: 'circle_missing_payout', name: 'Missing Payout Circle', contributionAmount: '10',
        asset: USDC_ASSET, frequency: 'weekly', members: MEMBERS_3, payoutOrder: ['m1', 'm2'],
      }),
      /Payout order must contain every member exactly once/
    );
  });
});

describe('Ajo Contributions', () => {
  let circle: AjoCircle;

  beforeEach(() => {
    circle = createAjoCircle({
      id: 'circle_contrib',
      name: 'Contribution Test Circle',
      contributionAmount: '10',
      asset: USDC_ASSET,
      frequency: 'weekly',
      members: FIXTURE_MEMBERS,
      payoutOrder: FIXTURE_PAYOUT_ORDER,
    });
  });

  it('tracks single and partial member contributions', () => {
    const c1 = recordContribution(circle, 'm1', '10', USDC_ASSET, [], 'tx_1');
    const status1 = getContributionStatus(circle, [c1]);

    assert.equal(status1.contributedCount, 1);
    assert.equal(status1.totalVerifiedAmount, '10');
    assert.equal(status1.isFullyContributed, false);

    const c2 = recordContribution(circle, 'm2', '10', USDC_ASSET, [c1], 'tx_2');
    const c3 = recordContribution(circle, 'm3', '10', USDC_ASSET, [c1, c2], 'tx_3');
    const status3 = getContributionStatus(circle, [c1, c2, c3]);

    assert.equal(status3.contributedCount, 3);
    assert.equal(status3.totalVerifiedAmount, '30');
    assert.equal(status3.isFullyContributed, false);
  });

  it('rejects duplicate contribution for the same member in the same cycle', () => {
    const c1 = recordContribution(circle, 'm1', '10', USDC_ASSET, [], 'tx_1');

    assert.throws(
      () => recordContribution(circle, 'm1', '10', USDC_ASSET, [c1], 'tx_1_dup'),
      /Duplicate contribution rejected/
    );
  });

  it('rejects contribution below required amount', () => {
    assert.throws(
      () => recordContribution(circle, 'm1', '5', USDC_ASSET, []),
      /less than required amount/
    );
  });

  it('rejects transaction hash reuse', () => {
    const c1 = recordContribution(circle, 'm1', '10', USDC_ASSET, [], 'tx_reused');

    assert.throws(
      () => recordContribution(circle, 'm2', '10', USDC_ASSET, [c1], 'tx_reused'),
      /Transaction hash "tx_reused" has already been used/
    );
  });
});

describe('Ajo Payout Eligibility & Calculation', () => {
  let circle: AjoCircle;

  beforeEach(() => {
    circle = createAjoCircle({
      id: 'circle_payout',
      name: 'Payout Test Circle',
      contributionAmount: '10',
      asset: USDC_ASSET,
      frequency: 'weekly',
      members: FIXTURE_MEMBERS,
      payoutOrder: FIXTURE_PAYOUT_ORDER,
    });
  });

  it('keeps payout locked when members are unpaid', () => {
    const contributions: Contribution[] = [];
    for (let i = 0; i < 4; i++) {
      const c = recordContribution(
        circle,
        FIXTURE_MEMBERS[i].memberId,
        '10',
        USDC_ASSET,
        contributions,
        `tx_${i}`
      );
      contributions.push(c);
    }

    const check = checkAjoPayoutEligibility(circle, contributions, []);
    assert.equal(check.eligible, false);
    assert.match(check.reason, /Not all members have contributed/);
  });

  it('unlocks payout when all members have contributed', () => {
    const contributions: Contribution[] = [];
    for (let i = 0; i < 5; i++) {
      const c = recordContribution(
        circle,
        FIXTURE_MEMBERS[i].memberId,
        '10',
        USDC_ASSET,
        contributions,
        `tx_${i}`
      );
      contributions.push(c);
    }

    const check = checkAjoPayoutEligibility(circle, contributions, []);
    assert.equal(check.eligible, true);
    assert.equal(check.recipientId, 'm1');
    assert.equal(check.amount, '50');
  });

  it('rejects duplicate payout if current cycle payout is already paid', () => {
    const contributions: Contribution[] = [];
    for (let i = 0; i < 5; i++) {
      const c = recordContribution(
        circle,
        FIXTURE_MEMBERS[i].memberId,
        '10',
        USDC_ASSET,
        contributions,
        `tx_${i}`
      );
      contributions.push(c);
    }

    const existingPayout: Payout = {
      id: 'payout_1',
      circleId: circle.id,
      recipientId: 'm1',
      cycle: 0,
      amount: '50',
      asset: USDC_ASSET,
      status: 'paid',
      transactionHash: 'tx_payout_hash',
      createdAt: new Date().toISOString(),
    };

    const check = checkAjoPayoutEligibility(circle, contributions, [existingPayout]);
    assert.equal(check.eligible, false);
    assert.match(check.reason, /already paid/);
  });

  it('calculates pot correctly for a 3-member circle with contribution amount 25', () => {
    const circle3 = createAjoCircle({
      id: 'circle_3_calc', name: '3 Member', contributionAmount: '25',
      asset: USDC_ASSET, frequency: 'weekly', members: MEMBERS_3, payoutOrder: PAYOUT_ORDER_3,
    });
    const contributions: Contribution[] = MEMBERS_3.map((m, i) => recordContribution(circle3, m.memberId, '25', USDC_ASSET, [], `tx_${i}`));
    const check = checkAjoPayoutEligibility(circle3, contributions, []);
    assert.equal(check.eligible, true);
    assert.equal(check.amount, '75');
  });

  it('calculates pot correctly for a 12-member circle with contribution amount 5', () => {
    const circle12 = createAjoCircle({
      id: 'circle_12_calc', name: '12 Member', contributionAmount: '5',
      asset: USDC_ASSET, frequency: 'weekly', members: MEMBERS_12, payoutOrder: PAYOUT_ORDER_12,
    });
    const contributions: Contribution[] = MEMBERS_12.map((m, i) => recordContribution(circle12, m.memberId, '5', USDC_ASSET, [], `tx_${i}`));
    const check = checkAjoPayoutEligibility(circle12, contributions, []);
    assert.equal(check.eligible, true);
    assert.equal(check.amount, '60');
  });

  it('keeps payout locked for a 3-member circle when only 2 of 3 have paid', () => {
    const circle3 = createAjoCircle({
      id: 'circle_3_locked', name: '3 Member Locked', contributionAmount: '10',
      asset: USDC_ASSET, frequency: 'weekly', members: MEMBERS_3, payoutOrder: PAYOUT_ORDER_3,
    });
    const contributions: Contribution[] = [];
    // Only first 2 members pay
    for (let i = 0; i < 2; i++) {
      const c = recordContribution(circle3, MEMBERS_3[i].memberId, '10', USDC_ASSET, contributions, `tx_${i}`);
      contributions.push(c);
    }
    const check = checkAjoPayoutEligibility(circle3, contributions, []);
    assert.equal(check.eligible, false);
    assert.match(check.reason, /Not all members have contributed/);
  });
});

describe('Cycle Advancement & Idempotency', () => {
  let circle: AjoCircle;

  beforeEach(() => {
    circle = createAjoCircle({
      id: 'circle_cycle',
      name: 'Cycle Test Circle',
      contributionAmount: '10',
      asset: USDC_ASSET,
      frequency: 'weekly',
      members: FIXTURE_MEMBERS,
      payoutOrder: FIXTURE_PAYOUT_ORDER,
    });
  });

  it('advances cycle once after successful payout', () => {
    const paidPayout: Payout = {
      id: 'payout_c0',
      circleId: circle.id,
      recipientId: 'm1',
      cycle: 0,
      amount: '50',
      asset: USDC_ASSET,
      status: 'paid',
      transactionHash: 'tx_payout_c0',
      createdAt: new Date().toISOString(),
    };

    const updatedCircle = advanceAjoCycle(circle, paidPayout);
    assert.equal(updatedCircle.currentCycle, 1);
    assert.equal(updatedCircle.status, 'active');
  });

  it('does NOT advance cycle for failed, pending, or locked payout', () => {
    const failedPayout: Payout = {
      id: 'payout_failed',
      circleId: circle.id,
      recipientId: 'm1',
      cycle: 0,
      amount: '50',
      asset: USDC_ASSET,
      status: 'failed',
      createdAt: new Date().toISOString(),
    };

    assert.throws(
      () => advanceAjoCycle(circle, failedPayout),
      /Payout status is 'failed'/
    );

    const pendingPayout: Payout = {
      ...failedPayout,
      status: 'pending',
    };

    assert.throws(
      () => advanceAjoCycle(circle, pendingPayout),
      /Payout status is 'pending'/
    );
  });

  it('does NOT increment cycle twice when advanceAjoCycle is called repeatedly (idempotency)', () => {
    const paidPayout: Payout = {
      id: 'payout_c0',
      circleId: circle.id,
      recipientId: 'm1',
      cycle: 0,
      amount: '50',
      asset: USDC_ASSET,
      status: 'paid',
      transactionHash: 'tx_payout_c0',
      createdAt: new Date().toISOString(),
    };

    const circleCycle1 = advanceAjoCycle(circle, paidPayout);
    assert.equal(circleCycle1.currentCycle, 1);

    // Re-calling with the SAME payout from cycle 0
    const circleCycle1Again = advanceAjoCycle(circleCycle1, paidPayout);
    assert.equal(circleCycle1Again.currentCycle, 1); // Remains 1, NOT 2!
  });
});

describe('Deterministic End-to-End Fixture Scenario', () => {
  it('executes full 5-member cycle 0 scenario step-by-step', async () => {
    // 1. Create 5-member circle
    let circle = createAjoCircle({
      id: 'ajo_fixture_1',
      name: 'Fixture Ajo Group',
      contributionAmount: '10',
      asset: USDC_ASSET,
      frequency: 'weekly',
      members: FIXTURE_MEMBERS,
      payoutOrder: FIXTURE_PAYOUT_ORDER,
    });

    const contributions: Contribution[] = [];
    const payouts: Payout[] = [];
    const adapter = new DemoPaymentAdapter();

    // 0/5 Paid -> LOCKED
    let check = checkAjoPayoutEligibility(circle, contributions, payouts);
    assert.equal(check.eligible, false);

    // 3/5 Paid -> LOCKED
    for (let i = 0; i < 3; i++) {
      const m = FIXTURE_MEMBERS[i];
      const c = recordContribution(circle, m.memberId, '10', USDC_ASSET, contributions, `hash_${i}`);
      contributions.push(c);
    }
    check = checkAjoPayoutEligibility(circle, contributions, payouts);
    assert.equal(check.eligible, false);

    // 4/5 Paid -> LOCKED
    const c4 = recordContribution(circle, FIXTURE_MEMBERS[3].memberId, '10', USDC_ASSET, contributions, 'hash_3');
    contributions.push(c4);
    check = checkAjoPayoutEligibility(circle, contributions, payouts);
    assert.equal(check.eligible, false);

    // 5/5 Paid -> ELIGIBLE
    const c5 = recordContribution(circle, FIXTURE_MEMBERS[4].memberId, '10', USDC_ASSET, contributions, 'hash_4');
    contributions.push(c5);
    check = checkAjoPayoutEligibility(circle, contributions, payouts);

    assert.equal(check.eligible, true);
    assert.equal(check.recipientId, 'm1');
    assert.equal(check.amount, '50');

    // Create payout record
    const payoutRecord = createPayoutRecord(circle, contributions, payouts);
    assert.equal(payoutRecord.recipientId, 'm1');
    assert.equal(payoutRecord.amount, '50');
    assert.equal(payoutRecord.status, 'eligible');

    // Execute payout via PaymentAdapter
    const recipientMember = FIXTURE_MEMBERS.find((m) => m.memberId === payoutRecord.recipientId)!;
    const paymentResult = await adapter.sendPayment({
      destination: recipientMember.walletAddress,
      amount: payoutRecord.amount,
      asset: payoutRecord.asset,
    });

    assert.equal(paymentResult.status, 'success');
    assert.ok(paymentResult.hash);

    // Mark payout as paid
    const paidPayout: Payout = {
      ...payoutRecord,
      status: 'paid',
      transactionHash: paymentResult.hash,
      updatedAt: new Date().toISOString(),
    };
    payouts.push(paidPayout);

    // Advance cycle
    circle = advanceAjoCycle(circle, paidPayout);

    // Verify Cycle 1 state
    assert.equal(circle.currentCycle, 1);
    const nextCheck = checkAjoPayoutEligibility(circle, contributions, payouts);
    // In Cycle 1, 0/5 members have contributed for cycle 1, so payout is locked and recipient for cycle 1 will be member 2
    assert.equal(nextCheck.eligible, false);

    // Confirm that if all 5 members contribute for cycle 1, recipient will be member 2
    const cycle1Contributions: Contribution[] = [...contributions];
    for (let i = 0; i < 5; i++) {
      const m = FIXTURE_MEMBERS[i];
      const c = recordContribution(circle, m.memberId, '10', USDC_ASSET, cycle1Contributions, `hash_c1_${i}`);
      cycle1Contributions.push(c);
    }

    const cycle1Check = checkAjoPayoutEligibility(circle, cycle1Contributions, payouts);
    assert.equal(cycle1Check.eligible, true);
    assert.equal(cycle1Check.recipientId, 'm2'); // Cycle 1 recipient is member 2!
    assert.equal(cycle1Check.amount, '50');
  });

  it('runs to completion for a 3-member circle, simulating remaining contributions', async () => {
    let circle = createAjoCircle({
      id: 'ajo_fixture_3', name: '3 Member Fixture', contributionAmount: '20',
      asset: USDC_ASSET, frequency: 'weekly', members: MEMBERS_3, payoutOrder: PAYOUT_ORDER_3,
    });
    const contributions: Contribution[] = [];
    const payouts: Payout[] = [];
    const adapter = new DemoPaymentAdapter();

    // Loop through all 3 cycles
    for (let cycleIndex = 0; cycleIndex < 3; cycleIndex++) {
      assert.equal(circle.currentCycle, cycleIndex);
      assert.equal(circle.status, 'active');

      // Simulate remaining contributions for this cycle
      for (const member of MEMBERS_3) {
        const c = recordContribution(circle, member.memberId, '20', USDC_ASSET, contributions, `hash_c${cycleIndex}_${member.memberId}`);
        contributions.push(c);
      }

      const check = checkAjoPayoutEligibility(circle, contributions, payouts);
      assert.equal(check.eligible, true);
      assert.equal(check.amount, '60');
      assert.equal(check.recipientId, PAYOUT_ORDER_3[cycleIndex]);

      const payoutRecord = createPayoutRecord(circle, contributions, payouts);
      const recipientMember = MEMBERS_3.find(m => m.memberId === payoutRecord.recipientId)!;
      const paymentResult = await adapter.sendPayment({
        destination: recipientMember.walletAddress,
        amount: payoutRecord.amount,
        asset: payoutRecord.asset,
      });
      assert.equal(paymentResult.status, 'success');

      const paidPayout: Payout = {
        ...payoutRecord, status: 'paid', transactionHash: paymentResult.hash!, updatedAt: new Date().toISOString()
      };
      payouts.push(paidPayout);

      circle = advanceAjoCycle(circle, paidPayout);
    }

    // After 3 cycles, it should be completed
    assert.equal(circle.status, 'completed');
    assert.equal(circle.currentCycle, 3);
  });
});

describe('PollarPaymentAdapter Unit Tests', () => {
  it('maps destination, amount, and asset correctly to injected runTx function', async () => {
    let capturedOp: string | null = null;
    let capturedParams: any = null;

    const mockRunTx: RunTxFn = async (op, params) => {
      capturedOp = op;
      capturedParams = params;
      return {
        status: 'success',
        hash: 'tx_mock_stellar_hash_12345',
      };
    };

    const adapter = new PollarPaymentAdapter(mockRunTx);

    const result = await adapter.sendPayment({
      destination: 'G_RECIPIENT_ADDRESS',
      amount: '50',
      asset: USDC_ASSET,
    });

    assert.equal(capturedOp, 'payment');
    assert.equal(capturedParams.destination, 'G_RECIPIENT_ADDRESS');
    assert.equal(capturedParams.amount, '50');
    assert.deepEqual(capturedParams.asset, USDC_ASSET);

    assert.equal(result.status, 'success');
    assert.equal(result.hash, 'tx_mock_stellar_hash_12345');
  });

  it('surfaces Pollar SDK error details on payment failure', async () => {
    const mockRunTxError: RunTxFn = async () => {
      return {
        status: 'error',
        details: 'op_underfunded: Insufficient XLM balance on Stellar testnet',
        errorCode: 'TX_FAILED',
      };
    };

    const adapter = new PollarPaymentAdapter(mockRunTxError);

    const result = await adapter.sendPayment({
      destination: 'G_RECIPIENT_ADDRESS',
      amount: '50',
      asset: USDC_ASSET,
    });

    assert.equal(result.status, 'error');
    assert.match(result.error!, /op_underfunded/);
    assert.equal(result.hash, undefined);
  });

  it('handles unexpected thrown exceptions from runTx gracefully', async () => {
    const mockRunTxThrows: RunTxFn = async () => {
      throw new Error('Network timeout reaching Pollar endpoint');
    };

    const adapter = new PollarPaymentAdapter(mockRunTxThrows);

    const result = await adapter.sendPayment({
      destination: 'G_RECIPIENT_ADDRESS',
      amount: '50',
      asset: USDC_ASSET,
    });

    assert.equal(result.status, 'error');
    assert.equal(result.error, 'Network timeout reaching Pollar endpoint');
  });

  it('confirms DemoPaymentAdapter and PollarPaymentAdapter satisfy PaymentAdapter polymorphically', async () => {
    const mockRunTx: RunTxFn = async () => ({
      status: 'success',
      hash: 'pollar_hash',
    });

    const adapters: PaymentAdapter[] = [
      new DemoPaymentAdapter(),
      new PollarPaymentAdapter(mockRunTx),
    ];

    for (const adapter of adapters) {
      const res = await adapter.sendPayment({
        destination: 'G_TEST',
        amount: '10',
        asset: USDC_ASSET,
      });
      assert.equal(res.status, 'success');
      assert.ok(res.hash);
    }
  });
});


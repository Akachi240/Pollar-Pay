/**
 * Pure Ajo Rules Engine Functions.
 * Framework-agnostic, deterministic, and unit-testable.
 */

import { addAmounts, multiplyAmount, parseUnits, formatUnits } from './decimal';
import {
  AjoCircle,
  Contribution,
  ContributionStatusSummary,
  Payout,
  PayoutEligibilityResult,
  PersonalAllocation,
  PersonalRulePlanResult,
} from './types';
import { validateCircleCreation, validateContribution } from './validation';

/**
 * Creates a new AjoCircle with validated parameters.
 */
export function createAjoCircle(params: {
  id: string;
  name: string;
  contributionAmount: string;
  asset: AjoCircle['asset'];
  frequency: AjoCircle['frequency'];
  members: AjoCircle['members'];
  payoutOrder: string[];
}): AjoCircle {
  validateCircleCreation(params);

  // Normalize member payout positions
  const membersWithPositions = params.members.map((m) => {
    const pos = params.payoutOrder.indexOf(m.memberId);
    return {
      ...m,
      payoutPosition: pos >= 0 ? pos : m.payoutPosition,
    };
  });

  return {
    id: params.id,
    name: params.name,
    contributionAmount: params.contributionAmount,
    asset: params.asset,
    frequency: params.frequency,
    members: membersWithPositions,
    payoutOrder: params.payoutOrder,
    currentCycle: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Calculates contribution status summary for the active cycle of a circle.
 */
export function getContributionStatus(
  circle: AjoCircle,
  contributions: Contribution[]
): ContributionStatusSummary {
  const currentCycle = circle.currentCycle;

  // Filter verified contributions for the current cycle of this circle
  const currentVerified = contributions.filter(
    (c) =>
      c.circleId === circle.id &&
      c.cycle === currentCycle &&
      c.status === 'verified'
  );

  const contributedSet = new Set<string>();
  let totalVerifiedAmount = '0';

  for (const c of currentVerified) {
    if (!contributedSet.has(c.memberId)) {
      contributedSet.add(c.memberId);
      totalVerifiedAmount = addAmounts(totalVerifiedAmount, c.amount);
    }
  }

  const contributedMemberIds = Array.from(contributedSet);
  const uncontributedMemberIds = circle.members
    .map((m) => m.memberId)
    .filter((id) => !contributedSet.has(id));

  const isFullyContributed =
    contributedSet.size === circle.members.length && circle.members.length > 0;

  return {
    cycle: currentCycle,
    totalMembers: circle.members.length,
    contributedCount: contributedSet.size,
    contributedMemberIds,
    uncontributedMemberIds,
    totalVerifiedAmount,
    isFullyContributed,
  };
}

/**
 * Checks if a payout is eligible for the active cycle of a circle.
 */
export function checkAjoPayoutEligibility(
  circle: AjoCircle,
  contributions: Contribution[],
  payouts: Payout[]
): PayoutEligibilityResult {
  if (circle.status !== 'active') {
    return {
      eligible: false,
      reason: `Circle is not active (status: ${circle.status})`,
    };
  }

  if (circle.currentCycle >= circle.payoutOrder.length) {
    return {
      eligible: false,
      reason: `All cycles in circle payout order have been completed`,
    };
  }

  // Check if payout for current cycle already exists and is paid or pending
  const existingCyclePayout = payouts.find(
    (p) =>
      p.circleId === circle.id &&
      p.cycle === circle.currentCycle &&
      (p.status === 'paid' || p.status === 'pending')
  );

  if (existingCyclePayout) {
    return {
      eligible: false,
      reason: `Payout for cycle ${circle.currentCycle} is already ${existingCyclePayout.status}`,
    };
  }

  // Check contribution status
  const contribStatus = getContributionStatus(circle, contributions);

  if (!contribStatus.isFullyContributed) {
    const missing = circle.members.length - contribStatus.contributedCount;
    return {
      eligible: false,
      reason: `Not all members have contributed for cycle ${circle.currentCycle} (${missing} pending)`,
    };
  }

  const recipientId = circle.payoutOrder[circle.currentCycle];
  if (!recipientId) {
    return {
      eligible: false,
      reason: `No recipient designated for cycle ${circle.currentCycle} in payout order`,
    };
  }

  // Expected payout amount = contributionAmount * totalMembers
  const expectedAmount = multiplyAmount(circle.contributionAmount, circle.members.length);

  return {
    eligible: true,
    reason: `All ${circle.members.length} members have verified contributions for cycle ${circle.currentCycle}`,
    recipientId,
    amount: expectedAmount,
  };
}

/**
 * Records and validates a member contribution.
 */
export function recordContribution(
  circle: AjoCircle,
  memberId: string,
  amount: string,
  asset: AjoCircle['asset'],
  existingContributions: Contribution[],
  transactionHash?: string
): Contribution {
  validateContribution(circle, memberId, amount, asset, existingContributions, transactionHash);

  return {
    id: `contrib_${circle.id}_c${circle.currentCycle}_${memberId}_${Date.now()}`,
    circleId: circle.id,
    memberId,
    cycle: circle.currentCycle,
    amount,
    asset,
    status: 'verified',
    transactionHash,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates an eligible Payout record if payout checks pass.
 */
export function createPayoutRecord(
  circle: AjoCircle,
  contributions: Contribution[],
  payouts: Payout[]
): Payout {
  const check = checkAjoPayoutEligibility(circle, contributions, payouts);
  if (!check.eligible || !check.recipientId || !check.amount) {
    throw new Error(`Cannot create payout record: ${check.reason}`);
  }

  return {
    id: `payout_${circle.id}_c${circle.currentCycle}_${check.recipientId}_${Date.now()}`,
    circleId: circle.id,
    recipientId: check.recipientId,
    cycle: circle.currentCycle,
    amount: check.amount,
    asset: circle.asset,
    status: 'eligible',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Advances the circle cycle after a successful payout.
 * IDEMPOTENT: If payout has already advanced the cycle, returns circle unchanged.
 */
export function advanceAjoCycle(circle: AjoCircle, payout: Payout): AjoCircle {
  if (payout.circleId !== circle.id) {
    throw new Error(`Payout circle ID mismatch (${payout.circleId} vs ${circle.id})`);
  }

  // IDEMPOTENCY CHECK:
  // If the circle's currentCycle is already past this payout's cycle, it means this payout
  // has ALREADY been applied to advance the cycle. Return unchanged.
  if (circle.currentCycle > payout.cycle) {
    return circle;
  }

  // Must match active cycle
  if (payout.cycle !== circle.currentCycle) {
    throw new Error(
      `Payout cycle (${payout.cycle}) does not match circle active cycle (${circle.currentCycle})`
    );
  }

  // Strict status check: ONLY 'paid' status can advance the cycle!
  if (payout.status !== 'paid') {
    throw new Error(
      `Cannot advance cycle: Payout status is '${payout.status}' (must be 'paid')`
    );
  }

  const nextCycle = circle.currentCycle + 1;
  const isCompleted = nextCycle >= circle.payoutOrder.length;

  return {
    ...circle,
    currentCycle: nextCycle,
    status: isCompleted ? 'completed' : 'active',
  };
}

/**
 * Calculates a Personal Rule execution plan based on available balance and allocations.
 * Ensures the total does not exceed the available balance.
 * Supports percentage, fixed, and remainder rules.
 */
export function executePersonalRule(
  availableBalanceStr: string,
  allocations: PersonalAllocation[]
): PersonalRulePlanResult {
  try {
    const totalBalanceUnits = parseUnits(availableBalanceStr);
    let remainingUnits = totalBalanceUnits;
    const destinations: { destination: string; amount: string }[] = [];

    // Validation: Check for empty destination names
    for (const alloc of allocations) {
      if (!alloc.destination || alloc.destination.trim() === '') {
        throw new Error('Destination name cannot be empty');
      }
    }

    // 1. Process percentage rules
    const percentRules = allocations.filter(a => a.type === 'percentage');
    let totalPercent = 0;
    for (const rule of percentRules) {
      const percentVal = Number(rule.value || '0');
      if (percentVal < 0 || percentVal > 100) {
        throw new Error(`Invalid percentage: ${percentVal}%`);
      }
      totalPercent += percentVal;
      if (totalPercent > 100) {
        throw new Error('Total percentage exceeds 100%');
      }
      const percentBigInt = BigInt(Math.floor(percentVal));
      const amountUnits = (totalBalanceUnits * percentBigInt) / BigInt(100);
      remainingUnits = remainingUnits - amountUnits;
      destinations.push({ destination: rule.destination, amount: formatUnits(amountUnits) });
    }

    // 2. Process fixed rules
    const fixedRules = allocations.filter(a => a.type === 'fixed');
    for (const rule of fixedRules) {
      const amountUnits = parseUnits(rule.value || '0');
      if (amountUnits > remainingUnits) {
        throw new Error('Insufficient balance for fixed allocations');
      }
      remainingUnits = remainingUnits - amountUnits;
      destinations.push({ destination: rule.destination, amount: formatUnits(amountUnits) });
    }

    // 3. Process remainder rules
    const remainderRules = allocations.filter(a => a.type === 'remainder');
    if (remainderRules.length > 0) {
      const remainderPerRule = remainingUnits / BigInt(remainderRules.length);
      for (const rule of remainderRules) {
        destinations.push({ destination: rule.destination, amount: formatUnits(remainderPerRule) });
      }
    } else if (remainingUnits < BigInt(0)) {
       throw new Error('Negative remainder encountered');
    }

    return { destinations };
  } catch (err: any) {
    return { destinations: [], error: err.message };
  }
}

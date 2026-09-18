/**
 * Validation functions for Ajo circles, members, and transactions.
 */

import { compareAmounts, isSameAsset, parseUnits } from './decimal';
import { AjoCircle, AjoMember, Asset, Contribution } from './types';

export function validateContributionAmount(amountStr: string): void {
  try {
    const units = parseUnits(amountStr);
    if (units <= BigInt(0)) {
      throw new Error(`Contribution amount must be greater than zero: "${amountStr}"`);
    }
  } catch (e) {
    throw new Error(`Invalid contribution amount: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function validateCircleCreation(params: {
  name: string;
  contributionAmount: string;
  asset: Asset;
  members: AjoMember[];
  payoutOrder: string[];
}): void {
  if (!params.name || params.name.trim().length === 0) {
    throw new Error('Circle name is required');
  }

  validateContributionAmount(params.contributionAmount);

  if (!params.members || params.members.length < 3 || params.members.length > 12) {
    throw new Error('Circle must have between 3 and 12 members');
  }

  const memberIds = new Set<string>();
  const walletAddresses = new Set<string>();

  for (const m of params.members) {
    if (!m.memberId || m.memberId.trim() === '') {
      throw new Error('Member ID cannot be empty');
    }
    if (!m.walletAddress || m.walletAddress.trim() === '') {
      throw new Error(`Wallet address for member ${m.memberId} cannot be empty`);
    }
    if (memberIds.has(m.memberId)) {
      throw new Error(`Duplicate member ID rejected: "${m.memberId}"`);
    }
    if (walletAddresses.has(m.walletAddress)) {
      throw new Error(`Duplicate wallet address rejected: "${m.walletAddress}"`);
    }
    memberIds.add(m.memberId);
    walletAddresses.add(m.walletAddress);
  }

  if (!params.payoutOrder || params.payoutOrder.length !== params.members.length) {
    throw new Error('Payout order must contain every member exactly once');
  }

  const payoutSet = new Set(params.payoutOrder);
  if (payoutSet.size !== params.members.length) {
    throw new Error('Payout order contains duplicate member IDs');
  }

  for (const memberId of params.payoutOrder) {
    if (!memberIds.has(memberId)) {
      throw new Error(`Payout order contains invalid member ID: "${memberId}"`);
    }
  }
}

export function validateContribution(
  circle: AjoCircle,
  memberId: string,
  amount: string,
  asset: Asset,
  existingContributions: Contribution[],
  transactionHash?: string
): void {
  const member = circle.members.find((m) => m.memberId === memberId);
  if (!member) {
    throw new Error(`Member "${memberId}" is not a member of circle "${circle.id}"`);
  }

  if (!isSameAsset(circle.asset, asset)) {
    throw new Error(
      `Asset mismatch. Circle expects ${circle.asset.code ?? circle.asset.type}, got ${asset.code ?? asset.type}`
    );
  }

  if (compareAmounts(amount, circle.contributionAmount) < 0) {
    throw new Error(
      `Contribution amount "${amount}" is less than required amount "${circle.contributionAmount}"`
    );
  }

  // Duplicate contribution check for active cycle
  const existingVerified = existingContributions.find(
    (c) =>
      c.circleId === circle.id &&
      c.memberId === memberId &&
      c.cycle === circle.currentCycle &&
      c.status === 'verified'
  );
  if (existingVerified) {
    throw new Error(
      `Duplicate contribution rejected: Member "${memberId}" has already contributed for cycle ${circle.currentCycle}`
    );
  }

  // Transaction hash reuse check
  if (transactionHash && transactionHash.trim()) {
    const existingTx = existingContributions.find(
      (c) => c.transactionHash === transactionHash && c.status === 'verified'
    );
    if (existingTx) {
      throw new Error(`Transaction hash "${transactionHash}" has already been used`);
    }
  }
}

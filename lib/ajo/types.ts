/**
 * Ajo Domain Types - Core data model for Programmable Money Ajo circles.
 */

export interface User {
  id: string;
  name: string;
  walletAddress: string;
}

export type AssetType = 'native' | 'credit_alphanum4' | 'credit_alphanum12';

export interface Asset {
  type: AssetType;
  code?: string;
  issuer?: string;
}

export interface AjoMember {
  memberId: string;
  name: string;
  walletAddress: string;
  payoutPosition: number;
}

export type AjoCircleStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export interface AjoCircle {
  id: string;
  name: string;
  contributionAmount: string; // Exact string (e.g. "10" or "10.0000000")
  asset: Asset;
  frequency: 'weekly' | 'monthly' | 'biweekly';
  members: AjoMember[];
  payoutOrder: string[]; // Member IDs in order of payout per cycle
  currentCycle: number; // 0-indexed cycle number
  status: AjoCircleStatus;
  createdAt: string;
}

export type ContributionStatus = 'pending' | 'verified' | 'failed';

export interface Contribution {
  id: string;
  circleId: string;
  memberId: string;
  cycle: number;
  amount: string;
  asset: Asset;
  status: ContributionStatus;
  transactionHash?: string;
  createdAt: string;
}

export type PayoutStatus = 'locked' | 'eligible' | 'pending' | 'paid' | 'failed';

export interface Payout {
  id: string;
  circleId: string;
  recipientId: string;
  cycle: number;
  amount: string;
  asset: Asset;
  status: PayoutStatus;
  transactionHash?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ContributionStatusSummary {
  cycle: number;
  totalMembers: number;
  contributedCount: number;
  contributedMemberIds: string[];
  uncontributedMemberIds: string[];
  totalVerifiedAmount: string;
  isFullyContributed: boolean;
}

export interface PayoutEligibilityResult {
  eligible: boolean;
  reason: string;
  recipientId?: string;
  amount?: string;
}

export type PersonalAllocationType = 'percentage' | 'fixed' | 'remainder';

export interface PersonalAllocation {
  destination: string;
  type: PersonalAllocationType;
  value?: string; // e.g. "20" for percentage, "10" for fixed
}

export interface PersonalRulePlanResult {
  destinations: { destination: string; amount: string }[];
  error?: string;
}

/**
 * Decimal utilities for safe monetary handling without floating-point inaccuracies.
 * Stellar amounts support up to 7 decimal places.
 */

const DEFAULT_DECIMALS = 7;

/**
 * Parses a decimal string (e.g. "10", "10.5", "0.0000001") into a BigInt of base units.
 */
export function parseUnits(amountStr: string, decimals: number = DEFAULT_DECIMALS): bigint {
  const trimmed = amountStr.trim();
  if (!trimmed || isNaN(Number(trimmed))) {
    throw new Error(`Invalid monetary amount: "${amountStr}"`);
  }

  const parts = trimmed.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid decimal format: "${amountStr}"`);
  }

  const integerPart = parts[0] || '0';
  let decimalPart = parts[1] || '';

  if (integerPart.startsWith('-')) {
    throw new Error(`Monetary amount cannot be negative: "${amountStr}"`);
  }

  if (decimalPart.length > decimals) {
    throw new Error(
      `Amount "${amountStr}" exceeds maximum supported decimal places (${decimals})`
    );
  }

  // Pad right with zeros to reach target decimals
  decimalPart = decimalPart.padEnd(decimals, '0');

  const combined = `${integerPart}${decimalPart}`;
  return BigInt(combined);
}

/**
 * Formats base units BigInt back to a trimmed decimal string.
 */
export function formatUnits(units: bigint, decimals: number = DEFAULT_DECIMALS): string {
  if (units < BigInt(0)) {
    throw new Error('Base units cannot be negative');
  }

  const str = units.toString().padStart(decimals + 1, '0');
  const integerPart = str.slice(0, str.length - decimals);
  let decimalPart = str.slice(str.length - decimals);

  // Trim trailing zeros
  decimalPart = decimalPart.replace(/0+$/, '');

  return decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
}

/**
 * Adds two monetary decimal strings safely.
 */
export function addAmounts(aStr: string, bStr: string, decimals: number = DEFAULT_DECIMALS): string {
  const a = parseUnits(aStr, decimals);
  const b = parseUnits(bStr, decimals);
  return formatUnits(a + b, decimals);
}

/**
 * Multiplies a monetary decimal string by an integer count.
 */
export function multiplyAmount(amountStr: string, multiplier: number, decimals: number = DEFAULT_DECIMALS): string {
  if (multiplier < 0 || !Number.isInteger(multiplier)) {
    throw new Error(`Multiplier must be a non-negative integer: ${multiplier}`);
  }
  const units = parseUnits(amountStr, decimals);
  return formatUnits(units * BigInt(multiplier), decimals);
}

/**
 * Compares two monetary decimal strings.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 */
export function compareAmounts(aStr: string, bStr: string, decimals: number = DEFAULT_DECIMALS): number {
  const a = parseUnits(aStr, decimals);
  const b = parseUnits(bStr, decimals);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Checks if two assets are identical.
 */
export function isSameAsset(a: { type: string; code?: string; issuer?: string }, b: { type: string; code?: string; issuer?: string }): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'native') return true;
  return (a.code ?? '') === (b.code ?? '') && (a.issuer ?? '') === (b.issuer ?? '');
}

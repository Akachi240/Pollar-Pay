/**
 * Payment Adapter Interface & Implementations.
 * Decouples core Ajo business logic from the underlying payment execution provider.
 */

import { Asset } from './types';

export interface PaymentParams {
  destination: string;
  amount: string;
  asset: Asset;
}

export interface PaymentResult {
  status: 'success' | 'pending' | 'error';
  hash?: string;
  error?: string;
}

export interface PaymentAdapter {
  sendPayment(params: PaymentParams): Promise<PaymentResult>;
}

/**
 * Signature matching Pollar's runTx('payment', { destination, amount, asset }) method.
 * Injected at runtime from usePollar().runTx to decouple React hooks from adapter logic.
 */
export type RunTxFn = (
  operation: 'payment',
  params: {
    destination: string;
    amount: string;
    asset: Asset;
  },
  options?: { memo?: { type: 'text' | 'id'; value: string } }
) => Promise<{
  status: 'success' | 'pending' | 'error';
  hash?: string;
  details?: string;
  errorCode?: string;
  error?: string;
}>;

/**
 * PollarPaymentAdapter - Real adapter wrapping Pollar SDK payment execution via injected runTx function.
 * Zero React dependency inside adapter logic.
 */
export class PollarPaymentAdapter implements PaymentAdapter {
  constructor(private runTxFn: RunTxFn) {}

  async sendPayment(params: PaymentParams): Promise<PaymentResult> {
    // SAFETY BOUNDARY: Never pass demo/placeholder addresses to the real Pollar SDK
    if (params.destination.includes('NO_REAL_WALLET') || params.destination.includes('DEMO_')) {
      return {
        status: 'error',
        error: 'Safety Guard: Attempted to send a real Pollar payment to a simulated demo address',
      };
    }

    try {
      const outcome = await this.runTxFn(
        'payment',
        {
          destination: params.destination,
          amount: params.amount,
          asset: params.asset,
        }
      );

      if (outcome.status === 'error') {
        const errorDetails =
          outcome.details || outcome.error || outcome.errorCode || 'Pollar payment transaction failed';
        return {
          status: 'error',
          error: String(errorDetails),
        };
      }

      return {
        status: outcome.status,
        hash: outcome.hash,
      };
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/**
 * DemoPaymentAdapter - Deterministic mock adapter for offline testing & fallback mode.
 */
export class DemoPaymentAdapter implements PaymentAdapter {
  private shouldFail: boolean;
  private customErrorMessage?: string;

  constructor(options?: { shouldFail?: boolean; errorMessage?: string }) {
    this.shouldFail = options?.shouldFail ?? false;
    this.customErrorMessage = options?.errorMessage;
  }

  async sendPayment(params: PaymentParams): Promise<PaymentResult> {
    if (this.shouldFail) {
      return {
        status: 'error',
        error: this.customErrorMessage ?? 'Simulated payment failure in DemoPaymentAdapter',
      };
    }

    const mockHash = `demo_tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      status: 'success',
      hash: mockHash,
    };
  }
}

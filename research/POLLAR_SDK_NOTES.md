# Pollar SDK Architecture & Reference Notes

## Transaction History Flow

Transaction history in the Pollar SDK follows a four-part architecture:

1. **Trigger (`fetchTxHistory`)**: `client.fetchTxHistory(params?: TxHistoryParams): Promise<void>`
   - A fire-and-forget asynchronous method on `PollarClient` that fetches transaction records from the backend and updates the client's internal observable state.
2. **Snapshot Reader (`getTxHistoryState`)**: `client.getTxHistoryState(): TxHistoryState`
   - Returns the current static snapshot of the transaction history state (`idle` | `loading` | `loaded` | `error`).
3. **Subscription Observer (`onTxHistoryStateChange`)**: `client.onTxHistoryStateChange(cb): () => void`
   - Registers a callback listener for history state updates and returns an unsubscribe function.
4. **React Reactive Property (`txHistory`)**: `const { txHistory } = usePollar();`
   - A reactive property on the `usePollar()` hook that automatically reflects `TxHistoryState` updates in React components.

---

## Stellar Payment Execution

- **`runTx('payment', ...)`**: Standard Stellar-native payment pipeline. Builds, signs, and submits Stellar transactions while supporting external wallet adapters, passkeys, and XDR signing.
- **`sendPayment(...)`**: Separate multi-chain payment function reserved for non-Stellar (Solana/Polygon) or custodial single-call transfers.

---

## Asset Selection & Testnet Provenance

- **USDC Sourcing Correction**: An earlier inspection report mentioned a testnet USDC issuer address (`GBBD47IF6LWK2P7MDEVSCWR7DPCCM3GHIBFRVCCAAA6OLMSBLI2V7PPA`). A sourcing audit confirmed this address was an unverified inference from LLM pre-training, NOT sourced from the Pollar SDK or local repository.
- **Confirmed Working Asset (Native XLM)**: Native XLM (`{ type: 'native' }`) is confirmed as the target asset for the hackathon MVP. Native XLM requires zero trustlines, is natively supported by `PollarClient` and `runTx`, and integrates directly with Stellar testnet Friendbot funding.


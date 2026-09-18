# Pollar Pay

> **"Tell your money what to do."**

Pollar Pay is a hackathon project exploring how deterministic rules can automatically route, hold, and release digital assets. Instead of manually executing transactions, you define a **Money Policy**—a set of rules and conditions. A central rules engine evaluates these policies, and when conditions are met, it safely triggers transactions using **Pollar** as the underlying financial and payment rail.

## Policy Types

The application demonstrates a single overarching engine orchestrating three distinct types of Money Policies:

### 1. Personal (Simulation)
Tell your personal income where to go. Set up percentage-based splits or fixed allocations (e.g., 50% to Savings, 100 XLM to Rent). 
* **Note:** The Personal policy is purely a **simulation/preview** of how the engine calculates state. It does not move any real funds.

### 2. Shared Goal (Simulation)
Collect money for a shared purpose, like a family fund, wedding, or community project. Configure the target amount, how people should contribute, and a release condition (e.g., target reached or a specific date).
* **Note:** The Shared Goal policy is a **policy preview**. It simulates contribution activity and shows what the engine *would* do, but no funds are moved.

### 3. Ajo (Live Testnet Execution)
Tell your money what to do as a group. Ajo demonstrates the full end-to-end flow of Pollar Pay:
- **Rules Engine:** Tracks a 5-member circle, recording verified contributions and calculating payout eligibility for each cycle.
- **Demo vs. Connected Wallet:** The policy handles a mix of simulated "Demo Participants" and your actual "Connected Wallet".
- **Real Execution:** When the engine verifies that the cycle conditions are met (all members have contributed), it unlocks the payout. The final payout action integrates with the **Pollar SDK** to execute a real transaction on the **Stellar Testnet**.

## Disclaimer
This is a **hackathon prototype**, not a production-ready financial product or production financial infrastructure. 
- It does **not** move real-world money.
- Personal and Shared Goal flows are strictly front-end simulations.
- The Ajo flow does not perform real participant-to-participant money transfers; it uses testnet XLM for demonstration purposes only.

## Local Setup

### 1. Environment Variables
Copy the example environment file and configure it:
```bash
cp .env.example .env.local
```
Update `.env.local` with your required configuration (e.g., Pollar API keys, Neko server code, etc. as documented in the file).

### 2. Installation
The project relies on `pnpm` (note: do not use `npm install` as it may create conflicting lockfiles).
```bash
pnpm install
```

### 3. Run the Development Server
```bash
pnpm dev
```
Open [http://localhost:3070](http://localhost:3070) in your browser to see the result.

## Architecture
- **Rules Engine:** The core logic lives in `lib/ajo/`, evaluating state, contributions, and eligibility idempotently.
- **Pollar Integration:** Pollar provides the wallet connection, transaction signing, and modal UI for the final Stellar Testnet execution in the Ajo demo.
- **Front-end:** Built with Next.js (App Router), React, and Tailwind CSS.

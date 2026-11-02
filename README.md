# Campus Gate

<p align="center">
  <strong>Access, in harmony.</strong><br>
  A considered campus vehicle-access experience, backed by a verifiable on-chain movement log.
</p>

<p align="center">
  <a href="docs/videos/campus-gate-demo.webm"><strong>▶ Watch the local demo walkthrough</strong></a>
</p>

<p align="center">
  <img src="docs/screenshots/demo-02-admin-gate-activity.png" alt="Campus Gate operations dashboard with fictional demo vehicles" width="880">
</p>

> **Demo note:** The walkthrough and 12 generated screenshots use an isolated local Hardhat chain, a separate local MongoDB database, and fictional records. This is a local test demonstration, not a live or production deployment.

## Product gallery

The interface adapts to mobile screens and honors the operating system's reduced-motion preference.

<table>
  <tr>
    <td><img src="docs/screenshots/demo-01-sign-in.png" alt="Secure sign-in screen" width="420"><br><sub>01 · Secure sign-in</sub></td>
    <td><img src="docs/screenshots/demo-02-admin-gate-activity.png" alt="Administrator gate activity with fictional vehicles currently on campus" width="420"><br><sub>02 · Administrator gate activity</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/demo-03-vehicle-registry.png" alt="Vehicle registration form" width="420"><br><sub>03 · Vehicle registry</sub></td>
    <td><img src="docs/screenshots/demo-04-movement-history.png" alt="Fictional vehicle movement history" width="420"><br><sub>04 · Movement history</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/demo-05-filtered-activity.png" alt="Filtered vehicle movement search results" width="420"><br><sub>05 · Filtered activity search</sub></td>
    <td><img src="docs/screenshots/demo-06-verification-form.png" alt="Ledger record verification form" width="420"><br><sub>06 · Ledger verification</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/demo-07-verified-record.png" alt="Successful comparison of a fictional database record and blockchain entry" width="420"><br><sub>07 · Verified ledger record</sub></td>
    <td><img src="docs/screenshots/demo-08-guard-gate-view.png" alt="Gate guard workspace" width="420"><br><sub>08 · Guard workspace</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/demo-09-guard-movement-history.png" alt="Gate guard movement history" width="420"><br><sub>09 · Guard movement history</sub></td>
    <td><img src="docs/screenshots/demo-10-mobile-gate.png" alt="Responsive gate operations on a mobile screen" width="420"><br><sub>10 · Mobile gate operations</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/demo-11-mobile-history.png" alt="Responsive movement history on a mobile screen" width="420"><br><sub>11 · Mobile movement history</sub></td>
    <td><img src="docs/screenshots/demo-12-mobile-verification.png" alt="Successful ledger verification on a mobile screen" width="420"><br><sub>12 · Mobile ledger verification</sub></td>
  </tr>
</table>

## Supplied reference screenshots

The supplied originals are preserved in the ignored `docs/screenshots/local-only/` folder. These gallery copies mask wallet/account details, vehicle identifiers, owner details, and balances before publication.

<table>
  <tr>
    <td><img src="docs/screenshots/provided-gate-activity.png" alt="Supplied gate activity screenshot" width="420"><br><sub>Gate activity</sub></td>
    <td><img src="docs/screenshots/provided-movement-history.png" alt="Supplied movement history screenshot" width="420"><br><sub>Movement history</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/provided-ledger-verification.png" alt="Supplied ledger verification screenshot" width="420"><br><sub>Ledger verification</sub></td>
    <td><img src="docs/screenshots/provided-metamask-activity.png" alt="Supplied MetaMask activity screenshot" width="420"><br><sub>MetaMask activity</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/provided-metamask-wallet.png" alt="Supplied MetaMask wallet screenshot" width="420"><br><sub>MetaMask wallet</sub></td>
  </tr>
</table>

## Features

- Separate administrator and guard sign-ins.
- Register vehicles with owner details in MongoDB; store only a salted plate hash on-chain.
- Connect MetaMask and sign registration, entry, and exit transactions directly.
- View gate activity, currently-inside vehicles, and verify cached records against transaction receipts and the contract.
- Responsive interface, accessible controls, animated feedback, and a reduced-motion mode.
- Render deployment blueprint with a health check and production configuration validation.

## Requirements

- Node.js 22.13 or newer
- MongoDB (local or Atlas)
- MetaMask
- A compatible EVM RPC endpoint and funded deployer account for the network you select

## Local development

From the project root:

```powershell
npm ci
npm ci --prefix backend
npm ci --prefix frontend
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env`:

- Set `MONGO_URI` to your own MongoDB connection string and database name.
- Set a random `PLATE_SALT` and `JWT_SECRET`.
- Set `METAMASK_ADDRESS` to your wallet's **public address**.
- Keep `RPC_URL=http://127.0.0.1:8545` and `CHAIN_ID=31337` for the local Hardhat chain.
- Never store or share a wallet recovery phrase. Do not use Hardhat's public test keys on a public network.

Start a local blockchain and deploy the contract in separate terminals:

```powershell
npm run node
npm run deploy
```

Then start the API and frontend:

```powershell
npm start
npm run dev --prefix frontend
```

Open `http://localhost:5173`. Connect the MetaMask account configured as `METAMASK_ADDRESS`; the app prompts MetaMask to add/switch to Hardhat Local.

For local development only, the example credentials are `admin` / `admin123` and `guard` / `guard123`. Replace them before any shared or hosted deployment.

## Test deployment on Base Sepolia

Base Sepolia is a public EVM test network (chain ID `84532`); you do not create the network. Test ETH has no real-world value. Do not use a wallet or private key that holds real funds.

1. Create a separate MetaMask account for testing and copy only its public address into `METAMASK_ADDRESS`.
2. Get a Base Sepolia RPC endpoint from your provider, or use `https://sepolia.base.org` for local testing. Put it in `RPC_URL` and `PUBLIC_RPC_URL`. The public URL is sent to the browser, so never put a private or privileged API key in `PUBLIC_RPC_URL`.
3. Set `CHAIN_ID=84532` in `backend\.env`. Keep the test deployer private key only in this ignored local file; never share it or commit it.
4. Fund the test account with Base Sepolia ETH from a faucet. Test ETH has no monetary value; faucet availability and eligibility may change.
5. Deploy the test contract:

   ```powershell
   npm run deploy:configured
   ```

6. Copy the printed contract address into `CONTRACT_ADDRESS`, then start the backend. MetaMask will be prompted to add/switch to Base Sepolia when connecting.

This deployment is for testing only. A Base Sepolia contract is separate from Base Mainnet and cannot be used there. Before any real deployment, select a mainnet deliberately, use its RPC and chain ID, rotate any exposed credentials, and review hosting costs.

## Deploying a real contract

Choose the EVM network deliberately and use its official RPC provider. A public-chain deployment is permanent and requires real funds for gas.

1. In `backend\.env`, set the network's `RPC_URL`, numeric `CHAIN_ID`, `METAMASK_ADDRESS` (the intended admin/guard account), and `DEPLOYER_PRIVATE_KEY` (a dedicated deployer key funded only for deployment).
2. Deploy from a trusted local machine:

   ```powershell
   npm run deploy:configured
   ```

3. Record the printed contract address. Set it as `CONTRACT_ADDRESS` in the runtime environment.
4. The deployment script grants the MetaMask account the contract roles and removes the deployer admin role. It does not send funds on public networks.
5. Keep `DEPLOYER_PRIVATE_KEY` out of Render, Git, screenshots, and chat. The running application uses MetaMask for user transactions and does not need the deployer key.

Verify the selected network, wallet address, contract address, and deployment transaction before using real assets or operational data.

## Deploying to Render

This project includes [`render.yaml`](render.yaml) for a single **free-tier** Node web service that builds the Solidity ABI and frontend, serves the app and API together, and checks `/api/health`. Free instances may sleep when idle and cold-start on the next visit, have limited monthly resources, and do not provide persistent local storage. Treat this as a test deployment, not a production availability guarantee. Render plan limits can change; confirm current terms in the dashboard.

1. Push the project to the GitHub repository you intend to deploy from. Use a private repository if the source or operational details should not be public; never commit credentials or secrets.
2. In Render, create a Blueprint from that repository and confirm the service is on the free plan before creating it. A free Render service does not make MongoDB Atlas, RPC-provider usage, or blockchain gas fees free.
3. The blueprint defaults to Base Sepolia (`CHAIN_ID=84532`) and the public `https://sepolia.base.org` endpoint. Set `MONGO_URI`, `CONTRACT_ADDRESS`, `ADMIN_USER`, `ADMIN_PASS`, `GUARD_USER`, and `GUARD_PASS` in Render's private environment settings. If using a provider-specific RPC, set `RPC_URL` and `PUBLIC_RPC_URL` separately; never expose a server-only RPC credential as `PUBLIC_RPC_URL`.
4. Use unique usernames, passwords at least 12 characters long, and keep the generated `PLATE_SALT` / `JWT_SECRET`. In MongoDB Atlas, grant the app's network access and a least-privilege database user.
5. Deploy and wait for `/api/health` to report healthy. Open the Render URL, install/connect MetaMask, and switch to the exact chain used for the contract.

**Production safety:** Never commit `.env` files, API credentials, private keys, or recovery phrases. Rotate any credentials that have been shared. The hosted app fails startup on unsafe default passwords, incorrect chain ID, missing contract code, or invalid configuration. Restrict Atlas network access rather than allowing all IPs if your hosting plan supports stable outbound IPs.

## Checks

```powershell
npm test
npm run build
npm audit --omit=dev
npm audit --prefix backend
npm audit --prefix frontend
```

Restarting the local Hardhat node resets its chain and contract. Redeploy it before testing again. Clear only the dedicated local test collections if you want to reset sample records.

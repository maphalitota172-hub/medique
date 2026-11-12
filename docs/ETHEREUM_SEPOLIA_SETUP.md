# Ethereum Sepolia integration – MediQueue

This integration anchors the SHA-256 hashes of the existing MediQueue local audit blocks on the public Ethereum Sepolia test network.

## Privacy and design

- MySQL remains the application database.
- MediQueue's existing local audit chain remains the source of event details.
- Ethereum stores only a block hash, local block index, event type and transaction metadata.
- Do not put patient names, phone numbers, prescriptions, diagnoses, passwords, JWTs or other personal/health information on Ethereum.
- Sepolia ETH is test currency and has no intended monetary value.
- The wallet that deploys the contract becomes the contract owner and is the wallet authorised to anchor blocks.

## A. Prepare MetaMask

1. Install MetaMask from https://metamask.io/ (check the URL carefully).
2. Create or import a wallet. Never share its Secret Recovery Phrase or private key.
3. Open MetaMask network selection and enable/show test networks in Settings if Sepolia is not listed.
4. Select **Sepolia**.
5. Obtain a small amount of Sepolia test ETH from a reputable Sepolia faucet. Do not buy ETH for this coursework demo.

## B. Deploy the smart contract using Remix

1. Open https://remix.ethereum.org/.
2. Create a file named `MediQueueAnchor.sol`.
3. Copy the complete source from `contracts/MediQueueAnchor.sol` into Remix.
4. In Solidity Compiler, select compiler version `0.8.24` or a compatible `0.8.x` version and compile.
5. Open Deploy & Run Transactions.
6. Set Environment to **Injected Provider - MetaMask**.
7. Confirm MetaMask is on **Sepolia** and the connected account is the administrator wallet you intend to use.
8. Deploy `MediQueueAnchor`.
9. Approve the deployment in MetaMask.
10. Copy the deployed contract address from Remix. Keep it; it is needed by the MediQueue frontend.

The deployer wallet is the contract owner. Use that same wallet when anchoring blocks from the MediQueue Admin Dashboard.

## C. Configure MediQueue

1. In the MediQueue project root, create `.env` by copying `.env.example`.
2. Set your actual MySQL password and a long random `JWT_SECRET`.
3. Replace `VITE_ETHEREUM_CONTRACT_ADDRESS` with the deployed contract address, for example `0x...`.
4. Keep `VITE_ETHEREUM_CHAIN_ID=11155111`.
5. Stop and restart Vite after editing `.env`; Vite only reads these variables when it starts.
6. Install dependencies with `npm install` so the `ethers` package is installed.

Never commit or share `.env`.

## D. Run MediQueue

From the project root:

```powershell
npm install
npm run dev:all
```

Open `http://localhost:5173` and sign in as the MediQueue administrator.

## E. Anchor records

1. Open the **Ledger** tab.
2. First use the local **Verify chain** button. Resolve any invalid local block before anchoring.
3. In the **Ethereum Sepolia anchoring** panel, click **Connect MetaMask**.
4. Approve the connection and network switch. The connected wallet should be the same wallet that deployed the contract.
5. Click **Refresh Ethereum status** to compare local block hashes with the contract.
6. Click **Anchor pending blocks**. MetaMask will show a transaction; review and confirm it.
7. Wait for confirmation. The panel shows the transaction hash, Ethereum block number and number of hashes anchored.
8. Use the Sepolia Etherscan link to inspect the transaction.

The contract accepts up to 10 blocks per transaction. If more than 10 are pending, click the button again after the previous batch confirms.

## Troubleshooting

- **MetaMask not detected:** install/enable the MetaMask browser extension and reload the page.
- **Wrong network:** approve the switch to Sepolia in MetaMask.
- **Contract address missing:** check `VITE_ETHEREUM_CONTRACT_ADDRESS` in the root `.env`, then restart Vite.
- **Only owner can anchor:** connect the same MetaMask account that deployed the contract.
- **Insufficient funds:** obtain Sepolia test ETH from a faucet; never use mainnet funds for this demo.
- **Transaction pending:** wait for confirmation, then refresh status.
- **Block already anchored:** refresh status; the panel should exclude already anchored hashes.
- **Local chain invalid:** do not anchor until the local Verify chain check passes. The local chain and Ethereum anchoring are separate checks.

## What the lecturer can see

- The local MediQueue ledger records the application event.
- Ethereum Sepolia receives a transaction containing the local block hash and minimal event metadata.
- The contract emits a `BlockAnchored` event.
- The transaction is publicly inspectable on Sepolia Etherscan.
- MediQueue can query the contract to check whether each current local block hash has been anchored.

This is an Ethereum testnet integration, not Bitcoin, and it does not issue a cryptocurrency token.

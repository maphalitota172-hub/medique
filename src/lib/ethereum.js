import {
  BrowserProvider,
  Contract
} from 'ethers'

export const SEPOLIA_CHAIN_ID = 11155111n
export const SEPOLIA_CHAIN_HEX = '0xaa36a7'

const CONTRACT_ADDRESS = import.meta.env.VITE_ETHEREUM_CONTRACT_ADDRESS || ''

export const MEDIQUEUE_ANCHOR_ABI = [
  'function owner() view returns (address)',
  'function totalAnchors() view returns (uint256)',
  'function anchored(bytes32) view returns (bool)',
  'function anchorBatch(bytes32[] blockHashes, uint256[] localIndexes, string[] eventTypes)',
  'event BlockAnchored(bytes32 indexed blockHash, uint256 indexed localIndex, string eventType, address indexed anchoredBy, uint256 timestamp)'
]

// ---------------------------------------------------------------------------
// Trust Wallet detection
// Uses EIP-6963 (so Trust Wallet is found even when MetaMask or other wallets
// are installed), then falls back to Trust Wallet's own injected objects.
// MetaMask is never used.
// ---------------------------------------------------------------------------
const TRUST_RDNS = 'com.trustwallet.app'
let trustProvider = null

function looksLikeTrust(p) {
  return Boolean(p && typeof p.request === 'function' && (p.isTrust || p.isTrustWallet))
}

function discoverEip6963(timeoutMs = 400) {
  return new Promise(resolve => {
    const found = []
    const onAnnounce = event => {
      if (event?.detail?.provider) found.push(event.detail)
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce)
      resolve(found)
    }, timeoutMs)
  })
}

async function findTrustProvider() {
  // 1. EIP-6963 announcement from Trust Wallet
  const announced = await discoverEip6963()
  const viaEip = announced.find(d => d.info?.rdns === TRUST_RDNS)
  if (viaEip) return viaEip.provider

  // 2. Trust Wallet's dedicated global
  const tw = window.trustwallet
  if (tw) {
    if (typeof tw.request === 'function') return tw
    if (tw.ethereum && typeof tw.ethereum.request === 'function') return tw.ethereum
  }

  // 3. Multiple wallets sharing window.ethereum
  const list = window.ethereum?.providers
  if (Array.isArray(list)) {
    const match = list.find(looksLikeTrust)
    if (match) return match
  }

  // 4. Trust Wallet's in-app browser (mobile) sets window.ethereum directly
  if (looksLikeTrust(window.ethereum)) return window.ethereum

  return null
}

async function requireWallet() {
  if (!trustProvider) trustProvider = await findTrustProvider()
  if (!trustProvider) {
    throw new Error(
      'Trust Wallet was not detected. Install the Trust Wallet browser extension (or open this page in the Trust Wallet app browser), unlock it, and refresh. If MetaMask is installed, make sure Trust Wallet is enabled too.'
    )
  }
  return trustProvider
}

function requireContractAddress() {
  if (!/^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS)) {
    throw new Error('Ethereum contract address is missing or invalid. Deploy contracts/MediQueueAnchor.sol, then set VITE_ETHEREUM_CONTRACT_ADDRESS in your .env file and restart Vite.')
  }
}

async function switchToSepolia(provider) {
  let network = await provider.getNetwork()
  if (network.chainId === SEPOLIA_CHAIN_ID) return provider

  try {
    await provider.send('wallet_switchEthereumChain', [
      { chainId: SEPOLIA_CHAIN_HEX }
    ])
  } catch (error) {
    if (error.code !== 4902) {
      throw new Error('Please approve switching Trust Wallet to the Ethereum Sepolia network.')
    }

    await provider.send('wallet_addEthereumChain', [{
      chainId: SEPOLIA_CHAIN_HEX,
      chainName: 'Sepolia',
      nativeCurrency: {
        name: 'Sepolia Ether',
        symbol: 'ETH',
        decimals: 18
      },
      rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
      blockExplorerUrls: ['https://sepolia.etherscan.io']
    }])
  }

  const updatedProvider = new BrowserProvider(trustProvider)
  network = await updatedProvider.getNetwork()

  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error('Trust Wallet is not connected to Ethereum Sepolia.')
  }

  return updatedProvider
}

async function requireContractDeployed(provider) {
  requireContractAddress()
  const code = await provider.getCode(CONTRACT_ADDRESS)
  if (!code || code === '0x') {
    const network = await provider.getNetwork()
    throw new Error(
      `No MediQueueAnchor contract exists at ${CONTRACT_ADDRESS} on chain ${network.chainId} (Sepolia is 11155111). ` +
      'Fix: deploy contracts/MediQueueAnchor.sol on Sepolia and copy the CONTRACT address (not your wallet address, not the transaction hash) ' +
      'into VITE_ETHEREUM_CONTRACT_ADDRESS in .env, then restart Vite (Ctrl+C, npm run dev:all).'
    )
  }
}

function contractAt(providerOrSigner) {
  requireContractAddress()
  return new Contract(CONTRACT_ADDRESS, MEDIQUEUE_ANCHOR_ABI, providerOrSigner)
}

export async function connectSepoliaWallet() {
  const injected = await requireWallet()
  requireContractAddress()

  let provider = new BrowserProvider(injected)
  await provider.send('eth_requestAccounts', [])
  provider = await switchToSepolia(provider)

  await requireContractDeployed(provider)

  const signer = await provider.getSigner()
  const account = await signer.getAddress()
  const contract = contractAt(signer)
  const [totalAnchors, owner] = await Promise.all([
    contract.totalAnchors(),
    contract.owner()
  ])

  return {
    provider,
    account,
    owner,
    totalAnchors: Number(totalAnchors),
    isOwner: account.toLowerCase() === owner.toLowerCase()
  }
}

export async function readSepoliaAnchorStatus(provider, blocks) {
  await requireContractDeployed(provider)
  const contract = contractAt(provider)
  const totalAnchors = Number(await contract.totalAnchors())
  const relevant = blocks.filter(block => block.index > 0 && /^[a-fA-F0-9]{64}$/.test(block.hash))

  const statuses = {}
  // Keep RPC requests in small batches to avoid overwhelming public endpoints.
  for (let i = 0; i < relevant.length; i += 10) {
    const batch = relevant.slice(i, i + 10)
    const results = await Promise.all(
      batch.map(block => contract.anchored(`0x${block.hash}`))
    )
    batch.forEach((block, index) => {
      statuses[block.hash] = Boolean(results[index])
    })
  }

  return { totalAnchors, statuses }
}

export async function anchorPendingBlocks(provider, blocks) {
  const signer = await provider.getSigner()
  const contract = contractAt(signer)
  const validBlocks = blocks
    .filter(block => block.index > 0 && /^[a-fA-F0-9]{64}$/.test(block.hash))
    .slice(0, 10)

  if (!validBlocks.length) {
    throw new Error('There are no pending local blocks to anchor.')
  }

  const hashes = validBlocks.map(block => `0x${block.hash}`)
  const indexes = validBlocks.map(block => BigInt(block.index))
  const eventTypes = validBlocks.map(block => String(block.type).slice(0, 80))

  const transaction = await contract.anchorBatch(hashes, indexes, eventTypes)
  const receipt = await transaction.wait()

  return {
    transactionHash: transaction.hash,
    blockNumber: Number(receipt.blockNumber),
    anchoredCount: validBlocks.length
  }
}

export const getSepoliaContractAddress = () => CONTRACT_ADDRESS

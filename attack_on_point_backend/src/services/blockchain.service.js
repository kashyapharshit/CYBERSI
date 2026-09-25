const { ethers } = require('ethers');
const crypto = require('crypto');
const logger = require('../utils/logger');

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
};

// Hash only the canonical report payload so verification is reproducible.
const generateHash = (data) => {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(data))).digest('hex');
};

// Risk Assessment Result ka Hash Blockchain par Record karta hai
const recordRiskToBlockchain = async (assetRisksData) => {
  try {
    if (!wallet) {
      logger.warn('[BLOCKCHAIN] Private Key missing, skipping blockchain ledger.');
      return null;
    }
    const dataHash = generateHash(assetRisksData);
    
    // Send a zero-value transaction with embedded Hash in data bytes
    const tx = await wallet.sendTransaction({
      to: wallet.address, // self-transaction
      value: 0,
      data: ethers.hexlify(ethers.toUtf8Bytes(`RISK_HASH:${dataHash}`))
    });
    const receipt = await tx.wait();
    const network = await provider.getNetwork();
    logger.info(`[BLOCKCHAIN SUCCESS] Risk Hash logged to Blockchain! Tx Hash: ${tx.hash}`);
    return {
      tx_hash: tx.hash,
      block_number: receipt?.blockNumber ?? null,
      network: network.name || network.chainId.toString(),
      chain_id: network.chainId.toString(),
      signer: wallet.address,
      anchored_at: new Date()
    };
  } catch (error) {
    logger.error(`[BLOCKCHAIN ERROR] ${error.message}`);
    return null;
  }
};

// Fix Bug 1: Blockchain txHash se original hash extract karne ke liye function
const getHashFromBlockchain = async (txHash) => {
  try {
    if (!provider || !txHash) return null;
    const tx = await provider.getTransaction(txHash);
    if (!tx || !tx.data) return null;
    const decodedData = ethers.toUtf8String(tx.data);
    if (!decodedData.startsWith('RISK_HASH:')) return null;
    return decodedData.replace('RISK_HASH:', '');
  } catch (error) {
    logger.error(`[BLOCKCHAIN READ ERROR] ${error.message}`);
    return null;
  }
};

const getBlockchainStatus = async () => {
  const status = {
    configured: Boolean(PRIVATE_KEY),
    rpc_url_configured: Boolean(process.env.BLOCKCHAIN_RPC_URL),
    wallet_address: wallet?.address || null,
    reachable: false,
    network: null,
    block_number: null,
    balance_wei: null,
    error: null
  };

  try {
    const [network, blockNumber, balance] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
      wallet ? provider.getBalance(wallet.address) : Promise.resolve(null)
    ]);
    status.reachable = true;
    status.network = { chain_id: network.chainId.toString(), name: network.name };
    status.block_number = blockNumber;
    status.balance_wei = balance?.toString() || null;
  } catch (error) {
    status.error = error.message;
  }

  return status;
};

module.exports = {
  recordRiskToBlockchain,
  generateHash,
  getHashFromBlockchain,
  canonicalize,
  getBlockchainStatus
};

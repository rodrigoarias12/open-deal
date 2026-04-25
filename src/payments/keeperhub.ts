import {
  checkBalance,
  paymentSigner,
  readWalletConfig,
  type BalanceSnapshot,
  type WalletConfig,
} from "@keeperhub/wallet";

export { paymentSigner } from "@keeperhub/wallet";

export interface KeeperHubInfo {
  subOrgId: string;
  walletAddress: `0x${string}`;
  balance: BalanceSnapshot;
}

let cachedConfig: WalletConfig | null = null;

export async function getWallet(): Promise<WalletConfig> {
  if (!cachedConfig) cachedConfig = await readWalletConfig();
  return cachedConfig;
}

export async function getInfo(): Promise<KeeperHubInfo> {
  const wallet = await getWallet();
  const balance = await checkBalance(wallet);
  return {
    subOrgId: wallet.subOrgId,
    walletAddress: wallet.walletAddress,
    balance,
  };
}

/**
 * Drop-in replacement for fetch() that auto-pays HTTP 402 (x402 / MPP)
 * responses with the configured KeeperHub agentic wallet.
 *
 * For non-402 responses this is a regular fetch — wrapping our outbound
 * calls is therefore safe even on endpoints that never charge today.
 */
export const x402fetch = paymentSigner.fetch.bind(paymentSigner);

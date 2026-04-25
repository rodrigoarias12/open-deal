import { JsonRpcProvider, Wallet } from "ethers";
import { CHAIN, requireEnv } from "../config";

export function getProvider(): JsonRpcProvider {
  return new JsonRpcProvider(CHAIN.rpc, CHAIN.id);
}

export function getWallet(): Wallet {
  const pk = requireEnv("AGENT_PRIVATE_KEY");
  return new Wallet(pk, getProvider());
}

export async function getBalanceEth(address: string): Promise<bigint> {
  const provider = getProvider();
  return provider.getBalance(address);
}

export async function getBlockNumber(): Promise<number> {
  const provider = getProvider();
  return provider.getBlockNumber();
}

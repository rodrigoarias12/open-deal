import { JsonRpcProvider } from "ethers";
import { MAINNET } from "../config.js";

let provider: JsonRpcProvider | null = null;

function getProvider(): JsonRpcProvider {
  if (!provider) provider = new JsonRpcProvider(MAINNET.rpc, MAINNET.id);
  return provider;
}

export async function resolveName(name: string): Promise<string | null> {
  return getProvider().resolveName(name);
}

export async function lookupAddress(address: string): Promise<string | null> {
  return getProvider().lookupAddress(address);
}

export async function getTextRecord(name: string, key: string): Promise<string | null> {
  const resolver = await getProvider().getResolver(name);
  if (!resolver) return null;
  return resolver.getText(key);
}

export async function getTextRecords(
  name: string,
  keys: string[],
): Promise<Record<string, string | null>> {
  const resolver = await getProvider().getResolver(name);
  if (!resolver) return Object.fromEntries(keys.map((k) => [k, null]));
  const entries = await Promise.all(
    keys.map(async (k) => [k, await resolver.getText(k)] as const),
  );
  return Object.fromEntries(entries);
}

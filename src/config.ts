export const CHAIN = {
  id: 11155111,
  name: "sepolia",
  rpc:
    process.env.SEPOLIA_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com",
  explorer: "https://sepolia.etherscan.io",
} as const;

export const TOKENS = {
  WETH: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
} as const;

export const MODEL = "claude-sonnet-4-6";

export function env(key: string): string | undefined {
  return process.env[key];
}

export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

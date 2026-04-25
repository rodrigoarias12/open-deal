import { Wallet } from "ethers";

const wallet = Wallet.createRandom();

console.log("");
console.log("=== NEW DEV WALLET (testnet use only) ===");
console.log("");
console.log(`Address:     ${wallet.address}`);
console.log(`Private key: ${wallet.privateKey}`);
console.log(`Mnemonic:    ${wallet.mnemonic?.phrase}`);
console.log("");
console.log("=== NEXT STEPS ===");
console.log("");
console.log("1. Copy the private key into .env:");
console.log(`   AGENT_PRIVATE_KEY=${wallet.privateKey}`);
console.log("");
console.log("2. Fund this address on Sepolia testnet:");
console.log("   https://sepolia-faucet.pk910.de   (PoW faucet, always works)");
console.log("   https://sepoliafaucet.com         (Alchemy, fast if you have an account)");
console.log("");
console.log("NEVER commit .env or send real funds to this wallet.");
console.log("");

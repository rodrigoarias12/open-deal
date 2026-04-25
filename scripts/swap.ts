import "dotenv/config";
import { JsonRpcProvider, Wallet, formatEther, formatUnits, parseEther } from "ethers";
import { CHAIN, NATIVE_ETH, TOKENS, requireEnv } from "../src/config.js";
import { executeSwap, getQuote } from "../src/dex/uniswap.js";

async function main() {
  const provider = new JsonRpcProvider(CHAIN.rpc);
  const wallet = new Wallet(requireEnv("AGENT_PRIVATE_KEY"), provider);
  const amountIn = parseEther("0.001");

  const balanceBefore = await provider.getBalance(wallet.address);
  console.log(`agent ${wallet.address} on ${CHAIN.name}, balance ${formatEther(balanceBefore)} ETH`);
  if (balanceBefore < amountIn + parseEther("0.001")) {
    throw new Error("balance below 0.002 ETH (need swap amount + gas headroom)");
  }

  console.log(`quoting ${formatEther(amountIn)} ETH → USDC`);
  const quote = await getQuote({
    tokenIn: NATIVE_ETH,
    tokenOut: TOKENS.USDC,
    amount: amountIn,
    swapper: wallet.address,
  });
  console.log(`route ${quote.routeSummary}`);
  console.log(`expect ${formatUnits(quote.output.amount, 6)} USDC (min ${formatUnits(quote.output.minAmount, 6)})`);

  console.log(`executing swap...`);
  const result = await executeSwap(quote, wallet);
  console.log(`tx       ${result.hash}`);
  console.log(`status   ${result.receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
  console.log(`gas used ${result.receipt.gasUsed.toString()}`);
  console.log(`explorer ${result.explorerUrl}`);

  const balanceAfter = await provider.getBalance(wallet.address);
  console.log(`balance after ${formatEther(balanceAfter)} ETH (Δ ${formatEther(balanceAfter - balanceBefore)})`);
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});

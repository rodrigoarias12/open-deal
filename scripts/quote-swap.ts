import "dotenv/config";
import { formatEther, formatUnits, parseEther, Wallet } from "ethers";
import { NATIVE_ETH, TOKENS, requireEnv } from "../src/config";
import { getQuote } from "../src/dex/uniswap";

async function main() {
  const swapper = new Wallet(requireEnv("AGENT_PRIVATE_KEY")).address;
  const amountIn = parseEther("0.001");

  console.log(`Quoting ${formatEther(amountIn)} ETH → USDC on Sepolia for ${swapper}`);

  const quote = await getQuote({
    tokenIn: NATIVE_ETH,
    tokenOut: TOKENS.USDC,
    amount: amountIn,
    swapper,
  });

  console.log("");
  console.log("Route:    ", quote.routeSummary);
  console.log("Input:    ", formatEther(quote.input.amount), "ETH");
  console.log("Output:   ", formatUnits(quote.output.amount, 6), "USDC");
  console.log("Min out:  ", formatUnits(quote.output.minAmount, 6), "USDC (after slippage)");
  console.log("Slippage: ", quote.slippageBps, "bps");
  console.log("Gas est:  ", "$" + Number(quote.gasFeeUSD).toFixed(4));
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});

import type { TransactionReceipt, Wallet } from "ethers";
import { CHAIN, UNISWAP, requireEnv } from "../config.js";

export type TradeType = "EXACT_INPUT" | "EXACT_OUTPUT";

export interface QuoteParams {
  tokenIn: string;
  tokenOut: string;
  amount: bigint;
  swapper: string;
  tradeType?: TradeType;
}

export interface Quote {
  chainId: number;
  tradeType: TradeType;
  input: { token: string; amount: bigint };
  output: { token: string; amount: bigint; minAmount: bigint };
  routeSummary: string;
  slippageBps: number;
  gasFeeUSD: string;
  raw: any;
}

export async function getQuote(params: QuoteParams): Promise<Quote> {
  const apiKey = requireEnv("UNISWAP_API_KEY");
  const tradeType = params.tradeType ?? "EXACT_INPUT";

  const body = {
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    tokenInChainId: CHAIN.id,
    tokenOutChainId: CHAIN.id,
    amount: params.amount.toString(),
    type: tradeType,
    swapper: params.swapper,
  };

  let lastErr = "";
  let data: any = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${UNISWAP.tradingApi}/quote`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      data = await res.json();
      break;
    }
    lastErr = `${res.status} ${await res.text()}`;
    const transient = res.status === 404 && lastErr.includes("No quotes available");
    if (!transient || attempt === 4) throw new Error(`Uniswap /quote ${lastErr}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  if (!data) throw new Error(`Uniswap /quote ${lastErr}`);
  const q = data.quote;
  const aggOut = q.aggregatedOutputs?.[0];

  return {
    chainId: q.chainId,
    tradeType: q.tradeType,
    input: { token: q.input.token, amount: BigInt(q.input.amount) },
    output: {
      token: q.output.token,
      amount: BigInt(q.output.amount),
      minAmount: BigInt(aggOut?.minAmount ?? q.output.amount),
    },
    routeSummary: summarizeRoute(q.route),
    slippageBps: Math.round((q.slippage ?? 0.5) * 100),
    gasFeeUSD: q.gasFeeUSD ?? "0",
    raw: data,
  };
}

function summarizeRoute(route: any[][]): string {
  if (!route?.length) return "(no route)";
  return route
    .map((path) =>
      path
        .map((hop: any) => `${hop.tokenIn.symbol}→${hop.tokenOut.symbol}@${hop.type}/${hop.fee}bps`)
        .join(" → ")
    )
    .join(" | ");
}

export interface SwapTransaction {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface SwapResult {
  hash: string;
  receipt: TransactionReceipt;
  explorerUrl: string;
}

export async function executeSwap(quote: Quote, wallet: Wallet): Promise<SwapResult> {
  const apiKey = requireEnv("UNISWAP_API_KEY");
  const permitData = quote.raw.permitData;

  const body: Record<string, unknown> = { quote: quote.raw.quote };
  if (permitData) {
    body.permitData = permitData;
    body.signature = await wallet.signTypedData(
      permitData.domain,
      permitData.types,
      permitData.values,
    );
  }

  const res = await fetch(`${UNISWAP.tradingApi}/swap`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Uniswap /swap ${res.status}: ${text}`);
  }
  const data = await res.json();
  const swapTx: SwapTransaction = data.swap;

  const tx = await wallet.sendTransaction({
    to: swapTx.to,
    data: swapTx.data,
    value: swapTx.value ? BigInt(swapTx.value) : 0n,
    chainId: swapTx.chainId,
    gasLimit: swapTx.gasLimit ? BigInt(swapTx.gasLimit) : undefined,
    maxFeePerGas: swapTx.maxFeePerGas ? BigInt(swapTx.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: swapTx.maxPriorityFeePerGas
      ? BigInt(swapTx.maxPriorityFeePerGas)
      : undefined,
  });

  const receipt = await tx.wait();
  if (!receipt) throw new Error(`Tx ${tx.hash} returned no receipt`);

  return {
    hash: tx.hash,
    receipt,
    explorerUrl: `${CHAIN.explorer}/tx/${tx.hash}`,
  };
}

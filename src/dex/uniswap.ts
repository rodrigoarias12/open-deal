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

  const res = await fetch(`${UNISWAP.tradingApi}/quote`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Uniswap /quote ${res.status}: ${text}`);
  }

  const data = await res.json();
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

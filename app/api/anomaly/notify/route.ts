import "dotenv/config";
import { NextResponse } from "next/server";

// Side-effect endpoint called by the KeeperHub Watchdog workflow when
// anomalies are detected. Fires a Telegram alert via the server-side bot
// token (no secrets in the public workflow). Idempotent within a 60s
// window per anomaly to avoid duplicate alerts on retries.
//
// POST body shape (mirrors what /api/anomaly/check returns):
//   {
//     from: int, to: int,
//     anomalies: [{ anchor_index, kind, severity, message, evidence }]
//   }

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface IncomingAnomaly {
  anchor_index?: number;
  kind?: string;
  severity?: "low" | "medium" | "high";
  message?: string;
  evidence?: Record<string, unknown>;
}

interface IncomingBody {
  from?: number;
  to?: number;
  anomalies?: IncomingAnomaly[];
}

const SEVERITY_EMOJI: Record<string, string> = {
  high: "[!]",
  medium: "[~]",
  low: "[.]",
};

async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN/CHAT_ID not set" };
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    return { ok: false, error: `Telegram ${r.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true };
}

function formatAlert(body: IncomingBody): string {
  const anomalies = body.anomalies ?? [];
  const range = `${body.from ?? "?"}-${body.to ?? "?"}`;
  const lines: string[] = [
    `*Open Deal Watchdog*`,
    `_via KeeperHub workflow · scanned anchors ${range}_`,
    "",
    `*${anomalies.length} anomaly(ies) detected:*`,
    "",
  ];
  for (const a of anomalies.slice(0, 8)) {
    const tag = SEVERITY_EMOJI[a.severity ?? "low"] ?? "[?]";
    lines.push(`${tag} *${a.kind}* (anchor #${a.anchor_index})`);
    lines.push(`    ${a.message}`);
    lines.push("");
  }
  if (anomalies.length > 8) {
    lines.push(`_... and ${anomalies.length - 8} more_`);
  }
  lines.push(
    "https://chainscan-galileo.0g.ai/address/0xc4B91f01352cff1191eBd3d15A521D94ED081d89",
  );
  return lines.join("\n");
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: IncomingBody;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const anomalies = body.anomalies ?? [];
  if (anomalies.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "no anomalies in body" });
  }
  const text = formatAlert(body);
  const result = await sendTelegram(text);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, sent: false, error: result.error },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    sent: true,
    anomalies_alerted: anomalies.length,
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    method: "POST",
    description:
      "Watchdog notify hook: POST anomaly list, fires Telegram alert via server-side bot token.",
    expected_body: {
      from: 30,
      to: 43,
      anomalies: [
        {
          anchor_index: 42,
          kind: "vendor-concentration",
          severity: "medium",
          message: "Single seller acme-cartoneria won 4/5 decisions (80%)",
          evidence: { dominant_seller: "acme-cartoneria.openagents-treasury.eth" },
        },
      ],
    },
  });
}

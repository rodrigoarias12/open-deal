import "dotenv/config";
import { TelegramApprover } from "../src/notify/telegram";

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
  console.log(`[tg-test] token set, chat_id ${chatId}`);

  // Plain raw fetch first to isolate network issues
  console.log("[tg-test] step 1 — raw fetch getMe");
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const j = await r.json();
    console.log("  ok:", (j as { ok: boolean }).ok);
  } catch (e) {
    console.log("  raw fetch failed:", (e as Error).message);
    if ((e as Error).cause) console.log("  cause:", (e as Error).cause);
  }

  // Now use the class
  console.log("[tg-test] step 2 — sendMessage via TelegramApprover");
  const tg = new TelegramApprover({ token, chatId });
  try {
    const sent = await tg.sendMessage("test from openagents — hola 🧪");
    console.log("  message_id:", sent.message_id);
  } catch (e) {
    console.log("  sendMessage failed:", (e as Error).message);
    if ((e as Error).cause) console.log("  cause:", (e as Error).cause);
  }

  // Now full requestApproval with a 30s timeout (so this test doesn't hang too long)
  console.log("[tg-test] step 3 — requestApproval (30s timeout)");
  try {
    const result = await tg.requestApproval({
      title: "Smoke test — aprobá o ignorá",
      summary: "Este es un test del flow human-in-the-loop. Si apretás aprobar, el agente seguiría con el escrow. Si ignorás 30s, timeout.",
      amount_usd: 65,
      timeoutMs: 30_000,
    });
    console.log("  result:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.log("  requestApproval failed:", (e as Error).message);
    if ((e as Error).cause) console.log("  cause:", (e as Error).cause);
  }
}

main().catch((e) => {
  console.error("[tg-test] fatal:", e);
  process.exit(1);
});

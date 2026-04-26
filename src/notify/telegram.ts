/**
 * Minimal Telegram client for human-in-the-loop approval. Polling-only —
 * no webhook required, no public URL needed during the demo. Works from
 * any agent that can reach api.telegram.org.
 *
 * Usage:
 *
 *   const tg = new TelegramApprover({ token, chatId });
 *   const decision = await tg.requestApproval({
 *     title: "Cambio de proveedor para PAPEL-A4-RES",
 *     summary: "Acme te ofrece $6.50/u — 36% bajo el promedio histórico de $10.10/u.",
 *     amount_usd: 65,
 *     timeoutMs: 60_000,
 *   });
 *   // → { approved: true|false, reason: "human approved" | "timeout" | "rejected" }
 */

export interface ApprovalRequest {
  title: string;
  summary: string;
  amount_usd?: number;
  timeoutMs?: number;
}

export interface ApprovalResult {
  approved: boolean;
  reason: string;
  message_id?: number;
  callback_id?: string;
  responded_at?: string;
}

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: { id: number };
    data: string;
    message?: { message_id: number; chat: { id: number } };
  };
}

export class TelegramApprover {
  constructor(
    private readonly opts: { token: string; chatId: string | number },
  ) {}

  private url(method: string): string {
    return `https://api.telegram.org/bot${this.opts.token}/${method}`;
  }

  async sendMessage(
    text: string,
    keyboard?: Array<Array<{ text: string; callback_data: string }>>,
  ): Promise<{ message_id: number }> {
    const body: Record<string, unknown> = {
      chat_id: this.opts.chatId,
      text,
      parse_mode: "Markdown",
    };
    if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
    const resp = await fetch(this.url("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as {
      ok: boolean;
      description?: string;
      result?: { message_id: number };
    };
    if (!data.ok || !data.result) {
      throw new Error(`Telegram sendMessage failed: ${data.description}`);
    }
    return { message_id: data.result.message_id };
  }

  private async getUpdates(offset: number): Promise<TelegramUpdate[]> {
    const resp = await fetch(
      `${this.url("getUpdates")}?timeout=10&offset=${offset}&allowed_updates=${encodeURIComponent('["callback_query"]')}`,
    );
    const data = (await resp.json()) as { ok: boolean; result: TelegramUpdate[] };
    return data.ok ? data.result : [];
  }

  private async answerCallback(callbackId: string, text: string): Promise<void> {
    await fetch(this.url("answerCallbackQuery"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId, text }),
    });
  }

  private async editMessage(messageId: number, text: string): Promise<void> {
    await fetch(this.url("editMessageText"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: this.opts.chatId,
        message_id: messageId,
        text,
        parse_mode: "Markdown",
      }),
    });
  }

  async requestApproval(req: ApprovalRequest): Promise<ApprovalResult> {
    const timeoutMs = req.timeoutMs ?? 90_000;
    const stamp = Date.now();
    const approveData = `nproc:approve:${stamp}`;
    const rejectData = `nproc:reject:${stamp}`;

    const headline = `🚨 *${req.title}*`;
    const lines = [
      headline,
      "",
      req.summary,
    ];
    if (req.amount_usd !== undefined) {
      lines.push("");
      lines.push(`Monto: *$${req.amount_usd} USDC*`);
    }
    lines.push("");
    lines.push("_Esperando tu confirmación…_");

    const sent = await this.sendMessage(lines.join("\n"), [
      [
        { text: "✅ Aprobar y bloquear escrow", callback_data: approveData },
        { text: "✖ Rechazar", callback_data: rejectData },
      ],
    ]);

    const start = Date.now();
    let offset = 0;
    while (Date.now() - start < timeoutMs) {
      const updates = await this.getUpdates(offset);
      for (const u of updates) {
        offset = u.update_id + 1;
        const cb = u.callback_query;
        if (!cb) continue;
        if (cb.data !== approveData && cb.data !== rejectData) continue;
        if (
          cb.message?.chat?.id?.toString() !==
          String(this.opts.chatId)
        ) {
          continue;
        }
        const approved = cb.data === approveData;
        await this.answerCallback(cb.id, approved ? "Aprobado" : "Rechazado");
        await this.editMessage(
          sent.message_id,
          [
            headline,
            "",
            req.summary,
            req.amount_usd !== undefined
              ? `\nMonto: *$${req.amount_usd} USDC*`
              : "",
            "",
            approved
              ? "✅ *Aprobado por el operador.* El agente ejecuta ahora."
              : "✖ *Rechazado por el operador.* El agente no procede.",
          ].join("\n"),
        );
        return {
          approved,
          reason: approved ? "human approved" : "human rejected",
          message_id: sent.message_id,
          callback_id: cb.id,
          responded_at: new Date().toISOString(),
        };
      }
    }

    await this.editMessage(
      sent.message_id,
      [
        headline,
        "",
        req.summary,
        "",
        "⏱ *Timeout.* El agente no procedió por falta de respuesta.",
      ].join("\n"),
    );
    return { approved: false, reason: "timeout", message_id: sent.message_id };
  }
}

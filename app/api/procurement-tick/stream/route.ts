import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { runProcurementTick } from "../../../../apps/buyer-agent/src/index";

// Long-running SSE stream: same pipeline as /api/procurement-tick, but
// each console.log inside the run is pushed as an event so the UI can
// render a live terminal. Vercel pro caps maxDuration at 300s; for the
// demo we expect ~3-6 min so on hobby this might cut short.
export const maxDuration = 600;
export const dynamic = "force-dynamic";

function formatArg(a: unknown): string {
  if (typeof a === "string") return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

async function persistLatest(result: unknown): Promise<void> {
  try {
    const dir = path.join(process.cwd(), ".cache");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "latest-procurement-tick.json"),
      JSON.stringify(result, null, 2),
      "utf8",
    );
  } catch {
    /* read-only fs in some envs — non-fatal */
  }
}

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string | null, data: unknown) => {
        const lines: string[] = [];
        if (event) lines.push(`event: ${event}`);
        lines.push(`data: ${JSON.stringify(data)}`);
        lines.push("", "");
        try {
          controller.enqueue(encoder.encode(lines.join("\n")));
        } catch {
          /* client disconnected */
        }
      };

      // Heartbeat keeps the connection alive past intermediary proxies.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* ignore */
        }
      }, 15_000);

      // Hook console.log/error → emit as `line` events. Restored on
      // finally so other concurrent requests aren't affected.
      const origLog = console.log;
      const origError = console.error;
      console.log = (...args: unknown[]) => {
        send("line", { text: args.map(formatArg).join(" "), level: "info" });
        try {
          origLog(...args);
        } catch {
          /* ignore */
        }
      };
      console.error = (...args: unknown[]) => {
        send("line", { text: args.map(formatArg).join(" "), level: "error" });
        try {
          origError(...args);
        } catch {
          /* ignore */
        }
      };

      send("hello", {
        startedAt: new Date().toISOString(),
        msg: "stream connected · running procurement tick…",
      });

      try {
        const result = await runProcurementTick();
        await persistLatest(result);
        send("done", result);
      } catch (e) {
        send("error", { error: (e as Error).message });
      } finally {
        clearInterval(heartbeat);
        console.log = origLog;
        console.error = origError;
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

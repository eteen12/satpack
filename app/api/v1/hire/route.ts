import "server-only";
import { withPayment } from "@moneydevkit/nextjs/server";
import { runHireAgent } from "@/lib/services/hire-agent";
import { extractPreimage, logTx } from "@/lib/supabase";
import type { Lead } from "@/lib/services/hire-agent";

const PRICE_SATS = 1000;
const TIMEOUT_MS = 90_000;

const handler = async (req: Request) => {
  const startedAt = Date.now();
  const preimage = extractPreimage(req);

  let task = "";
  try {
    const body = (await req.json()) as { task?: unknown };
    task = typeof body.task === "string" ? body.task.trim() : "";
  } catch { /* empty body */ }

  if (!task) {
    return Response.json({ error: "missing required field: task" }, { status: 400 });
  }

  // collect all agent events into a result
  const leads: Lead[] = [];
  let summary = "";
  let totalSats = 0;
  let agentError = "";

  const agentDone = new Promise<void>((resolve) => {
    runHireAgent(task, (event) => {
      if (event.type === "done") {
        leads.push(...event.leads);
        summary = event.summary;
        totalSats = event.total_sats;
        resolve();
      } else if (event.type === "error") {
        agentError = event.message;
        resolve();
      }
    }).then(resolve).catch((err) => {
      agentError = err instanceof Error ? err.message : String(err);
      resolve();
    });
  });

  const timeout = new Promise<void>((resolve) =>
    setTimeout(() => { agentError = `timed out after ${TIMEOUT_MS}ms`; resolve(); }, TIMEOUT_MS)
  );

  await Promise.race([agentDone, timeout]);

  const ms = Date.now() - startedAt;

  void logTx({
    service: "hire-agent",
    amount_sats: PRICE_SATS,
    preimage,
    input_summary: task.slice(0, 80),
    result_summary: agentError
      ? `error: ${agentError.slice(0, 60)}`
      : `found ${leads.length} lead${leads.length === 1 ? "" : "s"}`,
    duration_ms: ms,
  });

  if (agentError) {
    return Response.json({ error: agentError, partial_leads: leads, ms }, { status: 200 });
  }

  return Response.json({ summary, leads, total_sats: totalSats, ms });
};

export const POST = withPayment({ amount: PRICE_SATS, currency: "SAT" }, handler);
export const maxDuration = 90;

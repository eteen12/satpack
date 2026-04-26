import "server-only";
import { withPayment } from "@moneydevkit/nextjs/server";
import { getAgent, logTx, incrementAgentUsage } from "@/lib/supabase";
import { runHireAgent, type Lead } from "@/lib/services/hire-agent";

const TIMEOUT_MS = 85_000;

const handler = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent) return Response.json({ error: "agent not found" }, { status: 404 });

  let task = "";
  try {
    const body = (await req.json()) as { task?: unknown };
    task = typeof body.task === "string" ? body.task.trim() : "";
  } catch { /* empty body */ }

  if (!task) return Response.json({ error: "missing required field: task" }, { status: 400 });

  const startedAt = Date.now();

  // ── external endpoint routing ──────────────────────────────────────────────
  if (agent.endpoint_url) {
    try {
      const res = await fetch(agent.endpoint_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) {
        const text = await res.text();
        return Response.json({ error: `agent returned ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
      }

      const result = await res.json() as { leads?: Lead[]; summary?: string; total_sats?: number; error?: string };
      if (result.error) return Response.json({ error: result.error }, { status: 500 });

      void incrementAgentUsage(agent.id);
      void logTx({
        service: "marketplace-hire",
        amount_sats: agent.price_sats,
        preimage: null,
        input_summary: agent.name,
        result_summary: `marketplace fee: ${Math.round(agent.price_sats * 0.1)} sats · ${agent.name}`,
        duration_ms: Date.now() - startedAt,
      });

      return Response.json(result);
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : "external agent failed" }, { status: 502 });
    }
  }

  // ── internal agent loop ────────────────────────────────────────────────────
  const systemPrefix = `You are ${agent.name}. Your role: ${agent.description}. Use your available tools to complete the user's request.`;

  const leads: Lead[] = [];
  let summary = "";
  let totalSats = 0;
  let agentError = "";

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => { agentError = "timed out"; resolve(); }, TIMEOUT_MS);
    runHireAgent(task, (event) => {
      if (event.type === "done") {
        leads.push(...event.leads);
        summary = event.summary;
        totalSats = event.total_sats;
        clearTimeout(timeout);
        resolve();
      } else if (event.type === "error") {
        agentError = event.message;
        clearTimeout(timeout);
        resolve();
      }
    }, systemPrefix).then(resolve).catch((err) => {
      agentError = err instanceof Error ? err.message : String(err);
      resolve();
    });
  });

  void incrementAgentUsage(agent.id);
  void logTx({
    service: "marketplace-hire",
    amount_sats: agent.price_sats,
    preimage: null,
    input_summary: agent.name,
    result_summary: agentError
      ? `error: ${agentError.slice(0, 60)}`
      : `marketplace fee: ${Math.round(agent.price_sats * 0.1)} sats · ${agent.name}`,
    duration_ms: Date.now() - startedAt,
  });

  if (agentError) return Response.json({ error: agentError, partial_leads: leads }, { status: 200 });
  return Response.json({ summary, leads, total_sats: totalSats, agent: agent.name });
};

// dynamic pricing: charge each agent's own price_sats
export const POST = withPayment(
  {
    amount: async (req: Request) => {
      const url = new URL(req.url);
      const id = url.pathname.split("/").at(-2) ?? "";
      const agent = await getAgent(id);
      return agent?.price_sats ?? 1000;
    },
    currency: "SAT",
  },
  handler,
);

export const maxDuration = 90;

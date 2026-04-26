import { runHireAgent, type AgentEvent } from "@/lib/services/hire-agent";

export const maxDuration = 60;

export async function POST(req: Request) {
  let task = "";
  try {
    const body = (await req.json()) as { task?: unknown };
    task = typeof body.task === "string" ? body.task.trim() : "";
  } catch { /* empty body */ }

  if (!task) {
    return Response.json({ error: "missing required field: task" }, { status: 400 });
  }

  const { readable, writable } = new TransformStream<string, string>();
  const writer = writable.getWriter();

  function emit(event: AgentEvent) {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    writer.write(line).catch(() => {/* stream closed */});
  }

  runHireAgent(task, emit).finally(() => {
    writer.close().catch(() => {/* already closed */});
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

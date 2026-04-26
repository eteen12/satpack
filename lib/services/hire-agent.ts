import "server-only";
import OpenAI from "openai";
import { searchPlaces } from "./search-places";
import { scrapeEmailsFromUrl } from "./scrape-email";
import { validateEmail } from "./validate-email";
import { logTx } from "../supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentEvent =
  | { type: "thinking"; message: string }
  | { type: "tool_start"; tool: string; label: string; sats: number }
  | { type: "tool_done"; tool: string; label: string; sats: number; ok: boolean; summary: string }
  | { type: "done"; leads: Lead[]; summary: string; total_sats: number }
  | { type: "error"; message: string };

export interface Lead {
  business_name: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  draft_subject: string;
  draft_body: string;
}

// ── Prices mirror the real endpoints ─────────────────────────────────────────

const PRICE_SEARCH = 75;
const PRICE_SCRAPE = 50;
const PRICE_VALIDATE = 32;
const HARD_TIMEOUT_MS = 60_000;
const MAX_TURNS = 25;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM = `You are a cold outreach lead-gen agent. You have three tools: search_places, scrape_email, validate_email.

IMPORTANT: Only call tools when the user is explicitly asking you to find leads, businesses, or contact info for outreach. For greetings, questions, or anything else — respond in plain conversational text and do NOT call any tools.

When the user gives a lead-gen task (e.g. "find 5 landscapers in Kelowna and pitch my web design services"):
1. Call search_places with a good Google-style query (include city + industry). Use details=true to get websites.
2. For each result that has a website, call scrape_email to find contact emails.
3. For each email found, call validate_email. Only keep emails with deliverable_guess "high" or "medium".
4. Once you have the target number of verified leads (default 5), stop calling tools.
5. Draft a short, natural outreach email for each verified lead — personalized with their business name, referencing the user's pitch.

Be efficient. Don't call more tools than needed.

After completing a lead search, your FINAL message must be ONLY valid JSON — no prose, no markdown:
{
  "summary": "Found X verified leads for ...",
  "leads": [
    {
      "business_name": "string",
      "website": "string",
      "email": "string",
      "phone": "string",
      "address": "string",
      "draft_subject": "string",
      "draft_body": "string"
    }
  ]
}

For non-lead-gen messages, respond in plain conversational text. Do not wrap it in JSON.`;

// ── Tools ─────────────────────────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_places",
      description:
        "Search Google Places for businesses by natural-language query. Returns names, addresses, phones, and websites.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "e.g. 'landscapers in Kelowna BC'" },
          limit: { type: "number", description: "Max results 1-10, default 5" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "scrape_email",
      description:
        "Scrape email addresses from a business website. Returns a list of emails found.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Full URL, e.g. https://lavishlandscapes.ca" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "validate_email",
      description:
        "Validate an email via MX lookup + deliverability checks. Returns deliverable_guess: high | medium | low | invalid.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string" },
        },
        required: ["email"],
      },
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────────────────────

async function execTool(
  name: string,
  args: Record<string, unknown>,
  emit: Emit,
): Promise<{ content: string; sats: number }> {
  if (name === "search_places") {
    const query = String(args.query ?? "");
    const limit = Math.min(10, Math.max(1, Number(args.limit ?? 5)));
    emit({ type: "tool_start", tool: "search_places", label: `"${query}"`, sats: PRICE_SEARCH });
    const t0 = Date.now();
    const res = await searchPlaces({ q: query, limit, details: true });
    const places = res.results.map((r) => ({
      name: r.name,
      address: r.formatted_address,
      phone: r.formatted_phone_number ?? "",
      website: r.website ?? "",
      rating: r.rating,
    }));
    void logTx({ service: "places-search", amount_sats: PRICE_SEARCH, preimage: null, input_summary: query, result_summary: `found ${places.length} place${places.length === 1 ? "" : "s"}`, duration_ms: Date.now() - t0 });
    emit({ type: "tool_done", tool: "search_places", label: `"${query}"`, sats: PRICE_SEARCH, ok: true, summary: `${places.length} businesses` });
    return { content: JSON.stringify(places), sats: PRICE_SEARCH };
  }

  if (name === "scrape_email") {
    const url = String(args.url ?? "");
    let domain = url;
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep url */ }
    emit({ type: "tool_start", tool: "scrape_email", label: domain, sats: PRICE_SCRAPE });
    const t0 = Date.now();
    const res = await scrapeEmailsFromUrl(url);
    void logTx({ service: "scrape-email", amount_sats: PRICE_SCRAPE, preimage: null, input_summary: domain, result_summary: res.emails.length > 0 ? `found ${res.emails.length} email${res.emails.length === 1 ? "" : "s"}` : "no emails", duration_ms: Date.now() - t0 });
    const summary = res.emails.length > 0 ? res.emails.slice(0, 2).join(", ") : "no emails found";
    emit({ type: "tool_done", tool: "scrape_email", label: domain, sats: PRICE_SCRAPE, ok: res.emails.length > 0, summary });
    return { content: JSON.stringify({ emails: res.emails }), sats: PRICE_SCRAPE };
  }

  if (name === "validate_email") {
    const email = String(args.email ?? "");
    emit({ type: "tool_start", tool: "validate_email", label: email, sats: PRICE_VALIDATE });
    const t0 = Date.now();
    const res = await validateEmail(email);
    void logTx({ service: "validate-email", amount_sats: PRICE_VALIDATE, preimage: null, input_summary: email.split("@")[1] ?? email, result_summary: `deliverable: ${res.deliverable_guess}`, duration_ms: Date.now() - t0 });
    const ok = res.deliverable_guess === "high" || res.deliverable_guess === "medium";
    emit({ type: "tool_done", tool: "validate_email", label: email, sats: PRICE_VALIDATE, ok, summary: `deliverable: ${res.deliverable_guess}` });
    return { content: JSON.stringify({ email, deliverable_guess: res.deliverable_guess, mx_valid: res.mx_valid }), sats: PRICE_VALIDATE };
  }

  throw new Error(`unknown tool: ${name}`);
}

// ── Agent loop ─────────────────────────────────────────────────────────────────

type Emit = (e: AgentEvent) => void;

export async function runHireAgent(task: string, emit: Emit): Promise<void> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) { emit({ type: "error", message: "AI_API_KEY not set" }); return; }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  });
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  const deadline = Date.now() + HARD_TIMEOUT_MS;
  let totalSats = 0;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: task },
  ];

  emit({ type: "thinking", message: "reading your request..." });

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      if (Date.now() > deadline) { emit({ type: "error", message: "timed out after 60s" }); return; }

      const res = await client.chat.completions.create({ model, messages, tools: TOOLS, tool_choice: "auto", max_tokens: 4096 });
      const choice = res.choices[0];
      if (!choice) { emit({ type: "error", message: "empty LLM response" }); return; }

      messages.push(choice.message);

      const toolCalls = choice.message.tool_calls;
      if (!toolCalls?.length) {
        // Final answer
        const raw = choice.message.content ?? "";
        let leads: Lead[] = [];
        let summary = raw;
        try {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]) as { leads?: Lead[]; summary?: string };
            leads = parsed.leads ?? [];
            summary = parsed.summary ?? raw;
          }
        } catch { /* keep summary = raw */ }
        emit({ type: "done", leads, summary, total_sats: totalSats });
        return;
      }

      // Execute tool calls sequentially so progress streams in order
      for (const call of toolCalls) {
        if (Date.now() > deadline) break;
        if (!("function" in call)) continue; // skip non-function tool calls
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call.function.arguments) as Record<string, unknown>; } catch { /* empty */ }
        const { content, sats } = await execTool(call.function.name, args, emit);
        totalSats += sats;
        messages.push({ role: "tool", tool_call_id: call.id, content });
      }
    }
    emit({ type: "error", message: "max turns exceeded" });
  } catch (err) {
    emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
}

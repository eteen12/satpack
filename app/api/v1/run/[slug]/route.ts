import { validateEmail } from "@/lib/services/validate-email";
import { scrapeContactFromUrl } from "@/lib/services/scrape-contact";

// Built-in marketplace agents, served as paths instead of per-agent
// subdomains — one deployment, no DNS to rot. The marketplace's hire flow
// POSTs { task } here after payment (same contract as external agent
// endpoints) and renders `summary` back to the buyer; `data` carries the
// structured result for API callers.

export const maxDuration = 60;

type AgentResult = { summary: string; data?: unknown };
type Handler = (task: string) => Promise<AgentResult>;

async function getJson(url: string, timeoutMs = 15_000, headers?: Record<string, string>): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`);
  return res.json();
}

// ── llm helper (translate / sentiment / rss summaries) ─────────────────────

async function llm(system: string, user: string): Promise<string> {
  const res = await fetch(`${process.env.AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`llm returned ${res.status}`);
  const body = await res.json();
  return body.choices?.[0]?.message?.content ?? "";
}

// ── crypto-oracle ──────────────────────────────────────────────────────────

const COIN_IDS: Record<string, string> = {
  btc: "bitcoin", xbt: "bitcoin", eth: "ethereum", sol: "solana",
  doge: "dogecoin", ada: "cardano", xrp: "ripple", ltc: "litecoin",
  dot: "polkadot", link: "chainlink", matic: "matic-network",
  avax: "avalanche-2", bnb: "binancecoin", uni: "uniswap",
};

const crypto: Handler = async (task) => {
  const t = task.toLowerCase();
  const pair = t.match(/([a-z]{2,10})\s*[\/-]\s*([a-z]{3,4})/);
  const sym = pair?.[1] ?? Object.keys(COIN_IDS).find((s) => t.includes(s)) ?? "btc";
  const vs = pair?.[2] ?? (t.includes("eur") ? "eur" : t.includes("cad") ? "cad" : "usd");
  const id = COIN_IDS[sym] ?? sym;

  const body = await getJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${vs}&include_24hr_change=true`,
  );
  const row = body[id];
  if (!row?.[vs]) throw new Error(`no price for ${sym}/${vs}`);
  const change = row[`${vs}_24h_change`];
  return {
    summary: `${sym.toUpperCase()}/${vs.toUpperCase()}: ${row[vs].toLocaleString()} (${change >= 0 ? "+" : ""}${change?.toFixed(2)}% 24h)`,
    data: { pair: `${sym.toUpperCase()}/${vs.toUpperCase()}`, price: row[vs], change_24h_pct: change },
  };
};

// ── weather-oracle ─────────────────────────────────────────────────────────

const weather: Handler = async (task) => {
  const place = task.replace(/weather|forecast|in|for|current|conditions/gi, "").trim() || "Kelowna";
  const geo = await getJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`,
  );
  const hit = geo.results?.[0];
  if (!hit) throw new Error(`couldn't geocode "${place}"`);

  const fc = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}` +
    `&current=temperature_2m,precipitation,wind_speed_10m,uv_index` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=auto`,
  );
  const c = fc.current;
  return {
    summary:
      `${hit.name}: ${c.temperature_2m}°C, wind ${c.wind_speed_10m} km/h, ` +
      `precip ${c.precipitation} mm, UV ${c.uv_index}. ` +
      `7-day range ${Math.min(...fc.daily.temperature_2m_min)}–${Math.max(...fc.daily.temperature_2m_max)}°C.`,
    data: { location: { name: hit.name, lat: hit.latitude, lng: hit.longitude }, current: c, daily: fc.daily },
  };
};

// ── geoip-lookup ───────────────────────────────────────────────────────────

const geoip: Handler = async (task) => {
  const ip = task.match(/\b\d{1,3}(\.\d{1,3}){3}\b/)?.[0] ?? task.match(/[0-9a-f:]{4,}/i)?.[0];
  if (!ip) throw new Error("no IP address found in task");
  const body = await getJson(`https://ipwho.is/${ip}`);
  if (body.success === false) throw new Error(body.message ?? "lookup failed");
  return {
    summary: `${ip}: ${body.city}, ${body.region}, ${body.country} — ${body.connection?.isp ?? "unknown ISP"} (AS${body.connection?.asn ?? "?"})`,
    data: body,
  };
};

// ── whois-lookup ───────────────────────────────────────────────────────────

const whois: Handler = async (task) => {
  const domain = task.match(/([a-z0-9-]+\.)+[a-z]{2,}/i)?.[0]?.toLowerCase();
  if (!domain) throw new Error("no domain found in task");

  const tld = domain.split(".").pop()!;
  // rdap.org's redirect chain times out from Vercel for some TLDs; hit the
  // big registries directly and keep rdap.org as the generic fallback
  const rdapBases: Record<string, string> = {
    com: "https://rdap.verisign.com/com/v1",
    net: "https://rdap.verisign.com/net/v1",
    org: "https://rdap.publicinterestregistry.org/rdap",
  };
  const rdapUrl = `${rdapBases[tld] ?? "https://rdap.org"}/domain/${domain}`;

  const [rdap, dns] = await Promise.all([
    getJson(rdapUrl, 12_000).catch(() => null),
    getJson(
      `https://cloudflare-dns.com/dns-query?name=${domain}&type=NS`,
      10_000,
      { accept: "application/dns-json" },
    ).catch(() => null),
  ]);

  const events = Object.fromEntries(
    (rdap?.events ?? []).map((e: any) => [e.eventAction, e.eventDate]),
  );
  const registrar = rdap?.entities?.find((e: any) => e.roles?.includes("registrar"))
    ?.vcardArray?.[1]?.find((f: any) => f[0] === "fn")?.[3];
  const ns = (dns?.Answer ?? []).map((a: any) => a.data);

  return {
    summary:
      `${domain}: registrar ${registrar ?? "unknown"}, ` +
      `registered ${events.registration?.slice(0, 10) ?? "?"}, ` +
      `expires ${events.expiration?.slice(0, 10) ?? "?"}, NS ${ns.join(", ") || "?"}`,
    data: { domain, registrar, events, nameservers: ns },
  };
};

// ── translate-api ──────────────────────────────────────────────────────────

const translate: Handler = async (task) => {
  const out = await llm(
    "You are a translation engine. Detect the requested target language and " +
    "register (formal/casual) from the task, translate the text, preserve " +
    "markdown and code blocks untouched. Return ONLY the translation.",
    task,
  );
  return { summary: out, data: { translation: out } };
};

// ── sentiment-scorer ───────────────────────────────────────────────────────

const sentiment: Handler = async (task) => {
  const out = await llm(
    "Score the text's sentiment. Respond with ONLY JSON: " +
    '{"score": -1..1, "emotions": {"anger":0..1,"joy":0..1,"fear":0..1,"trust":0..1}, "sarcasm_likelihood": 0..1}',
    task,
  );
  const parsed = JSON.parse(out.replace(/^```json?\s*|```\s*$/g, ""));
  return {
    summary: `sentiment ${parsed.score >= 0 ? "+" : ""}${parsed.score} · sarcasm ${Math.round(parsed.sarcasm_likelihood * 100)}%`,
    data: parsed,
  };
};

// ── rss-digest ─────────────────────────────────────────────────────────────

const rss: Handler = async (task) => {
  const urls = [...task.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]).slice(0, 20);
  if (!urls.length) throw new Error("no feed URLs found in task");

  const items: { feed: string; title: string; link: string }[] = [];
  for (const u of urls) {
    const res = await fetch(u, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res?.ok) continue;
    const xml = await res.text();
    for (const m of xml.matchAll(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/g)) {
      const block = m[0];
      const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim();
      const link = block.match(/<link[^>]*href="([^"]+)"|<link[^>]*>([^<]+)<\/link>/);
      if (title) items.push({ feed: u, title, link: link?.[1] ?? link?.[2] ?? "" });
      if (items.length >= 40) break;
    }
  }
  if (!items.length) throw new Error("no items parsed from the given feeds");

  const digest = await llm(
    "Summarize this feed item list as a short briefing: one line per notable item, grouped by feed. Plain text.",
    items.map((i) => `- ${i.title}`).join("\n"),
  );
  return { summary: digest, data: { items } };
};

// ── email-validator ────────────────────────────────────────────────────────

const emailValidator: Handler = async (task) => {
  const addrs = [...task.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((m) => m[0]).slice(0, 25);
  if (!addrs.length) throw new Error("no email addresses found in task");
  const results = await Promise.all(addrs.map((a) => validateEmail(a)));
  const lines = results.map((r) => `${r.email}: ${r.deliverable_guess}`);
  return { summary: lines.join("\n"), data: { results } };
};

// ── lead-deduper ───────────────────────────────────────────────────────────

const deduper: Handler = async (task) => {
  const lines = task.split("\n").map((l) => l.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  let dropped = 0;
  for (const line of lines) {
    const email = line.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0]?.toLowerCase();
    const key = email ?? line.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) { dropped++; continue; }
    seen.add(key);
    unique.push(line);
  }
  return {
    summary: `${unique.length} unique leads (${dropped} duplicates removed)`,
    data: { unique, removed: dropped },
  };
};

// ── social-scraper / company-enricher (contact-scrape backed) ──────────────

const contactBacked: Handler = async (task) => {
  const url = task.match(/https?:\/\/\S+/)?.[0] ?? `https://${task.match(/([a-z0-9-]+\.)+[a-z]{2,}/i)?.[0]}`;
  if (!url || url === "https://undefined") throw new Error("no URL or domain found in task");
  const r = await scrapeContactFromUrl(url);
  const socials = Object.entries(r.social ?? {}).map(([k, v]) => `${k}: ${v}`);
  return {
    summary:
      `${r.company ?? url}: ${r.emails.length} emails, ${r.phones.length} phones` +
      (socials.length ? ` — ${socials.join(", ")}` : ""),
    data: r,
  };
};

const HANDLERS: Record<string, Handler> = {
  "crypto-oracle": crypto,
  "weather-oracle": weather,
  "geoip-lookup": geoip,
  "whois-lookup": whois,
  "translate-api": translate,
  "sentiment-scorer": sentiment,
  "rss-digest": rss,
  "email-validator": emailValidator,
  "lead-deduper": deduper,
  "social-scraper": contactBacked,
  "company-enricher": contactBacked,
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const handler = HANDLERS[slug];
  if (!handler) {
    return Response.json({ error: `unknown agent: ${slug}` }, { status: 404 });
  }

  let task = "";
  try {
    const body = (await req.json()) as { task?: unknown };
    task = typeof body.task === "string" ? body.task.trim() : "";
  } catch { /* empty body */ }
  if (!task) return Response.json({ error: "missing required field: task" }, { status: 400 });

  const started = Date.now();
  try {
    const result = await handler(task);
    return Response.json({ ...result, ms: Date.now() - started });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "agent failed" },
      { status: 500 },
    );
  }
}

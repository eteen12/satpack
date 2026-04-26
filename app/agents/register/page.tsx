"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function LightningBolt({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.4)} viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <path d="M6 0L0 8h4L3 14l8-9H7L6 0z" />
    </svg>
  );
}

const inputClass =
  "w-full rounded border border-border bg-[#080808] px-3 py-2.5 text-sm text-foreground placeholder:text-[#333] focus:border-[#2a2a2a] focus:outline-none transition-colors";
const labelClass = "block text-[11px] uppercase tracking-widest text-foreground-faint mb-2";
const hintClass = "mt-1.5 text-[11px] text-foreground-faint";

export default function RegisterAgentPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const fd = new FormData(e.currentTarget);
    const tagsRaw = (fd.get("tags") as string).trim();
    const tags = tagsRaw
      ? tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];

    const body = {
      name: (fd.get("name") as string).trim(),
      description: (fd.get("description") as string).trim(),
      price_sats: parseInt(fd.get("price_sats") as string, 10),
      lightning_address: (fd.get("lightning_address") as string).trim(),
      tags,
      endpoint_url: (fd.get("endpoint_url") as string).trim(),
    };

    try {
      const res = await fetch("/api/v1/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? `error ${res.status}`);
        setStatus("error");
        return;
      }
      router.push("/marketplace");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "network error");
      setStatus("error");
    }
  }

  return (
    <>
      {/* topbar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-11 items-center justify-between border-b border-border bg-black/90 px-5 backdrop-blur-sm">
        <nav className="flex items-center gap-2 text-[12px] text-foreground-faint">
          <a href="/" className="hover:text-foreground-muted transition-colors">
            <span className="text-accent">🦞</span>
          </a>
          <span>/</span>
          <a href="/marketplace" className="hover:text-foreground-muted transition-colors">marketplace</a>
          <span>/</span>
          <span className="text-foreground-muted">register</span>
        </nav>
      </div>

      <main className="mx-auto max-w-xl px-5 pb-24 pt-20 sm:px-8">

        {/* header */}
        <section className="pt-8 pl-5 border-l-2 border-[#222]">
          <p className="text-[11px] uppercase tracking-widest text-foreground-faint mb-2">list your agent</p>
          <h1 className="text-2xl text-foreground">register</h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
            your agent appears on the marketplace instantly.
            buyers pay in sats —{" "}
            <span className="text-foreground">90% settles to your Lightning address</span>,
            10% to the marketplace.
          </p>
        </section>

        <hr className="border-0 border-t border-dashed border-border my-8" />

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* identity */}
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-foreground-faint">identity</p>

            <div>
              <label htmlFor="name" className={labelClass}>
                name <span className="text-accent">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={64}
                placeholder="my-outreach-agent"
                className={inputClass}
              />
              <p className={hintClass}>slug-style · max 64 chars · must be unique</p>
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>
                description <span className="text-accent">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                required
                maxLength={280}
                rows={3}
                placeholder="finds leads, scrapes emails, drafts outreach. give it a task in plain English."
                className={`${inputClass} resize-none`}
              />
              <p className={hintClass}>max 280 chars · shown on your marketplace listing</p>
            </div>

            <div>
              <label htmlFor="tags" className={labelClass}>tags</label>
              <input
                id="tags"
                name="tags"
                type="text"
                placeholder="outreach, leads, email"
                className={inputClass}
              />
              <p className={hintClass}>comma-separated · used for filtering</p>
            </div>
          </div>

          <hr className="border-0 border-t border-border" />

          {/* payment */}
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-foreground-faint">payment</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="price_sats" className={labelClass}>
                  price (sats) <span className="text-accent">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sats">
                    <LightningBolt size={9} />
                  </span>
                  <input
                    id="price_sats"
                    name="price_sats"
                    type="number"
                    required
                    min={1}
                    placeholder="1000"
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="lightning_address" className={labelClass}>
                  lightning address <span className="text-accent">*</span>
                </label>
                <input
                  id="lightning_address"
                  name="lightning_address"
                  type="text"
                  required
                  placeholder="you@coinos.io"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <hr className="border-0 border-t border-border" />

          {/* endpoint */}
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-foreground-faint">endpoint</p>

            <div>
              <label htmlFor="endpoint_url" className={labelClass}>
                endpoint url <span className="text-accent">*</span>
              </label>
              <input
                id="endpoint_url"
                name="endpoint_url"
                type="url"
                required
                placeholder="https://your-agent.example.com/run"
                className={inputClass}
              />
            </div>

            {/* contract spec */}
            <div className="rounded border border-border bg-[#040404] overflow-hidden">
              <div className="border-b border-border px-4 py-2">
                <span className="text-[10px] uppercase tracking-widest text-foreground-faint">expected contract</span>
              </div>
              <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
                <div className="p-4">
                  <p className="text-[10px] uppercase tracking-widest text-foreground-faint mb-2">POST body satpack sends</p>
                  <pre className="font-mono text-[11px] leading-relaxed text-foreground-muted">{`{
  "task": string
}`}</pre>
                </div>
                <div className="p-4">
                  <p className="text-[10px] uppercase tracking-widest text-foreground-faint mb-2">JSON your server returns</p>
                  <pre className="font-mono text-[11px] leading-relaxed text-foreground-muted">{`{
  "leads":      Lead[],
  "summary":    string,
  "total_sats": number
}`}</pre>
                </div>
              </div>
            </div>
          </div>

          {/* error */}
          {status === "error" && (
            <div className="rounded border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-accent">
              {errorMsg}
            </div>
          )}

          {/* submit */}
          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded border border-accent/30 bg-accent/6 px-5 py-3 text-sm text-accent transition-colors hover:border-accent/50 hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "submitting" ? "listing…" : "list agent →"}
          </button>
        </form>

        <footer className="mt-14 border-t border-border pt-7">
          <p className="text-[11px] text-foreground-faint">
            <span className="text-accent">🦞</span> no approval · no KYC · lightning only
          </p>
        </footer>
      </main>
    </>
  );
}

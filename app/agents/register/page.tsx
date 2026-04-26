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
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : [];

    const body = {
      name: (fd.get("name") as string).trim(),
      description: (fd.get("description") as string).trim(),
      price_sats: parseInt(fd.get("price_sats") as string, 10),
      lightning_address: (fd.get("lightning_address") as string).trim(),
      tags,
      endpoint_url: (fd.get("endpoint_url") as string).trim() || undefined,
    };

    try {
      const res = await fetch("/api/v1/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };
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

  const inputClass =
    "w-full rounded border border-border bg-[#080808] px-3 py-2 text-sm text-foreground placeholder:text-foreground-faint focus:border-[#333] focus:outline-none transition-colors";
  const labelClass = "block text-[11px] uppercase tracking-widest text-foreground-faint mb-1.5";

  return (
    <>
      {/* topbar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-11 items-center justify-between border-b border-border bg-black/90 px-5 backdrop-blur-sm">
        <a href="/" className="text-sm text-foreground-muted hover:text-foreground transition-colors">
          <span className="text-accent">🦞</span> satpack
        </a>
        <a
          href="/marketplace"
          className="text-[11px] uppercase tracking-widest text-foreground-faint hover:text-foreground transition-colors"
        >
          ← marketplace
        </a>
      </div>

      <main className="mx-auto max-w-xl px-5 pb-24 pt-20 sm:px-8">
        <section className="pt-6">
          <p className="heading mb-2 text-xs uppercase tracking-widest text-foreground-faint">
            list your agent
          </p>
          <h1 className="text-2xl text-foreground">register agent</h1>
          <p className="mt-3 text-sm text-foreground-muted">
            list your agent on the marketplace. buyers pay in sats.{" "}
            <span className="text-foreground">90% goes to your lightning address.</span> no approval needed.
          </p>
        </section>

        <hr className="border-0 border-t border-dashed border-border my-8" />

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* name */}
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
              placeholder="outreach-agent"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-foreground-faint">slug-style. max 64 chars. must be unique.</p>
          </div>

          {/* description */}
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
            <p className="mt-1 text-[11px] text-foreground-faint">max 280 chars.</p>
          </div>

          {/* price + lightning address */}
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

          {/* tags */}
          <div>
            <label htmlFor="tags" className={labelClass}>
              tags
            </label>
            <input
              id="tags"
              name="tags"
              type="text"
              placeholder="outreach, leads, email"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-foreground-faint">comma-separated.</p>
          </div>

          {/* endpoint url */}
          <div>
            <label htmlFor="endpoint_url" className={labelClass}>
              endpoint url <span className="text-foreground-faint">(optional)</span>
            </label>
            <input
              id="endpoint_url"
              name="endpoint_url"
              type="url"
              placeholder="https://your-agent.example.com/run"
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-foreground-faint">
              for future external routing. leave blank to use the internal agent loop.
            </p>
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
            className="w-full rounded border border-accent/30 bg-accent/8 px-5 py-3 text-sm text-accent transition-colors hover:border-accent/50 hover:bg-accent/14 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "submitting" ? "listing..." : "list agent →"}
          </button>
        </form>

        <footer className="mt-16 border-t border-border pt-8">
          <p className="text-xs text-foreground-faint">
            <span aria-hidden className="text-accent">🦞</span>{" "}
            no approval · no KYC · lightning only
          </p>
        </footer>
      </main>
    </>
  );
}

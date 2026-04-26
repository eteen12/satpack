import { HireChat } from "./HireForm";

export const dynamic = "force-dynamic";

export default function HirePage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#1a1a1a] bg-black px-5 z-10">
        <a href="/" className="text-sm text-[#555] transition-colors hover:text-[#888]">
          <span className="text-[#00d4ff]">🦞</span> satpack
        </a>
        <span className="inline-flex items-center gap-1.5 rounded border border-[#f7931a]/25 bg-[#f7931a]/5 px-2.5 py-1 text-[11px] uppercase tracking-widest text-[#f7931a]">
          <svg width={10} height={14} viewBox="0 0 10 14" fill="currentColor" aria-hidden>
            <path d="M6 0L0 8h4L3 14l8-9H7L6 0z" />
          </svg>
          powered by lightning
        </span>
      </header>
      <HireChat />
    </div>
  );
}

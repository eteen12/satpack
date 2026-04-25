import { getDashboardStats } from "@/lib/supabase";
import { Live } from "./Live";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Satpack — Live",
  description:
    "Watch AI agents pay for API calls in real time over the Lightning Network.",
};

export default async function DashboardPage() {
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const initial = configured ? await getDashboardStats() : null;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            <span className="font-mono text-xs uppercase tracking-widest text-amber-300">
              live
            </span>
          </div>
          <h1 className="font-mono text-3xl text-zinc-100 sm:text-4xl">
            satpack
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            Watch AI agents pay for API calls in real time over the Bitcoin
            Lightning Network. Each row is one paid request — agent earned its
            keep, sats moved.
          </p>
        </header>

        <Live initial={initial} configured={configured} />

        <footer className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-900 pt-6 font-mono text-xs text-zinc-500">
          <a className="hover:text-zinc-300" href="/">
            home
          </a>
          <a className="hover:text-zinc-300" href="/api/v1/catalog">
            /api/v1/catalog
          </a>
          <a className="hover:text-zinc-300" href="/api/v1/llms.txt">
            /api/v1/llms.txt
          </a>
          <a
            className="hover:text-zinc-300"
            href="https://github.com/eteen12/satpack"
            target="_blank"
            rel="noreferrer"
          >
            github
          </a>
        </footer>
      </div>
    </main>
  );
}

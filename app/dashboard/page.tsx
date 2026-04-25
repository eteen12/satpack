import { getDashboardStats } from "@/lib/supabase";
import { Live } from "./Live";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Satpack — Live",
  description:
    "Watch AI agents pay for API calls in real time over the Bitcoin Lightning Network.",
};

export default async function DashboardPage() {
  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const initial = configured ? await getDashboardStats() : null;

  return (
    <main className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-baseline gap-3">
            <span className="font-display text-2xl tracking-tight text-foreground">
              satpack
            </span>
            <span className="hidden items-center gap-2 text-foreground-faint sm:inline-flex">
              <span className="h-1 w-1 rounded-full bg-foreground-faint" />
              <span className="eyebrow">live · L402</span>
            </span>
          </a>
          <nav className="flex items-center gap-7 text-sm text-foreground-muted">
            <a href="/" className="hover:text-foreground">
              Home
            </a>
            <a href="/api/v1/catalog" className="hover:text-foreground">
              Catalog
            </a>
            <a
              href="https://github.com/eteen12/satpack"
              target="_blank"
              rel="noreferrer"
              className="hidden hover:text-foreground sm:inline"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <span className="live-dot" />
              live · {new Date().toISOString().slice(0, 10)}
            </p>
            <h1 className="font-display-tight mt-3 text-4xl leading-tight text-foreground sm:text-5xl">
              Agents paying, in real time.
            </h1>
            <p className="mt-3 max-w-2xl text-foreground-muted">
              Every row below is one autonomous API call settled over Bitcoin
              Lightning. Auto-refreshing every 3s.
            </p>
          </div>
        </div>

        <Live initial={initial} configured={configured} />
      </div>
    </main>
  );
}

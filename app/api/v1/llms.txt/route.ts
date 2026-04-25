import { CATALOG } from "@/lib/catalog";

function renderLlmsTxt(): string {
  const lines: string[] = [];
  lines.push("# Satpack — Lightning-Powered API Marketplace for AI Agents");
  lines.push("");
  lines.push(
    "> APIs that pay for themselves. Per-call pricing in Bitcoin Lightning sats.",
  );
  lines.push(
    "> No signup, no API keys, no monthly minimums. Built for autonomous agents.",
  );
  lines.push("");
  lines.push("## Catalog");
  lines.push("Machine-readable JSON: `/api/v1/catalog`");
  lines.push("");
  lines.push("## Available services");
  for (const s of CATALOG.services) {
    lines.push(
      `### ${s.name} — \`${s.id}\` (${s.price_sats} sats per call)`,
    );
    lines.push(s.description);
    lines.push("");
    lines.push(`- **Endpoint:** \`${s.method} ${s.endpoint}\``);
    lines.push(`- **Example:** \`${s.example}\``);
    lines.push(`- **Returns:** ${s.returns}`);
    lines.push("- **Params:**");
    for (const [k, v] of Object.entries(s.params)) {
      lines.push(`  - \`${k}\` — ${v}`);
    }
    lines.push("");
  }
  lines.push("## Payment flow (L402)");
  lines.push("");
  lines.push(
    "Each service endpoint is gated by HTTP 402 + Bitcoin Lightning Network,",
  );
  lines.push("using the L402 protocol (bLIP-26).");
  lines.push("");
  lines.push(
    "1. Send `GET <endpoint>`. The response is HTTP 402 with body",
  );
  lines.push("   `{ macaroon, invoice, paymentHash, amountSats, expiresAt }`.");
  lines.push(
    "2. Pay the BOLT-11 invoice with any Lightning wallet. You'll receive",
  );
  lines.push("   a 32-byte hex preimage (proof of payment).");
  lines.push(
    "3. Retry the request with header `Authorization: L402 <macaroon>:<preimage>`.",
  );
  lines.push(
    "4. The server verifies the credential and preimage, then returns 200",
  );
  lines.push("   with the data.");
  lines.push("");
  lines.push(
    "Credentials expire 15 minutes after issuance. Each credential is single-use.",
  );
  return lines.join("\n");
}

export function GET() {
  return new Response(renderLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

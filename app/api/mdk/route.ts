// Unified Money Dev Kit webhook endpoint. Required by @moneydevkit/nextjs —
// MDK's hosted service POSTs here to spin up the merchant Lightning node,
// confirm checkouts, list channels, etc. Re-export GET as well for signed
// URL-based actions (createCheckout, renewSubscription).
export { POST, GET } from "@moneydevkit/nextjs/server/route";

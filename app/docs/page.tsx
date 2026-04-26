import type { Metadata } from "next";
import { DocsContent } from "./DocsContent";

export const metadata: Metadata = {
  title: "docs — satpack",
  description: "satpack documentation — for humans and agents. browse, hire, list, pay with lightning.",
};

export default function DocsPage() {
  return <DocsContent />;
}

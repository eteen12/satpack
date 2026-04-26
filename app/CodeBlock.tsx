"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="ml-2 text-[10px] uppercase tracking-widest text-foreground-faint transition-colors hover:text-accent"
    >
      {copied ? "✓" : "copy"}
    </button>
  );
}

export function CodeBlock({
  label,
  children,
}: {
  label?: string;
  children: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="overflow-hidden rounded border border-border bg-[#060606]">
      <div className="flex items-center justify-between border-b border-border bg-[#0a0a0a] px-3 py-2">
        <span className="text-[10px] uppercase tracking-widest text-foreground-faint">
          {label ?? ""}
        </span>
        <button
          onClick={copy}
          className="text-[10px] uppercase tracking-widest transition-colors text-foreground-faint hover:text-accent"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre px-4 py-3 text-xs leading-relaxed text-foreground">
        <code>{children}</code>
      </pre>
    </div>
  );
}

import { readFileSync } from "fs";
import path from "path";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

export const metadata = {
  title: "Help — Operations Runbook",
};

export default function DashboardHelpPage() {
  const runbookPath = path.join(process.cwd(), "docs/runbooks/DENIS-OPS.md");
  let content = "";
  try {
    content = readFileSync(runbookPath, "utf8");
  } catch {
    content = "Runbook file not found. See docs/runbooks/DENIS-OPS.md in the repository.";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-dash-text-muted hover:text-dash-text"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-dash-accent-muted">
          <BookOpen className="size-5 text-dash-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-dash-text">Operations Runbook</h1>
          <p className="text-sm text-dash-text-muted">
            What to do when Denis or ordering misbehaves
          </p>
        </div>
      </div>
      <article className="prose prose-invert max-w-none rounded-xl border border-dash-border bg-dash-surface p-6 text-sm text-dash-text-secondary">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{content}</pre>
      </article>
    </div>
  );
}

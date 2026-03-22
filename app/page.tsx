"use client";

import { useEffect, useState } from "react";
import {
  listRuns,
  startRun,
  type RunListItem,
  type PaginatedRunList,
} from "@/lib/fabro-api";

const EXAMPLE_WORKFLOW = `digraph HelloWorld {
  graph [goal="Say hello"]
  rankdir=LR

  start [shape=Mdiamond, label="Start"]
  exit  [shape=Msquare, label="Exit"]
  greet [label="Greet", prompt="Say hello and describe what Fabro does."]

  start -> greet -> exit
}`;

function formatElapsed(secs?: number): string {
  if (secs == null) return "—";
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function statusColor(status: string): string {
  switch (status) {
    case "working":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "pending":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    case "review":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "merge":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function RunCard({ run }: { run: RunListItem }) {
  return (
    <a
      href={`/runs/${run.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-100">
            {run.title}
          </h3>
          <p className="mt-0.5 text-sm text-zinc-500">
            {run.workflow.slug} · {run.repository.name}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(run.status)}`}
        >
          {run.status}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
        <span>{formatElapsed(run.timings?.elapsed_secs)}</span>
        {run.question && (
          <span className="text-amber-600 dark:text-amber-500">
            Needs input: {run.question.text}
          </span>
        )}
      </div>
    </a>
  );
}

export default function Home() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [showStartForm, setShowStartForm] = useState(false);
  const [dotSource, setDotSource] = useState(EXAMPLE_WORKFLOW);
  const [goal, setGoal] = useState("Say hello");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data: PaginatedRunList = await listRuns(20, 0);
        if (!cancelled) setRuns(data.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load runs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleStartRun() {
    setStarting(true);
    setError(null);
    try {
      await startRun({ dot_source: dotSource, goal });
      setShowStartForm(false);
      setDotSource(EXAMPLE_WORKFLOW);
      setGoal("Say hello");
      const data = await listRuns(20, 0);
      setRuns(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start run");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Fabro Cloud
          </h1>
          <p className="text-sm text-zinc-500">
            The dark software factory — orchestrate AI workflows
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Runs
          </h2>
          <button
            onClick={() => setShowStartForm(!showStartForm)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {showStartForm ? "Cancel" : "Start run"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {showStartForm && (
          <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-4 font-medium text-zinc-900 dark:text-zinc-100">
              New workflow run
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Goal
                </label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="What should this run accomplish?"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Workflow (Graphviz DOT)
                </label>
                <textarea
                  value={dotSource}
                  onChange={(e) => setDotSource(e.target.value)}
                  rows={14}
                  className="w-full font-mono text-sm"
                  spellCheck={false}
                />
              </div>
              <button
                onClick={handleStartRun}
                disabled={starting}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {starting ? "Starting…" : "Start run"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-zinc-500">Loading runs…</p>
        ) : runs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-zinc-500 dark:text-zinc-400">
              No runs yet. Start a workflow run to get started.
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Make sure <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">FABRO_API_URL</code> is set, or run Fabro locally and set it to{" "}
              <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">http://localhost:3001</code>
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {runs.map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

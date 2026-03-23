"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getRun, getRunEventsUrl } from "@/lib/fabro-api";

export default function RunDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [run, setRun] = useState<unknown>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getRun(id);
        if (!cancelled) setRun(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load run");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  useEffect(() => {
    const url = getRunEventsUrl(id);
    const eventSource = new EventSource(url);
    const lines: string[] = [];
    eventSource.onmessage = (e) => {
      lines.push(e.data);
      setEvents([...lines]);
    };
    eventSource.onerror = () => {
      eventSource.close();
    };
    return () => eventSource.close();
  }, [id]);

  if (loading && !run) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
        <p className="text-zinc-500">Loading run…</p>
      </div>
    );
  }

  if (error && !run) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-400"
        >
          ← Back to runs
        </Link>
      </div>
    );
  }

  const r = run as { id?: string; status?: string; error?: { message: string }; created_at?: string };

  const stageOutputs: { stage: string; output: string }[] = [];
  for (const line of events) {
    try {
      const ev = JSON.parse(line) as { type?: string; stage?: string; data?: { output?: string } };
      if (ev.type === "stage.completed" && ev.stage && ev.data?.output !== undefined) {
        stageOutputs.push({ stage: ev.stage, output: ev.data.output });
      }
    } catch {
      // skip non-JSON lines
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-400"
          >
            ← Back to runs
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Run {r.id ?? id}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                r.status === "running"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  : r.status === "completed"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : r.status === "failed"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {r.status ?? "—"}
            </span>
            {r.created_at && (
              <span>Started {new Date(r.created_at).toLocaleString()}</span>
            )}
          </div>
          {r.error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {r.error.message}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {stageOutputs.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
              Output
            </h2>
            <div className="space-y-4">
              {stageOutputs.map(({ stage, output }, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="mb-2 block text-xs font-medium uppercase text-zinc-500">
                    {stage}
                  </span>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-900 dark:text-zinc-100">
                    {output}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Event stream
          </h2>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-900 p-4 font-mono text-sm text-zinc-100 dark:border-zinc-800">
            {events.length === 0 ? (
              <p className="text-zinc-500">Waiting for events…</p>
            ) : (
              events.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))
            )}
          </div>
        </section>

        {run ? (
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
              Run payload
            </h2>
            <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-white p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900">
              {JSON.stringify(run, null, 2)}
            </pre>
          </section>
        ) : null}
      </main>
    </div>
  );
}

/**
 * In-memory store for runs and events.
 * For production, replace with a database.
 */

import type { Run, RunEvent } from "./types";

const runs = new Map<string, Run>();
const runEvents = new Map<string, RunEvent[]>();
const eventListeners = new Map<string, Set<(event: RunEvent) => void>>();

export function createRun(run: Run): void {
  runs.set(run.id, run);
  runEvents.set(run.id, []);
}

export function getRun(id: string): Run | undefined {
  return runs.get(id);
}

export function updateRun(id: string, updates: Partial<Run>): void {
  const run = runs.get(id);
  if (run) {
    Object.assign(run, updates);
  }
}

export function listRuns(limit: number, offset: number): Run[] {
  return Array.from(runs.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(offset, offset + limit);
}

export function hasMoreRuns(limit: number, offset: number): boolean {
  return runs.size > offset + limit;
}

export function appendEvent(runId: string, event: RunEvent): void {
  const list = runEvents.get(runId) ?? [];
  list.push(event);
  runEvents.set(runId, list);

  const listeners = eventListeners.get(runId);
  if (listeners) {
    listeners.forEach((cb) => cb(event));
  }
}

export function getEvents(runId: string): RunEvent[] {
  return runEvents.get(runId) ?? [];
}

export function subscribeToRun(runId: string, callback: (event: RunEvent) => void): () => void {
  let listeners = eventListeners.get(runId);
  if (!listeners) {
    listeners = new Set();
    eventListeners.set(runId, listeners);
  }
  listeners.add(callback);
  return () => listeners!.delete(callback);
}

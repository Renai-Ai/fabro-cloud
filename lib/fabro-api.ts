/**
 * Fabro API client.
 * All requests go through /api/fabro which proxies to the Fabro backend.
 */

const API_BASE = "/api/fabro";

const DEMO_MODE = process.env.NEXT_PUBLIC_FABRO_DEMO === "1";

function headers(): HeadersInit {
  const h: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (DEMO_MODE) {
    (h as Record<string, string>)["X-Fabro-Demo"] = "1";
  }
  return h;
}

export type RunStatus =
  | "queued"
  | "starting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

export type BoardColumn = "working" | "pending" | "review" | "merge";

export interface RunListItem {
  id: string;
  repository: { name: string };
  title: string;
  workflow: { slug: string };
  status: BoardColumn;
  created_at: string;
  pull_request?: { number: number; additions?: number; deletions?: number };
  timings?: { elapsed_secs: number; elapsed_warning?: boolean };
  sandbox?: { id: string };
  question?: { text: string };
}

export interface PaginatedRunList {
  data: RunListItem[];
  meta: { has_more: boolean };
}

export interface WorkflowListItem {
  slug: string;
  description?: string;
}

export interface PaginatedWorkflowList {
  data: WorkflowListItem[];
  meta: { has_more: boolean };
}

export interface StartRunRequest {
  dot_source: string;
  goal?: string;
}

export interface RunStatusResponse {
  id: string;
  status: RunStatus;
  created_at: string;
  error?: { message: string };
  queue_position?: number;
}

export async function listRuns(
  limit = 20,
  offset = 0
): Promise<PaginatedRunList> {
  const res = await fetch(
    `${API_BASE}/runs?page[limit]=${limit}&page[offset]=${offset}`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail ?? res.statusText);
  }
  return res.json();
}

export async function getRun(id: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/runs/${id}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail ?? res.statusText);
  }
  return res.json();
}

export async function startRun(req: StartRunRequest): Promise<RunStatusResponse> {
  const res = await fetch(`${API_BASE}/runs`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail ?? res.statusText);
  }
  return res.json();
}

export async function cancelRun(id: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/runs/${id}/cancel`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail ?? res.statusText);
  }
  return res.json();
}

export async function listWorkflows(
  limit = 20,
  offset = 0
): Promise<PaginatedWorkflowList> {
  const res = await fetch(
    `${API_BASE}/workflows?page[limit]=${limit}&page[offset]=${offset}`,
    { headers: headers(), cache: "no-store" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail ?? res.statusText);
  }
  return res.json();
}

export function getRunEventsUrl(id: string): string {
  return `${API_BASE}/runs/${id}/events`;
}

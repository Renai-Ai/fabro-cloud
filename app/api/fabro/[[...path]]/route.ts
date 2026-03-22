/**
 * Native workflow API - replicates Fabro conventions.
 * Uses our TypeScript workflow engine instead of Fabro backend.
 */

import { NextRequest, NextResponse } from "next/server";
import type { Run } from "@/lib/workflow/types";
import { listRuns, getRun, hasMoreRuns } from "@/lib/workflow/store";
import { startWorkflowRun, getRunEventsStream } from "@/lib/workflow/engine";

function runToListItem(run: Run): unknown {
  return {
    id: run.id,
    repository: { name: run.repository },
    title: run.title,
    workflow: { slug: run.workflowSlug },
    status: run.boardStatus,
    created_at: run.created_at,
    timings: run.timings,
    question: run.question,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const pathSegments = path ?? [];

  if (pathSegments[0] === "health" || (pathSegments.length === 0)) {
    return NextResponse.json({ status: "ok" });
  }

  if (pathSegments[0] === "runs" && !pathSegments[1]) {
    const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("page[limit]") ?? "20", 10)));
    const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("page[offset]") ?? "0", 10));
    const runs = listRuns(limit, offset);
    return NextResponse.json({
      data: runs.map((r) => runToListItem(r)),
      meta: { has_more: hasMoreRuns(limit, offset) },
    });
  }

  if (pathSegments[0] === "runs" && pathSegments[1] && pathSegments[2] === "events") {
    const runId = pathSegments[1];
    const run = getRun(runId);
    if (!run) {
      return NextResponse.json(
        { errors: [{ status: "404", title: "Not Found", detail: "Run not found" }] },
        { status: 404 }
      );
    }
    const stream = getRunEventsStream(runId);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  if (pathSegments[0] === "runs" && pathSegments[1]) {
    const runId = pathSegments[1];
    const run = getRun(runId);
    if (!run) {
      return NextResponse.json(
        { errors: [{ status: "404", title: "Not Found", detail: "Run not found" }] },
        { status: 404 }
      );
    }
    return NextResponse.json(run);
  }

  if (pathSegments[0] === "workflows") {
    return NextResponse.json({
      data: [
        { slug: "hello-world", description: "Simple greet workflow" },
        { slug: "plan-implement", description: "Plan, then implement" },
      ],
      meta: { has_more: false },
    });
  }

  return NextResponse.json(
    { errors: [{ status: "404", title: "Not Found", detail: "Unknown endpoint" }] },
    { status: 404 }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const pathSegments = path ?? [];

  if (pathSegments[0] === "runs" && pathSegments.length <= 1) {
    let body: { dot_source: string; goal?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { errors: [{ status: "400", title: "Bad Request", detail: "Invalid JSON" }] },
        { status: 400 }
      );
    }
    if (!body.dot_source) {
      return NextResponse.json(
        { errors: [{ status: "400", title: "Bad Request", detail: "dot_source is required" }] },
        { status: 400 }
      );
    }
    try {
      const runId = await startWorkflowRun(body.dot_source, body.goal);
      const run = getRun(runId);
      return NextResponse.json(
        {
          id: runId,
          status: run?.status ?? "queued",
          created_at: run?.created_at ?? new Date().toISOString(),
        },
        { status: 201 }
      );
    } catch (err) {
      console.error("[workflow] Start run error:", err);
      return NextResponse.json(
        { errors: [{ status: "500", title: "Internal Error", detail: String(err) }] },
        { status: 500 }
      );
    }
  }

  if (pathSegments[0] === "runs" && pathSegments[2] === "cancel") {
    return NextResponse.json(
      { errors: [{ status: "501", title: "Not Implemented", detail: "Cancel not yet implemented" }] },
      { status: 501 }
    );
  }

  return NextResponse.json(
    { errors: [{ status: "404", title: "Not Found", detail: "Unknown endpoint" }] },
    { status: 404 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { errors: [{ status: "501", title: "Not Implemented" }] },
    { status: 501 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { errors: [{ status: "501", title: "Not Implemented" }] },
    { status: 501 }
  );
}

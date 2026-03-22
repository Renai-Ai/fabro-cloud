/**
 * API proxy to Fabro backend.
 * Forwards all /api/fabro/* requests to FABRO_API_URL.
 * Supports SSE streaming for run events.
 */

import { NextRequest, NextResponse } from "next/server";

const FABRO_API_URL = process.env.FABRO_API_URL;
const FABRO_DEMO = process.env.NEXT_PUBLIC_FABRO_DEMO === "1";

// Headers to forward to Fabro (exclude Next.js / proxy headers)
const FORWARD_HEADERS = [
  "accept",
  "accept-encoding",
  "content-type",
  "authorization",
  "x-fabro-demo",
];

function getTargetUrl(path: string[], searchParams: URLSearchParams): string {
  const base = FABRO_API_URL!.replace(/\/$/, "");
  const pathStr = path.length ? path.join("/") : "";
  const query = searchParams.toString();
  const url = pathStr ? `${base}/${pathStr}` : base;
  return query ? `${url}?${query}` : url;
}

function buildHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (FABRO_DEMO) headers.set("X-Fabro-Demo", "1");
  return headers;
}

// Mock data for demo mode when FABRO_API_URL is unset
const DEMO_RUNS = {
  data: [
    {
      id: "01JNQVR7M0EJ5GKAT2SC4ERS1Z",
      repository: { name: "api-server" },
      title: "Add rate limiting to auth endpoints",
      workflow: { slug: "implement" },
      status: "merge",
      created_at: new Date().toISOString(),
      timings: { elapsed_secs: 420 },
    },
    {
      id: "01JNQVR7M0EJ5GKAT2SC4ERABC",
      repository: { name: "web-app" },
      title: "Implement login UI",
      workflow: { slug: "plan-implement" },
      status: "working",
      created_at: new Date().toISOString(),
      question: { text: "Approve or revise the plan?" },
      timings: { elapsed_secs: 120 },
    },
  ],
  meta: { has_more: false },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const pathSegments = path ?? [];

  if (!FABRO_API_URL) {
    if (FABRO_DEMO) {
      if (pathSegments[0] === "runs" && !pathSegments[1]) {
        return NextResponse.json(DEMO_RUNS);
      }
      if (pathSegments[0] === "runs" && pathSegments[1]) {
        return NextResponse.json({
          id: pathSegments[1],
          status: "completed",
          created_at: new Date().toISOString(),
        });
      }
      if (pathSegments[0] === "workflows") {
        return NextResponse.json({
          data: [
            { slug: "implement", description: "Implement a feature" },
            { slug: "plan-implement", description: "Plan, approve, implement" },
          ],
          meta: { has_more: false },
        });
      }
      if (pathSegments[0] === "health") {
        return NextResponse.json({ status: "ok" });
      }
      if (pathSegments[0] === "runs" && pathSegments[2] === "events") {
        return new Response(
          "data: {\"type\":\"demo\",\"message\":\"Demo mode - no real events\"}\n\n",
          {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          }
        );
      }
    }
    return NextResponse.json(
      {
        errors: [
          {
            status: "503",
            title: "Service Unavailable",
            detail:
              "Fabro backend is not configured. Set FABRO_API_URL or enable NEXT_PUBLIC_FABRO_DEMO=1 for demo mode.",
          },
        ],
      },
      { status: 503 }
    );
  }

  const url = getTargetUrl(pathSegments, req.nextUrl.searchParams);
  const headers = buildHeaders(req);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok && res.status !== 410) {
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = { errors: [{ status: String(res.status), title: "Error", detail: text }] };
      }
      return NextResponse.json(body, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "";
    const isStream = contentType.includes("text/event-stream");

    if (isStream) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[fabro-proxy] GET error:", err);
    return NextResponse.json(
      {
        errors: [
          {
            status: "502",
            title: "Bad Gateway",
            detail: "Failed to reach Fabro backend.",
          },
        ],
      },
      { status: 502 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const pathSegments = path ?? [];

  if (!FABRO_API_URL) {
    if (FABRO_DEMO && pathSegments[0] === "runs" && pathSegments.length <= 1) {
      return NextResponse.json(
        {
          id: `01JNQMOCK${Date.now().toString(36).toUpperCase()}`,
          status: "queued",
          created_at: new Date().toISOString(),
        },
        { status: 201 }
      );
    }
    return NextResponse.json(
      {
        errors: [
          {
            status: "503",
            title: "Service Unavailable",
            detail:
              "Fabro backend is not configured. Set FABRO_API_URL or enable NEXT_PUBLIC_FABRO_DEMO=1.",
          },
        ],
      },
      { status: 503 }
    );
  }

  const url = getTargetUrl(pathSegments, req.nextUrl.searchParams);
  const headers = buildHeaders(req);

  let body: string | undefined;
  const contentType = req.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    body = await req.text();
    if (!headers.has("content-type")) headers.set("content-type", contentType);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    const text = await res.text();

    if (!res.ok) {
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = { errors: [{ status: String(res.status), title: "Error", detail: text }] };
      }
      return NextResponse.json(body, { status: res.status });
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[fabro-proxy] POST error:", err);
    return NextResponse.json(
      {
        errors: [
          {
            status: "502",
            title: "Bad Gateway",
            detail: "Failed to reach Fabro backend.",
          },
        ],
      },
      { status: 502 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  if (!FABRO_API_URL) {
    return NextResponse.json(
      {
        errors: [
          {
            status: "503",
            title: "Service Unavailable",
            detail:
              "Fabro backend is not configured. Set FABRO_API_URL to your Fabro server URL.",
          },
        ],
      },
      { status: 503 }
    );
  }

  const { path } = await params;
  const pathSegments = path ?? [];
  const url = getTargetUrl(pathSegments, req.nextUrl.searchParams);
  const headers = buildHeaders(req);
  const body = await req.text();
  if (req.headers.get("content-type")) {
    headers.set("content-type", req.headers.get("content-type")!);
  }

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body,
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[fabro-proxy] PATCH error:", err);
    return NextResponse.json(
      {
        errors: [
          {
            status: "502",
            title: "Bad Gateway",
            detail: "Failed to reach Fabro backend.",
          },
        ],
      },
      { status: 502 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  if (!FABRO_API_URL) {
    return NextResponse.json(
      {
        errors: [
          {
            status: "503",
            title: "Service Unavailable",
            detail:
              "Fabro backend is not configured. Set FABRO_API_URL to your Fabro server URL.",
          },
        ],
      },
      { status: 503 }
    );
  }

  const { path } = await params;
  const pathSegments = path ?? [];
  const url = getTargetUrl(pathSegments, req.nextUrl.searchParams);
  const headers = buildHeaders(req);

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers,
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[fabro-proxy] DELETE error:", err);
    return NextResponse.json(
      {
        errors: [
          {
            status: "502",
            title: "Bad Gateway",
            detail: "Failed to reach Fabro backend.",
          },
        ],
      },
      { status: 502 }
    );
  }
}

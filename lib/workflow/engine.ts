/**
 * Workflow execution engine.
 * Walks the graph from start to exit, executing agent/command nodes.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { parseDot } from "./parser";
import { complete } from "./llm";
import {
  createRun,
  updateRun,
  appendEvent,
  getRun,
  subscribeToRun,
  getEvents,
} from "./store";
import type { ParsedWorkflow, WorkflowNode } from "./types";

const execAsync = promisify(exec);

function ulid(): string {
  const chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let result = "01";
  for (let i = 0; i < 22; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function getNextNode(workflow: ParsedWorkflow, fromId: string): string | null {
  const edge = workflow.edges.find((e) => e.from === fromId);
  return edge?.to ?? null;
}

async function executeNode(
  runId: string,
  node: WorkflowNode,
  context: Record<string, string>,
  goal?: string
): Promise<{ outcome: "success" | "fail"; output?: string }> {
  const systemContext = goal ? `Goal for this run: ${goal}\n\n` : "";

  if (node.type === "prompt" || node.type === "agent") {
    const prompt = node.prompt ?? `Complete the task: ${node.label ?? node.id}`;
    const fullPrompt = `${systemContext}${prompt}`;
    try {
      const output = await complete(fullPrompt);
      return { outcome: "success", output };
    } catch (err) {
      return {
        outcome: "fail",
        output: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (node.type === "command" && node.script) {
    try {
      const { stdout, stderr } = await execAsync(node.script, {
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      });
      return { outcome: "success", output: stdout + (stderr ? `\n${stderr}` : "") };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { outcome: "fail", output: msg };
    }
  }

  if (node.type === "start" || node.type === "exit") {
    return { outcome: "success" };
  }

  if (node.type === "human") {
    return { outcome: "success", output: "[Human gate - would block for input]" };
  }

  return { outcome: "success" };
}

export async function startWorkflowRun(dotSource: string, goal?: string): Promise<string> {
  const workflow = parseDot(dotSource);
  const runId = ulid();
  const slug = workflow.name.toLowerCase().replace(/\W/g, "-");

  createRun({
    id: runId,
    status: "queued",
    boardStatus: "working",
    dotSource,
    goal,
    workflowSlug: slug,
    repository: "default",
    title: goal ?? workflow.goal ?? slug,
    created_at: new Date().toISOString(),
  });

  appendEvent(runId, {
    type: "run.started",
    run_id: runId,
    data: { goal, workflow: slug },
    timestamp: new Date().toISOString(),
  });

  setImmediate(() => executeWorkflow(runId, workflow));
  return runId;
}

async function executeWorkflow(runId: string, workflow: ParsedWorkflow): Promise<void> {
  const run = getRun(runId);
  if (!run || run.status === "cancelled") return;

  updateRun(runId, { status: "running" });
  const startTime = Date.now();
  const context: Record<string, string> = {};

  let nodeId: string | null = workflow.startId;

  while (nodeId) {
    const node = workflow.nodes.get(nodeId);
    if (!node) {
      updateRun(runId, { status: "failed", error: { message: `Unknown node: ${nodeId}` } });
      return;
    }

    if (node.type === "exit") {
      break;
    }

    if (node.type === "start") {
      appendEvent(runId, { type: "stage.started", run_id: runId, stage: nodeId, timestamp: new Date().toISOString() });
      nodeId = getNextNode(workflow, nodeId);
      continue;
    }

    updateRun(runId, { currentStage: nodeId });
    appendEvent(runId, { type: "stage.started", run_id: runId, stage: nodeId, timestamp: new Date().toISOString() });

    const result = await executeNode(runId, node, context, run.goal);

    appendEvent(runId, {
      type: "stage.completed",
      run_id: runId,
      stage: nodeId,
      data: { outcome: result.outcome, output: result.output?.slice(0, 500) },
      timestamp: new Date().toISOString(),
    });

    if (result.outcome === "fail") {
      updateRun(runId, {
        status: "failed",
        error: { message: result.output ?? "Stage failed" },
        timings: { elapsed_secs: (Date.now() - startTime) / 1000 },
      });
      return;
    }

    nodeId = getNextNode(workflow, nodeId);
  }

  const elapsedSecs = (Date.now() - startTime) / 1000;
  updateRun(runId, {
    status: "completed",
    boardStatus: "merge",
    currentStage: undefined,
    timings: { elapsed_secs: elapsedSecs },
  });

  appendEvent(runId, {
    type: "run.completed",
    run_id: runId,
    data: { elapsed_secs: elapsedSecs },
    timestamp: new Date().toISOString(),
  });
}

export function getRunEventsStream(runId: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  return new ReadableStream({
    start(controller) {
      for (const event of getEvents(runId)) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      unsub = subscribeToRun(runId, (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });
    },
    cancel() {
      unsub?.();
    },
  });
}

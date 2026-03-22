/**
 * Workflow types following Fabro conventions.
 * @see https://docs.fabro.sh/core-concepts/workflows
 */

export type NodeShape =
  | "Mdiamond"  // start
  | "Msquare"   // exit
  | "box"       // agent
  | "tab"       // prompt (single LLM call)
  | "parallelogram"  // command
  | "hexagon"   // human gate
  | "diamond";  // conditional

export type NodeType = "start" | "exit" | "agent" | "prompt" | "command" | "human" | "conditional";

export interface WorkflowNode {
  id: string;
  label?: string;
  shape: NodeShape;
  type: NodeType;
  prompt?: string;
  script?: string;
  class?: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  label?: string;
  condition?: string;
}

export interface ParsedWorkflow {
  name: string;
  goal?: string;
  nodes: Map<string, WorkflowNode>;
  edges: WorkflowEdge[];
  startId: string;
  exitId: string;
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

export interface Run {
  id: string;
  status: RunStatus;
  boardStatus: BoardColumn;
  dotSource: string;
  goal?: string;
  workflowSlug: string;
  repository: string;
  title: string;
  created_at: string;
  error?: { message: string };
  timings?: { elapsed_secs: number };
  currentStage?: string;
  question?: { text: string };
}

export interface RunEvent {
  type: string;
  run_id: string;
  stage?: string;
  data?: unknown;
  timestamp: string;
}

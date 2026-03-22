/**
 * Parser for Fabro-style Graphviz DOT workflows.
 * Supports: digraph, goal, nodes (start, exit, agent, prompt, command), edges.
 */

import type { ParsedWorkflow, WorkflowNode, WorkflowEdge } from "./types";

const SHAPE_TO_TYPE: Record<string, string> = {
  Mdiamond: "start",
  Msquare: "exit",
  box: "agent",
  tab: "prompt",
  parallelogram: "command",
  hexagon: "human",
  diamond: "conditional",
};

function parseAttrValue(s: string): string {
  const m = s.match(/^["']?(.+?)["']?$/);
  return m ? m[1].replace(/\\"/g, '"') : s;
}

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const inner = attrStr.replace(/^\[|\]$/g, "").trim();
  const regex = /(\w+)\s*=\s*["']?([^"',\]]+)["']?|(\w+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(inner)) !== null) {
    const key = m[1] || m[3];
    const val = m[2] || m[4];
    if (key && val !== undefined) attrs[key] = parseAttrValue(val.trim());
  }
  return attrs;
}

export function parseDot(dotSource: string): ParsedWorkflow {
  const nodes = new Map<string, WorkflowNode>();
  const edges: WorkflowEdge[] = [];
  let goal = "";
  let graphName = "Workflow";

  const lines = dotSource.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("//") || line.startsWith("/*")) continue;

    const graphAttr = line.match(/graph\s+\[([^\]]+)\]/);
    if (graphAttr) {
      const attrs = parseAttributes(`[${graphAttr[1]}]`);
      if (attrs.goal) goal = attrs.goal;
      continue;
    }

    const nodeMatch = line.match(/^\s*(\w+)\s+\[([^\]]+)\](?:\s*;?)?$/);
    if (nodeMatch) {
      const [, id, attrStr] = nodeMatch;
      const attrs = parseAttributes(`[${attrStr}]`);
      const shape = (attrs.shape || "box") as WorkflowNode["shape"];
      const type = (SHAPE_TO_TYPE[shape] || "agent") as WorkflowNode["type"];
      nodes.set(id, {
        id,
        label: attrs.label,
        shape,
        type,
        prompt: attrs.prompt,
        script: attrs.script,
        class: attrs.class,
      });
      continue;
    }

    const edgeMatch = line.match(/^\s*(\w+)\s+->\s+(\w+)(?:\s+\[([^\]]+)\])?(?:\s*;?)?$/);
    if (edgeMatch) {
      const [, from, to, attrStr] = edgeMatch;
      const attrs = attrStr ? parseAttributes(`[${attrStr}]`) : {};
      edges.push({ from, to, label: attrs.label, condition: attrs.condition });
      continue;
    }

    if (line.includes("->")) {
      const parts = line.split(/\s+->\s+/).map((s) => s.trim().match(/^\s*(\w+)/)?.[1] ?? s.trim());
      for (let j = 0; j < parts.length - 1; j++) {
        const from = parts[j];
        const to = parts[j + 1];
        if (from && to) {
          edges.push({ from, to });
        }
      }
      continue;
    }

    const digraphMatch = line.match(/digraph\s+(\w+)\s*\{?/);
    if (digraphMatch) {
      graphName = digraphMatch[1];
    }
  }

  for (const e of edges) {
    if (!nodes.has(e.from)) {
      nodes.set(e.from, {
        id: e.from,
        shape: "box",
        type: "agent",
        label: e.from,
      });
    }
    if (!nodes.has(e.to)) {
      nodes.set(e.to, {
        id: e.to,
        shape: "box",
        type: "agent",
        label: e.to,
      });
    }
  }

  let startId = "start";
  let exitId = "exit";
  for (const [id, node] of nodes) {
    if (node.type === "start") startId = id;
    if (node.type === "exit") exitId = id;
  }

  if (!nodes.has(startId)) {
    nodes.set(startId, {
      id: startId,
      shape: "Mdiamond",
      type: "start",
    });
  }
  if (!nodes.has(exitId)) {
    nodes.set(exitId, {
      id: exitId,
      shape: "Msquare",
      type: "exit",
    });
  }

  return {
    name: graphName,
    goal,
    nodes,
    edges,
    startId,
    exitId,
  };
}

/**
 * LLM client for agent and prompt nodes.
 * Supports Anthropic Claude. Add OpenAI when needed.
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function complete(prompt: string, options?: { model?: string; maxTokens?: number }): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return `[Mock response - set ANTHROPIC_API_KEY for real LLM calls]\n\nPrompt: ${prompt.slice(0, 200)}...`;
  }

  const message = await anthropic.messages.create({
    model: options?.model ?? "claude-sonnet-4-20250514",
    max_tokens: options?.maxTokens ?? 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const textParts: string[] = [];
  for (const block of message.content) {
    if (block.type === "text" && "text" in block) {
      textParts.push(block.text);
    }
  }
  return textParts.join("\n") || "";
}

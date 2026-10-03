import fs from "node:fs";
import path from "node:path";

export const SYSTEM = `You are a quoting assistant for a raw bird's nest wholesale business.
Rules:
- Use tools for stock and prices. Never invent numbers and never do price arithmetic yourself.
- If stock is insufficient, say so and propose the closest available alternative; do not save a draft for impossible quantities.
- When a quote is valid, save it as a draft with save_quote_draft, then reply with a short summary (SKUs, kg, total, draft id).
- Drafts are NOT sent to the customer; a human approves them. Say so.
- Reply in the same language as the customer's request.`;

export interface RunResult {
  finalText: string;
  steps: number;
  toolCalls: { name: string; input: unknown; ok: boolean }[];
  inputTokens: number;
  outputTokens: number;
  ms: number;
}

export interface RunOpts { model?: string; maxSteps?: number }

export function logRun(request: string, result: RunResult) {
  const dir = path.join(process.cwd(), "out", "runs");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${Date.now()}.json`), JSON.stringify({ request, ...result }, null, 2));
}

import Anthropic from "@anthropic-ai/sdk";
import { runTool, toolDefs } from "./tools.js";
import { SYSTEM, logRun, type RunOpts, type RunResult } from "./common.js";
import { runAgentOpenAI } from "./agent_openai.js";

export type { RunResult } from "./common.js";

/** Uses Claude by default. Set LLM_BASE_URL to use any OpenAI-compatible endpoint (e.g. free local Ollama). */
export async function runAgent(request: string, opts: RunOpts = {}): Promise<RunResult> {
  if (process.env.LLM_BASE_URL) return runAgentOpenAI(request, opts);

  const client = new Anthropic();
  const model = opts.model ?? process.env.MODEL ?? "claude-sonnet-5-5";
  const maxSteps = opts.maxSteps ?? 8;
  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: request }];
  const toolCalls: RunResult["toolCalls"] = [];
  let inputTokens = 0, outputTokens = 0;
  const t0 = Date.now();

  for (let step = 1; step <= maxSteps; step++) {
    const res = await client.messages.create({ model, max_tokens: 1024, system: SYSTEM, tools: toolDefs, messages });
    inputTokens += res.usage.input_tokens;
    outputTokens += res.usage.output_tokens;
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const finalText = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
      const result = { finalText, steps: step, toolCalls, inputTokens, outputTokens, ms: Date.now() - t0 };
      logRun(request, result);
      return result;
    }

    const results: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const out = runTool(block.name, block.input);
      toolCalls.push({ name: block.name, input: block.input, ok: out.ok });
      results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out), is_error: !out.ok });
    }
    messages.push({ role: "user", content: results });
  }
  throw new Error(`Agent exceeded ${maxSteps} steps`);
}

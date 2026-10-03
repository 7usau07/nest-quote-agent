// Same agent loop for any OpenAI-compatible endpoint (Ollama, Gemini, Groq, OpenRouter, ...).
import { runTool, toolDefs } from "./tools.js";
import { SYSTEM, logRun, type RunOpts, type RunResult } from "./common.js";

type Msg = { role: string; content?: string | null; tool_calls?: any[]; tool_call_id?: string };

const oaTools = toolDefs.map((t) => ({
  type: "function",
  function: { name: t.name, description: t.description, parameters: t.input_schema },
}));

export async function runAgentOpenAI(
  request: string,
  opts: RunOpts = {},
  fetchFn: typeof fetch = fetch,
): Promise<RunResult> {
  const base = (process.env.LLM_BASE_URL ?? "http://localhost:11434/v1").replace(/\/$/, "");
  const model = opts.model ?? process.env.MODEL;
  if (!model) throw new Error("Set MODEL (e.g. qwen2.5:7b for Ollama).");
  const maxSteps = opts.maxSteps ?? 8;
  const messages: Msg[] = [{ role: "system", content: SYSTEM }, { role: "user", content: request }];
  const toolCalls: RunResult["toolCalls"] = [];
  let inputTokens = 0, outputTokens = 0;
  const t0 = Date.now();

  for (let step = 1; step <= maxSteps; step++) {
    const resp = await fetchFn(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLM_API_KEY ?? "none"}` },
      body: JSON.stringify({ model, messages, tools: oaTools }),
    });
    if (!resp.ok) throw new Error(`LLM request failed: ${resp.status} ${await resp.text()}`);
    const data: any = await resp.json();
    inputTokens += data.usage?.prompt_tokens ?? 0;
    outputTokens += data.usage?.completion_tokens ?? 0;
    const msg = data.choices[0].message;
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });

    if (!msg.tool_calls?.length) {
      const result = { finalText: msg.content ?? "", steps: step, toolCalls, inputTokens, outputTokens, ms: Date.now() - t0 };
      logRun(request, result);
      return result;
    }
    for (const call of msg.tool_calls) {
      let input: unknown = {};
      try { input = JSON.parse(call.function.arguments || "{}"); } catch { /* bad JSON from model -> tool error below */ }
      const out = runTool(call.function.name, input);
      toolCalls.push({ name: call.function.name, input, ok: out.ok });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out) });
    }
  }
  throw new Error(`Agent exceeded ${maxSteps} steps`);
}

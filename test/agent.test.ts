// Verifies the agent loop end-to-end with a scripted fake LLM (no network, no API key).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runAgentOpenAI } from "../src/agent_openai.js";

const call = (id: string, name: string, args: object) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const reply = (message: object) => new Response(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));

test("agent calculates, saves a draft, then answers", async () => {
  const lines = [{ sku: "RAW-A", kg: 12 }];
  const script = [
    reply({ content: null, tool_calls: [call("1", "calculate_quote", { lines })] }),
    reply({ content: null, tool_calls: [call("2", "save_quote_draft", { customer: "Hoa", lines })] }),
    reply({ content: "Draft saved, pending approval." }),
  ];
  const file = path.join(process.cwd(), "out", "quotes.jsonl");
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).length : 0;
  process.env.MODEL = "fake";
  const r = await runAgentOpenAI("Hoa wants 12kg RAW-A", {}, (async () => script.shift()!) as unknown as typeof fetch);
  const drafts = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  assert.equal(r.steps, 3);
  assert.deepEqual(r.toolCalls.map((c) => c.name), ["calculate_quote", "save_quote_draft"]);
  assert.equal(drafts.length, before + 1);
  assert.equal(JSON.parse(drafts.at(-1)!).total, 24_000_000 * 12 * 0.95);
});

test("tool errors are returned to the model, not thrown", async () => {
  const script = [
    reply({ content: null, tool_calls: [call("1", "calculate_quote", { lines: [{ sku: "RAW-C", kg: 50 }] })] }),
    reply({ content: "Not enough stock." }),
  ];
  process.env.MODEL = "fake";
  const r = await runAgentOpenAI("50kg RAW-C", {}, (async () => script.shift()!) as unknown as typeof fetch);
  assert.equal(r.toolCalls[0].ok, false);
  assert.equal(r.steps, 2);
});

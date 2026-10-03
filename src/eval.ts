// Measures whether the agent actually delivers: compares saved drafts against ground truth.
import fs from "node:fs";
import path from "node:path";
import { runAgent } from "./agent.js";
import { calculateQuote, type QuoteLine } from "./tools.js";

type Case = { name: string; request: string; expect: { lines: QuoteLine[] } | "no_draft" };

const cases: Case[] = [
  { name: "single SKU, no discount", request: "Customer An: 3kg RAW-A please.", expect: { lines: [{ sku: "RAW-A", kg: 3 }] } },
  { name: "mixed, tiered discounts", request: "Customer Hoa needs 12kg RAW-A and 6kg RAW-B.", expect: { lines: [{ sku: "RAW-A", kg: 12 }, { sku: "RAW-B", kg: 6 }] } },
  { name: "Vietnamese request", request: "Khách Minh cần 25kg yến thô loại RAW-B, báo giá giúp.", expect: { lines: [{ sku: "RAW-B", kg: 25 }] } },
  { name: "exceeds stock -> no draft", request: "Customer Lan: 50kg RAW-C.", expect: "no_draft" },
];

const quotesFile = path.join(process.cwd(), "out", "quotes.jsonl");
const readDrafts = () => (fs.existsSync(quotesFile) ? fs.readFileSync(quotesFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

let passed = 0, steps = 0, tokens = 0;
for (const c of cases) {
  const before = readDrafts().length;
  const r = await runAgent(c.request);
  const added = readDrafts().slice(before);
  let ok: boolean;
  if (c.expect === "no_draft") ok = added.length === 0;
  else {
    const truth = calculateQuote(c.expect.lines);
    ok = added.length === 1 && truth.ok && added[0].total === (truth.data as any).total;
  }
  passed += ok ? 1 : 0; steps += r.steps; tokens += r.inputTokens + r.outputTokens;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}  (${r.steps} steps, ${r.ms} ms)`);
}
console.log(`\n${passed}/${cases.length} passed | avg steps ${(steps / cases.length).toFixed(1)} | avg tokens ${Math.round(tokens / cases.length)}`);
process.exit(passed === cases.length ? 0 : 1);

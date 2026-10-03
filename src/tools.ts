import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";

const DATA = path.join(process.cwd(), "data");
const OUT = path.join(process.cwd(), "out");

type Inventory = { sku: string; description: string; kg_available: number }[];
type Prices = {
  currency: string;
  price_per_kg: Record<string, number>;
  volume_discounts: { min_kg: number; percent: number }[];
};
export type QuoteLine = { sku: string; kg: number };
export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));

export function discountFor(kg: number, tiers: Prices["volume_discounts"]): number {
  const t = [...tiers].sort((a, b) => b.min_kg - a.min_kg).find((x) => kg >= x.min_kg);
  return t ? t.percent : 0;
}

export function checkInventory(): ToolResult {
  return { ok: true, data: readJson<Inventory>("inventory.json") };
}

export function getPrices(): ToolResult {
  return { ok: true, data: readJson<Prices>("prices.json") };
}

/** Deterministic pricing. The LLM never does the arithmetic. */
export function calculateQuote(lines: QuoteLine[]): ToolResult {
  if (!Array.isArray(lines) || lines.length === 0) return { ok: false, error: "No line items given." };
  const inv = readJson<Inventory>("inventory.json");
  const prices = readJson<Prices>("prices.json");
  const out = [];
  let total = 0;
  for (const { sku, kg } of lines) {
    const stock = inv.find((i) => i.sku === sku);
    if (!stock) return { ok: false, error: `Unknown SKU: ${sku}` };
    if (!(kg > 0)) return { ok: false, error: `Invalid quantity for ${sku}: ${kg}` };
    if (kg > stock.kg_available)
      return { ok: false, error: `Insufficient stock for ${sku}: requested ${kg} kg, available ${stock.kg_available} kg` };
    const unit = prices.price_per_kg[sku];
    const pct = discountFor(kg, prices.volume_discounts);
    const lineTotal = Math.round(unit * kg * (1 - pct / 100));
    total += lineTotal;
    out.push({ sku, kg, unit_price: unit, discount_percent: pct, line_total: lineTotal });
  }
  return { ok: true, data: { currency: prices.currency, lines: out, total } };
}

/** Quotes are only ever saved as drafts; a human must approve before sending. */
export function saveQuoteDraft(customer: string, lines: QuoteLine[]): ToolResult {
  const calc = calculateQuote(lines);
  if (!calc.ok) return calc;
  fs.mkdirSync(OUT, { recursive: true });
  const draft = { id: `Q-${Date.now()}`, status: "pending_approval", customer, ...(calc.data as object) };
  fs.appendFileSync(path.join(OUT, "quotes.jsonl"), JSON.stringify(draft) + "\n");
  return { ok: true, data: draft };
}

export function runTool(name: string, input: any): ToolResult {
  try {
    switch (name) {
      case "check_inventory": return checkInventory();
      case "get_prices": return getPrices();
      case "calculate_quote": return calculateQuote(input.lines);
      case "save_quote_draft": return saveQuoteDraft(String(input.customer ?? ""), input.lines);
      default: return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

const linesSchema = {
  type: "array",
  items: {
    type: "object",
    properties: { sku: { type: "string" }, kg: { type: "number" } },
    required: ["sku", "kg"],
  },
} as const;

export const toolDefs: Anthropic.Messages.Tool[] = [
  { name: "check_inventory", description: "List SKUs with description and kg currently in stock.", input_schema: { type: "object", properties: {} } },
  { name: "get_prices", description: "Get price per kg per SKU and volume discount tiers.", input_schema: { type: "object", properties: {} } },
  { name: "calculate_quote", description: "Compute exact line totals and grand total. Always use this for any price; never calculate yourself.", input_schema: { type: "object", properties: { lines: linesSchema }, required: ["lines"] } },
  { name: "save_quote_draft", description: "Save a quote as a draft pending human approval. Call only after calculate_quote succeeded.", input_schema: { type: "object", properties: { customer: { type: "string" }, lines: linesSchema }, required: ["customer", "lines"] } },
];

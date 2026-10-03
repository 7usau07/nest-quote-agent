import { runAgent } from "./agent.js";

const request = process.argv.slice(2).join(" ");
if (!request) {
  console.error('Usage: npm start -- "Customer Hoa wants 12kg of grade A and 6kg of grade B"');
  process.exit(1);
}
const r = await runAgent(request);
console.log(r.finalText);
console.error(`\n[${r.steps} steps, ${r.toolCalls.length} tool calls, ${r.inputTokens}+${r.outputTokens} tokens, ${r.ms} ms]`);

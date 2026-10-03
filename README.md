# nest-quote-agent

An LLM agent that handles wholesale quote requests for a raw bird's nest (yến thô) trading business. It reads a customer request (English or Vietnamese), checks stock, prices the order, and saves a **draft** quote for human approval.

I built this from a real workflow in my own business. The agent decides *what to do*; all money math is done by deterministic code, not by the model.

## Design

| Decision | Why |
|---|---|
| Pricing in a tool (`calculate_quote`), not in the prompt | LLMs make arithmetic mistakes; invoices can't. |
| Drafts only (`pending_approval`), never auto-sent | Consequential actions need a human in the loop. |
| Tool errors returned to the model (`is_error`) | The agent can recover, e.g. offer an alternative when stock is short. |
| Step cap + per-run JSON trace in `out/runs/` | Every run is auditable and measurable. |
| Eval harness compares saved drafts to ground truth | "Does it actually deliver?" is measured, not assumed. |

## Run it

```bash
npm install
cp .env.example .env        # add your ANTHROPIC_API_KEY
export $(cat .env | xargs)
npm test                    # unit tests for pricing logic (no API key needed)
npm start -- "Customer Hoa needs 12kg RAW-A and 6kg RAW-B"
npm run eval                # end-to-end eval against 4 cases
```

Model defaults to `claude-sonnet-5-5`; override with `MODEL=...`.

### Run without an Anthropic key (open-source model, free)

The agent also speaks the OpenAI-compatible API, so it works with local Ollama or hosted providers:

```powershell
ollama pull qwen2.5:7b
$env:LLM_BASE_URL="http://localhost:11434/v1"
$env:MODEL="qwen2.5:7b"
npm start -- "Customer Hoa needs 12kg RAW-A and 6kg RAW-B"
```

Tool calling quality varies by model; `npm run eval` shows how each one performs.

## Layout

- `src/tools.ts` – inventory, prices, quote calculation, draft saving, tool schemas
- `src/agent.ts` – tool-use loop, token/latency accounting, run logging
- `src/eval.ts` – 4 end-to-end cases (discount tiers, Vietnamese input, out-of-stock)
- `src/agent_openai.ts` – same loop for OpenAI-compatible endpoints (Ollama, Gemini, Groq...)
- `test/tools.test.ts` – unit tests for pricing and validation
- `test/agent.test.ts` – agent loop tested with a scripted fake LLM (no network)
- `data/` – sample inventory and price list (illustrative numbers)

## Eval results

Model: `qwen2.5:7b` via Ollama, CPU only (no GPU).

| Metric | Result |
|---|---|
| Cases passed | 4 / 4 |
| Avg steps per request | 4.8 |
| Avg tokens per request | 3,461 |
| Avg latency per request | ~50 s |

Cases: single SKU, mixed SKUs with tiered discounts, Vietnamese-language request, and an out-of-stock request that must not produce a draft. This is a small eval (4 cases) meant to show the measurement loop, not a benchmark.

## Notes

Written with help from Claude (Anthropic) as a coding assistant; I reviewed and tested the code. Sample data is illustrative, not real prices.

## Possible next steps

- Connect inventory to Supabase/Postgres instead of JSON files
- Approval via Telegram/Zalo message before a quote is released
- Compare models on the eval set (cost vs. pass rate)

import { defineEvalConfig } from "eve/evals";

/** One fake calendar file backs every eval, so they run one at a time. */
export default defineEvalConfig({
  maxConcurrency: 1,
  timeoutMs: 120_000,
});

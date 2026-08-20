import { defineEvalConfig } from "eve/evals";

/**
 * One fake calendar file backs every eval, so they run one at a time. The
 * timeout is generous because a single message costs four sequential model
 * calls: Eve delegates, the specialist acts and reports, then Eve replies.
 */
export default defineEvalConfig({
  maxConcurrency: 1,
  timeoutMs: 240_000,
});

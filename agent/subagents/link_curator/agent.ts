import { defineAgent } from "eve";

import { linkCurationSchema } from "../../../src/library/types";

export default defineAgent({
  description:
    "Research one web link and return grounded metadata plus a useful standalone read.",
  model: "openai/gpt-5.6-luna",
  reasoning: "medium",
  outputSchema: linkCurationSchema,
});

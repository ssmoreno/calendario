import { defineAgent } from "eve";

import { linkCurationSchema } from "../../../src/library/types";

export default defineAgent({
  description:
    "Open one web link and return a grounded title, concise description, and broad library tags.",
  model: "openai/gpt-5.6-luna",
  reasoning: "medium",
  outputSchema: linkCurationSchema,
});

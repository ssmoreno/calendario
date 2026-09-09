import { defineAgent } from "eve";

import { linkCurationSchema } from "../../../src/library/types";

export default defineAgent({
  description:
    "Research one web link and return grounded metadata plus the most useful optional note.",
  model: "openai/gpt-5.6-luna",
  reasoning: "medium",
  outputSchema: linkCurationSchema,
});

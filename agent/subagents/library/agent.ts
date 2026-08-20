import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Handle links the user sends to keep for later — articles to read, recipes to cook, videos to watch — and answer questions about what they have saved, including finding a specific one again or dropping one they no longer want.",
  model: "zai/glm-4.6",
  reasoning: "low",
});

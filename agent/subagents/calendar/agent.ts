import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Handle anything about the user's Google Calendar: listing or answering questions about their schedule, creating events, changing or rescheduling them, deleting them, managing recurring series, and setting reminders.",
  model: "zai/glm-4.6",
  reasoning: "low",
});

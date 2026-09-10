import { defineDynamic, defineInstructions } from "eve/instructions";

import { buildInboundContext } from "../../src/eve/inbound-context";
import { claimInboundBatch } from "../../src/server/whatsapp-inbound-store";

export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      // Only a turn carrying an inbound WhatsApp message has messages to
      // acknowledge. A reminder dispatched into the same session inherits the
      // initiator, so the current caller is the one that matters here.
      const threadId = ctx.session.auth.current?.attributes.threadId;
      if (typeof threadId !== "string") return null;

      // The batch is claimed either way, because the reply resolves its
      // reactions against it. A single message needs no numbering: a bare
      // checkmark already marks the whole batch.
      const batch = await claimInboundBatch(threadId);
      if (batch.length < 2) return null;
      return defineInstructions({ content: buildInboundContext(batch) });
    },
  },
});

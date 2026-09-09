import type { EveEvalContext, EveEvalSession } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { prisma } from "../../src/server/db";

export const LIBRARY_EVAL_USER_ID = "local-dev";

export async function ensureLibraryEvalUser() {
  await prisma.user.upsert({
    where: { id: LIBRARY_EVAL_USER_ID },
    create: {
      id: LIBRARY_EVAL_USER_ID,
      name: "Local dev",
      email: "local-dev@calendario.invalid",
      emailVerified: true,
    },
    update: {},
  });
}

export async function attachLinkCuratorSession(
  t: EveEvalContext,
): Promise<EveEvalSession> {
  const childSessionIds = t.events.flatMap((event) =>
    event.type === "subagent.called" && event.data.name === "link_curator"
      ? [event.data.childSessionId]
      : [],
  );
  const sessionIds = await t.require(
    childSessionIds,
    satisfies(
      (ids: string[]) => ids.length === 1,
      "link curator started one child session",
    ),
  );

  return t.target.attachSession(sessionIds[0]!);
}

export function isStandaloneRead(note: string | null | undefined): boolean {
  if (!note) return false;

  const wordCount = note.split(/\s+/u).length;
  const describesSource =
    /\b(?:this|the) (?:image|pdf|paper|article|document|report) (?:explains|describes|discusses|presents|introduces|argues|shows)\b/iu.test(
      note,
    );

  return wordCount >= 200 && wordCount <= 380 && !describesSource;
}

import type { Metadata } from "next";

import { messages } from "@/calendar/messages";
import { Landing } from "@/components/landing/landing";
import { getSession } from "@/server/session";

export const metadata: Metadata = {
  title: `${messages.appName} — calendar and library`,
  description:
    "A calendar and a library that answer to a message. SS runs on your Google Calendar and keeps the links you saved.",
};

export default async function Home() {
  return <Landing signedIn={Boolean(await getSession())} />;
}

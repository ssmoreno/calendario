import type { Metadata } from "next";

import { messages } from "@/calendar/messages";
import { LibraryView } from "@/components/library/library-view";

export const metadata: Metadata = {
  title: `${messages.library.title} — ${messages.appName}`,
};

export default function Library() {
  return <LibraryView />;
}

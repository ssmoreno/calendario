import type { Metadata } from "next";

import { messages } from "@/calendar/messages";
import { CalendarView } from "@/components/dashboard/calendar-view";

export const metadata: Metadata = {
  title: `${messages.views.calendar} — ${messages.appName}`,
};

export default function Calendar() {
  return <CalendarView />;
}

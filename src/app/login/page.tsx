import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { messages } from "@/calendar/messages";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/server/session";

export const metadata: Metadata = {
  title: `${messages.auth.signInHeading} — ${messages.appName}`,
};

export default async function Login() {
  if (await getSession()) redirect("/");
  return <LoginForm />;
}

import type { Metadata } from "next";
import {
  Fraunces,
  IBM_Plex_Mono,
  Instrument_Sans,
} from "next/font/google";

import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Calendario — only the days that matter",
  description:
    "A personal event-only calendar that compresses quiet days into a focused agenda.",
};

const themeScript = `
(() => {
  try {
    const stored = JSON.parse(localStorage.getItem("calendario.preferences.v1") || "null");
    const preference = ["system", "light", "dark"].includes(stored?.theme)
      ? stored.theme
      : "system";
    const dark = preference === "dark" || (preference === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch {
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.themePreference = "system";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${fraunces.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

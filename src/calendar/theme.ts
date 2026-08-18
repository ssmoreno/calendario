import type { ThemePreference } from "./types";

export type ResolvedTheme = "light" | "dark";

export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(
  theme: ThemePreference,
  systemDark: boolean,
): ResolvedTheme {
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}

/**
 * Paints the theme, crossfading the page whenever the resolved theme actually
 * flips so the switch never lands as a sudden white or black screen.
 */
export function applyTheme(theme: ThemePreference, resolved: ResolvedTheme) {
  const root = document.documentElement;
  const paint = () => {
    root.dataset.theme = resolved;
    root.dataset.themePreference = theme;
    root.style.colorScheme = resolved;
  };
  const flipped = root.dataset.theme !== resolved;
  const animates = !window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;

  if (flipped && animates && typeof document.startViewTransition === "function") {
    document.startViewTransition(paint);
    return;
  }
  paint();
}

/**
 * Applies a theme chosen away from the calendar shell, resolving "system"
 * against the current device preference.
 */
export function applyThemePreference(theme: ThemePreference) {
  applyTheme(theme, resolveTheme(theme, window.matchMedia(DARK_SCHEME_QUERY).matches));
}

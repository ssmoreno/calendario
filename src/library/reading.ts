export function sourceHost(link: string): string {
  return new URL(link).hostname.replace(/^www\./, "");
}

export function readingMinutes(summary: string): number {
  return Math.max(1, Math.round(summary.split(/\s+/).filter(Boolean).length / 220));
}

export function readingParagraphs(summary: string): string[] {
  return summary
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

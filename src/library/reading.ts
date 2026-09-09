export function sourceHost(link: string): string {
  return new URL(link).hostname.replace(/^www\./, "");
}

const LONG_NOTE_WORDS = 160;

function wordCount(note: string): number {
  return note.split(/\s+/u).filter(Boolean).length;
}

export function isLongLibraryNote(note: string): boolean {
  return wordCount(note) >= LONG_NOTE_WORDS;
}

export function readingMinutes(note: string): number {
  return Math.max(1, Math.round(wordCount(note) / 220));
}

export function readingParagraphs(note: string): string[] {
  return note
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

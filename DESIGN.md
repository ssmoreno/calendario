# SS Calendar design

SS Calendar is a quiet, full-page workspace with three areas: the inline Agent, the upcoming Google Calendar events, and a profile menu. There is no calendar grid or event editor.

The palette is Pumpkin Spice over Ink Black, with Stone Brown carrying secondary text. Dark is the default and the signature; a warm cream canvas is the alternate. The accent is bright enough to fill but not to letter, so `--accent` paints surfaces, dots, and indicators, `--accent-ink` is the text-and-focus-ring variant, and every accent fill pairs its label with `--on-accent`.

A slim top bar carries the wordmark and its accent dot, a connection pill, and the profile menu. Below it, one rounded sheet holds the whole workspace: a hairline splits the Agent column from the events column. The Agent column opens with the next event at display size above its lead time, and that same band absorbs the loading, disconnected, authorization, and service-error states. The Agent follows, a compact composer that expands into a bounded conversation, anchored by a pill with a single orange action. Remaining events read as a hairline ledger — a monospaced day and time beside each title, details expanding in place behind a native disclosure.

On narrow screens the sheet becomes one column, preserving Agent first and events second. Settings is the same sheet as a stack of rows: what a setting is on the left, how to change it on the right.

Keyboard focus uses the shared accent outline, native details controls retain semantic disclosure behavior, and reduced-motion preferences disable nonessential transitions. Instrument Sans carries the UI, IBM Plex Mono carries temporal metadata and the uppercase eyebrow labels that head every section.

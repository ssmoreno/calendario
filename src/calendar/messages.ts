export const messages = {
  appName: "SS",
  validation: {
    timezoneAwareStart: "Use a timezone-aware start.",
    dateKey: "Use YYYY-MM-DD.",
    allDayEnd: "The end date must be after the start date.",
    title: "Add a title.",
    recurrenceRule: "Use a valid recurrence rule.",
    recurrenceEnd: "The recurrence end must be on or after the event start.",
    recurrenceExclusions: "Recurrence exclusions must match the event timing.",
  },
  domain: {
    eventNotFound: "Event not found.",
    seriesNotFound: "Series not found.",
    repeats: "Repeats",
  },
  auth: {
    signInHeading: "Sign in",
    signInIntro:
      "Use the Google account for the calendar you want SS to manage.",
    working: "One moment…",
    genericFailure: "That did not work. Check the details and try again.",
    signInWithGoogleCalendar: "Sign in with Google Calendar",
  },
  views: {
    calendar: "Calendar",
    library: "Library",
  },
  library: {
    title: "Library",
  },
  whatsapp: {
    paired:
      "You're connected. Ask me about your calendar whenever you like — try \"what's on tomorrow?\"",
    notConnected:
      "I don't know whose calendar this is yet. Connect WhatsApp in the web app and text me the pairing code.",
    unsupportedContent:
      "Send text, an image, or a PDF and I'll take it from there.",
    notSaved: "That did not save. Send it again and I'll give it another go.",
  },
} as const;

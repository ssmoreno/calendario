import * as rruleModule from "rrule";

export type { Options } from "rrule";

const rrulePackage = rruleModule as typeof rruleModule & {
  default?: typeof rruleModule;
};

export const RRule = rrulePackage.RRule ?? rrulePackage.default?.RRule;

if (!RRule) throw new Error("rrule package does not export RRule.");

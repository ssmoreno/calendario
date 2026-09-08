"use client";

import { createContext, useContext } from "react";

import type { UpcomingEvent } from "@/server/google-calendar";

export type Connection =
  | "checking"
  | "connected"
  | "not_connected"
  | "authorization"
  | "error";

export interface ShellState {
  connection: Connection;
  connecting: boolean;
  events: readonly UpcomingEvent[];
  now: number;
  timeZone: string;
  agentOpen: boolean;
  connectGoogle(): void;
  refreshUpcoming(): void;
}

const ShellContext = createContext<ShellState | null>(null);

export const ShellProvider = ShellContext.Provider;

export function useShell(): ShellState {
  const state = useContext(ShellContext);
  if (!state) throw new Error("useShell must be used inside the app shell.");
  return state;
}

export function deleteEventApproval(
  toolInput: { scope?: unknown } | undefined,
): "user-approval" | "not-applicable" {
  return toolInput?.scope === "series" ? "user-approval" : "not-applicable";
}

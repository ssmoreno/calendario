import { describe, expect, it } from "vitest";

import { deleteEventApproval } from "./delete-approval";

describe("deleteEventApproval", () => {
  it("requires approval only for whole-series deletion", () => {
    expect(deleteEventApproval({ scope: "series" })).toBe("user-approval");
    expect(deleteEventApproval({ scope: "occurrence" })).toBe(
      "not-applicable",
    );
    expect(deleteEventApproval({ scope: "following" })).toBe(
      "not-applicable",
    );
    expect(deleteEventApproval(undefined)).toBe("not-applicable");
  });
});

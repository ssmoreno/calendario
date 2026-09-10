import { describe, expect, it } from "vitest";

import { isDispatchAuthorized } from "./dispatch-auth";

describe("isDispatchAuthorized", () => {
  it("accepts the configured secret as a bearer token", () => {
    expect(isDispatchAuthorized("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("accepts a bare token without the bearer prefix", () => {
    expect(isDispatchAuthorized("s3cret", "s3cret")).toBe(true);
  });

  it("stays shut when no secret is configured", () => {
    expect(isDispatchAuthorized("Bearer anything", undefined)).toBe(false);
    expect(isDispatchAuthorized("Bearer anything", "")).toBe(false);
  });

  it("rejects a missing, empty, or wrong token", () => {
    expect(isDispatchAuthorized(null, "s3cret")).toBe(false);
    expect(isDispatchAuthorized("Bearer ", "s3cret")).toBe(false);
    expect(isDispatchAuthorized("Bearer wrong!", "s3cret")).toBe(false);
  });

  it("rejects a token that merely starts with the secret", () => {
    expect(isDispatchAuthorized("Bearer s3cretplus", "s3cret")).toBe(false);
  });
});

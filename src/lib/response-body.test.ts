import { describe, expect, it } from "vitest";

import { readResponseBytes } from "./response-body";

describe("readResponseBytes", () => {
  it("joins a response body within the limit", async () => {
    const response = new Response("hello");

    const bytes = await readResponseBytes(response, 5);

    expect(Array.from(bytes)).toEqual(
      Array.from(new TextEncoder().encode("hello")),
    );
  });

  it("rejects a declared body that is too large", async () => {
    const response = new Response("ignored", {
      headers: { "content-length": "6" },
    });

    await expect(readResponseBytes(response, 5)).rejects.toThrow(
      "exceeds 5 bytes",
    );
  });

  it("stops a chunked body as soon as it exceeds the limit", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.enqueue(new Uint8Array([4, 5, 6]));
          controller.close();
        },
      }),
    );

    await expect(readResponseBytes(response, 5)).rejects.toThrow(
      "exceeds 5 bytes",
    );
  });
});

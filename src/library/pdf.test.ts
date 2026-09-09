import { describe, expect, it } from "vitest";

import { extractPdfText, isPublicIpAddress } from "./pdf";

function pdfWith(operators: string): Uint8Array {
  const stream = `BT /F1 12 Tf 20 700 Td ${operators} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return new TextEncoder().encode(body);
}

describe("extractPdfText", () => {
  it("reads the text layer of a PDF", async () => {
    const result = await extractPdfText(pdfWith("(Attention Is All You Need) Tj"));

    expect(result).toEqual({ text: "Attention Is All You Need", truncated: false });
  });

  it("returns empty text when the PDF draws no text", async () => {
    const result = await extractPdfText(pdfWith("0 0 0 rg"));

    expect(result.text).toBe("");
  });
});

describe("isPublicIpAddress", () => {
  it("accepts routable addresses", () => {
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
    expect(isPublicIpAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
  });

  it("rejects loopback, private, and reserved addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.5",
      "192.168.1.1",
      "169.254.169.254",
      "::1",
      "fe80::1%eth0",
      "::ffff:127.0.0.1",
      "not-an-address",
    ]) {
      expect(isPublicIpAddress(address), address).toBe(false);
    }
  });
});

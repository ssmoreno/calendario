import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

/** Loopback, private, and reserved ranges, mirroring the guard web_fetch applies. */
const blockedRanges = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedRanges.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedRanges.addSubnet(address, prefix, "ipv6");
}
blockedRanges.addAddress("::1", "ipv6");

export function isPublicIpAddress(address: string): boolean {
  const bare = address.replace(/^\[(.*)\]$/u, "$1").split("%")[0]!;
  const mapped = bare.toLowerCase().startsWith("::ffff:") ? bare.slice(7) : bare;
  const normalized = isIP(mapped) === 4 ? mapped : bare;
  const family = isIP(normalized);

  return family !== 0 && !blockedRanges.check(normalized, family === 4 ? "ipv4" : "ipv6");
}

/** Rejects a URL the server should not request: wrong scheme, or a host that resolves inside the network. */
export async function assertPublicUrl(
  url: string,
  protocols: readonly string[],
): Promise<URL> {
  const target = new URL(url);
  if (!protocols.includes(target.protocol)) {
    throw new Error(`URL must start with ${protocols.map((protocol) => `${protocol}//`).join(" or ")}`);
  }

  const host = target.hostname.replace(/^\[(.*)\]$/u, "$1");
  const addresses =
    isIP(host) === 0
      ? (await lookup(host, { all: true })).map(({ address }) => address)
      : [host];
  if (addresses.length === 0 || !addresses.every(isPublicIpAddress)) {
    throw new Error("URL must not target a private or reserved address.");
  }

  return target;
}

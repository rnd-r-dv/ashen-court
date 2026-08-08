// Which address this server advertises inside its room codes (Task 46).
//
// The host is the only party that knows where the host is: the guest's browser
// cannot discover it (see lanCode.ts). So the server reads its own interfaces
// and the address rides out in every code it hands the host to read aloud.
//
// Choosing badly is worse than not choosing: a VPN or link-local address is
// perfectly valid and completely unreachable from the LAN the guest is sitting
// on, and the guest has no field to correct it with any more. Hence the
// ordering below rather than "first non-internal IPv4".
import { networkInterfaces } from 'node:os';

/** The shape of os.networkInterfaces(), narrowed to what the pick needs. */
export type InterfaceMap = Record<string, ReadonlyArray<{ address: string; family: string; internal: boolean }> | undefined>;

/**
 * Virtual/tunnel interface prefixes. These carry real, routable addresses that
 * are nonetheless wrong to advertise: utun/tun/tap are VPN tunnels, awdl/llw
 * are Apple peer-to-peer links, anpi is an internal Apple bus, bridge/vmnet/
 * docker/veth are host-side virtual switches.
 */
const VIRTUAL_PREFIXES = ['utun', 'tun', 'tap', 'awdl', 'llw', 'anpi', 'bridge', 'vmnet', 'docker', 'veth', 'vboxnet'];

/** RFC1918 — the ranges a LAN actually uses. */
function isPrivate(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number) as [number, number];
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  return a === 172 && b >= 16 && b <= 31;
}

/** RFC3927 link-local: an address a machine gave itself when DHCP failed. */
function isLinkLocal(ip: string): boolean {
  return ip.startsWith('169.254.');
}

function isVirtual(name: string): boolean {
  const lower = name.toLowerCase();
  return VIRTUAL_PREFIXES.some(p => lower.startsWith(p));
}

/**
 * The best LAN IPv4 among `nics`, or null when there is none.
 *
 * Ranked: private-on-a-real-NIC, then private-on-anything, then any other
 * usable IPv4. Loopback and link-local are never returned — neither is
 * reachable from another machine, so a code carrying one would be a code that
 * cannot be joined.
 *
 * `family` is compared loosely: Node has reported it as both 'IPv4' and 4.
 */
export function pickLanIpv4(nics: InterfaceMap): string | null {
  const candidates: { name: string; address: string }[] = [];
  for (const [name, addresses] of Object.entries(nics)) {
    for (const entry of addresses ?? []) {
      if (entry.internal) continue;
      if (String(entry.family) !== 'IPv4' && String(entry.family) !== '4') continue;
      if (isLinkLocal(entry.address)) continue;
      candidates.push({ name, address: entry.address });
    }
  }
  const rank = (c: { name: string; address: string }): number => {
    const priv = isPrivate(c.address);
    const virt = isVirtual(c.name);
    if (priv && !virt) return 0;
    if (priv) return 1;
    if (!virt) return 2;
    return 3;
  };
  let best: { name: string; address: string } | null = null;
  for (const c of candidates) {
    // Strictly-better only, so ties keep the first match and the pick stays
    // deterministic for a given interface map.
    if (best === null || rank(c) < rank(best)) best = c;
  }
  return best?.address ?? null;
}

/** This machine's LAN IPv4, or null when it has none (loopback only). */
export function lanIpv4(): string | null {
  return pickLanIpv4(networkInterfaces() as InterfaceMap);
}

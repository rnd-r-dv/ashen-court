// Join-code codec — the LAN wire contract's other half (Task 46).
//
// WHY the address rides inside the code: a room id is nothing but a key in the
// host process's in-memory `RoomRegistry.rooms` Map. It names a room; it does
// not name a MACHINE. A guest runs their own app instance, so their browser
// must open a socket to the host BEFORE it can ask about any room — and page
// JavaScript has no way to discover which machine that is (no mDNS, no UDP
// broadcast, no subnet scan). Something has to carry the host's address into
// the guest's instance. Putting it in the code is what lets a player type one
// string and nothing else.
//
// Format: `RRRR-AAAAAAA` — 4 letters of room id, 7 letters of address.
//   24^7 = 4_586_471_424 >= 2^32 = 4_294_967_296, so SEVEN letters encode any
//   IPv4 with no class/prefix scheme and no special cases. Six would not
//   (24^6 = 191M), which is why the group is not shorter.
//
// The alphabet is the room code's own (A-Z minus I and O) so the whole string
// stays one character set: no digits to confuse with letters when read aloud,
// and no I/O/0/1 collisions.
//
// This module is deliberately dependency-free and node-free: the SERVER
// formats codes (it alone knows its address) and the APP parses them, so it is
// exported through server/package.json "exports" and imported by the app as
// `@ashen/server/lanCode`. Unlike ./protocol (types only, erased at build),
// this one is real runtime code in the browser bundle — keep it pure.

/** Room codes use A-Z minus O and I (letters only; no O/0 or I/1 collisions). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Letters of room id — unchanged from the original 4-letter codes. */
export const ROOM_CODE_LENGTH = 4;

/** Letters of encoded IPv4. 7 because 24^7 >= 2^32; 6 would be too few. */
export const ADDR_CODE_LENGTH = 7;

/** Separator between the two groups. Cosmetic — parseJoinCode ignores it. */
const SEPARATOR = '-';

/** The largest value the address group can hold, exclusive. */
const IPV4_SPACE = 2 ** 32;

/**
 * An IPv4 dotted quad as a 32-bit number, or null when `ip` is not a plain
 * dotted quad. Strict on purpose: '10.42.0.256', '1e2.0.0.1' and '10.42.0'
 * must not silently produce an address the guest will fail to reach.
 */
function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    // Number() would accept '', '0x1f', '1e2' and ' 7 '; the digit test is what
    // keeps the parse strict.
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = n * 256 + octet;   // * not <<: the top octet would go negative under <<
  }
  return n;
}

/** The dotted quad for a 32-bit address number. */
function numberToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

/**
 * The ADDR_CODE_LENGTH-letter group for an IPv4, or null when `ip` is not a
 * dotted quad. Big-endian base-24, zero-padded with the alphabet's first
 * letter so the group is always exactly ADDR_CODE_LENGTH long.
 */
export function encodeIpv4(ip: string): string | null {
  const n = ipToNumber(ip);
  if (n === null) return null;
  let rest = n;
  let out = '';
  for (let i = 0; i < ADDR_CODE_LENGTH; i++) {
    out = CODE_ALPHABET[rest % CODE_ALPHABET.length]! + out;
    rest = Math.floor(rest / CODE_ALPHABET.length);
  }
  return out;
}

/**
 * The IPv4 behind an address group, or null when the group is the wrong
 * length, carries an off-alphabet letter, or names a value past 2^32 (the
 * letter space is slightly larger than the address space, so the top of it
 * decodes to nothing).
 */
export function decodeIpv4(letters: string): string | null {
  if (letters.length !== ADDR_CODE_LENGTH) return null;
  let n = 0;
  for (const ch of letters) {
    const digit = CODE_ALPHABET.indexOf(ch);
    if (digit < 0) return null;
    n = n * CODE_ALPHABET.length + digit;
  }
  if (n >= IPV4_SPACE) return null;
  return numberToIp(n);
}

/**
 * The code a host shows its players: room id plus the host's address.
 *
 * `hostIp` is null on a loopback-only machine (no non-internal interface) and
 * the encode fails on anything that is not a dotted quad. Both degrade to a
 * bare room id, which parseJoinCode reads as "this machine" — that is exactly
 * right for two browsers on one box, and for anything else the host has no
 * address worth advertising anyway.
 */
export function formatJoinCode(roomId: string, hostIp: string | null): string {
  if (hostIp === null) return roomId;
  const addr = encodeIpv4(hostIp);
  return addr === null ? roomId : `${roomId}${SEPARATOR}${addr}`;
}

/**
 * A typed code split back into the room id and the host to dial, or null when
 * it is not a code at all.
 *
 * Forgiving about presentation — case, the hyphen, and any spacing a player
 * introduces reading it aloud are all stripped before the length check, so
 * 'mkbw bxtfqrs' and 'MKBW-BXTFQRS' are the same code.
 *
 * A bare ROOM_CODE_LENGTH code yields host: null, which lanUrl() resolves to
 * location.hostname. That keeps the pre-Task-46 single-machine flow working
 * and is what a loopback-only host's code means.
 */
export function parseJoinCode(input: string): { roomId: string; host: string | null } | null {
  const cleaned = input.toUpperCase().replace(new RegExp(`[^${CODE_ALPHABET}]`, 'g'), '');
  if (cleaned.length === ROOM_CODE_LENGTH) return { roomId: cleaned, host: null };
  if (cleaned.length !== ROOM_CODE_LENGTH + ADDR_CODE_LENGTH) return null;
  const roomId = cleaned.slice(0, ROOM_CODE_LENGTH);
  const host = decodeIpv4(cleaned.slice(ROOM_CODE_LENGTH));
  return host === null ? null : { roomId, host };
}

/**
 * The room id inside a code, for the server's own lookup. The client already
 * used the address half to decide WHICH server to dial, so by the time a
 * joinRoom arrives only the room id matters — but a client (or a remembered
 * reconnect payload) may still send the full code, so the server strips it
 * rather than failing to find a room that exists.
 */
export function roomIdOf(code: string): string {
  return parseJoinCode(code)?.roomId ?? code;
}

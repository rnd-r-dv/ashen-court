// Join-code codec (code-only LAN join). A room code must carry the host's
// address, because a bare room id is only a key in the host process's in-memory
// Map — a guest's browser has no way to discover WHICH machine holds that Map
// (no mDNS, no UDP broadcast, no subnet scan from page JS). Embedding the
// address is what lets a guest type one string and nothing else.
import { describe, expect, it } from 'vitest';
import {
  ADDR_CODE_LENGTH,
  CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  decodeIpv4,
  encodeIpv4,
  formatJoinCode,
  parseJoinCode,
} from '../src/lanCode.js';

describe('encodeIpv4 / decodeIpv4', () => {
  it('encodes an IPv4 as exactly ADDR_CODE_LENGTH code letters', () => {
    const letters = encodeIpv4('10.42.0.116');
    expect(letters).not.toBeNull();
    expect(letters).toHaveLength(ADDR_CODE_LENGTH);
    for (const ch of letters!) expect(CODE_ALPHABET).toContain(ch);
  });

  it('round-trips every address shape a LAN actually uses', () => {
    for (const ip of [
      '0.0.0.0',
      '10.42.0.116',
      '10.0.0.1',
      '192.168.1.20',
      '192.168.86.28',
      '172.16.31.255',
      '169.254.1.1',
      '255.255.255.255', // the top of the 32-bit range — the padding edge
    ]) {
      expect(decodeIpv4(encodeIpv4(ip)!)).toBe(ip);
    }
  });

  it('is stable: the same address always encodes to the same letters', () => {
    expect(encodeIpv4('10.42.0.116')).toBe(encodeIpv4('10.42.0.116'));
  });

  it('gives distinct codes to addresses one octet apart', () => {
    expect(encodeIpv4('10.42.0.116')).not.toBe(encodeIpv4('10.42.0.117'));
  });

  it('rejects malformed addresses rather than encoding nonsense', () => {
    for (const bad of ['', '10.42.0', '10.42.0.116.9', '10.42.0.256', '-1.0.0.0', 'localhost', '10.42.0.a', '1e2.0.0.1']) {
      expect(encodeIpv4(bad)).toBeNull();
    }
  });

  it('rejects address groups that are the wrong length or off-alphabet', () => {
    expect(decodeIpv4('ABC')).toBeNull();
    expect(decodeIpv4('ABCDEFGH')).toBeNull();
    expect(decodeIpv4('ABCDEFI')).toBeNull(); // I is not in CODE_ALPHABET
  });

  it('rejects a 7-letter group that overflows 32 bits', () => {
    // 24^7 (4_586_471_424) exceeds 2^32 (4_294_967_296), so the top of the
    // letter space has no address behind it and must not decode.
    const maxLetter = CODE_ALPHABET[CODE_ALPHABET.length - 1]!;
    expect(decodeIpv4(maxLetter.repeat(ADDR_CODE_LENGTH))).toBeNull();
  });
});

describe('formatJoinCode', () => {
  it('joins the room id and address group with a hyphen', () => {
    const code = formatJoinCode('MKBW', '10.42.0.116');
    expect(code.startsWith('MKBW-')).toBe(true);
    expect(code).toHaveLength(ROOM_CODE_LENGTH + 1 + ADDR_CODE_LENGTH);
  });

  it('falls back to a bare room id when the server has no LAN address', () => {
    // Loopback-only host (no non-internal interface): there is no address to
    // advertise, so the code stays 4 letters and means "this machine".
    expect(formatJoinCode('MKBW', null)).toBe('MKBW');
  });

  it('falls back to a bare room id when the address is unencodable', () => {
    expect(formatJoinCode('MKBW', 'not-an-ip')).toBe('MKBW');
  });
});

describe('parseJoinCode', () => {
  it('recovers the room id and host from a full code', () => {
    const code = formatJoinCode('MKBW', '10.42.0.116');
    expect(parseJoinCode(code)).toEqual({ roomId: 'MKBW', host: '10.42.0.116' });
  });

  it('treats a bare 4-letter code as this machine (host: null)', () => {
    // Preserves the two-browsers-on-one-box flow, where lanUrl(null) resolves
    // to location.hostname.
    expect(parseJoinCode('MKBW')).toEqual({ roomId: 'MKBW', host: null });
  });

  it('is forgiving about how a player types it', () => {
    const code = formatJoinCode('MKBW', '192.168.1.20');
    const expected = { roomId: 'MKBW', host: '192.168.1.20' };
    expect(parseJoinCode(code.toLowerCase())).toEqual(expected);
    expect(parseJoinCode(code.replace('-', ''))).toEqual(expected);
    expect(parseJoinCode(`  ${code.replace('-', ' ')}  `)).toEqual(expected);
  });

  it('rejects codes of any other length', () => {
    for (const bad of ['', 'MKB', 'MKBWX', 'MKBW-BXTFQR', 'MKBW-BXTFQRST']) {
      expect(parseJoinCode(bad)).toBeNull();
    }
  });

  it('rejects a full code whose address group overflows 32 bits', () => {
    const maxLetter = CODE_ALPHABET[CODE_ALPHABET.length - 1]!;
    expect(parseJoinCode(`MKBW-${maxLetter.repeat(ADDR_CODE_LENGTH)}`)).toBeNull();
  });

  it('round-trips through format for a sweep of addresses', () => {
    for (const ip of ['10.42.0.116', '192.168.0.1', '172.20.10.3']) {
      expect(parseJoinCode(formatJoinCode('QRST', ip))).toEqual({ roomId: 'QRST', host: ip });
    }
  });
});

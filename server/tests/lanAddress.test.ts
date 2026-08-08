// Which address the server advertises in its room codes (Task 46). Kept as a
// pure function over os.networkInterfaces()' shape so the choice is testable
// without depending on whatever interfaces the test machine happens to have.
import { describe, expect, it } from 'vitest';
import { pickLanIpv4 } from '../src/lanAddress.js';
import type { InterfaceMap } from '../src/lanAddress.js';

/** Shorthand for one os.networkInterfaces() entry. */
const addr = (address: string, opts: { internal?: boolean; family?: string } = {}) => ({
  address,
  family: opts.family ?? 'IPv4',
  internal: opts.internal ?? false,
});

describe('pickLanIpv4', () => {
  it('returns null when there is nothing but loopback', () => {
    const nics: InterfaceMap = { lo0: [addr('127.0.0.1', { internal: true })] };
    expect(pickLanIpv4(nics)).toBeNull();
  });

  it('returns null for an empty interface map', () => {
    expect(pickLanIpv4({})).toBeNull();
  });

  it('picks the private IPv4 of a normal single-NIC machine', () => {
    const nics: InterfaceMap = {
      lo0: [addr('127.0.0.1', { internal: true })],
      en0: [addr('10.42.0.116')],
    };
    expect(pickLanIpv4(nics)).toBe('10.42.0.116');
  });

  it('ignores IPv6 addresses — the code format encodes IPv4 only', () => {
    const nics: InterfaceMap = {
      en0: [addr('fe80::1', { family: 'IPv6' }), addr('192.168.1.20')],
    };
    expect(pickLanIpv4(nics)).toBe('192.168.1.20');
  });

  it('accepts family given as the numeric 4/6 form', () => {
    // Node has reported family both as 'IPv4' and as 4 across versions.
    const nics = { en0: [{ address: '192.168.1.20', family: 4, internal: false }] } as unknown as InterfaceMap;
    expect(pickLanIpv4(nics)).toBe('192.168.1.20');
  });

  it('skips link-local autoconfiguration addresses', () => {
    const nics: InterfaceMap = {
      en1: [addr('169.254.10.5')],
      en0: [addr('192.168.1.20')],
    };
    expect(pickLanIpv4(nics)).toBe('192.168.1.20');
  });

  it('prefers a real NIC over a VPN/virtual tunnel interface', () => {
    // A utun/tailscale address is reachable from the VPN, not from the LAN the
    // guest is sitting on — advertising it produces an unreachable code.
    const nics: InterfaceMap = {
      utun3: [addr('10.2.0.7')],
      en0: [addr('192.168.1.20')],
    };
    expect(pickLanIpv4(nics)).toBe('192.168.1.20');
  });

  it('prefers an RFC1918 private address over a public one', () => {
    const nics: InterfaceMap = {
      en5: [addr('93.184.216.34')],
      en0: [addr('10.42.0.116')],
    };
    expect(pickLanIpv4(nics)).toBe('10.42.0.116');
  });

  it('falls back to a virtual interface when it is the only thing available', () => {
    const nics: InterfaceMap = {
      lo0: [addr('127.0.0.1', { internal: true })],
      utun0: [addr('100.64.1.2')],
    };
    expect(pickLanIpv4(nics)).toBe('100.64.1.2');
  });

  it('falls back to a public address when there is no private one', () => {
    const nics: InterfaceMap = { en0: [addr('93.184.216.34')] };
    expect(pickLanIpv4(nics)).toBe('93.184.216.34');
  });

  it('tolerates undefined entries in the map', () => {
    // os.networkInterfaces() is typed with possibly-undefined values.
    const nics: InterfaceMap = { en0: undefined, en1: [addr('192.168.1.20')] };
    expect(pickLanIpv4(nics)).toBe('192.168.1.20');
  });

  it('is deterministic across calls for the same input', () => {
    const nics: InterfaceMap = {
      en0: [addr('192.168.1.20')],
      en1: [addr('10.0.0.5')],
    };
    expect(pickLanIpv4(nics)).toBe(pickLanIpv4(nics));
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canEmbedJpeg } from './images';

const bytes = (s) => [...s].map((c) => c.charCodeAt(0));
const u16 = (n) => [n >> 8, n & 0xff];
const u32 = (n) => [...u16(n >>> 16), ...u16(n & 0xffff)];
const seg = (marker, payload) => [0xff, marker, ...u16(payload.length + 2), ...payload];

const JFIF = seg(0xe0, [...bytes('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const sof = (marker = 0xc0, comps = 3, precision = 8) =>
  seg(marker, [precision, ...u16(2481), ...u16(3508), comps, ...Array(comps * 3).fill(1)]);
const DHT = seg(0xc4, Array(20).fill(0));
const SOS = seg(0xda, [1, 1, 0, 0, 63, 0]);
const exif = (orientation) =>
  seg(0xe1, [...bytes('Exif\0\0MM'), 0, 42, ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0, ...u32(0)]);
const icc = (description) => {
  const desc = [...bytes('desc'), 0, 0, 0, 0, ...u32(description.length + 1), ...bytes(description), 0];
  const profile = [...Array(128).fill(0), ...u32(1), ...bytes('desc'), ...u32(144), ...u32(desc.length), ...desc];
  return seg(0xe2, [...bytes('ICC_PROFILE\0'), 1, 1, ...profile]);
};
const jpeg = (...segments) => new Uint8Array([0xff, 0xd8, ...segments.flat(), ...SOS, 0xff, 0xd9]);

describe('JPEGs embedded byte for byte', () => {
  it.each([
    ['plain baseline RGB', jpeg(JFIF, sof(), DHT)],
    ['progressive', jpeg(JFIF, sof(0xc2), DHT)],
    ['greyscale', jpeg(JFIF, sof(0xc0, 1))],
    ['upright EXIF', jpeg(exif(1), sof())],
    ['sRGB profile', jpeg(icc('sRGB IEC61966-2.1'), sof())],
  ])('%s → as is', (_, data) => {
    expect(canEmbedJpeg(data)).toBe(true);
  });

  it.each([
    ['rotated by EXIF', jpeg(exif(6), sof())],
    ['Display P3 profile', jpeg(icc('Display P3'), sof())],
    ['Adobe RGB profile', jpeg(icc('Adobe RGB (1998)'), sof())],
    ['CMYK', jpeg(sof(0xc0, 4))],
    ['12-bit', jpeg(sof(0xc1, 3, 12))],
    ['Huffman table before the frame header', jpeg(DHT, sof())],
    ['arithmetic coded', jpeg(sof(0xc9))],
    ['no frame header', jpeg(JFIF)],
    ['not a JPEG', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ])('%s → redrawn', (_, data) => {
    expect(canEmbedJpeg(data)).toBe(false);
  });

  it('accepts the brand cover art', () => {
    expect(canEmbedJpeg(new Uint8Array(readFileSync(new URL('../assets/cover.jpg', import.meta.url))))).toBe(true);
  });
});

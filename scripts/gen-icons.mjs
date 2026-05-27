// Generates DailyBulk PWA icons (a gauge ring mark) as PNGs using only Node
// builtins — no native image libraries required. Run: npm run gen:icons
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// --- tiny PNG encoder ---------------------------------------------------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rows with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- drawing ------------------------------------------------------------
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

const INDIGO = [129, 140, 248];
const CYAN = [34, 211, 238];
const TOP = [12, 21, 48];
const BOTTOM = [7, 10, 18];

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34; // ring centre radius
  const thick = size * 0.11;
  const dotR = size * 0.1;
  const gapStart = 60; // degrees (bottom opening)
  const gapEnd = 120;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // background vertical gradient
      let [r, g, b] = mix(TOP, BOTTOM, y / size);

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // angle 0..360, clockwise from +x (y is down)
      let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (ang < 0) ang += 360;
      const inGap = ang > gapStart && ang < gapEnd;

      // ring
      if (!inGap && Math.abs(dist - R) <= thick / 2) {
        // gradient along the arc sweep
        let sweepPos;
        if (ang >= gapEnd) sweepPos = (ang - gapEnd) / (360 - (gapEnd - gapStart));
        else sweepPos = (ang + 360 - gapEnd) / (360 - (gapEnd - gapStart));
        const c = mix(INDIGO, CYAN, Math.max(0, Math.min(1, sweepPos)));
        // soft edge
        const edge = 1 - Math.abs(dist - R) / (thick / 2);
        const a = Math.min(1, edge * 3);
        r = lerp(r, c[0], a);
        g = lerp(g, c[1], a);
        b = lerp(b, c[2], a);
      }

      // inner dot
      if (dist <= dotR) {
        const a = Math.min(1, (dotR - dist) * 2);
        r = lerp(r, INDIGO[0], a);
        g = lerp(g, INDIGO[1], a);
        b = lerp(b, INDIGO[2], a);
      }

      buf[i] = Math.round(r);
      buf[i + 1] = Math.round(g);
      buf[i + 2] = Math.round(b);
      buf[i + 3] = 255;
    }
  }
  return encodePng(size, size, buf);
}

const targets = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
];

for (const [name, size] of targets) {
  writeFileSync(join(OUT, name), drawIcon(size));
  console.log("wrote", name, `${size}x${size}`);
}

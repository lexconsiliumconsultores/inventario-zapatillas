const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const tablaCRC = (() => {
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
  for (let i = 0; i < buf.length; i++) c = tablaCRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, datos) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length, 0);
  const tipoBuf = Buffer.from(tipo, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tipoBuf, datos])), 0);
  return Buffer.concat([len, tipoBuf, datos, crc]);
}

function png(ancho, alto, dibujar) {
  const raw = Buffer.alloc(alto * (1 + ancho * 4));
  let off = 0;
  for (let y = 0; y < alto; y++) {
    raw[off++] = 0;
    for (let x = 0; x < ancho; x++) {
      const [r, g, b, a] = dibujar(x, y, ancho, alto);
      raw[off++] = r;
      raw[off++] = g;
      raw[off++] = b;
      raw[off++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function dibujarIcono(x, y, ancho, alto) {
  const [br, bg, bb] = hex('#1e293b');
  const [mr, mg, mb] = hex('#4f46e5');
  const cx = ancho / 2;
  const cy = alto / 2;
  const d = Math.hypot(x - cx, y - cy);
  const radio = Math.min(ancho, alto) * 0.44;
  if (d > radio) return [0, 0, 0, 0];
  if (d > radio - Math.max(1, ancho * 0.05)) return [br, bg, bb, 255];
  const dx = x / ancho - 0.5;
  const dy = y / alto - 0.5;
  const s = Math.hypot(dx, dy);
  const t = 0.36;
  let color = [br, bg, bb];
  const ang = Math.atan2(dy, dx);
  const sector = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 6);
  if ((s < t && sector % 2 === 0) || (s < t * 0.45)) color = [mr, mg, mb];
  return [color[0], color[1], color[2], 255];
}

const publicDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(publicDir, { recursive: true });

const destinos = [
  [path.join(publicDir, 'icono-512.png'), 512],
  [path.join(publicDir, 'icono-192.png'), 192],
  [path.join(publicDir, 'icono-maskable-512.png'), 512],
];

for (const [ruta, size] of destinos) {
  fs.writeFileSync(ruta, png(size, size, dibujarIcono));
  console.log('Icono generado:', path.relative(process.cwd(), ruta), `(${size}x${size})`);
}
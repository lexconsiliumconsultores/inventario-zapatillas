const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const MAX_LADO = 400;
const CALIDAD = 70;

const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'inventario.json');

const regex = /^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/;

async function comprimirUna(b64) {
  const m = b64.match(regex);
  if (!m) return null;
  const buffer = Buffer.from(m[2], 'base64');
  const img = await Jimp.read(buffer);
  let { width: w, height: h } = img;
  if (Math.max(w, h) > MAX_LADO) {
    const f = MAX_LADO / Math.max(w, h);
    w = Math.round(w * f);
    h = Math.round(h * f);
    img.resize({ w, h });
  }
  img.quality = CALIDAD;
  return { data: 'data:image/jpeg;base64,' + (await img.getBuffer('image/jpeg')).toString('base64'), antes: buffer.length };
}

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.log('No hay inventario.json en', DATA_FILE);
    return;
  }
  const inventario = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  let totalAntes = 0;
  let totalDespues = 0;
  let fotos = 0;
  let cambios = 0;

  for (const p of inventario) {
    if (!p.foto) continue;
    fotos++;
    totalAntes += p.foto.length;
    try {
      const r = await comprimirUna(p.foto);
      if (r && r.data.length < p.foto.length) {
        p.foto = r.data;
        totalDespues += r.data.length;
        cambios++;
      } else {
        totalDespues += p.foto.length;
      }
    } catch (e) {
      totalDespues += p.foto.length;
      console.log('Omitida foto de', p.codigo + ':', e.message);
    }
  }

  if (cambios) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(inventario, null, 2));
    console.log(`${cambios}/${fotos} fotos comprimidas en ${DATA_FILE}`);
  } else {
    console.log('Sin cambios.');
  }
  console.log(`Tamaño fotos: ${(totalAntes / 1048576).toFixed(1)} MB -> ${(totalDespues / 1048576).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
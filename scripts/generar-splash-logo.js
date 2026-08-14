const path = require('path');
const { Jimp } = require('jimp');
const loadFont = require('@jimp/plugin-print/load-font').loadFont;
const { SANS_32_WHITE, SANS_64_WHITE, SANS_128_WHITE } = require(path.join(__dirname, '..', 'node_modules', '@jimp', 'plugin-print', 'dist', 'commonjs', 'fonts.js'));

const ORIGEN = process.env.TEMP + '/velvet-origen.png';

(async () => {
  const logo = await Jimp.read(ORIGEN);
  const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  const sizes = [
    ['drawable', 192],
    ['mipmap-mdpi', 120],
    ['mipmap-hdpi', 180],
    ['mipmap-xhdpi', 240],
    ['mipmap-xxhdpi', 360],
    ['mipmap-xxxhdpi', 480],
  ];

  for (const [carpeta, size] of sizes) {
    const cuadrado = new Jimp({ width: size, height: size });
    const logoR = await logo.clone();
    const lado = Math.round(size * 0.5);
    logoR.resize({ w: lado, h: lado });
    const ox = Math.round((size - lado) / 2);
    const oy = Math.round(size * 0.12);
    cuadrado.composite(logoR, ox, oy);
    const fuenteTxt = size >= 360 ? SANS_128_WHITE : size >= 180 ? SANS_64_WHITE : SANS_32_WHITE;
    const fuente = await loadFont(fuenteTxt);
    const texto = 'V 1.0.2';
    const ty = oy + lado + Math.round(size * 0.05);
    cuadrado.print({ font: fuente, x: 0, y: ty, text: texto, alignmentX: 2 });
    await cuadrado.write(path.join(resDir, carpeta, 'splash_logo.png'));
    console.log('splash_logo:', carpeta, size + 'x' + size);
  }
})().catch((e) => console.error('Error:', e.message));
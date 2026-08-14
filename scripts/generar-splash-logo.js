const { Jimp } = require('jimp');
const path = require('path');

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
    const lado = Math.round(size * 0.72);
    logoR.resize({ w: lado, h: lado });
    const ox = Math.round((size - lado) / 2);
    const oy = Math.round((size - lado) / 2);
    cuadrado.composite(logoR, ox, oy);
    await cuadrado.write(path.join(resDir, carpeta, 'splash_logo.png'));
    console.log('splash_logo:', carpeta, size + 'x' + size);
  }
})().catch((e) => console.error('Error:', e.message));
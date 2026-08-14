const { Jimp, rgbaToInt } = require('jimp');
const fs = require('fs');
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
    cuadrado.scan(0, 0, size, size, (x, y) => {
      cuadrado.setPixelColor(rgbaToInt(15, 23, 42, 0), x, y);
    });
    const margen = Math.round(size * 0.08);
    const lado = size - margen * 2;
    const redimensionado = logo.resize({ w: lado, h: lado });
    cuadrado.composite(redimensionado, margen, margen);
    await cuadrado.write(path.join(resDir, carpeta, 'splash_logo.png'));
    console.log('splash_logo:', carpeta, size + 'x' + size);
  }
})().catch((e) => console.error('Error:', e.message));
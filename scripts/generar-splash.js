const { Jimp, rgbaToInt } = require('jimp');
const fs = require('fs');
const path = require('path');

const ORIGEN = process.env.TEMP + '/velvet-origen.png';
const FONDO = '#0f172a';
const MARGEN = 0.22;

const splash = (ancho, alto, dibujar) => {
  const img = new Jimp({ width: ancho, height: alto });
  img.scan(0, 0, ancho, alto, (x, y) => {
    const [r, g, b] = dibujar(x, y);
    img.setPixelColor(rgbaToInt(r, g, b, 255), x, y);
  });
  return img;
};

(async () => {
  const logo = await Jimp.read(ORIGEN);
  const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  const destinos = [
    ['drawable', 480, 320],
    ['drawable-port-mdpi', 320, 480],
    ['drawable-port-hdpi', 480, 800],
    ['drawable-port-xhdpi', 720, 1280],
    ['drawable-port-xxhdpi', 960, 1600],
    ['drawable-port-xxxhdpi', 1280, 1920],
    ['drawable-land-mdpi', 480, 320],
    ['drawable-land-hdpi', 800, 480],
    ['drawable-land-xhdpi', 1280, 720],
    ['drawable-land-xxhdpi', 1600, 960],
    ['drawable-land-xxxhdpi', 1920, 1280],
  ];

  for (const [carpeta, ancho, alto] of destinos) {
    const lado = Math.min(ancho, alto) * (1 - MARGEN);
    const escala = lado / logo.width;
    const logoAncho = Math.round(logo.width * escala);
    const logoAlto = Math.round(logo.height * escala);
    const ox = Math.round((ancho - logoAncho) / 2);
    const oy = Math.round((alto - logoAlto) / 2);
    const redimensionado = logo.resize({ w: logoAncho, h: logoAlto });
    const fondo = splash(ancho, alto, () => {
      const [r, g, b] = [15, 23, 42];
      return [r, g, b];
    });
    fondo.composite(redimensionado, ox, oy);
    const ruta = path.join(resDir, carpeta, 'splash.png');
    await fondo.write(ruta);
    console.log('Splash:', carpeta, `${ancho}x${alto}`);
  }
})().catch((e) => console.error('Error:', e.message));

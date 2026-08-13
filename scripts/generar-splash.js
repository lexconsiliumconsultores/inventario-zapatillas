const fs = require('fs');
const path = require('path');
const { Jimp, ResizeStrategy } = require('jimp');

const raiz = path.join(__dirname, '..');
const logoRuta = path.join(raiz, 'public', 'logo-velvet.png');

const fondos = [
  ['android/app/src/main/res/drawable/splash.png', 480, 320],
  ['android/app/src/main/res/drawable-port-mdpi/splash.png', 320, 480],
  ['android/app/src/main/res/drawable-port-xhdpi/splash.png', 720, 1280],
  ['android/app/src/main/res/drawable-port-xxhdpi/splash.png', 960, 1600],
  ['android/app/src/main/res/drawable-port-xxxhdpi/splash.png', 1280, 1920],
  ['android/app/src/main/res/drawable-port-hdpi/splash.png', 480, 800],
  ['android/app/src/main/res/drawable-land-mdpi/splash.png', 480, 320],
  ['android/app/src/main/res/drawable-land-hdpi/splash.png', 800, 480],
  ['android/app/src/main/res/drawable-land-xhdpi/splash.png', 1280, 720],
  ['android/app/src/main/res/drawable-land-xxhdpi/splash.png', 1600, 960],
  ['android/app/src/main/res/drawable-land-xxxhdpi/splash.png', 1920, 1280],
];

(async () => {
  const logo = await Jimp.read(logoRuta);
  for (const [rel, w, h] of fondos) {
    const px = new Jimp({ width: 1, height: 1 });
    px.setPixelColor(0xff0f172a, 0, 0);
    const bg = px.clone();
    await bg.resize({ w, h, mode: ResizeStrategy.BEZIER });
    const lado = Math.round(Math.min(w, h) * 0.55);
    const logoTmp = logo.clone();
    await logoTmp.resize({ w: lado, h: lado, mode: ResizeStrategy.BEZIER });
    bg.composite(logoTmp, Math.round((w - lado) / 2), Math.round((h - lado) / 2));
    const salida = path.join(raiz, rel);
    await bg.write(salida);
    console.log('Splash generado:', rel, `${w}x${h}`);
  }
})().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});

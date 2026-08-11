const { Jimp, ResizeStrategy } = require('jimp');

const origen = process.argv[2];
const salida = process.argv[3];
const size = Number(process.argv[4]) || 512;

(async () => {
  const img = await Jimp.read(origen);
  await img.resize({ w: size, h: size, mode: ResizeStrategy.BEZIER });
  await img.write(salida);
  console.log('Generado:', salida);
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
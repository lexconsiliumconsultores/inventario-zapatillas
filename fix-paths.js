const fs = require('fs');
const ed = (f, fn) => fs.writeFileSync(f, fn(fs.readFileSync(f, 'utf8')));
ed('public/index.html', (s) => s.replace(/="\/(?!(\/|api))/g, '="'));
ed('public/tienda.html', (s) => s.replace(/="\/(?!(\/|api))/g, '="'));
ed('public/manifest.json', (s) => s.replace(/: "\//g, ': "'));
ed('public/index.html', (s) => s.replace("register('/sw.js')", "register('sw.js')"));
ed('public/version.json', (s) => s.replace(/"apk": "\//, '"apk": "'));
ed('public/app.js', (s) =>
  s.replace("'/version.json", "'version.json").replace('new URL(meta.apk, location.origin)', 'new URL(meta.apk, location.href)')
);
ed('public/tienda.js', (s) => s.replace("'/version.json", "'version.json"));
console.log('OK');

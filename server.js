const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'inventario.json');
const PORT = process.env.PORT || 3000;

let inventario = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    inventario = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    inventario = [];
  }
}

function guardar() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(inventario, null, 2));
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let datos = '';
    req.on('data', (c) => (datos += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(datos || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function enviar(res, codigo, datos) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(datos));
}

function servirArchivo(res, ruta, tipo) {
  fs.readFile(ruta, (err, contenido) => {
    if (err) {
      res.writeHead(404);
      res.end('No encontrado');
      return;
    }
    res.writeHead(200, { 'Content-Type': tipo });
    res.end(contenido);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return servirArchivo(res, path.join(__dirname, 'public', 'index.html'), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/estilos.css') {
    return servirArchivo(res, path.join(__dirname, 'public', 'estilos.css'), 'text/css; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/app.js') {
    return servirArchivo(res, path.join(__dirname, 'public', 'app.js'), 'application/javascript; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/api/inventario') {
    const termino = (url.searchParams.get('q') || '').toLowerCase();
    if (!termino) return enviar(res, 200, inventario);
    const filtrado = inventario.filter((i) =>
      String(i.codigo).toLowerCase().includes(termino) ||
      String(i.color).toLowerCase().includes(termino) ||
      String(i.talla).toLowerCase().includes(termino)
    );
    return enviar(res, 200, filtrado);
  }

  if (req.method === 'POST' && url.pathname === '/api/inventario') {
    try {
      const item = await leerCuerpo(req);
      const codigo = String(item.codigo || '').trim();
      const color = String(item.color || '').trim();
      const talla = String(item.talla || '').trim();
      const cantidad = parseInt(item.cantidad, 10);

      if (!codigo || !color || !talla || isNaN(cantidad) || cantidad < 0) {
        return enviar(res, 400, { error: 'Completa codigo, color, talla y cantidad valida' });
      }

      const existente = inventario.find((i) => i.codigo === codigo && i.talla === talla && i.color === color);
      if (existente) {
        existente.cantidad += cantidad;
      } else {
        const id = inventario.reduce((max, i) => Math.max(max, i.id || 0), 0) + 1;
        inventario.push({ id, codigo, color, talla, cantidad });
      }
      guardar();
      return enviar(res, 200, { ok: true, inventario });
    } catch (e) {
      return enviar(res, 400, { error: 'JSON invalido' });
    }
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/inventario/')) {
    try {
      const id = parseInt(url.pathname.split('/').pop(), 10);
      const item = await leerCuerpo(req);
      const idx = inventario.findIndex((i) => i.id === id);
      if (idx === -1) return enviar(res, 404, { error: 'No encontrado' });
      inventario[idx] = { ...inventario[idx], ...item };
      guardar();
      return enviar(res, 200, { ok: true, inventario });
    } catch (e) {
      return enviar(res, 400, { error: 'JSON invalido' });
    }
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/inventario/')) {
    const id = parseInt(url.pathname.split('/').pop(), 10);
    inventario = inventario.filter((i) => i.id !== id);
    guardar();
    return enviar(res, 200, { ok: true, inventario });
  }

  res.writeHead(404);
  res.end('Ruta no encontrada');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Inventario corriendo en el puerto ${PORT}`);
});
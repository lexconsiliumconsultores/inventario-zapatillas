const http = require('http');
const fs = require('fs');
const path = require('path');
const { cargarDesdeExcel, buscarArchivoExcel } = require('./excel');

const PORT = process.env.PORT || 3000;

const DATA_DIR_PEDIDO = process.env.DATA_DIR || __dirname;
let DATA_DIR = DATA_DIR_PEDIDO;
let UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {
  if (DATA_DIR_PEDIDO !== __dirname) {
    console.error(`No se puede escribir en DATA_DIR=${DATA_DIR_PEDIDO} (${e.code}). Uso la carpeta del proyecto.`);
    DATA_DIR = __dirname;
    UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}
const DATA_FILE = path.join(DATA_DIR, 'inventario.json');

const GH_REPO = process.env.GH_SYNC_REPO || '';
const GH_TOKEN = process.env.GH_SYNC_TOKEN || '';
const GH_RUTA = 'inventario.json';
const GH_ACTIVO = Boolean(GH_REPO && GH_TOKEN);
const GH_URL = GH_REPO ? `https://api.github.com/repos/${GH_REPO}/contents/${GH_RUTA}` : '';
const CABECERA_GH = { Authorization: `Bearer ${GH_TOKEN}`, 'User-Agent': 'inventario-zapatillas', Accept: 'application/vnd.github+json' };

async function leerGitHub() {
  if (!GH_ACTIVO) return null;
  const res = await fetch(GH_URL, { headers: CABECERA_GH });
  if (!res.ok) {
    if (res.status !== 404) console.error('Lectura GitHub fallo:', res.status);
    return null;
  }
  const data = await res.json();
  try {
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  } catch (e) {
    return null;
  }
}

async function escribirGitHub(lista) {
  if (!GH_ACTIVO) return;
  let sha;
  try {
    const actual = await fetch(GH_URL, { headers: CABECERA_GH });
    if (actual.status === 404) sha = undefined;
    else if (!actual.ok) {
      console.error('Sync: lectura previa', actual.status);
      return;
    } else sha = (await actual.json()).sha;
    const body = { message: 'Actualizar inventario', content: Buffer.from(JSON.stringify(lista, null, 2)).toString('base64') };
    if (sha) body.sha = sha;
    const res = await fetch(GH_URL, {
      method: 'PUT',
      headers: { ...CABECERA_GH, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error('Sync: escritura', res.status);
  } catch (e) {
    console.error('Sync GitHub:', e.message);
  }
}

let colaSync = Promise.resolve();
function sincronizarGitHub() {
  const copia = JSON.parse(JSON.stringify(inventario));
  colaSync = colaSync.then(() => escribirGitHub(copia)).catch((e) => console.error('Sync GitHub:', e.message));
  return colaSync;
}

let inventario = [];

function cargarJSON() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      inventario = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || [];
    } catch (e) {
      inventario = [];
    }
  }
}

function guardar() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(inventario, null, 2));
  sincronizarGitHub();
}

function semillarDesdeExcel() {
  const archivo = buscarArchivoExcel();
  if (!archivo) return null;
  const productos = cargarDesdeExcel(archivo);
  if (!productos.length) return null;
  const fotosPrevias = {};
  inventario.forEach((p) => {
    if (p.foto) fotosPrevias[p.temporada + '||' + p.codigo + '||' + p.producto] = p.foto;
  });
  inventario = productos.map((p, i) => ({
    id: i + 1,
    ...p,
    foto: fotosPrevias[p.temporada + '||' + p.codigo + '||' + p.producto] || null,
  }));
  guardar();
  return archivo;
}

cargarJSON();
migrarFotos();
if (!inventario.length) {
  const archivo = semillarDesdeExcel();
  if (archivo) console.log('Datos cargados desde:', archivo);
}

if (GH_ACTIVO) {
  leerGitHub().then((datosNube) => {
    if (datosNube && Array.isArray(datosNube) && datosNube.length) {
      inventario = datosNube;
      fs.writeFileSync(DATA_FILE, JSON.stringify(inventario, null, 2));
      console.log('Inventario cargado desde GitHub');
    } else if (inventario.length) {
      sincronizarGitHub();
      console.log('GitHub vacio; inventario local subido a GitHub');
    }
  });
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

function totalStock(tallas) {
  return (tallas || []).reduce((s, t) => s + (Number(t.stock) || 0), 0);
}

function migrarFotos() {
  let cambios = false;
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
  inventario.forEach((p) => {
    if (p.foto && p.foto.startsWith('/uploads/') && !p.foto.startsWith('data:')) {
      const ruta = path.join(UPLOAD_DIR, path.basename(p.foto));
      if (fs.existsSync(ruta)) {
        const tipo = mime[path.extname(ruta).toLowerCase()] || 'image/png';
        p.foto = `data:${tipo};base64,` + fs.readFileSync(ruta).toString('base64');
        cambios = true;
      }
    }
  });
  if (cambios) {
    guardar();
    console.log('Fotos convertidas al formato embebido');
  }
}

function crearServidor() {
  return http.createServer(async (req, res) => {
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

  if (req.method === 'GET' && ['/manifest.json', '/sw.js', '/logo-velvet.png', '/logo-velvet-192.png', '/logo-maskable-512.png'].includes(url.pathname)) {
    const tipos = { json: 'application/manifest+json; charset=utf-8', js: 'application/javascript; charset=utf-8', png: 'image/png' };
    return servirArchivo(res, path.join(__dirname, 'public', url.pathname.slice(1)), tipos[path.extname(url.pathname).slice(1)] || 'application/octet-stream');
  }

  if (req.method === 'GET' && url.pathname.startsWith('/uploads/')) {
    const archivo = path.join(UPLOAD_DIR, path.basename(url.pathname));
    const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
    const tipo = mime[path.extname(archivo).toLowerCase()] || 'application/octet-stream';
    return servirArchivo(res, archivo, tipo);
  }

  if (req.method === 'GET' && url.pathname === '/api/inventario') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const temporada = url.searchParams.get('temporada') || '';
    let datos = inventario;
    if (temporada) datos = datos.filter((i) => i.temporada === temporada);
    if (q) {
      datos = datos.filter(
        (i) =>
          String(i.codigo).toLowerCase().includes(q) ||
          String(i.producto).toLowerCase().includes(q) ||
          String(i.categoria).toLowerCase().includes(q)
      );
    }
    return enviar(res, 200, datos);
  }

  if (req.method === 'GET' && url.pathname === '/api/system') {
    return enviar(res, 200, {
      excel: buscarArchivoExcel(),
      totales: {
        productos: inventario.length,
        unidades: inventario.reduce((s, i) => s + totalStock(i.tallas), 0),
      },
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/inventario') {
    try {
      const item = await leerCuerpo(req);
      const codigo = String(item.codigo || '').trim();
      const producto = String(item.producto || '').trim();
      const temporada = item.temporada || 'Verano';
      if (!codigo && !producto) return enviar(res, 400, { error: 'Indica codigo o producto' });
      const id = inventario.reduce((max, i) => Math.max(max, i.id || 0), 0) + 1;
      const tallas = (item.tallas || []).map((t) => ({
        talla: String(t.talla).trim(),
        stock: Number(t.stock) || 0,
      }));
      const nuevo = {
        id,
        temporada,
        codigo,
        producto,
        categoria: String(item.categoria || 'General').trim(),
        genero: String(item.genero || '').trim() || 'Unisex',
        precio: Number(item.precio) || 0,
        tallas,
        foto: null,
      };
      inventario.push(nuevo);
      guardar();
      return enviar(res, 200, { ok: true, item: nuevo });
    } catch (e) {
      return enviar(res, 400, { error: 'JSON invalido' });
    }
  }

  if (req.method === 'PUT' && url.pathname.match(/^\/api\/inventario\/\d+\/foto$/)) {
    try {
      const id = parseInt(url.pathname.split('/')[3], 10);
      const item = await leerCuerpo(req);
      const prod = inventario.find((i) => i.id === id);
      if (!prod) return enviar(res, 404, { error: 'No encontrado' });
      const b64 = item.base64 || '';
      const m = b64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (!m) return enviar(res, 400, { error: 'Imagen invalida' });
      const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
      if (!['jpg', 'png', 'gif', 'webp'].includes(ext)) return enviar(res, 400, { error: 'Formato no soportado' });
      prod.foto = b64;
      guardar();
      return enviar(res, 200, { ok: true, item: prod });
    } catch (e) {
      return enviar(res, 400, { error: 'Error al guardar la foto' });
    }
  }

  if (req.method === 'DELETE' && url.pathname.match(/^\/api\/inventario\/\d+\/foto$/)) {
    const id = parseInt(url.pathname.split('/')[3], 10);
    const prod = inventario.find((i) => i.id === id);
    if (prod) {
      prod.foto = null;
      guardar();
    }
    return enviar(res, 200, { ok: true, inventario });
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/inventario/')) {
    try {
      const id = parseInt(url.pathname.split('/').pop(), 10);
      const item = await leerCuerpo(req);
      const idx = inventario.findIndex((i) => i.id === id);
      if (idx === -1) return enviar(res, 404, { error: 'No encontrado' });
      const actual = inventario[idx];
      inventario[idx] = {
        ...actual,
        producto: String(item.producto ?? actual.producto).trim(),
        codigo: String(item.codigo ?? actual.codigo).trim(),
        categoria: String(item.categoria ?? actual.categoria).trim(),
        genero: String(item.genero ?? actual.genero).trim() || 'Unisex',
        precio: Number(item.precio) ?? actual.precio,
        temporada: item.temporada || actual.temporada,
      };
      guardar();
      return enviar(res, 200, { ok: true, inventario });
    } catch (e) {
      return enviar(res, 400, { error: 'JSON invalido' });
    }
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/inventario\/\d+\/venta$/)) {
    try {
      const id = parseInt(url.pathname.split('/')[3], 10);
      const item = await leerCuerpo(req);
      const prod = inventario.find((i) => i.id === id);
      if (!prod) return enviar(res, 404, { error: 'No encontrado' });
      const variante = prod.tallas.find((v) => String(v.talla) === String(item.talla));
      if (!variante) return enviar(res, 400, { error: 'Talla no existe' });
      const cantidad = Number(item.cantidad) || 1;
      if (variante.stock < cantidad) {
        return enviar(res, 400, { error: `Stock insuficiente: quedan ${variante.stock}` });
      }
      variante.stock -= cantidad;
      guardar();
      return enviar(res, 200, { ok: true, inventario });
    } catch (e) {
      return enviar(res, 400, { error: 'JSON invalido' });
    }
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/inventario\/\d+\/alta$/)) {
    try {
      const id = parseInt(url.pathname.split('/')[3], 10);
      const item = await leerCuerpo(req);
      const prod = inventario.find((i) => i.id === id);
      if (!prod) return enviar(res, 404, { error: 'No encontrado' });
      const cantidad = Number(item.cantidad) || 0;
      let variante = prod.tallas.find((v) => String(v.talla) === String(item.talla));
      if (!variante) {
        variante = { talla: String(item.talla).trim(), stock: 0 };
        prod.tallas.push(variante);
      }
      variante.stock += cantidad;
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

  if (req.method === 'POST' && url.pathname === '/api/reload') {
    const archivo = semillarDesdeExcel();
    if (!archivo) return enviar(res, 400, { error: 'No se encontro el Excel' });
    return enviar(res, 200, { ok: true, excel: archivo, inventario });
  }

  if (req.method === 'POST' && url.pathname === '/api/excel/upload') {
    try {
      const item = await leerCuerpo(req);
      const buffer = Buffer.from(String(item.base64 || ''), 'base64');
      if (!buffer.length) return enviar(res, 400, { error: 'Falta el archivo Excel' });
      const nombre = 'subido-excel' + Date.now() + '.xlsx';
      const ruta = path.join(DATA_DIR, nombre);
      fs.writeFileSync(ruta, buffer);
      const productos = cargarDesdeExcel(ruta);
      if (!productos.length) {
        fs.rmSync(ruta, { force: true });
        return enviar(res, 400, { error: 'El Excel no tiene datos validos (hojas: Verano, Invierno, Niños)' });
      }
      const fotosPrevias = {};
      inventario.forEach((p) => {
        if (p.foto) fotosPrevias[p.temporada + '||' + p.codigo + '||' + p.producto] = p.foto;
      });
      inventario = productos.map((p, i) => ({
        id: i + 1,
        ...p,
        foto: fotosPrevias[p.temporada + '||' + p.codigo + '||' + p.producto] || null,
      }));
      guardar();
      return enviar(res, 200, { ok: true, excel: nombre, inventario });
    } catch (e) {
      return enviar(res, 400, { error: 'No se pudo procesar el Excel' });
    }
  }

  res.writeHead(404);
  res.end('Ruta no encontrada');
  });
}

function iniciar(puerto = process.env.PORT || 3000) {
  const server = crearServidor();
  return new Promise((resolve) => {
    server.listen(puerto, () => resolve(server));
  });
}

if (require.main === module) {
  iniciar().then((server) => {
    console.log(`Inventario corriendo en el puerto ${server.address().port}`);
  });
}

module.exports = { crearServidor, iniciar };
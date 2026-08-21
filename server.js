const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cargarDesdeExcel, buscarArchivoExcel } = require('./excel');

const PORT = process.env.PORT || 3000;

const ADMIN_LOGIN = (process.env.ADMIN_USERS || 'admin:admin1234').split(',').map((s) => {
  const [usuario, clave] = s.split(':');
  return { usuario: String(usuario || '').trim(), clave: String(clave || '').trim() };
});
const SESSION_SECRET = process.env.SESSION_SECRET || 'velvet-store-session-secret';

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

const CONEXION_FILE = path.join(DATA_DIR, 'conexion.json');
const GH_RUTA = 'inventario.json';
const GH_RUTA_PEDIDOS = 'pedidos.json';

let ghRepo = '';
let ghToken = '';
let ghActivo = false;
let ghUrl = '';

function ghUrlDe(ruta) {
  return ghRepo ? `https://api.github.com/repos/${ghRepo}/contents/${ruta}` : '';
}

function cargarConfiguracion() {
  let cfg = {};
  if (fs.existsSync(CONEXION_FILE)) {
    try {
      cfg = JSON.parse(fs.readFileSync(CONEXION_FILE, 'utf8')) || {};
    } catch (e) {
      cfg = {};
    }
  }
  ghRepo = process.env.GH_SYNC_REPO || cfg.repo || '';
  ghToken = process.env.GH_SYNC_TOKEN || cfg.token || '';
  ghActivo = Boolean(ghRepo && ghToken);
  ghUrl = ghUrlDe(GH_RUTA);
}

async function leerGitHubRuta(ruta) {
  if (!ghActivo) return null;
  const url = ghUrlDe(ruta);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ghToken}`, 'User-Agent': 'inventario-zapatillas', Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    if (res.status !== 404) console.error(`Lectura GitHub fallo (${ruta}):`, res.status);
    return null;
  }
  const data = await res.json();
  try {
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  } catch (e) {
    return null;
  }
}

async function leerGitHub() {
  return leerGitHubRuta(GH_RUTA);
}

async function escribirGitHubRuta(lista, ruta) {
  if (!ghActivo) return;
  const url = ghUrlDe(ruta);
  const cabecera = { Authorization: `Bearer ${ghToken}`, 'User-Agent': 'inventario-zapatillas', Accept: 'application/vnd.github+json' };
  let sha;
  try {
    const actual = await fetch(url, { headers: cabecera });
    if (actual.status === 404) sha = undefined;
    else if (!actual.ok) {
      console.error('Sync: lectura previa', actual.status);
      return;
    } else sha = (await actual.json()).sha;
    const body = { message: 'Actualizar ' + ruta, content: Buffer.from(JSON.stringify(lista, null, 2)).toString('base64') };
    if (sha) body.sha = sha;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...cabecera, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error('Sync: escritura', res.status);
  } catch (e) {
    console.error('Sync GitHub:', e.message);
  }
}

async function escribirGitHub(lista) {
  return escribirGitHubRuta(lista, GH_RUTA);
}

async function cargarDesdeGitHub() {
  if (!ghActivo) return false;
  const datos = await leerGitHub();
  if (datos && Array.isArray(datos) && datos.length) {
    inventario = datos;
    fs.writeFileSync(DATA_FILE, JSON.stringify(inventario, null, 2));
    return true;
  }
  return false;
}

let colaSync = Promise.resolve();
function sincronizarGitHub() {
  if (!ghActivo) return Promise.resolve();
  const copia = JSON.parse(JSON.stringify(inventario));
  colaSync = colaSync.then(() => escribirGitHub(copia)).catch((e) => console.error('Sync GitHub:', e.message));
  return colaSync;
}

let inventario = [];

const PEDIDOS_FILE = path.join(DATA_DIR, 'pedidos.json');
let pedidos = [];

function cargarPedidos() {
  if (fs.existsSync(PEDIDOS_FILE)) {
    try {
      pedidos = JSON.parse(fs.readFileSync(PEDIDOS_FILE, 'utf8')) || [];
    } catch (e) {
      pedidos = [];
    }
  }
}

let colaSyncPedidos = Promise.resolve();
function sincronizarPedidos() {
  if (!ghActivo) return Promise.resolve();
  const copia = JSON.parse(JSON.stringify(pedidos));
  colaSyncPedidos = colaSyncPedidos.then(() => escribirGitHubRuta(copia, GH_RUTA_PEDIDOS)).catch((e) => console.error('Sync pedidos:', e.message));
  return colaSyncPedidos;
}

function guardarPedidos() {
  fs.writeFileSync(PEDIDOS_FILE, JSON.stringify(pedidos, null, 2));
  sincronizarPedidos();
}

async function cargarPedidosDesdeGitHub() {
  if (!ghActivo) return false;
  const datos = await leerGitHubRuta(GH_RUTA_PEDIDOS);
  if (datos && Array.isArray(datos)) {
    pedidos = datos;
    fs.writeFileSync(PEDIDOS_FILE, JSON.stringify(pedidos, null, 2));
    return true;
  }
  return false;
}

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
cargarPedidos();
migrarFotos();
cargarConfiguracion();
if (!inventario.length) {
  const archivo = semillarDesdeExcel();
  if (archivo) console.log('Datos cargados desde:', archivo);
}

if (ghActivo) {
  leerGitHub().then((datosNube) => {
    if (datosNube && Array.isArray(datosNube) && datosNube.length) {
      inventario = datosNube;
      fs.writeFileSync(DATA_FILE, JSON.stringify(inventario, null, 2));
      console.log('Inventario cargado desde GitHub');
    } else if (inventario.length) {
      sincronizarGitHub();
      console.log('GitHub vacio; inventario local subido a GitHub');
    } else if (fs.existsSync(path.join(__dirname, 'inventario-backup-railway.json'))) {
      const backup = JSON.parse(fs.readFileSync(path.join(__dirname, 'inventario-backup-railway.json'), 'utf8'));
      if (backup && Array.isArray(backup) && backup.length) {
        inventario = backup.map((p, i) => ({ id: i + 1, ...p }));
        fs.writeFileSync(DATA_FILE, JSON.stringify(inventario, null, 2));
        sincronizarGitHub();
        console.log('Sin datos; inventario restaurado desde backup y subido a GitHub');
      } else {
        console.log('GitHub sin datos; inventario vacio');
      }
    } else {
      console.log('GitHub sin datos; inventario vacio');
    }
  });
  cargarPedidosDesdeGitHub().then((ok) => {
    if (ok) console.log('Pedidos cargados desde GitHub');
  });
}

setInterval(() => {
  if (!ghActivo) return;
  if (inventario.length) return;
  console.log('Inventario vacio; reintentando carga desde GitHub');
  cargarDesdeGitHub();
}, 60000);

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

function cookieDe(req, nombre) {
  const partes = (req.headers.cookie || '').split(';');
  for (const p of partes) {
    const [k, v] = p.trim().split('=');
    if (k === nombre) return decodeURIComponent(v || '');
  }
  return '';
}

function firmarCookie(contenido) {
  const datos = Buffer.from(JSON.stringify(contenido)).toString('base64url');
  const firma = crypto.createHmac('sha256', SESSION_SECRET).update(datos).digest('base64url');
  return datos + '.' + firma;
}

function verificarCookie(tok) {
  const partes = String(tok || '').split('.');
  if (partes.length !== 2) return null;
  const [datos, firma] = partes;
  const esperada = crypto.createHmac('sha256', SESSION_SECRET).update(datos).digest('base64url');
  if (esperada !== firma) return null;
  try {
    const contenido = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'));
    if (Date.now() > (contenido.exp || 0)) return null;
    return contenido;
  } catch (e) {
    return null;
  }
}

function estaAutenticado(req) {
  return Boolean(verificarCookie(cookieDe(req, 'velvet_admin')));
}

function rutaAdminProtegida(req, url) {
  const p = url.pathname;
  if (!p.startsWith('/api/')) return false;
  if (p === '/api/system') return false;
  if (p === '/api/login' || p === '/api/logout') return false;
  if (p.startsWith('/api/tienda/')) return false;
  if (p === '/api/pedidos' && req.method === 'POST') return false;
  return true;
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

  if (rutaAdminProtegida(req, url) && !estaAutenticado(req)) {
    return enviar(res, 401, { error: 'No autorizado' });
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    if (!ADMIN_LOGIN.length) return enviar(res, 503, { error: 'La proteccion no esta configurada en el servidor' });
    const cuerpo = await leerCuerpo(req).catch(() => ({}));
    const valido = ADMIN_LOGIN.some(
      (u) => u.usuario === String(cuerpo.usuario || '') && u.clave === String(cuerpo.password || '')
    );
    if (!valido) return enviar(res, 401, { error: 'Usuario o contraseña incorrectos' });
    const token = firmarCookie({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    const https = req.headers['x-forwarded-proto'] === 'https';
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': `velvet_admin=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax${https ? '; Secure' : ''}`,
    });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': 'velvet_admin=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
    });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return servirArchivo(res, path.join(__dirname, 'public', 'index.html'), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/estilos.css') {
    return servirArchivo(res, path.join(__dirname, 'public', 'estilos.css'), 'text/css; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/app.js') {
    return servirArchivo(res, path.join(__dirname, 'public', 'app.js'), 'application/javascript; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/tienda') {
    return servirArchivo(res, path.join(__dirname, 'public', 'tienda.html'), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/tienda.js') {
    return servirArchivo(res, path.join(__dirname, 'public', 'tienda.js'), 'application/javascript; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/tienda.css') {
    return servirArchivo(res, path.join(__dirname, 'public', 'tienda.css'), 'text/css; charset=utf-8');
  }

  if (req.method === 'GET' && ['/manifest.json', '/sw.js', '/logo-velvet.png', '/logo-velvet-192.png', '/logo-maskable-512.png', '/version.json'].includes(url.pathname)) {
    const tipos = { json: 'application/manifest+json; charset=utf-8', js: 'application/javascript; charset=utf-8', png: 'image/png' };
    return servirArchivo(res, path.join(__dirname, 'public', url.pathname.slice(1)), tipos[path.extname(url.pathname).slice(1)] || 'application/octet-stream');
  }

  if (req.method === 'GET' && url.pathname === '/velvet-store.apk') {
    const rutaApk = path.join(__dirname, 'velvet-store-descarga.apk');
    if (!fs.existsSync(rutaApk)) return enviar(res, 404, { error: 'APK no disponible' });
    return servirArchivo(res, rutaApk, 'application/vnd.android.package-archive');
  }

  if (req.method === 'GET' && url.pathname === '/velvet-store-tienda.apk') {
    const rutaApk = path.join(__dirname, 'velvet-store-tienda-descarga.apk');
    if (!fs.existsSync(rutaApk)) return enviar(res, 404, { error: 'APK no disponible' });
    return servirArchivo(res, rutaApk, 'application/vnd.android.package-archive');
  }

  if (req.method === 'GET' && url.pathname.startsWith('/uploads/')) {
    const archivo = path.join(UPLOAD_DIR, path.basename(url.pathname));
    const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
    const tipo = mime[path.extname(archivo).toLowerCase()] || 'application/octet-stream';
    return servirArchivo(res, archivo, tipo);
  }

  if (req.method === 'GET' && url.pathname === '/api/tienda/catalogo') {
    const temporada = url.searchParams.get('temporada') || '';
    const q = (url.searchParams.get('q') || '').toLowerCase();
    let datos = inventario.filter((i) => totalStock(i.tallas) > 0);
    if (temporada && temporada !== 'Todos') datos = datos.filter((i) => i.temporada === temporada);
    if (q) {
      datos = datos.filter(
        (i) =>
          String(i.codigo).toLowerCase().includes(q) ||
          String(i.producto).toLowerCase().includes(q) ||
          String(i.categoria).toLowerCase().includes(q)
      );
    }
    const limpio = datos.map((i) => ({
      id: i.id,
      temporada: i.temporada,
      codigo: i.codigo,
      producto: i.producto,
      categoria: i.categoria,
      genero: i.genero,
      precio: i.precio,
      foto: i.foto,
      tallas: (i.tallas || [])
        .filter((t) => Number(t.stock) > 0)
        .map((t) => ({ talla: t.talla, stock: Number(t.stock) })),
    }));
    return enviar(res, 200, limpio);
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

  if (req.method === 'PUT' && url.pathname.match(/^\/api\/inventario\/\d+\/talla$/)) {
    try {
      const id = parseInt(url.pathname.split('/')[3], 10);
      const item = await leerCuerpo(req);
      const prod = inventario.find((i) => i.id === id);
      if (!prod) return enviar(res, 404, { error: 'No encontrado' });
      const anterior = String(item.anterior ?? item.talla).trim();
      const variante = (prod.tallas || []).find((v) => String(v.talla) === anterior);
      if (!variante) return enviar(res, 400, { error: 'Talla no existe' });
      variante.talla = String(item.talla).trim();
      variante.stock = Number(item.stock) || 0;
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
      const actual = inventario[idx];
      const tallas = Array.isArray(item.tallas)
        ? item.tallas
            .map((t) => ({ talla: String(t.talla).trim(), stock: Number(t.stock) || 0 }))
            .filter((t) => t.talla)
        : actual.tallas;
      inventario[idx] = {
        ...actual,
        producto: String(item.producto ?? actual.producto).trim(),
        codigo: String(item.codigo ?? actual.codigo).trim(),
        categoria: String(item.categoria ?? actual.categoria).trim(),
        genero: String(item.genero ?? actual.genero).trim() || 'Unisex',
        precio: Number(item.precio) ?? actual.precio,
        temporada: item.temporada || actual.temporada,
        tallas,
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

  if (req.method === 'POST' && url.pathname.match(/^\/api\/inventario\/\d+\/baja$/)) {
    try {
      const id = parseInt(url.pathname.split('/')[3], 10);
      const item = await leerCuerpo(req);
      const prod = inventario.find((i) => i.id === id);
      if (!prod) return enviar(res, 404, { error: 'No encontrado' });
      const cantidad = Number(item.cantidad) || 1;
      const variante = (prod.tallas || []).find((v) => String(v.talla) === String(item.talla));
      if (!variante) return enviar(res, 400, { error: 'Talla no existe' });
      if (variante.stock - cantidad < 0) return enviar(res, 400, { error: `Stock insuficiente: quedan ${variante.stock}` });
      variante.stock -= cantidad;
      guardar();
      return enviar(res, 200, { ok: true, inventario });
    } catch (e) {
      return enviar(res, 400, { error: 'JSON invalido' });
    }
  }

  if (req.method === 'DELETE' && url.pathname.match(/^\/api\/inventario\/\d+\/talla\/.+$/)) {
    const id = parseInt(url.pathname.split('/')[3], 10);
    const talla = decodeURIComponent(url.pathname.split('/')[5]);
    const prod = inventario.find((i) => i.id === id);
    if (prod) {
      prod.tallas = (prod.tallas || []).filter((v) => String(v.talla) !== talla);
      guardar();
    }
    return enviar(res, 200, { ok: true, inventario });
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

  if (req.method === 'POST' && url.pathname === '/api/inventario/import') {
    try {
      const item = await leerCuerpo(req);
      let lista = item.base64 ? JSON.parse(Buffer.from(item.base64, 'base64').toString('utf8')) : item.inventario;
      if (!Array.isArray(lista) || !lista.length) return enviar(res, 400, { error: 'Archivo sin productos validos' });
      if (lista.length > 2000) return enviar(res, 400, { error: 'Demasiados productos' });
      inventario = lista.map((p, i) => ({
        id: i + 1,
        ...p,
        tallas: (p.tallas || []).map((t) => ({ talla: String(t.talla).trim(), stock: Number(t.stock) || 0 })).filter((t) => t.talla),
      }));
      guardar();
      return enviar(res, 200, { ok: true, inventario });
    } catch (e) {
      return enviar(res, 400, { error: 'JSON invalido' });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/conexion') {
    return enviar(res, 200, {
      activo: ghActivo,
      repo: ghRepo || null,
      viaEntorno: Boolean(process.env.GH_SYNC_TOKEN),
    });
  }

  if (req.method === 'PUT' && url.pathname === '/api/conexion') {
    try {
      const item = await leerCuerpo(req);
      const token = String(item.token || '').trim();
      if (!token) return enviar(res, 400, { error: 'Falta el token de GitHub' });
      const repo = String(item.repo || 'lexconsiliumconsultores/inventario-datos').trim();
      fs.writeFileSync(CONEXION_FILE, JSON.stringify({ repo, token }, null, 2));
      cargarConfiguracion();
      const cargado = await cargarDesdeGitHub();
      if (!cargado && inventario.length) {
        await sincronizarGitHub();
      }
      return enviar(res, 200, { ok: true, activo: ghActivo, repo: ghRepo, cargado });
    } catch (e) {
      return enviar(res, 400, { error: 'No se pudo guardar la conexion' });
    }
  }

  if (req.method === 'DELETE' && url.pathname === '/api/conexion') {
    if (process.env.GH_SYNC_TOKEN) {
      return enviar(res, 400, { error: 'La sincronizacion esta fijada por entorno; no se puede desconectar' });
    }
    fs.rmSync(CONEXION_FILE, { force: true });
    cargarConfiguracion();
    return enviar(res, 200, { ok: true, activo: false });
  }

  if (req.method === 'GET' && url.pathname === '/api/pedidos') {
    const lista = [...pedidos].sort((a, b) => b.id - a.id);
    return enviar(res, 200, lista);
  }

  if (req.method === 'GET' && url.pathname === '/api/pedidos/pendientes') {
    const pendientes = pedidos.filter((p) => !p.despachado).length;
    return enviar(res, 200, { pendientes });
  }

  if (req.method === 'POST' && url.pathname === '/api/pedidos') {
    try {
      const item = await leerCuerpo(req);
      const cliente = String(item.cliente || '').trim();
      const telefono = String(item.telefono || '').trim();
      const direccion = String(item.direccion || '').trim();
      const observacion = String(item.observacion || '').trim();
      const lineas = Array.isArray(item.lineas) ? item.lineas : [];
      if (!cliente) return enviar(res, 400, { error: 'Indica tu nombre' });
      if (!telefono) return enviar(res, 400, { error: 'Indica tu telefono' });
      if (!direccion) return enviar(res, 400, { error: 'Indica tu direccion' });
      if (!lineas.length) return enviar(res, 400, { error: 'El carrito esta vacio' });
      const detalle = [];
      for (const linea of lineas) {
        const id = Number(linea.id);
        const talla = String(linea.talla || '').trim();
        const cantidad = Number(linea.cantidad) || 1;
        const prod = inventario.find((i) => i.id === id);
        if (!prod) return enviar(res, 400, { error: 'Un producto ya no existe' });
        const variante = (prod.tallas || []).find((v) => String(v.talla) === talla);
        if (!variante) return enviar(res, 400, { error: `Talla ${talla} no existe para ${prod.producto}` });
        if (Number(variante.stock) < cantidad) {
          return enviar(res, 400, { error: `Solo quedan ${variante.stock} de ${prod.producto} (talla ${talla})` });
        }
        variante.stock -= cantidad;
        detalle.push({
          id: prod.id,
          producto: prod.producto,
          codigo: prod.codigo,
          temporada: prod.temporada,
          talla,
          cantidad,
          precio: Number(prod.precio) || 0,
          subtotal: (Number(prod.precio) || 0) * cantidad,
        });
      }
      const total = detalle.reduce((s, l) => s + l.subtotal, 0);
      const id = pedidos.reduce((max, p) => Math.max(max, p.id || 0), 0) + 1;
      const pedido = {
        id,
        fecha: new Date().toISOString(),
        cliente,
        telefono,
        direccion,
        observacion,
        lineas: detalle,
        total,
        estado: 'pendiente',
        despachado: false,
      };
      pedidos.push(pedido);
      guardar();
      guardarPedidos();
      return enviar(res, 200, { ok: true, pedido });
    } catch (e) {
      return enviar(res, 400, { error: 'JSON invalido' });
    }
  }

  if (req.method === 'PUT' && url.pathname.match(/^\/api\/pedidos\/\d+\/despachar$/)) {
    const id = parseInt(url.pathname.split('/')[3], 10);
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) return enviar(res, 404, { error: 'Pedido no encontrado' });
    pedido.estado = 'despachado';
    pedido.despachado = true;
    guardarPedidos();
    return enviar(res, 200, { ok: true, pedido });
  }

  if (req.method === 'DELETE' && url.pathname.match(/^\/api\/pedidos\/\d+$/)) {
    const id = parseInt(url.pathname.split('/')[3], 10);
    const idx = pedidos.findIndex((p) => p.id === id);
    if (idx === -1) return enviar(res, 404, { error: 'Pedido no encontrado' });
    const pedido = pedidos[idx];
    for (const linea of pedido.lineas) {
      const prod = inventario.find((i) => i.id === Number(linea.id));
      if (!prod) continue;
      const variante = (prod.tallas || []).find((v) => String(v.talla) === String(linea.talla));
      if (variante) variante.stock += Number(linea.cantidad) || 0;
    }
    pedidos.splice(idx, 1);
    guardar();
    guardarPedidos();
    return enviar(res, 200, { ok: true, pedidos });
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
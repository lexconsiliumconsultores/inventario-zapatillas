const grid = document.getElementById('tienda-grid');
const vacio = document.getElementById('tienda-vacio');
const tabs = document.getElementById('tienda-tabs');
const busqueda = document.getElementById('tienda-busqueda');
const carritoBtn = document.getElementById('tienda-carrito-btn');
const carritoCount = document.getElementById('carrito-count');
const overlayCarrito = document.getElementById('tienda-carrito');
const overlayOk = document.getElementById('tienda-ok');
const carritoItems = document.getElementById('tienda-carrito-items');
const totalEl = document.getElementById('tienda-total');
const formCheckout = document.getElementById('tienda-checkout');
const mensajeEl = document.getElementById('tienda-mensaje');
const okTexto = document.getElementById('tienda-ok-texto');

let catalogo = [];
let temporada = 'Todos';
let carrito = {};
let ultimoPedido = null;

function formatearPrecio(n) {
  return '$' + Number(n).toLocaleString('es-CL');
}

async function cargar() {
  const params = new URLSearchParams();
  if (temporada && temporada !== 'Todos') params.set('temporada', temporada);
  if (busqueda.value.trim()) params.set('q', busqueda.value.trim());
  const res = await fetch('/api/tienda/catalogo?' + params.toString());
  catalogo = await res.json();
  pintar();
}

function pintarTabs() {
  const set = new Set();
  if (window.temporadasDisponibles) {
    window.temporadasDisponibles.forEach((t) => set.add(t));
  }
  const todas = ['Todos', ...set];
  tabs.innerHTML = todas
    .map((t) => `<button class="${t === temporada ? 'activo' : ''}" data-temp="${esc(t)}">${esc(t)}</button>`)
    .join('');
}

function pintar() {
  grid.innerHTML = '';
  vacio.hidden = catalogo.length > 0;
  catalogo.forEach((item) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta';
    const tallasHtml = item.tallas
      .map((t) => {
        const enCarrito = carrito[item.id + '|' + t.talla] ? ' en-carrito' : '';
        return `<button type="button" class="talla-btn${enCarrito}" data-id="${item.id}" data-talla="${esc(t.talla)}">${esc(t.talla)}</button>`;
      })
      .join('') || '<em style="font-size:12px;color:#9ca3af">sin tallas</em>';
    tarjeta.innerHTML = `
      ${item.foto ? `<img class="tarjeta-foto" src="${esc(item.foto)}" alt="${esc(item.producto)}" loading="lazy" />` : '<div class="tarjeta-foto-placeholder">Sin foto</div>'}
      <div class="tarjeta-info">
        <div><span style="font-size:11px;color:#6b7280">${esc(item.temporada)}</span></div>
        <h3>${esc(item.producto)}</h3>
        <div class="codigo">${esc(item.codigo || '')}</div>
        <div class="precio">${formatearPrecio(item.precio)}</div>
        <div class="tallas">${tallasHtml}</div>
      </div>
    `;
    grid.appendChild(tarjeta);
  });
  pintarCarrito();
}

function pintarCarrito() {
  const items = Object.values(carrito);
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  carritoCount.textContent = items.length;
  carritoBtn.hidden = items.length === 0;
  totalEl.textContent = formatearPrecio(total);
  document.querySelectorAll('.talla-btn').forEach((btn) => {
    const k = btn.dataset.id + '|' + btn.dataset.talla;
    btn.classList.toggle('en-carrito', Boolean(carrito[k]));
  });
}

function agregarAlCarrito(id, talla) {
  const item = catalogo.find((i) => i.id === Number(id));
  if (!item) return;
  const stock = (item.tallas.find((t) => t.talla === talla) || {}).stock || 0;
  const k = id + '|' + talla;
  const actual = carrito[k] || { id: Number(id), talla, cantidad: 0, producto: item.producto, precio: item.precio, subtotal: 0 };
  if (actual.cantidad + 1 > stock) {
    alert(`Solo hay ${stock} de ${item.producto} (talla ${talla})`);
    return;
  }
  actual.cantidad += 1;
  actual.subtotal = actual.precio * actual.cantidad;
  carrito[k] = actual;
  pintarCarrito();
}

grid.addEventListener('click', (e) => {
  const btn = e.target.closest('.talla-btn');
  if (btn) {
    agregarAlCarrito(btn.dataset.id, btn.dataset.talla);
    return;
  }
  const foto = e.target.closest('.tarjeta-foto');
  if (foto) abrirFoto(foto.src, foto.alt);
});

tabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  temporada = btn.dataset.temp;
  document.querySelectorAll('#tienda-tabs button').forEach((b) => b.classList.remove('activo'));
  btn.classList.add('activo');
  cargar();
});

busqueda.addEventListener('input', () => {
  clearTimeout(busqueda._t);
  busqueda._t = setTimeout(cargar, 300);
});

function pintarItemsCarrito() {
  carritoItems.innerHTML = '';
  const items = Object.values(carrito);
  if (!items.length) {
    overlayCarrito.hidden = true;
    return;
  }
  items.forEach((i) => {
    const fila = document.createElement('div');
    fila.className = 'carrito-item';
    fila.innerHTML = `
      <div>
        <b>${esc(i.producto)}</b><br>
        <span class="c-cantidad">Talla ${esc(i.talla)} × ${i.cantidad}</span>
      </div>
      <div class="carrito-item-acciones">
        <span class="c-subtotal">${formatearPrecio(i.subtotal)}</span>
        <button type="button" class="carrito-quitar" data-quitar="${i.id}|${esc(i.talla)}" aria-label="Quitar del carrito" title="Quitar del carrito">×</button>
      </div>
    `;
    carritoItems.appendChild(fila);
  });
  mensajeEl.hidden = true;
}

carritoBtn.addEventListener('click', () => {
  pintarItemsCarrito();
  overlayCarrito.hidden = Object.keys(carrito).length === 0;
});

carritoItems.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-quitar]');
  if (!btn) return;
  delete carrito[btn.dataset.quitar];
  pintarCarrito();
  pintarItemsCarrito();
  if (!Object.keys(carrito).length) overlayCarrito.hidden = true;
});

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-cerrar-carrito]')) overlayCarrito.hidden = true;
  if (e.target.closest('[data-cerrar-ok]')) {
    overlayOk.hidden = true;
    carrito = {};
    pintarCarrito();
    cargar();
  }
});

formCheckout.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cliente = document.getElementById('tienda-cliente').value.trim();
  const telefono = document.getElementById('tienda-telefono').value.trim();
  const direccion = document.getElementById('tienda-direccion').value.trim();
  const observacion = document.getElementById('tienda-observacion').value.trim();
  const lineas = Object.values(carrito).map((i) => ({
    id: i.id,
    talla: i.talla,
    cantidad: i.cantidad,
  }));
  mensajeEl.hidden = true;
  const btn = formCheckout.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Enviando pedido...';
  try {
    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente, telefono, direccion, observacion, lineas }),
    });
    const data = await res.json();
    if (data.error) {
      mensajeEl.textContent = data.error;
      mensajeEl.hidden = false;
      return;
    }
    ultimoPedido = data.pedido;
    const dest =
      direccion || observacion
        ? ` (${[direccion, observacion].filter(Boolean).join(' · ')})`
        : '';
    okTexto.textContent = `¡Gracias ${cliente}! Recibimos tu pedido N° ${data.pedido.id} por $${Number(data.pedido.total).toLocaleString('es-CL')}. Te contactamos al ${telefono}${dest} para coordinar la entrega.`;
    overlayCarrito.hidden = true;
    overlayOk.hidden = false;
    formCheckout.reset();
  } catch (err) {
    mensajeEl.textContent = 'No se pudo enviar el pedido. Revisa tu conexión.';
    mensajeEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar pedido';
  }
});

function esc(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

const fotoOverlay = document.getElementById('tienda-foto');
const fotoViewport = document.getElementById('foto-viewport');
const fotoImg = document.getElementById('foto-img');
const fotoMas = document.getElementById('foto-mas');
const fotoMenos = document.getElementById('foto-menos');
const fotoNivel = document.getElementById('foto-nivel');
const fotoZoom = { valor: 1, panX: 0, panY: 0 };
let fotoPunt = new Map();
let fotoPinchInicio = 0;
let fotoPinchZoomInicio = 1;
let fotoTapAnt = null;

function fotoAplicar() {
  fotoImg.style.transform = `translate(${fotoZoom.panX}px, ${fotoZoom.panY}px) scale(${fotoZoom.valor})`;
  fotoNivel.textContent = Math.round(fotoZoom.valor * 100) + '%';
}

function fotoZoomEn(factor) {
  fotoZoom.valor = Math.min(8, Math.max(1, fotoZoom.valor * factor));
  fotoAplicar();
}

function abrirFoto(src, alt) {
  fotoZoom.valor = 1;
  fotoZoom.panX = 0;
  fotoZoom.panY = 0;
  fotoPunt = new Map();
  fotoPinchInicio = 0;
  fotoTapAnt = null;
  fotoImg.src = src;
  fotoImg.alt = alt || '';
  fotoAplicar();
  fotoOverlay.hidden = false;
}

function cerrarFoto() {
  fotoOverlay.hidden = true;
  fotoImg.src = '';
}

function fotoDist(p1, p2) {
  return Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
}

fotoViewport.addEventListener('pointerdown', (e) => {
  fotoViewport.setPointerCapture(e.pointerId);
  if (e.pointerType === 'touch' && !fotoPunt.size) {
    const ahora = Date.now();
    if (
      fotoTapAnt &&
      ahora - fotoTapAnt.t < 300 &&
      Math.hypot(e.clientX - fotoTapAnt.x, e.clientY - fotoTapAnt.y) < 40
    ) {
      fotoZoomEn(fotoZoom.valor > 1.5 ? 1 / 2.5 : 2.5);
      fotoTapAnt = null;
    } else {
      fotoTapAnt = { t: ahora, x: e.clientX, y: e.clientY };
    }
  }
  fotoPunt.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fotoPunt.size === 2) {
    const p = [...fotoPunt.values()];
    fotoPinchInicio = fotoDist(p[0], p[1]);
    fotoPinchZoomInicio = fotoZoom.valor;
  }
});

fotoViewport.addEventListener('pointermove', (e) => {
  if (!fotoPunt.has(e.pointerId)) return;
  const prev = fotoPunt.get(e.pointerId);
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  fotoPunt.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fotoPunt.size === 2) {
    const p = [...fotoPunt.values()];
    const d = fotoDist(p[0], p[1]);
    if (fotoPinchInicio > 0) {
      const nuevo = fotoPinchZoomInicio * (d / fotoPinchInicio);
      fotoZoom.valor = Math.min(8, Math.max(1, nuevo));
      fotoAplicar();
    }
  } else if (fotoZoom.valor > 1) {
    fotoZoom.panX += dx;
    fotoZoom.panY += dy;
    fotoAplicar();
  }
});

function fotoFinPunto(e) {
  fotoPunt.delete(e.pointerId);
  if (fotoPunt.size < 2) {
    fotoPinchInicio = 0;
  }
}
fotoViewport.addEventListener('pointerup', fotoFinPunto);
fotoViewport.addEventListener('pointercancel', fotoFinPunto);

fotoMas.addEventListener('click', () => fotoZoomEn(1.3));
fotoMenos.addEventListener('click', () => fotoZoomEn(1 / 1.3));

fotoOverlay.addEventListener('wheel', (e) => {
  e.preventDefault();
  fotoZoomEn(e.deltaY < 0 ? 1.15 : 1 / 1.15);
}, { passive: false });

fotoOverlay.addEventListener('click', (e) => {
  if (e.target.closest('[data-cerrar-foto]')) cerrarFoto();
});

fotoOverlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarFoto();
});

(async () => {
  try {
    const all = await (await fetch('/api/tienda/catalogo')).json();
    window.temporadasDisponibles = [...new Set(all.map((i) => i.temporada))].filter(Boolean);
  } catch (e) {}
  pintarTabs();
  cargar();
})();

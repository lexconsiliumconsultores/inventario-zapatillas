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
  if (!btn) return;
  agregarAlCarrito(btn.dataset.id, btn.dataset.talla);
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

carritoBtn.addEventListener('click', () => {
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
      <div>${formatearPrecio(i.subtotal)}</div>
    `;
    carritoItems.appendChild(fila);
  });
  mensajeEl.hidden = true;
  overlayCarrito.hidden = false;
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
      body: JSON.stringify({ cliente, telefono, lineas }),
    });
    const data = await res.json();
    if (data.error) {
      mensajeEl.textContent = data.error;
      mensajeEl.hidden = false;
      return;
    }
    ultimoPedido = data.pedido;
    okTexto.textContent = `¡Gracias ${cliente}! Recibimos tu pedido N° ${data.pedido.id} por $${Number(data.pedido.total).toLocaleString('es-CL')}. Te contactamos al ${telefono} para coordinar la entrega.`;
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

(async () => {
  try {
    const all = await (await fetch('/api/tienda/catalogo')).json();
    window.temporadasDisponibles = [...new Set(all.map((i) => i.temporada))].filter(Boolean);
  } catch (e) {}
  pintarTabs();
  cargar();
})();

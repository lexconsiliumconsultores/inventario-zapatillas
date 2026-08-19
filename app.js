const tbody = document.getElementById('tabla');
const vacio = document.getElementById('vacio');
const busqueda = document.getElementById('busqueda');
const tabs = document.getElementById('tabs');
const totales = document.getElementById('totales');
const origExcel = document.getElementById('orig-excel');

const formItem = document.getElementById('form-item');
const formVenta = document.getElementById('form-venta');
const formAlta = document.getElementById('form-alta');
const formBaja = document.getElementById('form-baja');
const modalForm = document.getElementById('modal-form');
const modalVenta = document.getElementById('modal-venta');
const modalAlta = document.getElementById('modal-alta');
const modalBaja = document.getElementById('modal-baja');
const btnPedidos = document.getElementById('btn-pedidos');
const pedidosBadge = document.getElementById('pedidos-badge');
const modalPedidos = document.getElementById('modal-pedidos');
const pedidosLista = document.getElementById('pedidos-lista');

let inventario = [];
let temporada = '';
let itemVenta = null;
let itemAlta = null;
let itemBaja = null;
let fotoPendiente = null;
let quitarFoto = false;

const APP_VERSION = '1.0.6';

document.getElementById('app-version').textContent = 'V' + APP_VERSION;

(async () => {
  try {
    let instalada = APP_VERSION;
    if (window.Capacitor && Capacitor.isNativePlatform() && Capacitor.Plugins.AppUpdater) {
      try {
        const v = await Capacitor.Plugins.AppUpdater.version();
        if (v && v.version) instalada = v.version;
        else instalada = '';
      } catch (e) {
        instalada = '';
      }
    }
    const res = await fetch('/version.json?t=' + Date.now());
    if (!res.ok) return;
    const meta = await res.json();
    if (meta.version && meta.version !== instalada) {
      const aviso = document.getElementById('aviso-act');
      const nota = document.getElementById('aviso-nota');
      const link = document.getElementById('aviso-descargar');
      const boton = document.getElementById('aviso-boton');
      if (nota) nota.textContent = meta.nota || '';
      if (link && meta.apk) link.href = meta.apk;
      if (aviso) aviso.hidden = false;
      if (boton) {
        boton.textContent = 'Actualizar ahora';
        boton.onclick = async () => {
          if (window.Capacitor && Capacitor.isNativePlatform()) {
            boton.textContent = 'Descargando...';
            try {
              const AppUpdater = Capacitor.Plugins.AppUpdater;
              await AppUpdater.instalar({ url: new URL(meta.apk, location.origin).href });
              boton.textContent = 'Instalando...';
            } catch (e) {
              boton.textContent = 'Actualizar ahora';
              alert('No se pudo actualizar: ' + (e.message || e));
            }
          } else {
            window.location.href = link.href;
          }
        };
      }
    }
  } catch (e) {}
})();

async function cargarPedidosPendientes() {
  try {
    const res = await fetch('/api/pedidos/pendientes?t=' + Date.now());
    if (!res.ok) return;
    const data = await res.json();
    const n = Number(data.pendientes) || 0;
    btnPedidos.hidden = false;
    pedidosBadge.hidden = n === 0;
    pedidosBadge.textContent = n;
  } catch (e) {}
}

async function verPedidos() {
  try {
    const res = await fetch('/api/pedidos?t=' + Date.now() + Math.random());
    if (!res.ok) {
      alert('No se pudieron cargar los pedidos.');
      return;
    }
    const lista = await res.json();
    pedidosLista.innerHTML = lista.length
      ? lista
          .map((p) => {
            const lineas = p.lineas
              .map((l) => `<li>${esc(l.producto)} (${esc(l.codigo || '')}) · Talla ${esc(l.talla)} × ${l.cantidad} · <b>$${Number(l.subtotal).toLocaleString('es-CL')}</b></li>`)
              .join('');
            const fecha = new Date(p.fecha).toLocaleString('es-CL');
            return `<div class="pedido ${p.despachado ? 'despachado' : ''}">
              <div class="pedido-head">
                <b>Pedido #${p.id}</b>
                <span class="pedido-acciones">
                  <span class="pedido-estado">${p.despachado ? 'Despachado' : 'Pendiente'}</span>
                  <button type="button" class="pedido-eliminar" data-eliminar="${p.id}" title="Eliminar pedido" aria-label="Eliminar pedido">×</button>
                </span>
              </div>
              <div class="pedido-info">
                <div><b>${esc(p.cliente)}</b> · ${esc(p.telefono)}</div>
                ${p.direccion ? `<div class="pedido-fecha">Dirección: ${esc(p.direccion)}</div>` : ''}
                ${p.observacion ? `<div class="pedido-fecha">Observaciones: ${esc(p.observacion)}</div>` : ''}
                <div class="pedido-fecha">${fecha}</div>
                <ul>${lineas}</ul>
                <div class="pedido-total">Total: <b>$${Number(p.total).toLocaleString('es-CL')}</b></div>
              </div>
              ${!p.despachado ? `<button type="button" class="btn-primario chico" data-despachar="${p.id}">Marcar despachado</button>` : ''}
            </div>`;
          })
          .join('')
      : '<p class="vacio">No hay pedidos todavía.</p>';
    modalPedidos.hidden = false;
  } catch (e) {
    alert('Error al cargar pedidos.');
  }
}

pedidosLista.addEventListener('click', async (e) => {
  const btnDespachar = e.target.closest('[data-despachar]');
  if (btnDespachar) {
    const id = btnDespachar.dataset.despachar;
    try {
      const res = await fetch(`/api/pedidos/${id}/despachar`, { method: 'PUT' });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      await cargarPedidosPendientes();
      await verPedidos();
    } catch (err) {
      alert('No se pudo actualizar el pedido.');
    }
    return;
  }
  const btnEliminar = e.target.closest('[data-eliminar]');
  if (!btnEliminar) return;
  const id = btnEliminar.dataset.eliminar;
  if (!confirm('¿Eliminar este pedido? Se restaurará el stock de sus productos.')) return;
  try {
    const res = await fetch(`/api/pedidos/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    await cargarPedidosPendientes();
    await verPedidos();
  } catch (err) {
    alert('No se pudo eliminar el pedido.');
  }
});

btnPedidos.addEventListener('click', verPedidos);

async function cargar() {
  const params = new URLSearchParams();
  if (temporada) params.set('temporada', temporada);
  if (busqueda.value.trim()) params.set('q', busqueda.value.trim());
  const res = await fetch('/api/inventario?' + params.toString());
  inventario = await res.json();
  pintar();
}

async function cargarSistema() {
  const res = await fetch('/api/system');
  const data = await res.json();
  const nombre = data.excel ? data.excel.split('\\').pop().split('/').pop() : '';
  origExcel.textContent = nombre ? 'Fuente: ' + nombre : '';
  origExcel.style.display = nombre ? 'block' : 'none';
  return data;
}

function formatearPrecio(n) {
  return '$' + Number(n).toLocaleString('es-CL');
}

function pintar() {
  tbody.innerHTML = '';
  vacio.style.display = inventario.length ? 'none' : 'block';
  let unidades = 0;

  inventario.forEach((item) => {
    unidades += item.tallas.reduce((s, t) => s + Number(t.stock) || 0, 0);
    const tr = document.createElement('tr');
    const stockTotal = item.tallas.reduce((s, t) => s + (Number(t.stock) || 0), 0);

    const chips = item.tallas
      .map((t) => {
        const s = Number(t.stock) || 0;
        let clase = 'chip-talla ok';
        if (s <= 2 && s > 0) clase = 'chip-talla baja';
        if (s <= 0) clase = 'chip-talla cero';
        return `<span class="${clase}">${t.talla} · ${s}</span>`;
      })
      .join('') || '<em>sin tallas</em>';

    tr.innerHTML = `
      <td data-etiqueta="Foto">${item.foto ? `<a href="${esc(item.foto)}" target="_blank"><img class="thumb" src="${esc(item.foto)}" alt="${esc(item.producto)}" /></a>` : '<span class="sin-foto">Sin foto</span>'}</td>
      <td data-etiqueta="Codigo"><b>${esc(item.codigo || '')}</b></td>
      <td data-etiqueta="Producto">
        <span class="badge-temporada">${esc(item.temporada)}</span><br>
        <b>${esc(item.producto || '')}</b>
      </td>
      <td data-etiqueta="Categoria">${esc(item.categoria || '')}</td>
      <td data-etiqueta="Genero">${esc(item.genero || '')}</td>
      <td data-etiqueta="Precio">${formatearPrecio(item.precio || 0)}</td>
      <td data-etiqueta="Tallas / Stock">${chips}</td>
      <td data-etiqueta="Total"><span class="total-stock ${stockTotal <= 2 ? 'baja' : ''}">${stockTotal}</span></td>
      <td data-etiqueta="Acciones">
        <div class="acciones-celda">
          <button class="mini btn-vender" data-accion="venta" data-id="${item.id}">Vender</button>
          <button class="mini btn-alta" data-accion="alta" data-id="${item.id}">Sumar</button>
          <button class="mini btn-restar" data-accion="restar" data-id="${item.id}">Restar</button>
          <button class="mini btn-editar" data-accion="editar" data-id="${item.id}">Editar</button>
          <button class="mini btn-eliminar" data-accion="eliminar" data-id="${item.id}">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  pintarTotales(unidades);
}

async function pintarTotales(unidades) {
  const sistema = await cargarSistema();
  const modelos = sistema.totales.productos;
  totales.innerHTML = `
    <div class="grupo"><b>${modelos}</b><span>Modelos</span></div>
    <div class="grupo"><b>${unidades}</b><span>En pantalla</span></div>
  `;
}

function esc(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function abrirModal(modal) {
  modal.hidden = false;
}

function cerrarModales() {
  modalForm.hidden = true;
  modalVenta.hidden = true;
  modalAlta.hidden = true;
  modalBaja.hidden = true;
  modalPedidos.hidden = true;
}

document.addEventListener('click', (e) => {
  const datos = e.target.closest('[data-cerrar]');
  if (datos) {
    e.preventDefault();
    cerrarModales();
  }
});

document.getElementById('aviso-cerrar') && document.getElementById('aviso-cerrar').addEventListener('click', () => {
  document.getElementById('aviso-act').hidden = true;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModales();
});

tabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('activo'));
  btn.classList.add('activo');
  temporada = btn.dataset.temporada;
  cargar();
});

busqueda.addEventListener('input', cargar);

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = Number(btn.dataset.id);

  if (btn.dataset.accion === 'restar') {
    const item = inventario.find((i) => i.id === id);
    if (!item || !item.tallas.length) {
      alert('Este producto no tiene tallas registradas.');
      return;
    }
    itemBaja = item;
    const sel = document.getElementById('baja-talla');
    sel.innerHTML = item.tallas
      .map((t) => `<option value="${esc(t.talla)}">Talla ${esc(t.talla)} · stock ${t.stock}</option>`)
      .join('');
    document.getElementById('baja-cantidad').value = '1';
    document.getElementById('titulo-baja').textContent = `Restar · ${item.codigo} ${item.producto}`;
    abrirModal(modalBaja);
    return;
  }

  if (btn.dataset.accion === 'eliminar') {
    const item = inventario.find((i) => i.id === id);
    if (!confirm(`¿Eliminar "${item.producto}" del inventario?`)) return;
    await fetch(`/api/inventario/${id}`, { method: 'DELETE' });
    cargar();
    return;
  }

  if (btn.dataset.accion === 'venta') {
    itemVenta = inventario.find((i) => i.id === id);
    if (!itemVenta || !itemVenta.tallas.length) {
      alert('Este producto no tiene tallas registradas.');
      return;
    }
    const sel = document.getElementById('venta-talla');
    sel.innerHTML = itemVenta.tallas
      .map((t) => `<option value="${esc(t.talla)}">Talla ${esc(t.talla)} · stock ${t.stock}</option>`)
      .join('');
    document.getElementById('venta-cantidad').value = '1';
    document.getElementById('titulo-venta').textContent = `Vender · ${itemVenta.codigo} ${itemVenta.producto}`;
    abrirModal(modalVenta);
    return;
  }

  if (btn.dataset.accion === 'alta') {
    itemAlta = inventario.find((i) => i.id === id);
    if (!itemAlta) return;
    document.getElementById('alta-talla').value = '';
    document.getElementById('alta-cantidad').value = '1';
    abrirModal(modalAlta);
    return;
  }

  if (btn.dataset.accion === 'editar') {
    const item = inventario.find((i) => i.id === id);
    if (!item) return;
    document.getElementById('editando-id').value = item.id;
    document.getElementById('temporada').value = item.temporada;
    document.getElementById('codigo').value = item.codigo;
    document.getElementById('producto').value = item.producto;
    document.getElementById('categoria').value = item.categoria || '';
    document.getElementById('genero').value = item.genero || '';
    document.getElementById('precio').value = item.precio || 0;
    document.getElementById('titulo-form').textContent = 'Editar Producto';
    document.getElementById('tallas-iniciales').innerHTML = '';
    (item.tallas || []).forEach((t) => agregarFilaTalla(t.talla, t.stock));
    fotoPendiente = null;
    quitarFoto = false;
    mostrarFotoActual(item.foto);
    abrirModal(modalForm);
    return;
  }
});

function comprimirFoto(archivo, maxLado = 400, calidad = 0.7) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (Math.max(w, h) > maxLado) {
          const factor = maxLado / Math.max(w, h);
          w = Math.round(w * factor);
          h = Math.round(h * factor);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.onerror = () => reject(new Error('Imagen invalida'));
      img.src = lector.result;
    };
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
}

document.getElementById('foto').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;
  try {
    fotoPendiente = await comprimirFoto(archivo);
    quitarFoto = false;
    mostrarFotoActual(fotoPendiente);
  } catch (err) {
    alert('No se pudo procesar la imagen.');
  }
});

document.getElementById('btn-quitar-foto').addEventListener('click', () => {
  fotoPendiente = null;
  quitarFoto = true;
  mostrarFotoActual(null);
});

function mostrarFotoActual(fuente) {
  const preview = document.getElementById('preview-foto');
  const texto = document.getElementById('texto-foto');
  const boton = document.getElementById('btn-quitar-foto');
  if (fuente) {
    preview.src = fuente;
    preview.style.display = 'block';
    texto.style.display = 'none';
    boton.hidden = false;
  } else {
    preview.removeAttribute('src');
    preview.style.display = 'none';
    texto.style.display = 'block';
    boton.hidden = true;
  }
}

async function guardarFotoSiAplica(id) {
  if (fotoPendiente) {
    await fetch(`/api/inventario/${id}/foto`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: fotoPendiente }),
    });
  } else if (quitarFoto) {
    await fetch(`/api/inventario/${id}/foto`, { method: 'DELETE' });
  }
  fotoPendiente = null;
  quitarFoto = false;
}

formItem.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editando-id').value;
  const payload = {
    temporada: document.getElementById('temporada').value,
    codigo: document.getElementById('codigo').value.trim(),
    producto: document.getElementById('producto').value.trim(),
    categoria: document.getElementById('categoria').value.trim() || 'General',
    genero: document.getElementById('genero').value.trim() || 'Unisex',
    precio: Number(document.getElementById('precio').value) || 0,
  };

  if (id) {
    const filas = [...document.querySelectorAll('.fila-talla')];
    payload.tallas = filas
      .map((f) => ({
        talla: f.querySelector('.t-talla').value.trim(),
        stock: Number(f.querySelector('.t-stock').value) || 0,
      }))
      .filter((t) => t.talla);
    const res = await fetch(`/api/inventario/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const datos = await res.json();
    if (datos.error) {
      alert(datos.error);
      return;
    }
    await guardarFotoSiAplica(id);
    cerrarModales();
    cargar();
    return;
  }

  const filas = [...document.querySelectorAll('.fila-talla')];
  payload.tallas = filas
    .map((f) => ({
      talla: f.querySelector('.t-talla').value.trim(),
      stock: Number(f.querySelector('.t-stock').value) || 0,
    }))
    .filter((t) => t.talla);

  const res = await fetch('/api/inventario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  await guardarFotoSiAplica(data.item.id);
  cerrarModales();
  cargar();
});

formVenta.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch(`/api/inventario/${itemVenta.id}/venta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      talla: document.getElementById('venta-talla').value,
      cantidad: Number(document.getElementById('venta-cantidad').value) || 1,
    }),
  });
  const data = await res.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  cerrarModales();
  cargar();
});

formAlta.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch(`/api/inventario/${itemAlta.id}/alta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      talla: document.getElementById('alta-talla').value,
      cantidad: Number(document.getElementById('alta-cantidad').value) || 0,
    }),
  });
  const data = await res.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  cerrarModales();
  cargar();
});

formBaja.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch(`/api/inventario/${itemBaja.id}/baja`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      talla: document.getElementById('baja-talla').value,
      cantidad: Number(document.getElementById('baja-cantidad').value) || 1,
    }),
  });
  const data = await res.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  cerrarModales();
  cargar();
});

document.getElementById('btn-nuevo').addEventListener('click', () => {
  formItem.reset();
  document.getElementById('editando-id').value = '';
  document.getElementById('precio').value = '0';
  document.getElementById('titulo-form').textContent = 'Nuevo Producto';
  document.getElementById('tallas-iniciales').innerHTML = '';
  agregarFilaTalla();
  fotoPendiente = null;
  quitarFoto = false;
  document.getElementById('foto').value = '';
  mostrarFotoActual(null);
  abrirModal(modalForm);
  document.getElementById('producto').focus();
});

document.getElementById('btn-agregar-talla').addEventListener('click', agregarFilaTalla);

function agregarFilaTalla(talla = '', stock = '') {
  const contenedor = document.getElementById('tallas-iniciales');
  const fila = document.createElement('div');
  fila.className = 'fila-talla';
  fila.innerHTML = `
    <input type="number" class="t-talla" placeholder="Talla" min="1" value="${esc(String(talla))}" />
    <input type="number" class="t-stock" placeholder="Stock" min="0" value="${esc(String(stock))}" />
    <button type="button" class="quitar" title="Eliminar talla">x</button>
  `;
  fila.querySelector('.quitar').addEventListener('click', () => fila.remove());
  contenedor.appendChild(fila);
}

document.getElementById('btn-recargar').addEventListener('click', async () => {
  if (!confirm('Esto reemplaza todo el inventario actual con los datos del Excel. ¿Continuar?')) return;
  const res = await fetch('/api/reload', { method: 'POST' });
  const data = await res.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  alert('Inventario recargado desde el Excel.');
  cargar();
});

document.getElementById('btn-subir-excel').addEventListener('click', () => {
  document.getElementById('archivo-excel').click();
});

document.getElementById('archivo-excel').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  e.target.value = '';
  if (!archivo) return;
  if (!confirm(`Se cargará el inventario desde "${archivo.name}". ¿Continuar?`)) return;
  const lector = new FileReader();
  lector.onload = async () => {
    const res = await fetch('/api/excel/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: lector.result.split(',')[1] }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    alert(`Inventario cargado desde "${archivo.name}" (${data.inventario.length} productos).`);
    cargar();
    cargarSistema();
  };
  lector.readAsDataURL(archivo);
});

cargar();
cargarSistema();
cargarPedidosPendientes();

const refrescar = document.getElementById('refrescar');
const refrescarTexto = document.getElementById('refrescar-texto');
let tocando = 0;
let desdeY = 0;
let refrescando = false;

function mostrarRefrescar(texto, activo) {
  if (activo) {
    refrescarTexto.textContent = texto;
    refrescar.hidden = false;
  } else {
    refrescar.hidden = true;
  }
}

addEventListener('touchstart', (e) => {
  if (window.scrollY <= 0 && !refrescando) {
    tocando = 1;
    desdeY = e.touches[0].clientY;
    mostrarRefrescar('Tira para actualizar', false);
  }
}, { passive: true });

addEventListener('touchmove', (e) => {
  if (!tocando || refrescando) return;
  const delta = e.touches[0].clientY - desdeY;
  if (window.scrollY <= 0 && delta > 0) {
    e.preventDefault();
    if (delta > 90) mostrarRefrescar('Suelta para actualizar', true);
    else mostrarRefrescar('Tira para actualizar', true);
  }
}, { passive: false });

addEventListener('touchend', async (e) => {
  if (!tocando) return;
  tocando = 0;
  const delta = e.changedTouches[0].clientY - desdeY;
  if (window.scrollY <= 0 && delta > 90) {
    refrescando = true;
    mostrarRefrescar('Actualizando...', true);
    navigator.vibrate && navigator.vibrate(50);
    await Promise.all([cargar(), cargarSistema(), cargarPedidosPendientes()]);
    refrescando = false;
    mostrarRefrescar('', false);
  } else {
    mostrarRefrescar('', false);
  }
});

let ultimaActiva = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - ultimaActiva > 15000) {
    ultimaActiva = Date.now();
    cargar();
    cargarSistema();
    cargarPedidosPendientes();
  }
});
window.addEventListener('focus', () => {
  if (Date.now() - ultimaActiva > 15000) {
    ultimaActiva = Date.now();
    cargar();
    cargarSistema();
    cargarPedidosPendientes();
  }
});

setInterval(() => {
  if (document.visibilityState === 'visible') {
    cargar();
    cargarSistema();
    cargarPedidosPendientes();
  }
}, 30000);
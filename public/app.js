const tbody = document.getElementById('tabla');
const vacio = document.getElementById('vacio');
const busqueda = document.getElementById('busqueda');
const tabs = document.getElementById('tabs');
const totales = document.getElementById('totales');
const origExcel = document.getElementById('orig-excel');

const formItem = document.getElementById('form-item');
const formVenta = document.getElementById('form-venta');
const formAlta = document.getElementById('form-alta');
const modalForm = document.getElementById('modal-form');
const modalVenta = document.getElementById('modal-venta');
const modalAlta = document.getElementById('modal-alta');

let inventario = [];
let temporada = '';
let itemVenta = null;
let itemAlta = null;
let fotoPendiente = null;
let quitarFoto = false;

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
      <td>${item.foto ? `<a href="${esc(item.foto)}" target="_blank"><img class="thumb" src="${esc(item.foto)}" alt="${esc(item.producto)}" /></a>` : '<span class="sin-foto">Sin foto</span>'}</td>
      <td><b>${esc(item.codigo || '')}</b></td>
      <td>
        <span class="badge-temporada">${esc(item.temporada)}</span><br>
        <b>${esc(item.producto || '')}</b>
      </td>
      <td>${esc(item.categoria || '')}</td>
      <td>${esc(item.genero || '')}</td>
      <td>${formatearPrecio(item.precio || 0)}</td>
      <td>${chips}</td>
      <td class="total-stock ${stockTotal <= 2 ? 'baja' : ''}">${stockTotal}</td>
      <td>
        <div class="acciones-celda">
          <button class="mini btn-vender" data-accion="venta" data-id="${item.id}">Vender</button>
          <button class="mini btn-alta" data-accion="alta" data-id="${item.id}">Sumar</button>
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
}

document.addEventListener('click', (e) => {
  const datos = e.target.closest('[data-cerrar]');
  if (datos) {
    e.preventDefault();
    cerrarModales();
  }
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
    fotoPendiente = null;
    quitarFoto = false;
    mostrarFotoActual(item.foto);
    abrirModal(modalForm);
    return;
  }
});

document.getElementById('foto').addEventListener('change', (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = () => {
    fotoPendiente = lector.result;
    quitarFoto = false;
    mostrarFotoActual(fotoPendiente);
  };
  lector.readAsDataURL(archivo);
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

function agregarFilaTalla() {
  const contenedor = document.getElementById('tallas-iniciales');
  const fila = document.createElement('div');
  fila.className = 'fila-talla';
  fila.innerHTML = `
    <input type="number" class="t-talla" placeholder="Talla" min="1" />
    <input type="number" class="t-stock" placeholder="Stock" min="0" value="1" />
    <button type="button" class="quitar">x</button>
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
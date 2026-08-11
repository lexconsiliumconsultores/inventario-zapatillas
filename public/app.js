const form = document.getElementById('form-item');
const tbody = document.getElementById('tabla');
const vacio = document.getElementById('vacio');
const busqueda = document.getElementById('busqueda');
const filtroTalla = document.getElementById('filtro-talla');
const editandoId = document.getElementById('editando-id');
const tituloForm = document.getElementById('titulo-form');
const btnGuardar = document.getElementById('btn-guardar');
const btnCancelar = document.getElementById('btn-cancelar');
const totales = document.getElementById('totales');

let inventario = [];

async function cargar() {
  const res = await fetch('/api/inventario');
  inventario = await res.json();
  pintar();
}

function pintar() {
  const termino = busqueda.value.toLowerCase();
  const talla = filtroTalla.value;

  let filtrados = inventario;
  if (termino) {
    filtrados = filtrados.filter((i) =>
      String(i.codigo).toLowerCase().includes(termino) ||
      String(i.color).toLowerCase().includes(termino) ||
      String(i.talla).toLowerCase().includes(termino)
    );
  }
  if (talla) {
    filtrados = filtrados.filter((i) => String(i.talla) === talla);
  }

  tbody.innerHTML = '';
  vacio.style.display = filtrados.length ? 'none' : 'block';

  filtrados.forEach((item) => {
    const tr = document.createElement('tr');
    const baja = item.cantidad <= 5;
    tr.innerHTML = `
      <td><b>${escapar(item.codigo)}</b></td>
      <td><span class="badge-color">${escapar(item.color)}</span></td>
      <td>${escapar(item.talla)}</td>
      <td><span class="badge-cantidad ${baja ? 'baja' : 'ok'}">${item.cantidad}</span></td>
      <td>
        <button class="btn-editar" data-id="${item.id}">Editar</button>
        <button class="btn-eliminar" data-id="${item.id}">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  pintarTotales();
}

function pintarTotales() {
  const modelos = inventario.length;
  const unidades = inventario.reduce((suma, i) => suma + Number(i.cantidad || 0), 0);
  const bajas = inventario.filter((i) => i.cantidad <= 5).length;
  totales.innerHTML = `
    <div class="grupo"><b>${modelos}</b><span>Modelos</span></div>
    <div class="grupo"><b>${unidades}</b><span>Unidades</span></div>
    <div class="grupo"><b>${bajas}</b><span>Stock bajo</span></div>
  `;
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function limpiarForm() {
  form.reset();
  document.getElementById('cantidad').value = '1';
  editandoId.value = '';
  tituloForm.textContent = 'Agregar Zapatilla';
  btnGuardar.textContent = 'Agregar';
  btnCancelar.hidden = true;
  document.getElementById('codigo').focus();
}

async function guardar() {
  const item = {
    codigo: document.getElementById('codigo').value.trim(),
    color: document.getElementById('color').value.trim(),
    talla: document.getElementById('talla').value,
    cantidad: parseInt(document.getElementById('cantidad').value, 10) || 0,
  };

  const id = editandoId.value;
  if (id) {
    await fetch(`/api/inventario/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  } else {
    await fetch('/api/inventario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  }
  limpiarForm();
  cargar();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  guardar();
});

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = Number(btn.dataset.id);

  if (btn.classList.contains('btn-eliminar')) {
    if (!confirm('¿Eliminar esta zapatilla del inventario?')) return;
    await fetch(`/api/inventario/${id}`, { method: 'DELETE' });
    cargar();
    return;
  }

  if (btn.classList.contains('btn-editar')) {
    const item = inventario.find((i) => i.id === id);
    if (!item) return;
    editandoId.value = item.id;
    document.getElementById('codigo').value = item.codigo;
    document.getElementById('color').value = item.color;
    document.getElementById('talla').value = item.talla;
    document.getElementById('cantidad').value = item.cantidad;
    tituloForm.textContent = 'Editar Zapatilla';
    btnGuardar.textContent = 'Actualizar';
    btnCancelar.hidden = false;
    document.getElementById('codigo').focus();
    return;
  }
});

btnCancelar.addEventListener('click', limpiarForm);

document.getElementById('mas').addEventListener('click', () => {
  const input = document.getElementById('cantidad');
  input.value = (parseInt(input.value, 10) || 0) + 1;
});

document.getElementById('menos').addEventListener('click', () => {
  const input = document.getElementById('cantidad');
  input.value = Math.max(0, (parseInt(input.value, 10) || 0) - 1);
});

busqueda.addEventListener('input', pintar);
filtroTalla.addEventListener('change', pintar);

cargar();
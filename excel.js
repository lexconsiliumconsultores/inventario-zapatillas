const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SHEETS = ['Verano', 'Invierno', 'Niños'];

function cargarDesdeExcel(file) {
  const wb = xlsx.readFile(file);
  const productos = [];

  SHEETS.forEach((sheetName) => {
    if (!wb.Sheets[sheetName]) return;
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    if (!rows.length) return;

    const headerRow = rows.findIndex((r) =>
      r && r.some((c) => String(c).trim().toUpperCase() === 'CODIGO')
    );
    if (headerRow === -1) return;

    const headers = rows[headerRow].map((h) => String(h || '').trim().toUpperCase());
    const idx = (name) => headers.indexOf(name);
    const idxCode = idx('CODIGO');
    const idxName = idx('PRODUCTO');
    const idxCat = Math.max(idx('CATEGORIA'), idx('DESCRIPCION'));
    const idxGen = idx('GENERO');
    const idxPrice = idx('PRECIO');
    const idxTalla = idx('TALLAS');
    const idxStock = idx('STOCK DISPONIBLE');

    let last = null;
    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const code = row[idxCode];
      const name = row[idxName];
      const talla = row[idxTalla];
      const stock = row[idxStock];

      if (code || name) {
        last = {
          temporada: sheetName,
          codigo: String(code || '').trim(),
          producto: String(name || '').trim(),
          categoria: String(row[idxCat] || '').trim() || 'General',
          genero: String(row[idxGen] || '').trim() || 'Unisex',
          precio: Number(row[idxPrice]) || 0,
          tallas: [],
        };
        productos.push(last);
      }

      if (last && talla !== undefined && talla !== null && String(talla).trim() !== '') {
        const t = String(talla).trim();
        const s = Number(stock) || 0;
        const existente = last.tallas.find((v) => v.talla === t);
        if (existente) existente.stock += s;
        else last.tallas.push({ talla: t, stock: s });
      }
    }
  });

  return productos;
}

function buscarArchivoExcel() {
  if (process.env.EXCEL_FILE && fs.existsSync(process.env.EXCEL_FILE)) {
    return process.env.EXCEL_FILE;
  }
  const enProyecto = fs.readdirSync(__dirname).find((f) => f.endsWith('.xlsx'));
  if (enProyecto) return path.join(__dirname, enProyecto);
  const descargas = path.join(os.homedir(), 'Downloads');
  if (fs.existsSync(descargas)) {
    const enDescargas = fs.readdirSync(descargas).find((f) => f.endsWith('.xlsx'));
    if (enDescargas) return path.join(descargas, enDescargas);
  }
  return null;
}

module.exports = { cargarDesdeExcel, buscarArchivoExcel };
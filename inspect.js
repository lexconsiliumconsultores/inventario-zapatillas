const xlsx = require('xlsx');
const path = require('path');
const file = process.argv[2];

const wb = xlsx.readFile(file, { cellDates: true });
console.log('HOJAS:', wb.SheetNames);

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
  console.log('\n===== HOJA:', name, '| filas:', rows.length);

  const headers = (rows[0] || []).map((h, i) => i + ':' + String(h).trim());
  console.log('ENCABEZADOS:', headers.join(' | '));

  for (let i = 1; i < Math.min(rows.length, 12); i++) {
    if (!rows[i]) continue;
    const vals = rows[i].map((v) => (v === null || v === undefined ? '' : String(v)));
    console.log('FILA' + i + ':', vals.join(' | '));
  }
}
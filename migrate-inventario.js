// Ejecuta solo despues de crear las tablas (ver supabase/schema.sql).
// Lee inventario.json y lo sube via PostgREST con la llave publishable.
const fs = require('fs');
const path = './inventario.json';
const SUPABASE_URL = 'https://sltgejpimquvaxzyupjo.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY || 'PEGAR_SERVICE_ROLE_O_SECRET_KEY';
if (KEY === 'PEGAR_SERVICE_ROLE_O_SECRET_KEY') { console.error('Define SUPABASE_SECRET_KEY en el entorno'); process.exit(1); }

(async () => {
  const lista = JSON.parse(fs.readFileSync(path, 'utf8'));
  let ok = 0, err = 0;
  for (const it of lista) {
    const body = { ...it };
    delete body.id;
    const res = await fetch(SUPABASE_URL + '/rest/v1/inventario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY, Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
    if (res.ok) { ok++; } else { err++; console.error(await res.text()); }
  }
  console.log('Migrado:', ok, 'errores:', err);
})().catch(e => console.error(e));

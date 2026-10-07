# Migracion PROYECTO 1 (Velvet Store) a Supabase directo

## Cambios ya aplicados (06-10-2026)
- `public/supabase-config.js`: apunta al mismo proyecto Supabase de LEX (vfxbnuhacqvyebualfhv).
- `public/api-shim.js`: intercepta `window.fetch` para `/api/*` y responde desde Supabase (inventario, pedidos, catalogo publico, sistema, ventas/altas/bajas/tallas/foto, pendientes, despachar, importar).
- `public/index.html` y `public/tienda.html`: incluye @supabase/supabase-js + config + shim antes de `app.js`/`tienda.js`.
- `capacitor.config.json` y `tienda-app/capacitor.config.json`: se elimina `server.url` (la APK empaqueta localmente `public/`).
- `public/sw.js`: cache v4 para forzar refresh de estaticos.
- `supabase/schema.sql`: tablas `inventario` + `pedidos` (id,campos,tallas jsonb,lineas jsonb, estado/despachado) y politicas RLS.
- `migrate-inventario.js`: siembra las 35 zapatillas desde `inventario.json` via PostgREST.
- Importar desde Excel (`/api/excel/upload`) queda devuelvo un aviso deshabilitado; el importador via `/api/inventario/import` (JSON) sigue disponible.
- `railway.json` y `render.yaml` se Archivan (ver /railway.json.bak) para cerrar la dependencia de Railway; deploy de la estatilla via hosting estático (Cloudflare Pages / GitHub Pages / Vercel) o — con URL fija — se puede volver a CDN.

## Pasos todavia pendientes (los debes ejecutar)
1. En Supabase (mismo proyecto que LEX): SQL Editor -> pegar y ejecutar `supabase/schema.sql`.
2. En esta carpeta: `node migrate-inventario.js` para subir inventario.json.
3. Servir `public/` estatico (ejemplo: `npx serve public`) o subirlo al hosting. Administrar tienda desde `/index.html`, tienda desde `/tienda.html`.
4. APKs: `cd android && gradlew assembleRelease` y `cd tienda-app/android && gradlew assembleRelease` (Java 21) y subir los APKs junto a las APKs viejas de Velvet.
5. Retirar Railway y variables/env una vez validado.
6. Icono y textos: las APK nuevas muestran la PWA 100% offline; si quieres iconos/lanzador distintos, regenerarlos con scripts.

Nota: el login de admin ya no va al server (no hay cookie de sesion). El shim del navegador usa admin1234/dani1234 para simplificar; si quieres usuarios/roles reales, mover a Supabase Auth.

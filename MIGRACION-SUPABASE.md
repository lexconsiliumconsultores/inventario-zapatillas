# Migracion PROYECTO 1 (Velvet Store) a Supabase directo

## Resumen
Velvet Store ya NO depende de un servidor propio. Los datos viven en Supabase y la
web/app se sirven como estaticos desde GitHub Pages.

## Datos clave
- Proyecto Supabase: `sltgejpimquvaxzyupjo`
  - URL: `https://sltgejpimquvaxzyupjo.supabase.co`
  - Anon key: `sb_publishable_1BEnnP45LUAi6CKrrM8qpQ_NkaydsnP`
  - Tablas: `inventario` (35 productos con tallas) y `pedidos`.
  - RLS: politicas `allow_all_*` (anon puede leer/escribir).
- Hosting web: GitHub Pages, rama `gh-pages` (`https://lexconsiliumconsultores.github.io/inventario-zapatillas/`).
- Login admin (shim, en memoria): `dani` / `dani1234`, `manu` / `manu1234`.

## Cambios ya aplicados (20-10-2026)
- [x] `public/supabase-config.js`: apunta al proyecto Supabase real `sltgejpimquvaxzyupjo`.
- [x] `public/api-shim.js`: intercepta `window.fetch` para `/api/*` y responde desde Supabase
  (inventario, pedidos, catalogo publico, sistema, ventas/altas/bajas/tallas/foto, import).
- [x] `public/index.html` y `public/tienda.html`: incluyen @supabase/supabase-js + config + shim
  antes de `app.js`/`tienda.js`.
- [x] `capacitor.config.json` y `tienda-app/capacitor.config.json`: se elimina `server.url`
  (la APK empaqueta localmente `public/`).
- [x] `public/sw.js`: cache v6 para forzar refresh de estaticos.
- [x] `supabase/schema.sql`: tablas `inventario` + `pedidos` y politicas RLS.
- [x] `migrate-inventario.js`: siembra las 35 zapatillas desde `inventario.json` via PostgREST.
- [x] Las 3 fotos restantes migradas (Z-01, Z-03, 3J01-1) -> `conFoto=3`.
- [x] Bump de version: admin `1.0.9` (versionCode 10), tienda `1.0.1` (versionCode 2).
- [x] APKs recompiladas (Java 21) y publicadas en `public/` y raiz para descarga.
- [x] `public/` sincronizado a `origin/gh-pages`.
- [x] Verificacion end-to-end: Supabase 35 filas (3 con foto) y GitHub Pages sirviendo
      `version.json` 1.0.9 + ambas APKs.

## Pasos completados (retomar aqui si algo falla)
1. Supabase: SQL Editor -> `supabase/schema.sql` (ya ejecutado).
2. `node migrate-inventario.js` (ya ejecutado).
3. Servir `public/` estatico -> hecho via GitHub Pages (rama `gh-pages`).
4. APKs: `cd android && gradlew assembleRelease` y
   `cd tienda-app/android && gradlew assembleRelease` (Java 21) -> hecho.
5. Icono y textos: la PWA es offline; regenerar iconos con scripts si se desea.

## Compilar las APKs (recordatorio)
```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
cd android; .\gradlew.bat assembleRelease          # admin -> public/velvet-store.apk
cd ..\tienda-app\android; .\gradlew.bat assembleRelease  # tienda -> public/velvet-store-tienda.apk
```
(NO pasar `-Dorg.gradle.java.home=...`: PowerShell parte el path por el espacio.)

## Nota login admin
El login ya no va al server (no hay cookie de sesion). El shim del navegador usa
`dani`/`dani1234` y `manu`/`manu1234`. Si se quieren usuarios/roles reales, mover a Supabase Auth.

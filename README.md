# Inventario de Zapatillas — Velvet Store

Control de inventario de zapatillas: stock por talla, ventas, altas de stock, fotos y carga desde Excel.

Arquitectura actual: **sin servidor propio**. Los datos viven en **Supabase** y la web/app se
sirven como estáticos desde **GitHub Pages**.

- Web + PWA (instalable en celulares y tablets): `https://lexconsiliumconsultores.github.io/inventario-zapatillas/`
- App Android (APK con Capacitor): admin y tienda, empaquetan `public/` localmente.
- Datos en Supabase (`inventario` y `pedidos`), accesibles vía PostgREST con anon key.

## Cómo correr en local

Requisito: Node.js 18+

```bash
npm install
npm start
```

Abrir `http://localhost:3000`

Al primer arranque busca un archivo `.xlsx` en la carpeta del proyecto o en `Downloads` (o fíjalo
con la variable de entorno `EXCEL_FILE`). También puede empezar vacío y usar el botón
**"Recargar desde Excel"**.

## Cómo correr la web (Supabase)

La web no necesita servidor: `public/` consume Supabase directamente.

```bash
npx serve public          # o cualquier servidor estático
```

Admin en `/index.html`, tienda en `/tienda.html`. El `public/api-shim.js` traduce las llamadas
`/api/*` a Supabase en el navegador.

## Deploy en línea

### GitHub Pages (actual)

1. Sube este repo a GitHub y activa **Settings → Pages → Source: `gh-pages` branch**.
2. La rama `gh-pages` es un espejo de `public/` (se actualiza con el contenido de `public/`).
3. Listo. La URL `https://lexconsiliumconsultores.github.io/inventario-zapatillas/` es tu PWA.

Para publicar cambios: actualiza `public/` y sincroniza esa carpeta a la rama `gh-pages`.

## Base de datos (Supabase)

- Proyecto: `sltgejpimquvaxzyupjo` — `https://sltgejpimquvaxzyupjo.supabase.co`
- Anon key: `sb_publishable_1BEnnP45LUAi6CKrrM8qpQ_NkaydsnP`
- Tablas: `inventario` (productos con tallas) y `pedidos`, con RLS `allow_all_*`.
- Schema: `supabase/schema.sql` · Siembra: `migrate-inventario.js`.

## App Android (APK)

Las apps (admin y tienda) se configuran con Capacitor empaquetando `public/` (sin `server.url`).

```bash
npm run android:sync   # npx cap sync android (copia public/ a la app)
npm run android:build  # genera el APK de debug
```

APKs release (firmadas, Java 21): ver `MIGRACION-SUPABASE.md`.

- Admin: `android/` (`com.velvetstore.inventario`)
- Tienda: `tienda-app/android/` (`com.velvetstore.tienda`)

## Estructura

```
server.js              Servidor HTTP + API (modo local / migración)
excel.js               Lectura de Excel (hojas Verano, Invierno, Niños)
public/                Web + PWA (consumen Supabase vía api-shim.js)
android/               App Android admin (Capacitor)
tienda-app/            App Android tienda (Capacitor)
supabase/              schema.sql del proyecto Supabase
scripts/               Utilidades (iconos, fotos)
uploads/               Fotos de productos
inventario.json        Datos (no se sube a git)
```

---

*Proyecto Velvet Store — migración a Supabase completada (20-10-2026).*

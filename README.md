# Inventario de Zapatillas

Control de inventario de zapatillas: stock por talla, ventas, altas de stock, fotos y carga desde Excel.

- Web + PWA (instalable en celulares y tablets)
- App Android (APK con Capacitor)
- API REST sin dependencias externas (solo `xlsx`)

## Cómo correr

Requisito: Node.js 18+

```bash
npm install
npm start
```

Abrir `http://localhost:3000`

Al primer arranque busca un archivo `.xlsx` en la carpeta del proyecto o en `Downloads` (o fíjalo con la variable de entorno `EXCEL_FILE`). También puede empezar vacío y usar el botón **"Recargar desde Excel"**.

## Deploy en línea

### Railway (recomendado)

1. Sube este repo a GitHub.
2. En [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → conecta el repo.
3. **Renombra el servicio a `velvet-store`** (Settings → Service → Name, o clic derecho sobre el servicio → Rename). Así la URL queda `https://velvet-store-xxxx.up.railway.app`.
4. Crea un **Volume** y móntalo en `/data` (1 GB es suficiente). Los datos persisten ahí.
5. Variables de entorno:
   - `DATA_DIR` → `/data`
   - `NODE_VERSION` → `20`
6. Build y start ya quedan configurados en `railway.json` (`npm install` / `npm start`).
7. Listo. La URL `https://velvet-store-xxxx.up.railway.app` es tu PWA instalable.

### Render (alternativa)

1. Sube este repo a GitHub.
2. En [render.com](https://render.com) → **New** → **Web Service** → conecta el repo.
3. Build: `npm install` · Start: `npm start` (ya configurado en `render.yaml`).
4. Listo. La URL `https://tu-app.onrender.com` es tu PWA instalable.

Si quieres dejar el inventario vacío en línea, simplemente no subas ningún archivo `.xlsx`.

## App Android (APK)

La app Android se configura con Capacitor apuntando a la web en línea.

```bash
npm run android:sync   # npx cap sync android (copia public/ a la app)
npm run android:build  # genera el APK de debug
```

El APK queda en `android/app/build/outputs/apk/debug/`. Instálalo en cualquier celular Android.

## Nube y local

La web en línea (Render) guarda sus propios datos. No hay app de escritorio; todo el uso es desde el navegador (PWA) o la app Android, que apuntan a la misma web.

Con el botón "Conectar sincronización" se pueden compartir los datos con un repo de GitHub.

## Estructura

```
server.js              Servidor HTTP + API
excel.js               Lectura de Excel (hojas Verano, Invierno, Niños)
public/                Web + PWA (manifest, service worker, iconos)
android/               Proyecto Android (Capacitor)
scripts/generar-iconos.js   Genera iconos PNG
uploads/               Fotos de productos
inventario.json        Datos (no se sube a git)
```
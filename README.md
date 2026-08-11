# Inventario de Zapatillas

Control de inventario de zapatillas: stock por talla, ventas, altas de stock, fotos y carga desde Excel.

- Web + PWA (instalable en celulares y tablets)
- App de escritorio para Windows (Electron)
- API REST sin dependencias externas (solo `xlsx`)

## Cómo correr

Requisito: Node.js 18+

```bash
npm install
npm start
```

Abrir `http://localhost:3000`

Al primer arranque busca un archivo `.xlsx` en la carpeta del proyecto o en `Downloads` (o fíjalo con la variable de entorno `EXCEL_FILE`). También puede empezar vacío y usar el botón **"Recargar desde Excel"**.

## Deploy en línea (Render)

1. Sube este repo a GitHub.
2. En [render.com](https://render.com) → **New** → **Web Service** → conecta el repo.
3. Build: `npm install` · Start: `npm start` (ya configurado en `render.yaml`).
4. Listo. La URL `https://tu-app.onrender.com` es tu PWA instalable.

Si quieres dejar el inventario vacío en línea, simplemente no subas ningún archivo `.xlsx`.

## App Windows (instalador)

```bash
npm run dist
```

Genera en `dist/`:
- `Inventario Zapatillas Setup x.y.z.exe` (instalador NSIS)
- `Inventario Zapatillas x.y.z.exe` (versión portable, no necesita instalar)

La app abre una ventana con el inventario. Detecta el Excel en la misma carpeta/proyecto o en `Downloads`.

## Nube y local al mismo tiempo

La web (Render) y la app Windows usan el mismo código pero datos separados:

- **Windows**: guarda sus datos en `inventario.json` en la carpeta donde instalaste la app (modo local/offline).
- **Línea**: Render usa su propio almacenamiento persistente en disco.

> Para sincronizar entre ambos se puede añadir después un botón "Exportar/Importar copia" con `inventario.json`.

## Estructura

```
server.js              Servidor HTTP + API
excel.js               Lectura de Excel (hojas Verano, Invierno, Niños)
electron/main.js       Ventana de escritorio (Electron)
public/                Web + PWA (manifest, service worker, iconos)
scripts/generar-iconos.js   Genera iconos PNG
uploads/               Fotos de productos
inventario.json        Datos (no se sube a git)
```
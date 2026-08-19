# MEMORIA DEL PROYECTO — VELVET STORE

Historial completo de todo lo realizado desde el inicio del proyecto hasta el cierre.

---

## 1. Qué es el proyecto

**Velvet Store** es un sistema de inventario de zapatillas con dos partes:

1. **Panel de administración** (protegido con usuario y contraseña): gestor del inventario, Excel/catálogo y registro de ventas.
2. **Tienda pública** para clientes: catálogo visible, ficha de cada zapatilla con foto, y registro de pedidos.

Además se desarrolló una **aplicación Android** (APK) que abre la tienda/inventario directamente, compilada y firmada con Ceramic Capacitor.

- Repositorio: `https://github.com/lexconsiliumconsultores/inventario-zapatillas.git` (rama `master`)
- Servidor: Railway — proyecto `compassionate-inspiration`, servicio `velvet-store`, entorno `production`
- URL: `https://velvet-store-smec-production.up.railway.app`
- Base de datos / archivos: volumen en Railway `/data` (500 MB)

---

## 2. Cronología de trabajos realizados

### Fase 1 — Sistema de inventario (backend + panel admin)
- Servidor Node.js en `server.js` con rutas de API:
  - Inventario: consulta, alta, edición, baja de zapatillas (tallas, colores, fotos, precios).
  - `GET /api/inventario`, `GET /api/zapatilla?id=...`, altas/bajas/ediciones.
- Panel admin en `public/index.html` + `app.js` + `estilos.css`:
  - Listado de zapatillas, buscador, alta/edición, carga de fotos.
  - Exportación/gestión de Excel (`public/excel.js`).
- Almacenamiento persistente en el volumen `/data` de Railway.

### Fase 2 — Tienda pública
- `tienda.html`, `tienda.js`, `tienda.css`:
  - Catálogo público con tarjetas de producto.
  - Ficha de zapatilla con foto ampliable y zoom (pinch / rueda / botones) — **V 1.0.6**.
  - Registro de pedidos (`POST /api/pedidos`).
- Rutas públicas (sin login): `/tienda`, `/api/tienda/catalogo`, `POST /api/pedidos`, `/api/system` (healthcheck).

### Fase 3 — Seguridad del panel admin
- Protección del panel: todas las rutas `/api/*` requieren autenticación, salvo:
  - `/api/login` y `/api/logout`
  - `/api/system`
  - `/api/tienda/*` (catálogo)
  - `POST /api/pedidos`
- Cookie de sesión firmada con HMAC (`velvet_admin`) usando `SESSION_SECRET`.
- **Decisión del cliente:** el panel pide clave en **cada carga de página** (no hay sesión larga). Para lograrlo, `app.js` cierra la sesión al iniciar (`POST /api/logout`) y solo inicia si el login es válido.
- Botón **"Salir"** para cerrar sesión manualmente.
- Login con **usuario + contraseña**:
  - Usuarios permitidos configurados por variable de entorno `ADMIN_USERS`:
    - `dani` / `dani1234`
    - `manu` / `manu1234`
  - (Antes existía `ADMIN_PASSWORD=admin1234` como clave única; quedó obsoleta al implementar los usuarios múltiples.)

### Fase 4 — Sincronización con GitHub
- Los datos del sistema se sincronizan de forma automática con el repositorio `lexconsiliumconsultores/inventario-datos` mediante `GH_SYNC_REPO` y `GH_SYNC_TOKEN`.

### Fase 5 — Aplicación Android (APK)
- Proyecto Capacitor (`android/`), appId `com.velvetstore.inventario`.
- La app apunta a la URL de producción (Capacitor `server.url`).
- Compilación Release firmada con keystore propio (`android/keystore.properties`, no subido a git).
- **Importante:** para compilar se debe usar **Java 21**:
  - `JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`
  - (El `JAVA_HOME` del sistema apunta a JDK 17 y falla con *invalid source release: 21*).
- La APK compilada se sirve desde la web:
  - URL de descarga: `/velvet-store.apk`
  - Archivos en la raíz: `velvet-store-descarga.apk` y la versión en texto `Velvet Store X.Y.Z.apk`.

### Fase 6 — Nueva identidad (ícono y splash)
- **V 1.0.8 (final):** se reemplazó el ícono anterior por el **logo de Velvet** (`public/logo-velvet.png`).
  - Generados todos los tamaños launcher (`mipmap-*`): `ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png` y `splash_logo.png`.
  - Fondo del ícono adaptativo marrón `#39030D` (color del logo).
  - Splash actualizado con el mismo logo.

---

## 3. Versiones publicadas

| Versión | Novedades |
|---|---|
| 1.0.6 | Foto de zapatilla con zoom en la tienda |
| 1.0.7 | Cierre de funcionalidades: panel admin con usuarios (dani y manu), login en cada carga, botón Salir, APK firmada |
| 1.0.8 (final) | Ícono nuevo con el logo Velvet + splash; APK 1.0.8 versionCode 9 |

Archivos de versión:
- `public/version.json` → muestra la versión en la app y la ruta de la APK.
- `public/app.js` → `APP_VERSION`.
- `android/app/build.gradle` → `versionCode` / `versionName`.

---

## 4. Estado final (cierre)

- Última versión en producción: **1.0.8**
- `version.json` online: `1.0.8` — *"V 1.0.8 final: icono nuevo de la app con el logo Velvet + splash"*
- APK servida en `/velvet-store.apk`: **1.0.8** (versionCode 9), firmada, verificada en producción (se comprobó el hash).
- Despliegues Railway con estado **SUCCESS** en todas las versiones.
- Árbol de trabajo de git limpio.

## 5. Variables de entorno (Railway, entorno `production`)
- `ADMIN_USERS` = `dani:dani1234,manu:manu1234`
- `ADMIN_PASSWORD` = `admin1234` (legacy, ya no se usa)
- `SESSION_SECRET` = cadena aleatoria (firma de cookies)
- `DATA_DIR` = `/data`
- `NODE_VERSION` = `20`
- `GH_SYNC_REPO` = `lexconsiliumconsultores/inventario-datos`
- `GH_SYNC_TOKEN` = token de acceso del repo de datos

## 6. Recordatorios técnicos
- Compilar APK: `$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"; cd android; .\gradlew.bat assembleRelease`
- Verificar APK: `C:\Users\CASA\AppData\Local\Android\Sdk\build-tools\35.0.0\aapt2.exe dump badging <apk>`
- Firma APK: certificado `CN=Velvet Store`.
- Push a `master` dispara el deploy automático en Railway.
- El pomp de datos entre la web y la app usa la misma URL de producción (Capacitor).

---

*Documento de cierre — Velvet Store. ¡Proyecto terminado!*
# ESTADO DE LA MIGRACION RAILWAY -> SUPABASE (handoff)

Ultima actualizacion: 20-10-2026

**ESTADO: COMPLETADA.** Todos los pasos 1-8 estan hechos. Ver MIGRACION-SUPABASE.md
y MEMORIA-DEL-PROYECTO.md (seccion 9) para el detalle final.

Este archivo era el punto de retoma; ya no es necesario.

---

## 1. Resumen

La migracion de PROYECTO 1 (Velvet Store) a Supabase directo esta CASI completa.
Falta compilar las APKs nuevas y cerrar detalles (Railway, docs).

---

## 2. YA COMPLETADO

- [x] Proyecto Supabase verificado y operativo.
  - URL real: `https://sltgejpimquvaxzyupjo.supabase.co`
  - Anon key: `sb_publishable_1BEnnP45LUAi6CKrrM8qpQ_NkaydsnP`
  - Tablas `inventario` (35 productos) y `pedidos` (0) creadas.
  - RLS con politicas `allow_all_*` (anon hace todo, igual que antes).
  - Escritura probada: INSERT 201 / DELETE 204 con la anon key.
- [x] Migracion de datos: 35 productos con tallas.
- [x] MIGRADAS LAS 3 FOTOS que faltaban (Z-01, Z-03, 3J01-1). Ahora `conFoto=3`.
- [x] Hosting GitHub Pages: rama `origin/gh-pages` sincronizada con `public/`.
- [x] Assets web sincronizados en `android/` y `tienda-app/android/` (`npx cap sync android`).
- [x] Bump de version aplicado (ver seccion 4).
- [x] Codigo del shim (`public/api-shim.js`) revisado: login, inventario, pedidos,
  tienda/catalogo, ventas/altas/bajas/tallas/foto, import. OK.

## 3. PENDIENTE (en orden)

1. **Compilar APK admin** (`android/`) con Java 21. FALLO por comando (ver seccion 5).
2. **Compilar APK tienda** (`tienda-app/android/`) con Java 21.
3. Copiar las APKs nuevas a `public/velvet-store.apk` y `public/velvet-store-tienda.apk`
   (y a la raiz: `velvet-store-descarga.apk`, `velvet-store-tienda-descarga.apk`,
   `Velvet Store 1.0.9.apk`, `Velvet Store Tienda 1.0.1.apk`) para que se puedan descargar.
4. Re-sincronizar `public/` a `origin/gh-pages` (por el bump de version y las APKs).
5. Verificar la app end-to-end (ver seccion 6).
6. Retirar Railway (CLI disponible y autenticado; ver seccion 7).
7. Actualizar `MIGRACION-SUPABASE.md` (esta desactualizado: dice proyecto LEX
   `vfxbnuhacqvyebualfhv` pero el real es `sltgejpimquvaxzyupjo`) y `MEMORIA-DEL-PROYECTO.md`.
8. Commit + push a `master` cuando este todo verificado.

## 4. CAMBIOS SIN COMMITEAR (working tree)

```
 M android/app/build.gradle              -> versionCode 10, versionName "1.0.9"
 M public/app.js                         -> APP_VERSION '1.0.9'
 M public/version.json                   -> version 1.0.9 + nota Supabase
 M tienda-app/android/app/build.gradle   -> versionCode 2,  versionName "1.0.1"
```

Los assets en `android/app/src/main/assets/public/` y
`tienda-app/android/app/src/main/assets/public/` ya fueron re-sincronizados.

## 5. FALLO AL COMPILAR (como arreglarlo)

El comando que fallo:

```
.\gradlew.bat assembleRelease -Dorg.gradle.java.home="C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
```

Error: `Cannot locate tasks that match '.gradle.java.home=C:\Program Files\...'`
PowerShell partio el argumento por el espacio del path.

**Arreglo:** usar `$env:JAVA_HOME` y NO pasar `-D`:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
.\gradlew.bat assembleRelease
```

(Workdir: `android` para la admin, `tienda-app\android` para la tienda.)

Salida esperada de la APK:
- Admin: `android\app\build\outputs\apk\release\app-release.apk`
- Tienda: `tienda-app\android\app\build\outputs\apk\release\app-release.apk`

Firma: keystore `velvet-store.keystore` (storeFile=velvet-store.keystore,
storePassword/keyPassword=velvet2026, keyAlias=velvet) ya presente en ambos proyectos.

## 6. PROBLEMA DE DNS LOCAL (IMPORTANTE)

La PC NO resuelve `sltgejpimquvaxzyupjo.supabase.co` con el DNS del router
(192.168.1.1 / 192.168.18.1): `El nombre DNS no existe`.
Google DNS (8.8.8.8) SI lo resuelve -> el proyecto existe y esta vivo.

- `ipconfig /flushdns` NO lo arreglo (el problema es el DNS del router).
- No somos administradores, asi que no se puede editar `C:\Windows\System32\drivers\etc\hosts`
  ni cambiar el DNS del adaptador sin permisos de admin.

**Workaround para scripts Node** (parche de `dns.lookup`), usado con exito en
`C:\Users\CASA\AppData\Local\Temp\opencode\`:

```js
const dns = require('dns');
const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (String(hostname).endsWith('.supabase.co')) {
    const all = options && options.all;
    const rec = { address: '104.18.38.10', family: 4 }; // IP Cloudflare de Supabase
    return process.nextTick(callback, null, all ? [rec] : rec.address, rec.family);
  }
  return originalLookup.call(this, hostname, options, callback);
};
```

**Accion recomendada para el usuario:** cambiar el DNS del router/adaptador a
`8.8.8.8` / `1.1.1.1`, o agregar la entrada al `hosts`. Sin esto, el navegador
de esta PC tampoco podra usar la app en GitHub Pages.

## 7. RAILWAY

- CLI disponible: `railway` v5.23.0, autenticado como `lexconsiliumconsul@outlook.com`.
- Proyecto: `compassionate-inspiration` (ID `1c81d8dc-cf24-4a16-92fc-abd41cb77733`),
  entorno `production` (ID `5f91d2aa-c5ba-44b7-9a5f-e7b419619807`).
- Servicio linkeado: `0bc10746-32bd-4f5d-b236-5ee8e5128240` -> "not found in project"
  (puede haber sido borrado o hay que re-linkear con `railway service`).
- Pendiente: decidir si eliminar el servicio/proyecto (accion destructiva -> confirmar con el usuario).

## 8. SCRIPTS TEMPORALES USADOS (en Temp)

`C:\Users\CASA\AppData\Local\Temp\opencode\`
- `test-supabase.js`   -> prueba de conectividad.
- `verify-supabase.js` -> conteo de filas + prueba de escritura.
- `migrate-fotos.js`   -> migra las 3 fotos (ya ejecutado).

## 9. DATOS CLAVE

- Repo: `https://github.com/lexconsiliumconsultores/inventario-zapatillas.git` (rama `master`)
- Hosting: rama `gh-pages` (GitHub Pages)
- Login admin (shim, en memoria): `dani` / `dani1234`, `manu` / `manu1234`
- Usuarios de app: panel admin `index.html`, tienda `tienda.html`

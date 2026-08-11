const { app, BrowserWindow, dialog, Menu } = require('electron');

if (typeof app === 'string' || typeof Menu === 'undefined') {
  console.error('electron/main.js es solo para la app de escritorio.');
  console.error('Para la version web ejecuta: npm start  (corre node server.js)');
  process.exit(1);
}

const path = require('path');
const { iniciar } = require(path.join(__dirname, '..', 'server.js'));
const { autoUpdater } = require('electron-updater');

let ventana = null;

function crearVentana(puerto) {
  ventana = new BrowserWindow({
    width: 1280,
    height: 820,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });

  ventana.loadURL(`http://localhost:${puerto}`);

  ventana.on('closed', () => {
    ventana = null;
  });

  ventana.on('page-title-updated', (e) => e.preventDefault());
}

function configurarActualizaciones() {
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    const destino = ventana || BrowserWindow.getFocusedWindow();
    if (!destino) return;
    dialog
      .showMessageBox(destino, {
        type: 'info',
        title: 'Actualizacion disponible',
        message: `Hay una nueva version de Velvet Store (${info.version})`,
        detail: '¿Quieres descargarla e instalarla?',
        buttons: ['Descargar', 'Ahora no'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate();
      });
  });

  autoUpdater.on('update-downloaded', () => {
    const destino = ventana || BrowserWindow.getFocusedWindow();
    if (!destino) return;
    dialog
      .showMessageBox(destino, {
        type: 'info',
        title: 'Actualizacion lista',
        message: 'La actualizacion se instala al cerrar la app.',
        detail: 'Reiniciar ahora para aplicar los cambios.',
        buttons: ['Reiniciar ahora', 'Mas tarde'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on('error', (e) => console.error('AutoUpdate:', e.message));

  autoUpdater.on('update-not-available', () => console.log('Sin actualizaciones'));

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e) => console.error('AutoUpdate check:', e.message));
  }, 5000);
}

const menu = Menu.buildFromTemplate([
  {
    label: 'Archivo',
    submenu: [
      {
        label: 'Recargar inventario desde Excel',
        accelerator: 'F5',
        click: () => {
          if (ventana) ventana.webContents.send('recargar-excel');
        },
      },
      {
        label: 'Buscar actualizaciones',
        click: () => {
          autoUpdater.checkForUpdates().catch((e) => console.error('AutoUpdate check:', e.message));
        },
      },
      { type: 'separator' },
      { role: 'quit', label: 'Salir' },
    ],
  },
]);

app.whenReady().then(async () => {
  Menu.setApplicationMenu(menu);
  try {
    const server = await iniciar(0);
    const puerto = server.address().port;
    crearVentana(puerto);
    configurarActualizaciones();
  } catch (e) {
    dialog.showErrorBox('Error', 'No se pudo iniciar el servidor: ' + e.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
const { app, BrowserWindow, dialog, Menu } = require('electron');

if (typeof app === 'string' || typeof Menu === 'undefined') {
  console.error('electron/main.js es solo para la app de escritorio.');
  console.error('Para la version web ejecuta: npm start  (corre node server.js)');
  process.exit(1);
}

const path = require('path');
const fs = require('fs');
const { iniciar } = require(path.join(__dirname, '..', 'server.js'));

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
  } catch (e) {
    dialog.showErrorBox('Error', 'No se pudo iniciar el servidor: ' + e.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
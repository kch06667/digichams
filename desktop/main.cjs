'use strict';
// Windows desktop launcher. The existing game remains the source of truth.
// No remote site, renderer Node.js APIs, or ROM loading is involved.
const {app, BrowserWindow, shell} = require('electron');
const path = require('node:path');
const fs = require('node:fs');

function gameEntry(base = app.isPackaged
  ? path.join(process.resourcesPath, 'game')
  : path.join(__dirname, '..')) {
  return path.join(base, 'index.html');
}
function gameWindowOptions() {
  return {
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0e2436',
    title: 'Digimon Championship',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false
    }
  };
}
function createGameWindow() {
  const file = gameEntry();
  if (!fs.existsSync(file)) throw new Error('Game entry not found: ' + file);
  const win = new BrowserWindow(gameWindowOptions());
  win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  win.webContents.on('will-navigate', (event, url) => {
    // Block page navigation to remote websites. The renderer is only a game.
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(file);
  win.webContents.on('did-fail-load', (_event, errorCode, description) => {
    console.error('[Desktop] game load failed:', errorCode, description);
  });
  return win;
}
if (require.main === module) {
  app.whenReady().then(() => {
    createGameWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createGameWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
module.exports = {gameEntry,gameWindowOptions};

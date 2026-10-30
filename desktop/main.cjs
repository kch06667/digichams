'use strict';
// Separate Windows desktop shell for the existing game. No ROM execution.
const {app, BrowserWindow, protocol, net} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');

// Standard/secure origin keeps fetch(), asset URLs and localStorage functional.
protocol.registerSchemesAsPrivileged([{
  scheme: 'digichamp',
  privileges: {standard:true, secure:true, supportFetchAPI:true, stream:true}
}]);

function gameRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, 'game')
    : path.join(__dirname, '..');
}
function resolveGamePath(requestUrl, root = gameRoot()) {
  const url = new URL(requestUrl);
  if (url.protocol !== 'digichamp:' || url.hostname !== 'game') return null;
  let pathname;
  // Encoded separators could turn a single apparent path segment into a
  // second root or a Windows UNC-looking path after decoding.
  if (/%2f|%5c/i.test(url.pathname)) return null;
  try { pathname = decodeURIComponent(url.pathname); }
  catch (_) { return null; }
  if (pathname.startsWith('//')) return null;
  if (pathname.includes('\\') || pathname.includes('\0')) return null;
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) return null;
  return resolved;
}
function gameWindowOptions() {
  return {
    width: 1440, height: 900,
    minWidth: 960, minHeight: 640,
    show: false, autoHideMenuBar: true,
    backgroundColor: '#0e2436', title: 'Digimon Championship',
    webPreferences: {
      nodeIntegration:false, contextIsolation:true, sandbox:true,
      webSecurity:true, webviewTag:false, allowRunningInsecureContent:false
    }
  };
}
function createGameWindow() {
  const win = new BrowserWindow(gameWindowOptions());
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('digichamp://game/')) event.preventDefault();
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL('digichamp://game/index.html');
  win.webContents.on('did-fail-load', (_event, code, desc) => {
    console.error('[Desktop] loading error', code, desc);
  });
  return win;
}
// Electron may load its app entry through a bootstrap module, in which
// case require.main !== module. The real Electron app must initialize even
// when that is true; plain Node unit tests provide no app.whenReady().
if (typeof app.whenReady === 'function') {
  app.whenReady().then(() => {
    protocol.handle('digichamp', request => {
      const file = resolveGamePath(request.url);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile())
        return new Response('Not found', {status:404});
      return net.fetch(pathToFileURL(file).href);
    });
    createGameWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createGameWindow();
    });
  }).catch(error=>{
    console.error('[Desktop] initialization failed',error);
    app.quit();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
module.exports = {resolveGamePath,gameWindowOptions};

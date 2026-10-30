'use strict';
/* Verify that the packaged launcher cannot expose other hosts / arbitrary
 * paths and keeps Electron sandboxing. No Electron download required. */
const assert=require('node:assert/strict');
const path=require('node:path');
const test=require('node:test');
const Module=require('node:module');
const originalLoad=Module._load;
const mainPath=path.resolve(__dirname,'..','main.cjs');
let registered=[];
const electron={
  app:{isPackaged:false},
  protocol:{registerSchemesAsPrivileged:(schemes)=>registered=schemes},
  BrowserWindow:function BrowserWindow(){},
  net:{fetch:()=>{}}
};
test('local protocol is declared secure and sandboxed',()=>{
  let launcher;
  Module._load=function(request,parent,isMain){
    if(request==='electron')return electron;
    return originalLoad.call(this,request,parent,isMain);
  };
  try{delete require.cache[mainPath];launcher=require(mainPath);}
  finally{Module._load=originalLoad;}
  assert.equal(registered.length,1);
  assert.equal(registered[0].scheme,'digichamp');
  assert.equal(registered[0].privileges.secure,true);
  assert.equal(registered[0].privileges.standard,true);
  assert.equal(registered[0].privileges.supportFetchAPI,true);
  const pref=launcher.gameWindowOptions().webPreferences;
  assert.equal(pref.nodeIntegration,false);
  assert.equal(pref.contextIsolation,true);
  assert.equal(pref.sandbox,true);
  assert.equal(pref.webSecurity,true);
  assert.equal(launcher.gameWindowOptions().minWidth>=900,true);
});
test('protocol path resolver enforces exact game origin and root',()=>{
  let launcher;
  Module._load=function(request,parent,isMain){
    if(request==='electron')return electron;
    return originalLoad.call(this,request,parent,isMain);
  };
  try{delete require.cache[mainPath];launcher=require(mainPath);}
  finally{Module._load=originalLoad;}
  const root=path.resolve(__dirname,'fixtures','sample-game');
  const resolve=u=>launcher.resolveGamePath(u,root);
  assert.equal(resolve('digichamp://game/'),path.join(root,'index.html'));
  assert.equal(resolve('digichamp://game/index.html'),path.join(root,'index.html'));
  assert.equal(resolve('digichamp://game/phaser-lab/?farmHandoff=abc'),
    path.join(root,'phaser-lab','index.html'));
  assert.equal(resolve('digichamp://game/phaser-lab/index.html?embeddedBattle=1'),
    path.join(root,'phaser-lab','index.html'));
  assert.equal(resolve('digichamp://game/src/farm-core.js'),
    path.join(root,'src','farm-core.js'));
  assert.equal(resolve('digichamp://game/assets/farm/map.webp?x=1'),
    path.join(root,'assets','farm','map.webp'));
  for(const url of [
    'https://game/index.html','file:///C:/Windows/win.ini',
    'digichamp://elsewhere/index.html','digichamp://game.evil/index.html',
    'digichamp://game/%5cWindows%5csystem.ini',
    'digichamp://game/%00thing',
    'digichamp://game/%2f%2fserver'
  ])assert.equal(resolve(url),null,url);
});

test('Electron bootstrap creates a window even when loaded as a required module',async()=>{
  const originalApp=electron.app;
  const originalProtocol=electron.protocol;
  const originalWindow=electron.BrowserWindow;
  let booted=0,handled=0,loaded='';
  electron.app={
    isPackaged:false,
    whenReady:()=>Promise.resolve(),
    on:()=>{},
    quit:()=>{throw Error('unexpected app quit during bootstrap');}
  };
  electron.protocol={
    registerSchemesAsPrivileged:()=>{},
    handle:()=>{handled++;}
  };
  electron.BrowserWindow=function(){
    booted++;
    this.webContents={
      setWindowOpenHandler:()=>{},
      on:()=>{}
    };
    this.once=()=>{};
    this.loadURL=url=>{loaded=url;};
  };
  electron.BrowserWindow.getAllWindows=()=>[];
  Module._load=function(request,parent,isMain){
    if(request==='electron')return electron;
    return originalLoad.call(this,request,parent,isMain);
  };
  try{
    delete require.cache[mainPath];
    // This is a require(), not a Node main module. Electron must still boot.
    require(mainPath);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(booted,1);
    assert.equal(handled,1);
    assert.equal(loaded,'digichamp://game/index.html');
  } finally {
    Module._load=originalLoad;
    electron.app=originalApp;
    electron.protocol=originalProtocol;
    electron.BrowserWindow=originalWindow;
    delete require.cache[mainPath];
  }
});

test('Windows local Phaser loader pins the already-used renderer without CDN',()=>{
  const originalApp=electron.app;
  electron.app={isPackaged:false};
  Module._load=function(request,parent,isMain){
    if(request==='electron')return electron;
    return originalLoad.call(this,request,parent,isMain);
  };
  try{
    delete require.cache[mainPath];
    const launcher=require(mainPath);
    const cdn=launcher.PHASER_CDN;
    const html='<script defer src="'+cdn+'"></script>';
    assert.equal(launcher.offlinePhaserPage(html),
      '<script defer src="./vendor/phaser.min.js"></script>');
    assert.equal(launcher.PHASER_CDN,
      'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js');
    assert.equal(launcher.OFFLINE_PHASER,
      '/phaser-lab/vendor/phaser.min.js');
    assert.ok(launcher.offlinePhaserPath().endsWith(
      path.join('desktop','node_modules','phaser','dist','phaser.min.js')));
    for(const input of ['',html+html,'<script src="https://evil.com/a.js"></script>']){
      assert.throws(()=>launcher.offlinePhaserPage(input));
    }
  }finally{
    Module._load=originalLoad;
    electron.app=originalApp;
    delete require.cache[mainPath];
  }
});

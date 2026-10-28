/* Browser-local PRIVATE artwork import for the Phaser battle lab.
 * No network, storage, automatic upload or publishing of selected files.
 * Supports the existing one-species manifest.json + action_<n>.png export.
 * Phaser receives short-lived object URLs. Never cache those URLs in the SW.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DigiPrivateArtLoader=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const LIMIT_FILES=45, LIMIT_TOTAL=32*1024*1024, LIMIT_EACH=8*1024*1024;
  function validateFiles(files){
    if(!Array.isArray(files)||files.length<2||files.length>LIMIT_FILES)
      throw Error('manifest.json 및 PNG 파일을 선택해야 해 (최대 45개)');
    let size=0;
    const names=new Set();
    for(const f of files){
      if(!f||typeof f.name!=='string'||!/^[\w.-]+\.(json|png)$/i.test(f.name)||
        !Number.isSafeInteger(f.size)||f.size<1||f.size>LIMIT_EACH)
        throw Error('허용되지 않는 파일 형식 또는 크기');
      if(names.has(f.name))throw Error('같은 이름의 파일이 중복됐어');
      names.add(f.name);size+=f.size;
    }
    if(size>LIMIT_TOTAL)throw Error('그래픽 파일의 총 크기가 32MB를 초과했어');
  }
  async function fromFiles(input,validateManifest,options={}){
    const files=Array.from(input||[]);
    validateFiles(files);
    if(typeof validateManifest!=='function')throw Error('manifest validator is required');
    const metaFiles=files.filter(f=>f.name==='manifest.json');
    if(metaFiles.length!==1)throw Error('manifest.json 파일이 반드시 한 개 있어야 해');
    let manifest;
    try{manifest=JSON.parse(await metaFiles[0].text())}
    catch(_){throw Error('manifest.json 파일 형식이 잘못됐어')}
    if(!validateManifest(manifest)||typeof manifest.species!=='string'||
       !manifest.species.trim()||manifest.species.length>80)
      throw Error('잘못되었거나 지원하지 않는 스프라이트 설명서');
    const png=new Map(files.filter(f=>f.name.endsWith('.png')).map(f=>[f.name,f]));
    const entries=Object.values(manifest.actions);
    if(entries.length<1)throw Error('변환된 애니메이션이 없어');
    for(const entry of entries){
      if(!png.has(entry.file))throw Error('스프라이트 파일 누락: '+entry.file);
    }
    // Create URLs only AFTER all validation, and clean up on partial failure.
    const makeURL=options.createObjectURL||(file=>URL.createObjectURL(file));
    const revoke=options.revokeObjectURL||(url=>URL.revokeObjectURL(url));
    const urls=new Map();
    try{
      for(const entry of entries)if(!urls.has(entry.file)){
        const url=makeURL(png.get(entry.file));
        if(typeof url!=='string'||!url)throw Error('Failed to open image');
        urls.set(entry.file,url);
      }
    }catch(error){
      for(const url of urls.values())revoke(url);
      throw error;
    }
    let disposed=false;
    return {
      species:manifest.species, manifest,
      lookup:filename=>disposed?null:urls.get(filename)||null,
      dispose(){
        if(disposed)return;
        disposed=true;
        for(const url of urls.values())revoke(url);
        urls.clear();
      }
    };
  }
  return Object.freeze({fromFiles,validateFiles});
});

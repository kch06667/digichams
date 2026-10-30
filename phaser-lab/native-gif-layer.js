/* Original GIFs directly in the REAL Phaser game, with no exported PNG atlas.
 * A small DOM layer displays only the fighters active in this match.
 * The existing ORIGINAL battle engine, Phaser HUD and saved game own gameplay.
 * No NDS extraction, new artwork, extra timers or external image requests.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DigiNativeBattleGIF=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const CATEGORIES=new Set(['fresh','in-training','rookie','champion','ultimate','mega']);
  const ALL_ACTIONS=new Set(Array.from({length:40},(_,i)=>i));
  const clean=record=>record&&typeof record.name==='string'&&
    CATEGORIES.has(record.folder)&&
    typeof record.stem==='string'&&/^m\d{3}_[a-z0-9_]+$/.test(record.stem);
  function parseCatalog(species,index){
    if(!Array.isArray(species?.entries)||!Array.isArray(index?.catalog_entries))
      return new Map();
    const real=index.catalog_entries.filter(x=>x.category!=='egg');
    if(real.length!==216||species.entries.length!==216)return new Map();
    const known=new Set(real.filter(clean).map(x=>x.folder+'/'+x.stem));
    if(known.size!==216)return new Map();
    const lookup=new Map();
    for(const item of species.entries){
      if(!clean(item)||!known.has(item.folder+'/'+item.stem)||
         lookup.has(item.name))return new Map();
      lookup.set(item.name,{name:item.name,folder:item.folder,stem:item.stem});
    }
    return lookup;
  }
  async function loadCatalog(fetcher){
    try{
      const [a,b]=await Promise.all([
        fetcher('../assets/species-catalog.json'),
        fetcher('../assets/sprite-index.json')
      ]);
      if(!a.ok||!b.ok)return new Map();
      return parseCatalog(await a.json(),await b.json());
    }catch(_){return new Map();}
  }
  function findSpecies(catalog,name){
    return catalog.get(name==='팔몬'?'파르몬':name)||null;
  }
  function gifPath(entry,action){
    if(!clean(entry)||!Number.isInteger(action)||action<0||action>39)
      return null;
    const suffix=entry.stem==='m357_unimon_main'&&action===5?'5_1':String(action);
    return '../assets/sprites/'+entry.folder+'/'+entry.stem+'_'+suffix+'.gif';
  }
  class Layer{
    constructor(container,canvas,catalog){
      this.container=container;
      this.canvas=canvas;
      this.catalog=catalog;
      this.nodes=new Map();
      this.disposed=false;
      if(!container||!canvas||!catalog?.size){this.disabled=true;return;}
      container.style.position='relative';
      this.root=container.ownerDocument.createElement('div');
      this.root.id='dc-native-battle-gifs';
      this.root.setAttribute('aria-hidden','true');
      Object.assign(this.root.style,{
        position:'absolute',inset:'0',pointerEvents:'none',
        zIndex:'2',overflow:'hidden'
      });
      container.appendChild(this.root);
    }
    _request(n,pose,fallback=false){
      const src=gifPath(n.entry,pose);
      if(!src)return;
      if(!fallback)n.pose=pose;
      n.failedPose=null;
      n.sequence++;
      const seq=n.sequence;
      n.ready=false;
      n.img.style.visibility='hidden';
      n.sprite.setVisible(true);
      n.img.onload=()=>{
        if(this.disposed||seq!==n.sequence)return;
        if(!n.img.naturalWidth||!n.img.naturalHeight)return;
        if(!n.baseScale){
          n.baseScale=Math.min(64/n.img.naturalWidth,
            69/n.img.naturalHeight,2.4);
        }
        n.ready=true;
        n.img.style.visibility='visible';
        n.sprite.setVisible(false);
      };
      n.img.onerror=()=>{
        if(this.disposed||seq!==n.sequence)return;
        // Retry the actual species' ORIGINAL idle GIF once, never a
        // different Digimon or a URL outside our validated sprite index.
        if(pose!==0){this._request(n,0,true);return;}
        n.failedPose=0;
        n.ready=false;
        n.img.style.visibility='hidden';
        n.sprite.setVisible(true);
      };
      n.img.src=src;
    }
    sync(fighters,visuals,logic,time=0){
      if(this.disabled||this.disposed)return;
      const canvasRect=this.canvas.getBoundingClientRect();
      const rootRect=this.container.getBoundingClientRect();
      if(!canvasRect.width||!canvasRect.height)return;
      const sx=canvasRect.width/800,sy=canvasRect.height/450;
      const active=new Set();
      for(const f of fighters){
        const v=visuals.get(f.id);
        // Never override a specifically selected/converted PNG atlas.
        if(!v||v.useArt)continue;
        const entry=findSpecies(this.catalog,f.name);
        if(!entry)continue;
        active.add(f.id);
        let n=this.nodes.get(f.id);
        if(!n||n.entry.stem!==entry.stem){
          if(n)n.img.remove();
          const img=this.container.ownerDocument.createElement('img');
          img.alt='';
          img.draggable=false;
          img.dataset.mon=entry.name;
          Object.assign(img.style,{
            position:'absolute',pointerEvents:'none',
            imageRendering:'pixelated',visibility:'hidden',
            transformOrigin:'center bottom'
          });
          this.root.appendChild(img);
          n={img,entry,sprite:v.sprite,pose:null,failedPose:null,
            baseScale:0,ready:false,sequence:0};
          this.nodes.set(f.id,n);
        }
        const pose=logic.motionAction(f,ALL_ACTIONS);
        if(pose!==n.pose&&pose!==null)this._request(n,pose);
        const style=logic.fighterPresentation(f,true,true,time);
        n.img.style.left=(canvasRect.left-rootRect.left+f.x*sx)+'px';
        n.img.style.top=(canvasRect.top-rootRect.top+(f.y-2+style.bob)*sy)+'px';
        n.img.style.width=(n.ready?n.img.naturalWidth*n.baseScale*sx:0)+'px';
        n.img.style.height=(n.ready?n.img.naturalHeight*n.baseScale*sy:0)+'px';
        const flip=(f.visualDir??f.dir)>0?-1:1;
        n.img.style.transform='translate(-50%,-100%) scaleX('+flip+
          ') rotate('+style.angle+'deg)';
        n.img.style.opacity=String(style.alpha);
      }
      for(const [id,n] of this.nodes)if(!active.has(id)){
        n.sequence++;
        n.sprite.setVisible(true);
        n.img.remove();
        this.nodes.delete(id);
      }
    }
    status(id){
      const n=this.nodes.get(id);
      return n?{ready:n.ready,pose:n.pose,src:n.ready?n.img.getAttribute('src'):null}:null;
    }
    dispose(){
      this.disposed=true;
      for(const n of this.nodes.values()){
        n.sequence++;
        n.img.onload=null;n.img.onerror=null;
      }
      this.nodes.clear();
      this.root?.remove();
    }
  }
  return Object.freeze({parseCatalog,loadCatalog,findSpecies,gifPath,
    create:(container,canvas,catalog)=>new Layer(container,canvas,catalog)});
});

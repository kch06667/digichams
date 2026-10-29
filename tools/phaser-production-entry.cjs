'use strict';
// The authoritative full-game HTML uses Phaser as the default arena renderer.
// Developer/QA builders strip ONLY this tagged script group so legacy battle
// regression tests remain isolated and do not load duplicate bridges.
const START='<!-- DC-PHASER-PRODUCTION-BEGIN -->';
const END='<!-- DC-PHASER-PRODUCTION-END -->';
const scripts=[
 'src/battle-settlement-core.js',
 'src/battle-commit-core.js',
 'src/dev-phaser-commit.js',
 'src/dev-phaser-farm-launch.js',
 'src/phaser-arena-entry-choice.js'
];
const block=START+'\n'+scripts.map(src=>
 '<script defer src="'+src+'" data-phaser-production="1"></script>'
).join('\n')+'\n'+END;
function strip(html){
 const a=html.indexOf(START),b=html.indexOf(END);
 if(a===-1&&b===-1)return html;
 if(a<0||b<a||html.indexOf(START,a+START.length)!==-1||
    html.indexOf(END,b+END.length)!==-1||
    html.slice(a,b+END.length)!==block)
   throw Error('Production Phaser script block is missing or modified');
 const before=html.slice(0,a),after=html.slice(b+END.length);
 return before.replace(/\n$/, '')+after;
}
module.exports={START,END,scripts,block,strip};

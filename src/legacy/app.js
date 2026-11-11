// Legacy app script, moved from REMLUX_HTML.html. Runs as an ES module (strict mode).
// The maths lives in src/engine (pure, tested); this file keeps the UI, state and drawing,
// with thin wrappers that read the on-screen inputs and the global room shape.
import{rad,deg,parsePhotometry,buildModel,layout,placeLights as placeLightsE,placeIn as placeInE,areaOf,
  rectPoly,inPoly,polyArea,polyPerim,isConvex,edgeDist,crosses,inwardN,insetPoly,isSimple,shapePreset,normalizePoly,
  directIlluminance,illuminanceAt,wallZoneWidth,sampleWorkPlane,wallScallops,suggestGrid}from'../engine/index.ts';
import{newIsoView,attachIsoControls}from'../render/iso.ts';
import{initRoomThree,drawRoom3D,invalidateRoom3D,hideRoom3D}from'./../ui/roomThree.ts';
import{mountLibraryPicker}from'../ui/libraryPicker.ts';
import{initPlanImage}from'../ui/planImage.ts';
const $=id=>document.getElementById(id);
let lib;  // fixture library picker, mounted below once calc() exists
const f=(n,d=2)=>{const t=(+n).toFixed(d);return t.includes('.')?t.replace(/\.?0+$/,''):t};
const GRIDS=[[2,2],[3,2],[3,3],[4,3],[4,4],[5,4],[6,4],[6,6]];
const ANG=[10,15,24,36,45,60,90];
const layers={map:true,beam:true,field:false,dim:true,move:true,group:false,snap:true,iso:false};
let isoD=null,isoSig='';const isoView=newIsoView();
// ---- floor plan dimensions, drawn in screen pixels so text stays readable at any size ----
let dimD=null;
// isometric 3D view: shows the same heat map and lights on a floor with walls, instead of the flat plan
function drawIso3d(){
  const on=layers.iso&&isoD&&page==='visualize';
  const el=$('iso');
  if(!on){hideRoom3D();return}
  const w=Math.floor($('planwrap').clientWidth);if(w<80)return;
  const sig=[isoD.L,isoD.W,isoD.H,isoD.poly?JSON.stringify(isoD.poly):''].join();if(sig!==isoSig){isoSig=sig;isoView.zoom=0}  // room changed: fit again, keep the viewing angle
  drawRoom3D(el,{...isoD,width:w,height:Math.max(320,Math.min(640,Math.round(w*.75))),view:isoView,showBeams:layers.beam,heat:$('cv')})}
function drawDims(){
  const sv=$('dim'),wrap=$('planwrap'),on=!!(dimD&&layers.dim&&!layers.iso);
  wrap.classList.toggle('nodim',!on);if(!on){sv.innerHTML='';return}
  const st=$('stage'),wr=wrap.getBoundingClientRect(),sr=st.getBoundingClientRect();
  const ox=sr.left-wr.left+st.clientLeft,oy=sr.top-wr.top+st.clientTop,pw=st.clientWidth,ph=st.clientHeight;
  if(!pw||!ph)return;
  const{L,W,pts,sel,map}=dimD,X=x=>ox+x*pw/L,Y=y=>oy+y*ph/W,tw=t=>t.length*6.8+8;
  const tick=(x,y,c)=>`<line x1="${x-3.5}" y1="${y+3.5}" x2="${x+3.5}" y2="${y-3.5}" stroke="${c}" stroke-width="1.5"/>`;
  const txt=(x,y,t,c,rot,halo)=>`<text x="${x}" y="${y}" ${rot?`transform="rotate(-90 ${x} ${y})"`:''} text-anchor="middle" font-size="11" font-weight="600" fill="${c}" ${halo||''}>${t}</text>`;
  const hd=(x1,x2,y,t,c)=>`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c}"/>`+tick(x1,y,c)+tick(x2,y,c)+(x2-x1>=tw(t)?txt((x1+x2)/2,y-4,t,c):'');
  const vd=(y1,y2,x,t,c)=>`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${c}"/>`+tick(x,y1,c)+tick(x,y2,c)+(y2-y1>=tw(t)?txt(x-4,(y1+y2)/2,t,c,1):'');
  const chain=v=>{const u=[...new Set(v.filter(q=>q>.001&&q<v.lim-.001).map(q=>Math.round(q*1000)/1000))].sort((a,b)=>a-b);return[0,...u,v.lim]};
  const xs=pts.map(p=>p[0]);xs.lim=L;const ys=pts.map(p=>p[1]);ys.lim=W;
  const cx=chain(xs),cy=chain(ys),ac='var(--accent)',ink='var(--ink)',ru='var(--rule)';
  const r1=oy-28,r2=oy-12,c1=ox-28,c2=ox-12;let s='',hid=0;
  // extension lines
  cx.forEach(x=>s+=`<line x1="${X(x)}" y1="${oy-3}" x2="${X(x)}" y2="${(x===0||x===L)?r1-4:r2-4}" stroke="${ru}"/>`);
  cy.forEach(y=>s+=`<line x1="${ox-3}" y1="${Y(y)}" x2="${(y===0||y===W)?c1-4:c2-4}" y2="${Y(y)}" stroke="${ru}"/>`);
  // overall
  s+=hd(X(0),X(L),r1,f(L)+' m',ink)+vd(Y(0),Y(W),c1,f(W)+' m',ink);
  // chains: wall, lights, wall
  if(cx.length>2)for(let i=1;i<cx.length;i++){const t=f(cx[i]-cx[i-1]);if(X(cx[i])-X(cx[i-1])<tw(t))hid++;s+=hd(X(cx[i-1]),X(cx[i]),r2,t,ac)}
  if(cy.length>2)for(let i=1;i<cy.length;i++){const t=f(cy[i]-cy[i-1]);if(Y(cy[i])-Y(cy[i-1])<tw(t))hid++;s+=vd(Y(cy[i-1]),Y(cy[i]),c2,t,ac)}
  // equal spacings too tight to label one by one: label once as "n × s"
  const rep=(c,P,horiz)=>{if(c.length<4)return'';const g=[];for(let i=2;i<c.length-1;i++)g.push(c[i]-c[i-1]);
    if(g.some(v=>Math.abs(v-g[0])>.002)||P(c[2])-P(c[1])>=tw(f(g[0])))return'';
    const t=`${g.length} × ${f(g[0])}`,m=(P(c[1])+P(c[c.length-2]))/2,hl='stroke="var(--panel)" stroke-width="4" paint-order="stroke"';
    return horiz?txt(m,r2-4,t,ac,0,hl):txt(c2-4,m,t,ac,1,hl)};
  s+=rep(cx,X,1)+rep(cy,Y,0);
  // polygon rooms: label every wall with its length, just outside the wall
  if(dimD.P){const P=dimD.P,hl=`stroke="${dimD.map?'#16161e':'var(--panel)'}" stroke-width="4" paint-order="stroke"`;
    P.forEach((a,i)=>{const b=P[(i+1)%P.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),[nx,ny]=inwardN(P,i),x1=X(a[0]),y1=Y(a[1]),x2=X(b[0]),y2=Y(b[1]),pl=Math.hypot(x2-x1,y2-y1),t=f(len);
      if(pl<tw(t+' m'))return;let ang=Math.atan2(y2-y1,x2-x1)*180/Math.PI;if(ang>90)ang-=180;if(ang<=-90)ang+=180;
      const mx=(x1+x2)/2+nx*11,my=(y1+y2)/2+ny*11;s+=`<text x="${mx}" y="${my}" dy="4" transform="rotate(${ang} ${mx} ${my})" text-anchor="middle" font-size="11" font-weight="700" fill="${dimD.map?'#e4d4ff':'var(--accent2)'}" ${hl}>${t} m</text>`})}
  // selected light: distance to left and top walls
  if(sel>=0&&pts[sel]){
    const[x,y]=pts[sel],px=X(x),py=Y(y),c='var(--beam)',halo=map?'stroke="#16161e" stroke-width="3" paint-order="stroke"':'stroke="var(--panel)" stroke-width="3" paint-order="stroke"',tc=map?'#fff':ink;
    if(x>.001)s+=`<line x1="${X(0)}" y1="${py}" x2="${px}" y2="${py}" stroke="${c}" stroke-width="1.5" stroke-dasharray="5 3"/>`+tick(X(0),py,c)+txt((X(0)+px)/2,py-5,f(x)+' m',tc,0,halo);
    if(y>.001)s+=`<line x1="${px}" y1="${Y(0)}" x2="${px}" y2="${py}" stroke="${c}" stroke-width="1.5" stroke-dasharray="5 3"/>`+tick(px,Y(0),c)+txt(px-5,(Y(0)+py)/2,f(y)+' m',tc,1,halo);
  }
  sv.setAttribute('viewBox',`0 0 ${wr.width} ${wr.height}`);
  sv.innerHTML=s;
}
const SCALES=['auto',100,200,500,1000,2000];let lxScale=500,oneScale='auto',mapView='total';  // lxScale: floor plan colour scale; oneScale: One downlight card (independent)
let genVals=null,form='grid';
const FORMS={grid:['Grid','Rows and columns, with half a spacing to the walls. The standard for even ambient light in regular rooms.'],
  stagger:['Staggered','Like brickwork: every other row sits midway between the lights above, with one fewer light. Fills the dark spots between rows; useful in long rooms or when joists dictate positions.'],
  hex:['Honeycomb','Hexagonal: every light is the same distance from its six neighbours. The most even coverage for round beams, usually with fewer lights than a square grid.'],
  perim:['Perimeter','Only the outer ring of the grid, set in from the walls. Washes and frames the walls; pair it with a cove or a few centre lights for the middle of the room.']};
let mode='even',customPts=null,sel=-1,prevL=0,prevW=0,lastPts=[],wallP=null,phot='gen',ies=null;
// ---- one fixture model: lookup table of intensity vs cos(gamma), plus beam / field half-angles ----
// q (optional): {phot, ies, ang, lm} for a stored group; otherwise the inputs on screen
function model(q){
  return buildModel(q?{phot:q.phot,ies:q.ies,angle:+q.ang,lumens:+q.lm}:{phot,ies,angle:+$('ang').value,lumens:+$('lm').value});
}
// ---- lighting groups: each has its own fixture and layout; every group that is on adds to the result ----
const GCOL=['#7aa2f7','#9ece6a','#ff9e64','#bb9af7','#7dcfff','#f7768e','#e0af68'];
const GV=['ang','lm','pw','fr','nx','ny','dx','dy','ax','ay','aw','ah','brand','fixname'];
const fixLabel=v=>[v&&v.brand,v&&v.fixname].map(s=>(s||'').trim()).filter(Boolean).join(' ');  // "Brand Fixture name", or '' when both are empty
let statScope='all',groups=[],act=0,areaOn=false,gStats=[];
const cloneP=a=>a?a.map(p=>[p[0],p[1]]):null;
function renderGroups(){
  const g0=groups[act]||{name:''};
  const html=`<div class="glist">${groups.map((g,k)=>`<div class="grow${k===act?' on':''}" style="--gc:${g.col}"><button type="button" class="gsel" data-gsel="${k}" aria-pressed="${k===act}"${fixLabel(g.vals)?` title="${esc(fixLabel(g.vals))}"`:''}><i></i><span>${esc(g.name)}</span><small>${gStats[k]??'–'} lights</small></button><button type="button" class="chip gtog" data-gtog="${k}" aria-pressed="${g.on}" aria-label="Include ${esc(g.name)} in the calculation">${g.on?'On':'Off'}</button></div>`).join('')}</div>
    <label>Selected group name</label><input type="text" class="gname" maxlength="30" value="${esc(g0.name)}" aria-label="Selected group name">
    <div class="actions"><button class="chip" type="button" data-gact="add">+ Add group</button><button class="chip" type="button" data-gact="dup">Duplicate</button>${groups.length>1?'<button class="chip" type="button" data-gact="del">Remove</button>':''}</div>`;
  const ae=document.activeElement,typing=ae&&ae.classList&&ae.classList.contains('gname');
  document.querySelectorAll('.grpHost').forEach(e=>{if(!(typing&&e.contains(ae)))e.innerHTML=html})}
function snapGroup(){return{vals:Object.fromEntries(GV.map(i=>[i,$(i).value])),mode,customPts:cloneP(customPts),form,phot,ies,genVals:genVals?{...genVals}:null,areaOn}}
function saveActive(){if(!groups.length)groups=[{name:'Group 1',col:GCOL[0],on:true}];Object.assign(groups[act],snapGroup())}
function loadGroup(i){act=Math.max(0,Math.min(groups.length-1,i));const g=groups[act];
  GV.forEach(k=>{if(g.vals&&g.vals[k]!==undefined)$(k).value=g.vals[k]});
  mode=g.mode||'even';customPts=cloneP(g.customPts);form=g.form||'grid';phot=g.phot||'gen';ies=g.ies||null;genVals=g.genVals?{...g.genVals}:null;areaOn=!!g.areaOn;sel=-1}
// lights of a formation, either over the whole room (clipped to its shape) or inside the group's own area
const placeIn=(fm,nx,ny,L,W,fixed,dx,dy,P,ar)=>placeInE(fm,nx,ny,L,W,fixed,dx,dy,poly?P:null,ar);
// a stored (not selected) group: its model and light positions
function groupLights(g,L,W,P,h){
  const v=g.vals||{},md=model({phot:g.phot,ies:g.ies,ang:v.ang,lm:v.lm});if(!md)return null;
  let pts,labs;
  if(g.mode==='custom'&&g.customPts&&g.customPts.length){pts=g.customPts;labs=pts.map((_,k)=>'F'+(k+1))}
  else{const ly=placeIn(g.form||'grid',Math.round(+v.nx),Math.round(+v.ny),L,W,g.mode==='fixed',+v.dx,+v.dy,P,areaOf(g.areaOn,v));pts=ly.pts;labs=ly.labs}
  const iz=g.phot==='ies'&&g.ies;
  return{md,pts,labs,rB:h*Math.tan(md.th),rF:h*Math.tan(Math.min(md.gF,rad(85))),fr:Math.max(.005,(+v.fr||50)/1000),lm:md.lm,pw:iz?g.ies.watts:(+v.pw||0)};
}
// ---- room polygon geometry (metres, x along length, y along width) ----
let poly=null,shapeEdit=false,selV=-1,polySig='';
const roomP=(L,W)=>poly||rectPoly(L,W);
const SHAPES={rect:'Rectangle',L:'L-shape',T:'T-shape',U:'U-shape'};
// shift the polygon so its bounding box starts at 0,0 and make Length / Width match it
function normPoly(){if(!poly)return;const pk=poly._k,n=normalizePoly(poly);poly=n.P;poly._k=pk;
  if(customPts)customPts=customPts.map(([x,y])=>[x-n.x0,y-n.y0]);
  $('L').value=f(n.L,3);$('W').value=f(n.W,3);prevL=+$('L').value;prevW=+$('W').value}
// layout of a formation, clipped to the room shape (perimeter follows the walls)
const placeLights=(fm,nx,ny,L,W,fixed,dx,dy,P)=>placeLightsE(fm,nx,ny,L,W,fixed,dx,dy,poly?P:null);
const wzone=(L,W)=>wallZoneWidth(+$('wz').value,L,W);
const toCustom=()=>{if(mode!=='custom'){customPts=lastPts.map(p=>[p[0],p[1]]);mode='custom'}};
const STOPS=[[0,[22,22,30]],[.35,[61,89,161]],[.7,[224,175,104]],[1,[255,244,220]]];
function ramp(t){t=Math.max(0,Math.min(1,t));for(let i=1;i<STOPS.length;i++){if(t<=STOPS[i][0]){const[a,ca]=STOPS[i-1],[b,cb]=STOPS[i],k=(t-a)/(b-a);return ca.map((v,j)=>Math.round(v+(cb[j]-v)*k))}}return STOPS[3][1]}

function chips(){
  const nx=+$('nx').value, ny=+$('ny').value, a=+$('ang').value;
  $('gridChips').innerHTML=GRIDS.map(([c,r])=>`<button class="chip" type="button" data-g="${c}x${r}" aria-pressed="${nx===c&&ny===r}">${c} × ${r}</button>`).join('');
  $('angChips').innerHTML=ANG.map(v=>`<button class="chip" type="button" data-a="${v}" aria-pressed="${a===v}">${v}°</button>`).join('');
  document.querySelectorAll('[data-l]').forEach(b=>b.setAttribute('aria-pressed',layers[b.dataset.l]));
  $('photChips').innerHTML=[['gen','Generic beam'],['ies',ies?'IES: '+esc(ies.name.slice(0,24)):'Load IES / LDT file']].map(([k,t])=>`<button class="chip" type="button" data-p="${k}" aria-pressed="${phot===k}">${t}</button>`).join('')+`<button class="chip" type="button" data-p="lib" aria-pressed="${!!lib&&lib.isOpen()}">Library</button>`+(ies?`<button class="chip" type="button" data-p="load">Load another…</button>`:'');
  const iz=!!(phot==='ies'&&ies),FX=['ang','lm','pw'];
  if(iz){if(!genVals)genVals=Object.fromEntries(FX.map(i=>[i,$(i).value]));$('lm').value=f(ies.flux,0);$('pw').value=ies.watts>0?f(ies.watts,1):''}
  else if(genVals){FX.forEach(i=>$(i).value=genVals[i]);genVals=null}
  FX.forEach(i=>{$(i).disabled=iz;const lb=document.querySelector(`label[for="${i}"]`);lb.dataset.t=lb.dataset.t||lb.textContent;lb.textContent=(iz?lb.dataset.t.replace(' (optional)',''):lb.dataset.t)+(iz?(i==='pw'&&!(ies.watts>0)?' (not in IES file)':' (from IES file)'):'')});
  $('pw').placeholder=iz?'not in file':'';$('angChips').style.display=iz?'none':'';
  if(!groups.length)saveActive();renderGroups();
  $('areaChips').innerHTML=[['room','Whole room'],['area','Part of the room']].map(([k,t])=>`<button class="chip" type="button" data-area="${k}" aria-pressed="${(k==='area')===areaOn}">${t}</button>`).join('');
  $('areaBox').hidden=!areaOn;
  const sk=poly?(poly._k||'custom'):'rect';
  $('shapeChips').innerHTML=Object.entries(SHAPES).map(([k,t])=>`<button class="chip" type="button" data-shape="${k}" aria-pressed="${sk===k}">${t}</button>`).join('')+`<button class="chip" type="button" data-shape="edit" aria-pressed="${shapeEdit}">${shapeEdit?'Editing on plan…':'Draw / edit on plan'}</button>`;
  $('shapeEditBtn').setAttribute('aria-pressed',String(shapeEdit));
  $('polyBox').hidden=!poly;
  $('formChips').innerHTML=Object.entries(FORMS).map(([k,[t]])=>`<button class="chip" type="button" data-f="${k}" aria-pressed="${form===k&&mode!=='custom'}">${t}</button>`).join('');
  $('nxLab').textContent=form==='perim'?'Lights · length':'Columns · length';$('nyLab').textContent=form==='perim'?'Lights · width':'Rows · width';
  $('dy').disabled=form==='hex'&&mode!=='custom';
  $('scaleChips').innerHTML='<span class="note" style="margin:0;align-self:center">Colour scale</span>'+SCALES.map(v=>`<button class="chip" type="button" data-s="${v}" aria-pressed="${String(lxScale)===String(v)}">${v==='auto'?'Auto':v+' lx'}</button>`).join('');
  $('modeChips').innerHTML=[['even','Even in room'],['fixed','Set distance'],['custom','Custom (drag)']].map(([k,t])=>`<button class="chip" type="button" data-m="${k}" aria-pressed="${mode===k}">${t}</button>`).join('');
}
document.addEventListener('click',e=>{
  const b=e.target.closest('.chip'); if(!b) return;
  if(b.dataset.g){const[c,r]=b.dataset.g.split('x');$('nx').value=c;$('ny').value=r;if(mode==='custom')mode='even'}
  if(b.dataset.a)$('ang').value=b.dataset.a;
  if(b.dataset.ss)statScope=b.dataset.ss;
  if(b.dataset.l)layers[b.dataset.l]=!layers[b.dataset.l];
  if(b.dataset.m){if(b.dataset.m==='custom')toCustom();else mode=b.dataset.m}
  if(b.dataset.f){form=b.dataset.f;if(mode==='custom')mode='even'}
  if(b.dataset.area){areaOn=b.dataset.area==='area';if(mode==='custom')mode='even'}
  if(b.dataset.gtog!==undefined){const k=+b.dataset.gtog;groups[k].on=!groups[k].on}
  if(b.dataset.gact){saveActive();const ga=b.dataset.gact,n=groups.length,cp=g=>JSON.parse(JSON.stringify(g));
    if(ga==='add'){const g=cp(groups[act]);Object.assign(g,{name:'Group '+(n+1),col:GCOL[n%GCOL.length],on:true,mode:'even',customPts:null,form:'grid',areaOn:false});g.vals.nx='2';g.vals.ny='2';groups.push(g);loadGroup(n)}
    if(ga==='dup'){const g=cp(groups[act]);Object.assign(g,{name:groups[act].name+' copy',col:GCOL[n%GCOL.length],on:true});groups.push(g);loadGroup(n)}
    if(ga==='del'&&n>1){groups.splice(act,1);loadGroup(Math.min(act,groups.length-1))}}
  if(b.dataset.v)mapView=b.dataset.v;
  if(b.dataset.os)oneScale=b.dataset.os==='auto'?'auto':+b.dataset.os;
  if(b.dataset.s)lxScale=b.dataset.s==='auto'?'auto':+b.dataset.s;
  if(b.dataset.p==='lib'){lib.toggle();return}
  if(b.dataset.p){const k=b.dataset.p;if(k==='gen')phot='gen';else if(k==='load'||!ies){$('iesFile').click();return}else phot='ies'}
  calc();
});
const dirty=on=>{$('updBtn').classList.toggle('dirty',on);document.querySelector('.upd').classList.toggle('show',on);$('updMsg').textContent=on?'Inputs changed. Tap Update to apply.':''};
window.addEventListener('themechange',()=>calc());  // the 3D view reads its colours at draw time
lib=mountLibraryPicker($('libPanel'),(ph,e)=>{ies=ph;phot='ies';$('brand').value=ph.brand||e.brand;$('fixname').value=ph.name;lib.close();calc()},undefined,()=>chips());
$('iesFile').addEventListener('change',e=>{
  const fl=e.target.files&&e.target.files[0];if(!fl)return;
  fl.text().then(t=>{try{ies=parsePhotometry(t,fl.name);phot='ies';calc()}catch(err){$('iesInfo').innerHTML=`<span class="err">${esc(err.message)}</span>`}});
  e.target.value='';
});
['ax','ay','aw','ah','L','W','H','wp','wz','nx','ny','ang','lm','pw','fr'].forEach(i=>$(i).addEventListener('input',()=>{if((i==='nx'||i==='ny')&&mode==='custom')mode='even';dirty(true)}));
['brand','fixname'].forEach(i=>$(i).addEventListener('input',()=>calc()));  // labels only: update everything straight away
['dx','dy'].forEach(i=>$(i).addEventListener('input',()=>{mode='fixed';dirty(true)}));

function calc(){
  chips();dirty(false);
  const L=+$('L').value,W=+$('W').value,H=+$('H').value,wp=+$('wp').value;
  const nx=Math.round(+$('nx').value),ny=Math.round(+$('ny').value);
  const IZ=phot==='ies'&&ies,lm=IZ?ies.flux:+$('lm').value,h=H-wp,md=model();
  if(!md||!(L>0&&W>0&&H>0&&lm>0&&nx>=1&&ny>=1&&nx<=20&&ny<=20)||h<=0||(mode==='fixed'&&!(+$('dx').value>0&&+$('dy').value>0))){
    $('kpi').textContent='Check inputs';$('out').innerHTML='<p class="err">Check your inputs: room sizes and lumens must be above zero, the beam angle between 5° and 120°, the grid between 1 and 20, and the calculation height below the ceiling.</p>';
    return;
  }
  const{Iof,th,gF,llf}=md,a=md.ang;
  if(phot==='ies'&&ies){$('ang').value=f(a,0);$('iesInfo').textContent=''}
  else $('iesInfo').textContent='';
  const fr=Math.max(.005,(+$('fr').value||50)/1000);
  const pw=IZ?ies.watts:(+$('pw').value||0);
  const rBeam=h*Math.tan(th);
  const rField=h*Math.tan(Math.min(gF,rad(85)));
  let sx,sy,offx,offy,pts=[],labs=[];
  if(poly&&prevL&&(L!==prevL||W!==prevW)){const k=poly._k;poly=poly.map(([x,y])=>[x*L/prevL,y*W/prevW]);poly._k=k}
  const RP=roomP(L,W),RA=Math.abs(polyArea(RP)),RPer=polyPerim(RP),NC=!isConvex(RP);
  // only a warning is shown here; the explanatory text was removed
  $('shapeNote').innerHTML=poly&&!isSimple(RP)?'<span class="err">Walls cross each other. Drag the corners to fix it.</span>':'';
  $('shapeNote').hidden=!$('shapeNote').innerHTML;
  if(poly){const tx=RP.map(q=>f(q[0],3)+', '+f(q[1],3)).join('\n');if(tx!==polySig&&document.activeElement!==$('polyTxt')){$('polyTxt').value=tx;polySig=tx}}
  ['L','W'].forEach(i=>{const lb=document.querySelector(`label[for="${i}"]`);lb.textContent=(i==='L'?'Length':'Width')+(poly?' (overall)':'')});
  if(mode==='custom'&&!(customPts&&customPts.length))mode='even';
  const cu=mode==='custom';
  if(cu){
    if(prevL&&(L!==prevL||W!==prevW))customPts=customPts.map(([x,y])=>[x*L/prevL,y*W/prevW]);
    customPts=customPts.map(([x,y])=>[Math.min(L,Math.max(0,x)),Math.min(W,Math.max(0,y))]);
    pts=customPts;sx=sy=offx=offy=0;
  }else{
    const fx=mode==='fixed',ly=placeIn(form,nx,ny,L,W,fx,+$('dx').value,+$('dy').value,RP,areaOf(areaOn,{ax:$('ax').value,ay:$('ay').value,aw:$('aw').value,ah:$('ah').value}));
    ({pts,sx,sy,offx,offy}=ly);labs=ly.labs;
    if(!fx)$('dx').value=f(sx);if(!fx||form==='hex')$('dy').value=f(sy);
  }
  if(prevL&&(L!==prevL||W!==prevW))groups.forEach((g,k)=>{if(k!==act&&g.customPts)g.customPts=g.customPts.map(([x,y])=>[x*L/prevL,y*W/prevW])});
  prevL=L;prevW=W;lastPts=pts.map(p=>[p[0],p[1]]);
  const N=pts.length;if(sel>=N)sel=-1;
  const lab=k=>cu?'F'+(k+1):labs[k];
  // every group: the selected one from the inputs, the others from what they stored
  if(!groups.length)saveActive();
  const multi=groups.length>1,gtag=k=>multi?(k+1)+'·':'';
  const GL=groups.map((g,k)=>k===act?{md,pts,labs:pts.map((_,i)=>lab(i)),rB:rBeam,rF:rField,fr,lm,pw}:groupLights(g,L,W,RP,h));
  const ALL=[];GL.forEach((q,k)=>{if(q&&groups[k].on)q.pts.forEach((p,i)=>ALL.push([p[0],p[1],q.md.Iof,k,i]))});
  gStats=GL.map(q=>q?q.pts.length:0);
  const NT=ALL.length,nOn=groups.filter((g,k)=>g.on&&GL[k]&&GL[k].pts.length).length;
  let LMT=0,PWT=0;GL.forEach((q,k)=>{if(!q||!groups[k].on)return;const n=q.pts.length;LMT+=n*q.lm;PWT+=n*q.pw});
  let nnMax=0,minD=Infinity;
  pts.forEach((p,i)=>{let m=Infinity;pts.forEach((q,j)=>{if(i!==j){const d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<m)m=d;if(d<minD)minD=d}});if(m<Infinity&&m>nnMax)nnMax=m});
  const h2=h*h,Ed=directIlluminance(ALL,h,poly?RP:null),E=Ed,WZ=wzone(L,W);
  const{cw,ch,vals,INS,cnt,min:mn,max:mxi,peak:mx,avg,uniformity:uni}=sampleWorkPlane(L,W,poly?RP:null,WZ,Ed);
  const Ec=Iof(1)/h2;
  // statistics scope: all groups that are on, or just the selected group (even if it is switched off)
  const si=statScope!=='all'&&groups[+statScope]&&GL[+statScope]?+statScope:-1,sc=multi&&si>=0,SG=sc?GL[si]:GL[act],SL=sc?SG.pts.map(([x,y],i)=>[x,y,SG.md.Iof,si,i]):ALL,Es=sc?directIlluminance(SL,h,poly?RP:null):Ed;
  const SS=sc?sampleWorkPlane(L,W,poly?RP:null,WZ,Es):{cw,ch,vals,INS,cnt,min:mn,max:mxi,peak:mx,avg,uniformity:uni};
  const{vals:svals,INS:sINS,cnt:scnt,min:smn,max:smxi,peak:smx,avg:savg,uniformity:suni}=SS;
  const NTs=SL.length,nOns=sc?1:nOn;let LMTs=0,PWTs=0;GL.forEach((q,k)=>{if(!q||(sc?k!==si:!groups[k].on))return;LMTs+=q.pts.length*q.lm;PWTs+=q.pts.length*q.pw});
  $('statScope').innerHTML=multi?`<span class="text-mute">Statistics for</span><button class="chip" type="button" data-ss="all" aria-pressed="${!sc}">All groups</button>${groups.map((g,k)=>`<button class="chip" type="button" data-ss="${k}" aria-pressed="${k===si}"><span style="color:${g.col}">●</span> ${esc(g.name)}</button>`).join('')}`:'';

  $('kpi').innerHTML=`<b>${f(avg,0)} lx</b> avg · U ${f(uni,2)} · ${NT} lights${multi?` · ${nOn}/${groups.length} groups`:''}`;
  const gLab=k=>fixLabel(k===act?{brand:$('brand').value,fixname:$('fixname').value}:groups[k].vals),nmK=(sc?[si]:groups.map((g,k)=>k).filter(k=>groups[k].on)).filter(k=>gLab(k));
  $('out').innerHTML=`<div class="results">
    <div class="res hero"><b>Ø ${f(2*SG.rB)} m</b><span>spread of each ${multi?`<b style="color:${groups[sc?si:act].col}">${esc(groups[sc?si:act].name)}</b> `:''}downlight on the floor at 50% intensity (field Ø ${f(2*SG.rF)} m at 10%)</span></div>
    ${nmK.length?`<div class="res"><b style="font-size:1rem;line-height:1.4">${nmK.map(k=>(multi&&!sc?`<span style="color:${groups[k].col}">●</span> `:'')+esc(gLab(k))).join('<br>')}</b><span>${nmK.length>1?'fixtures':'fixture'}</span></div>`:''}
    <div class="res"><b>${f(SG.md.Iof(1)/h2,0)} lx</b><span>under one fixture alone</span></div>
    <div class="res"><b>${f(savg,0)} lx</b><span>average, all ${NTs} fixtures${multi?` in ${nOns} group${nOns===1?'':'s'}`:''}</span></div>
    <div class="res"><b>${f(smn,0)}–${f(smxi,0)} lx</b><span>lowest to highest${WZ>0?`, ${f(WZ)} m wall zone left out`:''}</span></div>
    <div class="res"><b>${f(suni,2)}</b><span>uniformity (min ÷ avg)</span></div>
    ${cu?`<div class="res"><b>${isFinite(minD)?f(minD):'-'} m</b><span>closest two fixtures</span></div>`:(form==='hex'?`<div class="res"><b>${f(sx)} m</b><span>honeycomb spacing to all six neighbours, rows ${f(sy)} m apart</span></div>`:`<div class="res"><b>${f(sx)} × ${f(sy)} m</b><span>spacing${form==='stagger'?', alternate rows offset':''}${poly?', lights outside the room shape left out':`, ${f(offx)} × ${f(offy)} m to walls`}</span></div>`)}
    <div class="res"><b>${f(LMTs,0)} lm</b><span>${multi?`${NTs} fixtures in ${nOns} group${nOns===1?'':'s'}`:`${N} fixtures × ${f(lm,0)} lm`}</span></div>
    ${PWTs>0?`<div class="res"><b>${f(PWTs,0)} W</b><span>total power, ${f(PWTs/RA,1)} W/m² · ${f(LMTs/PWTs,0)} lm/W</span></div>`:''}
  </div>`;
  const gap=cu||form!=='grid'?nnMax>2*rBeam:Math.max(sx,sy)>2*rBeam;
  $('verdict').style.color=uni<.5?'var(--bad)':uni>=.7?'var(--ok)':'var(--ink)';
  $('verdict').textContent=((!poly&&(offx<0||offy<0))?'This grid is larger than the room, so some fixtures fall outside it. ':'')+(gap?'Beams do not touch at the 50% edge, so expect visible pools of light. ':'Beams overlap at the 50% edge. ')+(uni>=.7?'Floor lighting is fairly even.':uni>=.5?'Floor lighting is moderately uneven.':'Floor lighting is patchy; add fixtures or widen the beam.');
  // canvas
  const cv=$('cv');cv.width=cw;cv.height=ch;const g=cv.getContext('2d'),im=g.createImageData(cw,ch);
  const bgHex=getComputedStyle(document.documentElement).getPropertyValue('--panel').trim().replace('#',''),bg=bgHex.length===6?[0,2,4].map(i=>parseInt(bgHex.slice(i,i+2),16)):[248,250,250];
  mapView='total';
  const top=lxScale==='auto'?mx:+lxScale;
  for(let i=0;i<vals.length;i++){const c=layers.map&&INS[i]?ramp(vals[i]/top):bg;im.data[i*4]=c[0];im.data[i*4+1]=c[1];im.data[i*4+2]=c[2];im.data[i*4+3]=255}
  g.putImageData(im,0,0);invalidateRoom3D();
  $('lgMax').textContent=f(top,0)+' lx'+(lxScale!=='auto'&&mx>top*1.005?'+':'');$('lgMin').textContent='0 lx';
  const mk=(id,v)=>{const e=$(id);e.style.left=Math.min(100,v/top*100)+'%';e.title=f(v,0)+' lx'};
  mk('mkMin',mn);mk('mkAvg',avg);mk('mkMax',mxi);
  document.querySelector('.legend').style.visibility=layers.map?'visible':'hidden';
  // overlay (room metres)
  const ov=$('ov');ov.setAttribute('viewBox',`0 0 ${L} ${W}`);
  const ink=layers.map?'#fff':'var(--ink)',sw='vector-effect="non-scaling-stroke"';
  let s='';
  GL.forEach((q,k)=>{if(!q||!groups[k].on)return;const isA=k===act,cc=multi?groups[k].col:ink;
    q.pts.forEach(([x,y],i)=>{const on=isA&&i===sel;
      if(layers.field)s+=`<circle cx="${x}" cy="${y}" r="${q.rF}" fill="none" stroke="${cc}" stroke-opacity="${on?.6:isA?.2:.14}" stroke-dasharray="4 4" stroke-width="1" ${sw}/>`;
      if(layers.beam)s+=`<circle cx="${x}" cy="${y}" r="${q.rB}" fill="none" stroke="${cc}" stroke-opacity="${on?.9:isA?.32:.22}" stroke-width="${on?1.5:1}" ${sw}/>`;
    })});
  ov.style.width='100%';ov.style.touchAction=layers.move?'none':'auto';
  $('stage').style.aspectRatio=`${L}/${W}`;
  // dots as fixed-size via separate non-scaling approach: use tiny ellipses sized in metres
  const dr=Math.max(fr,Math.min(L,W)*.008);
  let hits='';
  GL.forEach((q,k)=>{if(!q)return;const on=groups[k].on,isA=k===act,d=Math.max(q.fr,Math.min(L,W)*.008),fc=multi?groups[k].col:(layers.map?'#fff':'var(--ink)');
    q.pts.forEach(([x,y],i)=>{
      s+=on?`<circle cx="${x}" cy="${y}" r="${d}" fill="${fc}"${multi?` stroke="#16161e" stroke-width="1.5" ${sw}`:''}/>`:`<circle cx="${x}" cy="${y}" r="${d}" fill="none" stroke="${fc}" stroke-opacity=".6" stroke-dasharray="2 2" stroke-width="1.5" ${sw}/>`;
      if(isA&&i===sel)s+=`<circle cx="${x}" cy="${y}" r="${d*3.2}" fill="none" stroke="var(--beam)" stroke-width="2.5" ${sw}/>`;
      if(isA&&layers.move&&!shapeEdit)hits+=`<circle data-i="${i}" cx="${x}" cy="${y}" r="${Math.max(d*4,Math.min(L,W)*.035)}" fill="transparent" style="cursor:grab"/>`;
    })});
  let gh='';
  if(layers.move&&!shapeEdit&&pts.length>1){const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),hr=Math.max(L,W)*.016,gc=multi?groups[act].col:'var(--beam)';
    gh=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="none" pointer-events="none" stroke="${gc}" stroke-opacity=".7" stroke-dasharray="3 3" stroke-width="1" ${sw}/><g data-gs="1" style="cursor:nwse-resize"><circle cx="${x1}" cy="${y1}" r="${hr*2}" fill="transparent"/><rect x="${x1-hr}" y="${y1-hr}" width="${hr*2}" height="${hr*2}" fill="${gc}" stroke="#16161e" stroke-width="1.5" ${sw}><title>Drag to scale the group (closer / further apart)</title></rect></g>`}
  const AR=!cu&&areaOf(areaOn,{ax:$('ax').value,ay:$('ay').value,aw:$('aw').value,ah:$('ah').value});
  if(AR)s+=`<rect x="${AR.x}" y="${AR.y}" width="${AR.w}" height="${AR.h}" fill="${multi?groups[act].col:'var(--accent)'}" fill-opacity=".06" stroke="${multi?groups[act].col:'var(--accent)'}" stroke-width="1.5" stroke-dasharray="6 4" ${sw}/>`;
  const pd=Q=>'M'+Q.map(q=>q[0]+','+q[1]).join('L')+'Z',wzc=layers.map?'#fff':'var(--mute)';
  let wzs='';if(WZ>0){const Z=poly?insetPoly(RP,WZ):[[WZ,WZ],[L-WZ,WZ],[L-WZ,W-WZ],[WZ,W-WZ]];wzs=`<path d="${pd(Z)}" fill="none" stroke="${wzc}" stroke-opacity=".7" stroke-dasharray="2 4" stroke-width="1" ${sw}/>`}
  const mask=poly?`<path d="M0,0H${L}V${W}H0Z ${pd(RP)}" fill="var(--paper)" fill-rule="evenodd"/><path d="${pd(RP)}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" ${sw}/>`:'';
  let hv='';
  if(shapeEdit&&poly){const vr=Math.max(L,W)*.02,hr=Math.max(L,W)*.045;
    RP.forEach((a,k)=>{const b=RP[(k+1)%RP.length],mx2=(a[0]+b[0])/2,my2=(a[1]+b[1])/2;
      hv+=`<g data-pe="${k}" style="cursor:copy"><circle cx="${mx2}" cy="${my2}" r="${hr}" fill="transparent"/><circle cx="${mx2}" cy="${my2}" r="${vr*.8}" fill="var(--panel)" stroke="var(--accent)" stroke-width="1.5" ${sw}/><path d="M${mx2-vr*.45},${my2}H${mx2+vr*.45}M${mx2},${my2-vr*.45}V${my2+vr*.45}" stroke="var(--accent)" stroke-width="1.5" ${sw}/></g>`});
    RP.forEach(([x,y],k)=>{hv+=`<g data-pv="${k}" style="cursor:grab"><circle cx="${x}" cy="${y}" r="${hr}" fill="transparent"/><circle cx="${x}" cy="${y}" r="${k===selV?vr*1.4:vr}" fill="${k===selV?'var(--beam)':'var(--accent2)'}" stroke="var(--paper)" stroke-width="2" ${sw}/></g>`})}
  $('stage').style.borderColor=poly?'var(--rule)':'';$('stage').style.borderStyle=poly?'dashed':'';
  ov.style.touchAction=layers.move||shapeEdit?'none':'auto';
  ov.innerHTML=`<defs><clipPath id="roomclip"><path d="${pd(RP)}"/></clipPath></defs>${mask}<g clip-path="url(#roomclip)">${s}</g>${wzs}${hits}${gh}${hv}`;
  dimD={L,W,pts,sel:shapeEdit?-1:sel,map:layers.map,P:poly?RP:null};drawDims();
  {const cs=getComputedStyle(document.documentElement),v=n=>cs.getPropertyValue(n).trim();
   isoD={L,W,H,poly:poly?RP:null,ink:v('--ink')||'#c0caf5',mute:v('--mute')||'#787c99',beam:v('--beam')||'#e0af68',
     lights:GL.flatMap((q,k)=>q?q.pts.map(([x,y],i)=>({x,y,rB:q.rB,col:multi?groups[k].col:v('--beam')||'#e0af68',on:!!groups[k].on,selected:k===act&&i===sel})):[])};
   $('stage').style.display=layers.iso?'none':'';$('dim').style.display=layers.iso?'none':'';$('iso').hidden=!layers.iso;$('planwrap').classList.toggle('nodim',layers.iso);$('isoNav').hidden=!layers.iso;
   drawIso3d()}
  const sp=sel>=0&&sel<N?pts[sel]:null;
  if(shapeEdit&&poly){const v=selV>=0&&selV<RP.length?RP[selV]:null;
    $('selbar').innerHTML=(v?`<b>C${selV+1}</b> x <input id="pvx" type="number" inputmode="decimal" step="0.05" value="${f(v[0])}" aria-label="Corner x in metres"> y <input id="pvy" type="number" inputmode="decimal" step="0.05" value="${f(v[1])}" aria-label="Corner y in metres"> m ${RP.length>3?'<button class="chip" id="pvRm" type="button">Remove corner</button>':''}`:'<span class="note" style="margin:0">Drag a corner, or tap + on a wall to add one.</span>')+`<button class="chip" id="shapeDone" type="button" aria-pressed="true">Done editing</button>`}
  else $('selbar').innerHTML=(sp?`<b>${lab(sel)}</b> x <input id="selx" type="number" inputmode="decimal" step="0.05" value="${f(sp[0])}" aria-label="Light x position in metres"> y <input id="sely" type="number" inputmode="decimal" step="0.05" value="${f(sp[1])}" aria-label="Light y position in metres"> m <button class="chip tool" id="rmBtn" type="button" aria-label="Remove light" title="Remove light"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg></button>`:'')+`<button class="chip tool" id="addBtn" type="button" aria-label="Add light" title="Add light"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg></button>`+(N>1?`<span class="text-mute">Group spacing</span><button class="chip tool" id="gScDn" type="button" aria-label="Group spacing &minus;10%" title="Bring the lights of this group 10% closer together"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h4M14 8h-4M4.5 6 6 8l-1.5 2M11.5 6 10 8l1.5 2"/></svg></button><button class="chip tool" id="gScUp" type="button" aria-label="Group spacing +10%" title="Spread the lights of this group 10% further apart"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 8H2M10 8h4M3.5 6 2 8l1.5 2M12.5 6 14 8l-1.5 2"/></svg></button>`:'');
  $('planCap').textContent=(poly?`${f(RA,1)} m² ${poly.length}-corner room, `:`${f(L)} × ${f(W)} m, `)+(cu?`${N} lights, custom layout`:` ${nx} × ${ny} ${FORMS[form][0].toLowerCase()}, ${N} lights`);
  // table
  const hasNm=GL.some((q,k)=>q&&!(sc&&k!==si)&&gLab(k));
  let rows='';GL.forEach((q,k)=>{if(!q||(sc&&k!==si))return;q.pts.forEach(([x,y],i)=>{rows+=`<tr${groups[k].on?'':' style="opacity:.45"'}>${multi?`<td><span style="color:${groups[k].col}">●</span> ${esc(groups[k].name)}</td>`:''}${hasNm?`<td>${esc(gLab(k))}</td>`:''}<td>${gtag(k)}${q.labs[i]}</td><td>${f(x)}, ${f(y)}</td><td>${f(2*q.rB)}</td><td>${f(q.lm,0)}</td><td>${(sc||groups[k].on)?f(Es(x,y),0):'off'}</td></tr>`})});
  $('tbl').innerHTML=`<table><thead><tr>${multi?'<th>Group</th>':''}${hasNm?'<th>Light</th>':''}<th>Fixture</th><th>Position x, y (m)</th><th>Spread Ø (m)</th><th>lm</th><th>Lux below it</th></tr></thead><tbody>${rows}</tbody></table>`;
  // ---- statistics page ----
  {const F=v=>isFinite(v)?f(v,0):'–',U=(a,b)=>b>0&&isFinite(a)?f(a/b,2):'–';
   const row=(n,av,mn2,mx2,ar)=>`<tr><td>${n}</td><td class="num">${ar?f(ar,1):'–'}</td><td class="num">${F(av)}</td><td class="num">${F(mn2)}</td><td class="num">${F(mx2)}</td><td class="num">${U(mn2,av)}</td><td class="num">${U(mn2,mx2)}</td></tr>`;
   const zA=scnt/((sINS.reduce((s,v)=>s+(v?1:0),0))||1)*RA;
   $('surfTbl').innerHTML=`<table><thead><tr><th>Surface</th><th class="num">m²</th><th class="num">Ē lx</th><th class="num">Emin</th><th class="num">Emax</th><th class="num">U₀</th><th class="num">Ud</th></tr></thead><tbody>
     ${row(`<b>Work plane, ${f(wp)} m</b>`,savg,smn,smxi,zA)}</tbody></table>`;
   $('surfCap').textContent=`${f(RA,1)} m² room, ${f(WZ)} m wall zone`;
   // histogram of the work plane (inside the wall zone), with the Suggest target marked
   const T=+$('tg').value||0,NB=12,loV=Math.floor(Math.max(0,Math.min(smn,T||smn)*.85)/10)*10,hiV=Math.max(smxi,T)*1.02,span=hiV-loV||1,B=new Array(NB).fill(0);let reach=0;
   for(let i=0;i<svals.length;i++){if(sINS[i]!==2)continue;B[Math.max(0,Math.min(NB-1,Math.floor((svals[i]-loV)/span*NB)))]++;if(svals[i]>=T)reach++}
   const Wd=320,Hd=150,ml=34,mb=26,mt=10,bw=(Wd-ml-6)/NB,bm=Math.max(...B)||1,X=v=>ml+(v-loV)/span*(Wd-ml-6),Yh=c=>mt+(Hd-mt-mb)*(1-c/bm);
   let svg=B.map((c,k)=>{const col=ramp((loV+(k+.5)/NB*span)/(lxScale==='auto'?smx:+lxScale));return`<rect x="${ml+k*bw+1}" y="${Yh(c)}" width="${bw-2}" height="${Hd-mb-Yh(c)}" rx="2" fill="rgb(${col})"><title>${f(loV+k/NB*span,0)}–${f(loV+(k+1)/NB*span,0)} lx: ${f(c/scnt*100,0)}%</title></rect>`}).join('');
   svg+=`<line x1="${ml}" y1="${Hd-mb}" x2="${Wd-6}" y2="${Hd-mb}" stroke="var(--rule)"/>`;
   [0,.5,1].forEach(t=>svg+=`<text x="${ml+t*(Wd-ml-6)}" y="${Hd-mb+14}" font-size="10" text-anchor="${t?t<1?'middle':'end':'start'}" fill="var(--mute)">${f(loV+t*span,0)}</text>`);
   svg+=`<text x="${ml-4}" y="${mt+8}" font-size="10" text-anchor="end" fill="var(--mute)">${f(bm/scnt*100,0)}%</text><text x="${(Wd+ml)/2}" y="${Hd-2}" font-size="10" text-anchor="middle" fill="var(--mute)">lux on the work plane</text>`;
   if(T>0)svg+=`<line x1="${X(T)}" y1="${mt-4}" x2="${X(T)}" y2="${Hd-mb}" stroke="var(--bad)" stroke-dasharray="4 3" stroke-width="1.5"/><text x="${X(T)+(X(T)>Wd*.7?-4:4)}" y="${mt+6}" font-size="10" font-weight="700" text-anchor="${X(T)>Wd*.7?'end':'start'}" fill="var(--bad)">target ${f(T,0)}</text>`;
   $('hist').innerHTML=`<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="Histogram of lux across the work plane">${svg}</svg><p class="note">${f(reach/scnt*100,0)}% of the work plane reaches the ${f(T,0)} lx target set under Suggest. Each bar is the share of floor area in that lux band.</p>`;
   $('histCap').textContent=`${f(smn,0)}–${f(smxi,0)} lx, Ē ${f(savg,0)} lx`;}
  drawSection(L,H,wp,h,pts.map(p=>p[0]),rBeam,rField,a,fr);
  drawOne(h,Iof,rBeam,rField,a,fr);
  wallP={H,th,Iof,gF};drawWall();
  const nm=$('pname').value.trim();
  $('sumTxt').value=[`REMLUX${nm?' - '+nm:''}`,
    `Room: ${poly?`polygon, ${poly.length} corners, ${f(RA,1)} m2 inside a ${f(L)} x ${f(W)} m box (corners: ${poly.map(q=>f(q[0])+' '+f(q[1])).join('; ')})`:f(L)+' x '+f(W)+' m'}, ceiling ${f(H)} m, calculated at ${f(wp)} m above floor`,
    ...(multi?[`Groups: ${groups.length} (${nOn} on), ${NT} fixtures, ${f(LMT,0)} lm total`].concat(GL.map((q,k)=>{const g=groups[k];if(!q)return`  ${g.name}: invalid settings`;const v=g.vals||{};return`  ${g.name}${g.on?'':' (off)'}: ${fixLabel(g.vals)?fixLabel(g.vals)+', ':''}${q.pts.length} x ${f(q.lm,0)} lm, ${f(q.md.ang,0)} deg, ${g.mode==='custom'?'custom':v.nx+' x '+v.ny+' '+FORMS[g.form||'grid'][0].toLowerCase()}${g.areaOn?` in area ${f(+v.ax)},${f(+v.ay)} ${f(+v.aw)}x${f(+v.ah)} m`:''}${g.phot==='ies'&&g.ies?', IES '+g.ies.file:''}`})).concat(['Selected group details:']):[]),
    ...(fixLabel({brand:$('brand').value,fixname:$('fixname').value})?[`Fixture: ${fixLabel({brand:$('brand').value,fixname:$('fixname').value})}`]:[]),
    `Fixtures: ${N} (${cu?'custom layout':nx+' x '+ny+' '+FORMS[form][0].toLowerCase()}), ${f(lm,0)} lm each, ${f(a,0)} deg beam, diameter ${f(fr*2000,0)} mm`,
    `Photometry: ${phot==='ies'&&ies?'IES file '+ies.file:'generic cos^n beam'}`,
    cu?`Spacing: custom positions, closest pair ${isFinite(minD)?f(minD):'-'} m`:`Spacing: ${f(sx)} x ${f(sy)} m centre to centre; wall offset ${f(offx)} x ${f(offy)} m`,
    `Spread on plane: beam (50%) diameter ${f(2*rBeam)} m, field (10%) diameter ${f(2*rField)} m`,
    `Lux (direct light only): average ${f(avg,0)}, min ${f(mn,0)}, max ${f(mxi,0)}, uniformity ${f(uni,2)}${WZ>0?` (${f(WZ)} m wall zone excluded)`:''}`,
    ...(PWT>0?[`Power: ${multi?'':f(pw,1)+' W each, '}${f(PWT,0)} W total, ${f(PWT/RA,1)} W/m2, ${f(LMT/PWT,0)} lm/W`]:[]),'','Fixture, x (m), y (m), lux below'].concat(ALL.map(([x,y,,k,i])=>`${gtag(k)}${GL[k].labs[i]}, ${f(x)}, ${f(y)}, ${f(E(x,y),0)}`)).join('\n');
  saveActive();renderGroups();
  try{localStorage.setItem('dlc:last',JSON.stringify(getState()))}catch(e){}
}

function drawSection(L,H,wp,h,xs,rB,rF,a,fr){
  const ml=64,top=50,w=440,s=Math.min(312/L,200/H),floor=top+H*s,plane=floor-wp*s,rw=L*s,right=ml+rw,ht=floor+58;
  const halo='stroke="var(--panel)" stroke-width="3" paint-order="stroke"';
  const dH=(x1,x2,y,txt,col)=>{col=col||'var(--mute)';return `<g stroke="${col}"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y-4}" x2="${x1}" y2="${y+4}"/><line x1="${x2}" y1="${y-4}" x2="${x2}" y2="${y+4}"/></g><text x="${(x1+x2)/2}" y="${y-5}" text-anchor="middle" font-size="11" font-weight="600" fill="${col}">${txt}</text>`};
  const dV=(x,y1,y2,txt,side)=>`<g stroke="var(--mute)"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><line x1="${x-4}" y1="${y1}" x2="${x+4}" y2="${y1}"/><line x1="${x-4}" y1="${y2}" x2="${x+4}" y2="${y2}"/></g><text transform="translate(${x+side*5},${(y1+y2)/2}) rotate(${side<0?-90:90})" text-anchor="middle" font-size="11" font-weight="600" fill="var(--mute)">${txt}</text>`;
  const X=x=>ml+x*s,u=[...new Set(xs.map(x=>Math.round(x*1000)/1000))].sort((p,q)=>p-q),nx=xs.length, fw=Math.max(2*fr*s,3), ty=top-24;
  let c='',d='';
  for(let i=0;i<nx;i++){
    const x=X(xs[i]);
    c+=`<polygon points="${x},${top} ${x-rF*s},${plane} ${x+rF*s},${plane}" fill="var(--beam)" fill-opacity=".10"/>`;
    c+=`<polygon points="${x},${top} ${x-rB*s},${plane} ${x+rB*s},${plane}" fill="var(--beam)" fill-opacity=".28" stroke="var(--beam)" stroke-width="1"/>`;
  }
  let fx='';for(let i=0;i<nx;i++)fx+=`<rect x="${X(xs[i])-fw/2}" y="${top}" width="${fw}" height="5" fill="var(--ink)"/>`;
  const ext=x=>`<line x1="${x}" y1="${top-6}" x2="${x}" y2="${ty+4}" stroke="var(--rule)"/>`;
  const lo=u[0],hi=u[u.length-1];
  if(lo>0.001)d+=ext(ml)+ext(X(lo))+dH(ml,X(lo),ty,f(lo));
  if(L-hi>0.001)d+=ext(right)+ext(X(hi))+dH(X(hi),right,ty,f(L-hi));
  if(u.length>1)d+=ext(X(u[0]))+ext(X(u[1]))+dH(X(u[0]),X(u[1]),ty,f(u[1]-u[0])+' m','var(--accent)');
  const x0=X(u[0]),by=floor+18;
  d+=`<line x1="${x0-rB*s}" y1="${plane}" x2="${x0-rB*s}" y2="${by}" stroke="var(--accent)" stroke-opacity=".5" stroke-dasharray="2 3"/><line x1="${x0+rB*s}" y1="${plane}" x2="${x0+rB*s}" y2="${by}" stroke="var(--accent)" stroke-opacity=".5" stroke-dasharray="2 3"/>`;
  d+=dH(x0-rB*s,x0+rB*s,by,'\u00d8 '+f(2*rB)+' m','var(--accent)');
  d+=dH(ml,right,floor+44,f(L)+' m');
  d+=dV(ml-16,top,floor,f(H)+' m',-1);
  d+=dV(right+16,top,plane,f(h)+' m',1);
  if(wp>0)d+=dV(right+16,plane,floor,f(wp)+' m',1);
  $('sec').innerHTML=`<svg viewBox="0 0 ${w} ${ht}" role="img" aria-label="Dimensioned section of the room with ${nx} downlights">
    <defs><clipPath id="sc"><rect x="${ml}" y="${top}" width="${rw}" height="${plane-top+1}"/></clipPath></defs>
    <rect x="${ml}" y="${top-6}" width="${rw}" height="6" fill="var(--rule)"/>
    <g clip-path="url(#sc)">${c}</g>
    <rect x="${ml}" y="${top}" width="${rw}" height="${H*s}" fill="none" stroke="var(--ink)" stroke-width="2"/>
    ${wp>0?`<line x1="${ml}" y1="${plane}" x2="${right}" y2="${plane}" stroke="var(--mute)" stroke-dasharray="4 4"/>`:''}
    ${fx}${d}
    <text x="${x0-fw/2-6}" y="${top+16}" text-anchor="end" font-size="11" fill="var(--ink)" ${halo}>\u00d8 ${f(2*fr*1000,0)} mm</text>
    <text x="${x0+fw/2+6}" y="${top+16}" font-size="11" fill="var(--ink)" ${halo}>${f(a,0)}\u00b0</text>
  </svg>`;
  $('secCap').textContent=`${f(h)} m throw`+(u.length>1?`, ${f(u[1]-u[0])} m spacing`:'');
}

function drawOne(h,Iof,rB,rF,a,fr){
  const Ec0=Iof(1)/(h*h),E=r=>illuminanceAt(Iof,h,r);
  const R=rF*1.2,k=135/R,steps=48;
  let Ec=0;for(let i=0;i<=80;i++)Ec=Math.max(Ec,E(R*i/80));Ec=Ec||1;
  const EB=E(rB),EF=E(rF);
  let rings='';
  const S=oneScale==='auto'?Ec:+oneScale;
  for(let i=steps;i>=1;i--){const c=ramp(E(R*(i-.5)/steps)/S);rings+=`<circle cx="150" cy="150" r="${k*R*i/steps}" fill="rgb(${c})"/>`}
  const lab='font-size="12" font-weight="600" text-anchor="middle" fill="#fff" stroke="#16161e" stroke-width="3" paint-order="stroke"';
  $('oneHeat').innerHTML=`<svg viewBox="0 0 300 300" role="img" aria-label="Top view of one downlight spread on the floor">
    <rect width="300" height="300" rx="14" fill="#16161e"/>${rings}
    <circle cx="150" cy="150" r="${k*rF}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-dasharray="5 4"/>
    <circle cx="150" cy="150" r="${k*rB}" fill="none" stroke="#fff" stroke-width="1.5"/>
    <circle cx="150" cy="150" r="${Math.max(2.5,k*fr)}" fill="#16161e"/>
    <text x="150" y="${150-k*rB-6}" ${lab}>50% · Ø ${f(2*rB)} m</text>
    <text x="150" y="${150+k*rF+15}" ${lab}>10% · Ø ${f(2*rF)} m</text>
  </svg>`;
  const W=300,Ht=210,ml=40,mr=12,mt=16,mb=30,pw=W-ml-mr,ph=Ht-mt-mb;
  const X=x=>ml+(x+R)/(2*R)*pw,Y=e=>mt+ph-(e/Ec)*ph;
  let d='';for(let i=0;i<=80;i++){const x=-R+2*R*i/80;d+=`${i?'L':'M'}${X(x).toFixed(1)},${Y(E(Math.abs(x))).toFixed(1)} `}
  $('oneProf').innerHTML=`<svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Lux across the beam of one downlight">
    <path d="${d}L${X(R)},${Y(0)} L${X(-R)},${Y(0)} Z" fill="var(--beam)" fill-opacity=".25"/>
    <path d="${d}" fill="none" stroke="var(--beam)" stroke-width="2"/>
    <line x1="${ml}" y1="${Y(0)}" x2="${W-mr}" y2="${Y(0)}" stroke="var(--ink)"/>
    <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${Y(0)}" stroke="var(--rule)"/>
    <g stroke="var(--accent)" stroke-dasharray="4 3"><line x1="${X(-rB)}" y1="${Y(EB)}" x2="${X(-rB)}" y2="${Y(0)}"/><line x1="${X(rB)}" y1="${Y(EB)}" x2="${X(rB)}" y2="${Y(0)}"/><line x1="${X(-rB)}" y1="${Y(EB)}" x2="${X(rB)}" y2="${Y(EB)}"/></g>
    <g stroke="var(--mute)" stroke-dasharray="2 3"><line x1="${X(-rF)}" y1="${Y(EF)}" x2="${X(-rF)}" y2="${Y(0)}"/><line x1="${X(rF)}" y1="${Y(EF)}" x2="${X(rF)}" y2="${Y(0)}"/></g>
    <g font-size="11" fill="var(--mute)"><text x="${ml-5}" y="${mt+4}" text-anchor="end">${f(Ec,0)}</text><text x="${ml-5}" y="${Y(0)}" text-anchor="end">0</text>
    <text x="${X(-R)}" y="${Y(0)+15}">${f(R,1)} m</text><text x="${X(0)}" y="${Y(0)+15}" text-anchor="middle">0</text><text x="${X(R)}" y="${Y(0)+15}" text-anchor="end">${f(R,1)} m</text></g>
    <text x="${X(0)}" y="${Y(EB)-5}" font-size="11" text-anchor="middle" fill="var(--accent)" font-weight="600" stroke="var(--panel)" stroke-width="3" paint-order="stroke">beam edge ${f(EB,0)} lx</text>
    <text x="${X(0)}" y="${Y(0)+27}" font-size="11" text-anchor="middle" fill="var(--mute)">distance from centre; lux in the plane</text>
  </svg>`;
  // colour scale for the top view: same colours as the floor plan legend, from 0 lx to the top of the scale
  {const grad=Array.from({length:9},(_,i)=>`rgb(${ramp(i/8)}) ${i*12.5}%`).join(','),at=v=>Math.min(100,Math.max(0,v/S*100));
   $('oneLegend').innerHTML=`<div class="mb-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Colour scale of the top view"><span class="note" style="margin:0;align-self:center">Colour scale</span>${SCALES.map(v=>`<button class="chip" type="button" data-os="${v}" aria-pressed="${String(oneScale)===String(v)}">${v==='auto'?'Auto':v+' lx'}</button>`).join('')}</div><div class="flex items-center gap-2 text-[.82rem] text-mute"><span>0 lx</span><div class="relative h-2.5 flex-1 rounded-full" style="background:linear-gradient(90deg,${grad})" role="img" aria-label="Colour scale of the top view, 0 to ${f(S,0)} lux"><i class="absolute -top-1 -ml-px h-[18px] w-0.5 bg-ink opacity-55" style="left:${at(EF)}%" title="field edge ${f(EF,0)} lx"></i><i class="absolute -top-1 -ml-[1.5px] h-[18px] w-[3px] bg-ink" style="left:${at(EB)}%" title="beam edge ${f(EB,0)} lx"></i></div><span>${f(S,0)} lx${oneScale!=='auto'&&Ec>S*1.005?'+':''}</span></div>`}
  $('oneCap').textContent=`${fixLabel({brand:$('brand').value,fixname:$('fixname').value})?fixLabel({brand:$('brand').value,fixname:$('fixname').value})+' · ':''}${f(a,0)}° beam, ${f(h)} m throw, ${f(Ec0,0)} lx at centre`;
}
function drawWall(){
  const P=wallP;if(!P)return;
  const d=+$('wd').value,sp=+$('ws').value,nn=Math.round(+$('wn').value);
  if(!(d>0&&sp>0&&nn>=1&&nn<=10)){$('wOut').innerHTML='<p class="err">Enter a distance and spacing above 0, and 1 to 10 lights.</p>';return}
  const {H,th,Iof,gF}=P;
  const{Wd,ys,cw,ch,vals,peak:mx}=wallScallops({distance:d,spacing:sp,count:nn,H,Iof});
  const cv=$('wcv');cv.width=cw;cv.height=ch;const g=cv.getContext('2d'),im=g.createImageData(cw,ch);
  for(let i=0;i<vals.length;i++){const c=ramp(Math.sqrt(vals[i]/mx));im.data[i*4]=c[0];im.data[i*4+1]=c[1];im.data[i*4+2]=c[2];im.data[i*4+3]=255}
  g.putImageData(im,0,0);
  $('wstage').style.aspectRatio=Wd+'/'+H;
  const tf=Math.min(gF,rad(85)),sw='vector-effect="non-scaling-stroke"';
  const curve=(t,dash)=>{const ct=1/Math.tan(t);let o='';
    ys.forEach(yi=>{let q='';for(let k=0;k<=160;k++){const dy=-Wd+2*Wd*k/160,z=ct*Math.sqrt(d*d+dy*dy);q+=(k?'L':'M')+(yi+dy).toFixed(3)+','+Math.min(z,H*1.5).toFixed(3)+' '}
      o+=`<path d="${q}" fill="none" stroke="#fff" stroke-width="${dash?1:2}" ${dash?'stroke-opacity=".6" stroke-dasharray="5 4"':''} ${sw}/>`});return o};
  const mr=Math.max(.03,Wd*.008);
  $('wov').setAttribute('viewBox',`0 0 ${Wd} ${H}`);
  $('wov').innerHTML=curve(tf,true)+curve(th,false)+ys.map(yi=>`<circle cx="${yi}" cy="0" r="${mr}" fill="#fff"/>`).join('');
  $('wMax').textContent=f(mx,0)+' lx peak';
  const reach=t=>d/Math.tan(t),wAt=(t,z)=>{const q=(z*Math.tan(t))**2-d*d;return q>0?2*Math.sqrt(q):0};
  const rb=reach(th),rf=reach(tf),zm=H/2,mg=nn>1?Math.sqrt(d*d+(sp/2)**2)/Math.tan(th):null;
  const dep=(v,t)=>v<=H?f(v)+' m':(t||'not on wall');
  $('wOut').innerHTML=`<div class="results">
    <div class="res"><b>${dep(rb)}</b><span>scallop top, 50% edge (below ceiling)</span></div>
    <div class="res"><b>${dep(rf)}</b><span>faint top, 10% edge (below ceiling)</span></div>
    <div class="res"><b>${wAt(th,zm)>0?f(wAt(th,zm))+' m':'none'}</b><span>scallop width ${f(zm)} m down, 50% edge</span></div>
    <div class="res"><b>${mg===null?'-':dep(mg,'below floor')}</b><span>neighbouring scallops merge below this depth</span></div>
    <div class="res"><b>${f(mx,0)} lx</b><span>peak light on the wall</span></div>
  </div>`;
  $('wallCap').textContent=`${f(d)} m from wall, ${nn} lights ${f(sp)} m apart`;
}
['wd','ws','wn'].forEach(i=>$(i).addEventListener('input',drawWall));
const IDS=['L','W','H','wp','wz','nx','ny','ang','lm','pw','fr','dx','dy','tg','wd','ws','wn','brand','fixname'];
const getState=()=>{const o={};IDS.forEach(i=>o[i]=$(i).value);o.mode=mode;o.customPts=customPts;o.layers={...layers};o.phot=phot;o.ies=ies;o.genVals=genVals;o.lxScale=lxScale;o.oneScale=oneScale;o.mapView=mapView;o.poly=poly?poly.map(q=>[q[0],q[1]]):null;if(groups.length){saveActive();o.groups=JSON.parse(JSON.stringify(groups));o.act=act}o.polyK=poly?poly._k:null;o.form=form;return o};
const setState=o=>{IDS.forEach(i=>{if(o[i]!==undefined)$(i).value=o[i]});if(o.mode)mode=o.mode;if(o.layers)Object.assign(layers,o.layers);customPts=o.customPts||null;genVals=o.genVals||null;ies=o.ies&&o.ies.v?o.ies:null;phot=ies&&o.phot==='ies'?'ies':'gen';if(o.lxScale!==undefined)lxScale=o.lxScale;if(o.oneScale!==undefined)oneScale=o.oneScale;if(o.mapView)mapView=o.mapView;poly=o.poly&&o.poly.length>2?o.poly.map(q=>[q[0],q[1]]):null;if(poly)poly._k=o.polyK||'custom';shapeEdit=false;selV=-1;if(o.groups&&o.groups.length){groups=JSON.parse(JSON.stringify(o.groups));loadGroup(o.act||0)}else{groups=[];act=0;areaOn=false}form=FORMS[o.form]?o.form:'grid';sel=-1;prevL=0;calc()};
const DEF=getState();
const esc=t=>t.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rooms=()=>{try{return JSON.parse(localStorage.getItem('dlc:rooms')||'{}')}catch(e){return{}}};
const putRooms=r=>{try{localStorage.setItem('dlc:rooms',JSON.stringify(r))}catch(e){}};
function renderSaved(){
  const k=Object.keys(rooms());
  $('saved').innerHTML=k.length?k.map(n=>`<span class="saved"><button class="chip" type="button" data-load="${encodeURIComponent(n)}">${esc(n)}</button><button class="chip" type="button" data-del="${encodeURIComponent(n)}" aria-label="Delete ${esc(n)}">×</button></span>`).join(''):'';
}
function suggest(){
  const L=+$('L').value,W=+$('W').value,H=+$('H').value,wp=+$('wp').value,T=+$('tg').value,h=H-wp,md=model();
  if(!(md&&L>0&&W>0&&h>0&&T>0)){$('sug').innerHTML='<p class="err">Enter valid room, fixture and target values first.</p>';return}
  const fm=form,hit=suggestGrid({L,W,h,target:T,form:fm,Iof:md.Iof,shape:poly?roomP(L,W):null,wallZone:wzone(L,W)});
  $('sug').innerHTML=hit?`<p><b>${hit.x} × ${hit.y} ${FORMS[fm][0].toLowerCase()}</b> (${hit.N} fixtures${poly?' inside the room shape':''}${groups.length>1?', selected group on its own':''}) gives about ${f(hit.avg,0)} lx on average at ${f(hit.uni,2)} uniformity, spaced ${fm==='hex'?f(hit.sx)+' m hexagonal':f(hit.sx)+' × '+f(hit.sy)+' m'}. <button class="chip" type="button" data-apply="${hit.x}x${hit.y}">Use this layout</button></p>`:`<p class="err">No ${FORMS[fm][0].toLowerCase()} layout up to 12 × 12 reaches ${f(T,0)} lx evenly. Try more lumens per fixture or a wider beam.</p>`;
}
function copySum(){
  const t=$('sumTxt');t.select();let ok=false;
  try{ok=document.execCommand('copy')}catch(e){}
  if(!ok&&navigator.clipboard){navigator.clipboard.writeText(t.value).then(()=>$('copyMsg').textContent='Copied.',()=>$('copyMsg').textContent='Select the text and copy it.');return}
  $('copyMsg').textContent=ok?'Copied.':'Select the text and copy it.';
}
document.addEventListener('click',e=>{
  const t=e.target;
  if(t.id==='saveBtn'){const r=rooms();const nm=$('pname').value.trim()||'Room '+(Object.keys(r).length+1);$('pname').value=nm;r[nm]=getState();putRooms(r);renderSaved()}
  const ld=t.closest('[data-load]');if(ld){const n=decodeURIComponent(ld.dataset.load),r=rooms();if(r[n]){$('pname').value=n;setState(r[n])}}
  const dl=t.closest('[data-del]');if(dl){const n=decodeURIComponent(dl.dataset.del),r=rooms();delete r[n];putRooms(r);renderSaved()}
  if(t.id==='resetBtn'){$('pname').value='';setState(DEF)}
  if(t.id==='sugBtn')suggest();
  const ap=t.closest('[data-apply]');if(ap){const[c,r]=ap.dataset.apply.split('x');mode='even';$('nx').value=c;$('ny').value=r;calc()}
  if(t.id==='copyBtn')copySum();
  if(t.id==='updBtn')calc();
  if(t.id==='wallUse'&&lastPts.length){
    const dmin=Math.min(...lastPts.map(p=>p[0]));
    const ys=[...new Set(lastPts.filter(p=>p[0]-dmin<.05).map(p=>Math.round(p[1]*100)/100))].sort((u,v)=>u-v);
    $('wd').value=f(Math.max(.05,dmin));
    if(ys.length>1)$('ws').value=f((ys[ys.length-1]-ys[0])/(ys.length-1));
    $('wn').value=Math.min(10,ys.length);drawWall();
  }
  if(t.id==='gScDn'||t.id==='gScUp'){toCustom();customPts=scalePts(customPts,t.id==='gScUp'?1.1:1/1.1);calc()}
  if(t.id==='addBtn'){toCustom();customPts.push([+$('L').value/2,+$('W').value/2]);sel=customPts.length-1;calc()}
  const gs=t.closest('[data-gsel]');if(gs){saveActive();loadGroup(+gs.dataset.gsel);calc();return}
  const sh=t.closest('[data-shape]');if(sh){const k=sh.dataset.shape,L=+$('L').value,W=+$('W').value;
    if(k==='rect'){poly=null;shapeEdit=false;selV=-1}
    else if(k==='edit'){shapeEdit=!shapeEdit;selV=-1;if(shapeEdit&&!poly){poly=rectPoly(L,W);poly._k='custom'}if(shapeEdit){layers.iso=false;showPage('visualize',true);setTimeout(()=>$('stage').scrollIntoView({behavior:'smooth',block:'center'}),80)}}
    else{poly=shapePreset(k,L,W);poly._k=k;selV=-1;if(mode==='custom')mode='even'}
    prevL=L;prevW=W;calc()}
  if(t.id==='shapeDone'){shapeEdit=false;selV=-1;calc()}
  if(t.id==='pvRm'&&poly&&poly.length>3&&selV>=0){poly.splice(selV,1);poly._k='custom';selV=-1;normPoly();calc()}
  if(t.id==='polyApply'){const Q=$('polyTxt').value.split(/\n/).map(l=>l.trim()).filter(Boolean).map(l=>l.split(/[\s,;]+/).map(Number));
    if(Q.length<3||Q.some(q=>q.length<2||q.slice(0,2).some(v=>!isFinite(v)))){$('polyMsg').innerHTML='<span class="err">Need at least 3 lines of x, y numbers.</span>'}
    else{poly=Q.map(q=>[q[0],q[1]]);poly._k='custom';selV=-1;normPoly();$('polyMsg').textContent='Applied.';calc()}}
  if(t.id==='rmBtn'&&sel>=0&&lastPts.length>1){toCustom();customPts.splice(sel,1);sel=-1;calc()}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('#L,#W,#H,#wp,#nx,#ny,#ang,#lm,#pw,#fr,#dx,#dy'))calc()});
document.addEventListener('change',e=>{
  if((e.target.id==='pvx'||e.target.id==='pvy')&&poly&&selV>=0){const v=+e.target.value;if(isFinite(v)){poly[selV][e.target.id==='pvx'?0:1]=v;const k=poly._k;poly._k='custom';normPoly();calc()}return}
  const id=e.target.id;if(id!=='selx'&&id!=='sely')return;
  toCustom();const p=customPts[sel];if(!p)return;
  const v=+e.target.value;if(id==='selx')p[0]=v;else p[1]=v;calc();
});
const ovEl=$('ov');
initPlanImage({setRoom:P=>{poly=P.map(([x,y])=>[x,y]);poly._k='custom';selV=-1;normPoly();calc()},fitRoom:(L,W)=>{if(poly)return false;$('L').value=L;$('W').value=W;calc();return true}});
let drag=-1,moved=false,raf=0;
let dragV=-1,gDrag=null,gScale=null;
// scale light positions by k about their centroid; k is reduced so every light stays inside the room
const scalePts=(base,k0)=>{const L=+$('L').value,W=+$('W').value,n=base.length,cx=base.reduce((s,p)=>s+p[0],0)/n,cy=base.reduce((s,p)=>s+p[1],0)/n;let k=k0;
  base.forEach(([x,y])=>{const dx=x-cx,dy=y-cy;
    if(dx*k+cx>L)k=Math.min(k,(L-cx)/dx);if(dx*k+cx<0)k=Math.min(k,-cx/dx);
    if(dy*k+cy>W)k=Math.min(k,(W-cy)/dy);if(dy*k+cy<0)k=Math.min(k,-cy/dy)});
  return base.map(([x,y])=>[cx+(x-cx)*k,cy+(y-cy)*k])};
const toPlan=e=>{const r=ovEl.getBoundingClientRect(),L=+$('L').value,W=+$('W').value;let x=(e.clientX-r.left)/r.width*L,y=(e.clientY-r.top)/r.height*W;
  if(layers.snap){x=Math.round(x*10)/10;y=Math.round(y*10)/10}return[Math.min(L,Math.max(0,x)),Math.min(W,Math.max(0,y))]};
ovEl.addEventListener('pointerdown',e=>{
  if(shapeEdit&&poly){const pv=e.target.closest('[data-pv]'),pe=e.target.closest('[data-pe]');
    if(pe){const k=+pe.dataset.pe,a=poly[k],b=poly[(k+1)%poly.length];poly.splice(k+1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]);poly._k='custom';dragV=selV=k+1}
    else if(pv)dragV=selV=+pv.dataset.pv;
    else{selV=-1;calc();return}
    ovEl.setPointerCapture(e.pointerId);e.preventDefault();calc();return}
  const gs=e.target.closest('[data-gs]');
  if(gs){toCustom();const r=ovEl.getBoundingClientRect(),L=+$('L').value,W=+$('W').value,n=customPts.length,
      cx=customPts.reduce((s,p)=>s+p[0],0)/n,cy=customPts.reduce((s,p)=>s+p[1],0)/n,px=(e.clientX-r.left)/r.width*L,py=(e.clientY-r.top)/r.height*W,d0=Math.hypot(px-cx,py-cy);
    if(d0>1e-6){gScale={pts:customPts.map(p=>[p[0],p[1]]),cx,cy,d0};ovEl.setPointerCapture(e.pointerId);e.preventDefault()}return}
  const t=e.target.closest('[data-i]');
  if(!t){if(sel!==-1){sel=-1;calc()}return}
  drag=+t.dataset.i;sel=drag;moved=false;
  gDrag=null;
  if(layers.group||e.shiftKey){toCustom();const r=ovEl.getBoundingClientRect();gDrag={pts:customPts.map(p=>[p[0],p[1]]),x0:(e.clientX-r.left)/r.width*(+$('L').value),y0:(e.clientY-r.top)/r.height*(+$('W').value)}}
  ovEl.setPointerCapture(e.pointerId);e.preventDefault();calc();
});
ovEl.addEventListener('pointermove',e=>{
  if(dragV>=0&&poly){poly[dragV]=toPlan(e);poly._k='custom';if(!raf)raf=requestAnimationFrame(()=>{raf=0;calc()});return}
  if(gScale){const r=ovEl.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*(+$('L').value),y=(e.clientY-r.top)/r.height*(+$('W').value);
    customPts=scalePts(gScale.pts,Math.max(.05,Math.hypot(x-gScale.cx,y-gScale.cy)/gScale.d0));
    if(!raf)raf=requestAnimationFrame(()=>{raf=0;calc()});return}
  if(drag<0)return;
  if(!moved){toCustom();moved=true}
  const r=ovEl.getBoundingClientRect(),L=+$('L').value,W=+$('W').value;
  let x=(e.clientX-r.left)/r.width*L,y=(e.clientY-r.top)/r.height*W;
  if(gDrag){
    let dx=x-gDrag.x0,dy=y-gDrag.y0;
    if(layers.snap){dx=Math.round(dx*10)/10;dy=Math.round(dy*10)/10}
    const xs=gDrag.pts.map(p=>p[0]),ys=gDrag.pts.map(p=>p[1]);
    dx=Math.min(L-Math.max(...xs),Math.max(-Math.min(...xs),dx));dy=Math.min(W-Math.max(...ys),Math.max(-Math.min(...ys),dy));
    customPts=gDrag.pts.map(([px,py])=>[px+dx,py+dy]);
    if(!raf)raf=requestAnimationFrame(()=>{raf=0;calc()});return}
  if(layers.snap){x=Math.round(x*10)/10;y=Math.round(y*10)/10}
  customPts[drag]=[Math.min(L,Math.max(0,x)),Math.min(W,Math.max(0,y))];
  if(!raf)raf=requestAnimationFrame(()=>{raf=0;calc()});
});
const endDrag=()=>{drag=-1;gDrag=null;gScale=null;if(dragV>=0){dragV=-1;normPoly();calc()}};
ovEl.addEventListener('pointerup',endDrag);ovEl.addEventListener('pointercancel',endDrag);
$('tg').addEventListener('change',()=>calc());
$('tg').addEventListener('input',()=>{try{localStorage.setItem('dlc:last',JSON.stringify(getState()))}catch(e){}});
$('pname').addEventListener('input',calc);
document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('gname')&&groups[act]){groups[act].name=e.target.value.slice(0,30)||'Group '+(act+1);document.querySelectorAll('.grow.on .gsel span').forEach(x=>x.textContent=groups[act].name)}});
document.addEventListener('change',e=>{if(e.target.classList&&e.target.classList.contains('gname')){e.target.blur();calc()}});
try{const l=JSON.parse(localStorage.getItem('dlc:last')||'null');if(l)setState(l)}catch(e){}
const PAGES=['room','fixture','visualize','stats','spot'];let page='visualize';
function showPage(p,nav){if(p==='layout')p='visualize';page=PAGES.includes(p)?p:'visualize';PAGES.forEach(k=>$('pg-'+k).hidden=k!==page);
  document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.page===page)));
  if(nav&&location.hash!=='#'+page)location.hash=page;requestAnimationFrame(()=>{drawDims();drawIso3d()})}
document.addEventListener('click',e=>{const b=e.target.closest('.tab');if(b){showPage(b.dataset.page,true);scrollTo({top:0,behavior:'smooth'})}});
addEventListener('hashchange',()=>showPage(location.hash.slice(1)));
showPage(location.hash.slice(1));
renderSaved();
calc();
attachIsoControls($('planwrap'),$('iso'),isoView,drawIso3d);initRoomThree(drawIso3d);
try{new ResizeObserver(()=>{drawDims();drawIso3d()}).observe($('planwrap'))}catch(e){addEventListener('resize',()=>{drawDims();drawIso3d()})}
export {};

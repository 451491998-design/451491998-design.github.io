const NS='http://www.w3.org/2000/svg';
const state={data:null,filtered:[],scale:1,tx:0,ty:0,drag:null,projection:null,selected:null};
const colors={'5A':'#d89b2b','4A':'#de5b52','3A':'#2f88a7','2A':'#86a6b6'};
const $=s=>document.querySelector(s);
const svg=$('#map'),viewport=$('#viewport'),regions=$('#regions'),points=$('#points'),labels=$('#labels'),tip=$('#tooltip');

function el(name,attrs={}){const n=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n}
function flatten(geom){return geom.type==='Polygon'?geom.coordinates:geom.coordinates.flat(1)}
function bounds(fc){const p=[];fc.features.forEach(f=>flatten(f.geometry).forEach(r=>r.forEach(x=>p.push(x))));return [Math.min(...p.map(x=>x[0])),Math.min(...p.map(x=>x[1])),Math.max(...p.map(x=>x[0])),Math.max(...p.map(x=>x[1]))]}
function setupProjection(fc){const [a,b,c,d]=bounds(fc),pad=62,s=Math.min((900-2*pad)/(c-a),(980-2*pad)/(d-b));state.projection=([x,y])=>[pad+(x-a)*s,980-pad-(y-b)*s]}
function pathFor(g){return flatten(g).map(r=>r.map((p,i)=>{const [x,y]=state.projection(p);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`}).join(' ')+' Z').join(' ')}
function shortName(r){
  let n=r.name.replace(/^江西省/,'');
  for(const prefix of [r.city,r.city.replace('市',''),r.county,r.county.replace(/[市县区]$/,'')]) if(prefix&&prefix!=='未标注'&&n.startsWith(prefix)) n=n.slice(prefix.length);
  n=n.replace(/(国家级旅游景区|旅游景区|风景名胜区|生态旅游区|文化旅游区|旅游度假区|风景区|景区|旅游区|度假区)$/,'').replace(/^[·\s-]+|[·\s-]+$/g,'');
  if(!n)n=r.name;
  return n.length>12?n.slice(0,11)+'…':n;
}
function drawMap(){
  setupProjection(state.data.cities); regions.innerHTML=''; points.innerHTML=''; labels.innerHTML='';
  state.data.cities.features.forEach(f=>{const p=el('path',{d:pathFor(f.geometry),class:'region'});p.dataset.city=f.properties.name;regions.appendChild(p);const c=f.properties.center||f.properties.centroid;if(c){const [x,y]=state.projection(c),t=el('text',{x,y,class:'city-label'});t.textContent=f.properties.name.replace('市','');regions.appendChild(t)}});
  state.data.counties.features.forEach(f=>regions.appendChild(el('path',{d:pathFor(f.geometry),class:'region-outline'})));
  state.data.records.forEach(r=>{const [x,y]=state.projection(r.coord),c=el('circle',{cx:x,cy:y,r:r.level==='5A'?5.7:r.level==='4A'?4.4:3.3,fill:colors[r.level]||'#718795',class:'point'});c.dataset.id=r.id;c.setAttribute('aria-label',r.name);c.addEventListener('mouseenter',e=>showTip(e,r));c.addEventListener('mouseleave',()=>tip.hidden=true);c.addEventListener('click',e=>{e.stopPropagation();selectRecord(r.id)});points.appendChild(c);const t=el('text',{x:x+6,y:y-5,class:'point-label'});t.dataset.id=r.id;t.textContent=shortName(r);labels.appendChild(t)});
}
function fillControls(){const d=state.data;for(const [id,key] of [['cityFilter','city'],['levelFilter','level'],['typeFilter','type']]){const vals=Object.keys(d.stats[key]).sort((a,b)=>(d.stats[key][b]-d.stats[key][a])||a.localeCompare(b,'zh'));vals.forEach(v=>$('#'+id).append(new Option(`${v}（${d.stats[key][v]}）`,v)))}
  const max=Math.max(...Object.values(d.stats.city));$('#cityRanking').innerHTML='<span class="legend-title">城市景区数量</span>'+Object.entries(d.stats.city).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<div class="rank-row"><span>${c.replace('市','')}</span><span class="rank-bar"><i style="width:${n/max*100}%"></i></span><b>${n}</b></div>`).join('')
}
function applyFilters(){const q=$('#searchInput').value.trim().toLowerCase(),city=$('#cityFilter').value,level=$('#levelFilter').value,type=$('#typeFilter').value;state.filtered=state.data.records.filter(r=>(!q||`${r.name}${r.county}${r.city}`.toLowerCase().includes(q))&&(!city||r.city===city)&&(!level||r.level===level)&&(!type||r.type===type));const ids=new Set(state.filtered.map(r=>String(r.id)));document.querySelectorAll('.point,.point-label').forEach(p=>p.classList.toggle('dim',!ids.has(p.dataset.id)));$('#visibleCount').textContent=state.filtered.length;$('#resultCount').textContent=state.filtered.length;renderList();if(state.selected&&!ids.has(String(state.selected)))clearSelection()}
function renderList(){const list=$('#resultList');list.innerHTML='';state.filtered.slice(0,200).forEach(r=>{const b=document.createElement('button');b.className='result-item'+(state.selected===r.id?' active':'');b.innerHTML=`<strong><span class="level-pill lv-${r.level}">${r.level}</span>${r.name}</strong><small>${r.city} · ${r.county} · ${r.type}</small>`;b.onclick=()=>selectRecord(r.id);list.appendChild(b)});if(state.filtered.length>200){const x=document.createElement('div');x.className='data-note';x.textContent=`列表显示前200条，地图已显示全部${state.filtered.length}个点位。`;list.appendChild(x)}}
function selectRecord(id){const r=state.data.records.find(x=>x.id===id);if(!r)return;state.selected=id;document.querySelectorAll('.point,.point-label').forEach(p=>p.classList.toggle('active',p.dataset.id===String(id)));$('#selectedDetail').className='selected-detail';$('#selectedDetail').innerHTML=`<h2>${r.name}</h2><div class="detail-grid"><span>地图简称</span><b>${shortName(r)}</b><span>等级</span><b>${r.level}</b><span>城市</span><b>${r.city}</b><span>区县</span><b>${r.county}</b><span>类型</span><b>${r.type}</b><span>来源</span><b>${r.source}</b></div>`;renderList();const p=document.querySelector(`.point[data-id="${id}"]`);if(p){const x=+p.getAttribute('cx'),y=+p.getAttribute('cy');state.scale=Math.max(state.scale,2.6);state.tx=450-x*state.scale;state.ty=470-y*state.scale;updateTransform()}}
function clearSelection(){state.selected=null;document.querySelectorAll('.point.active,.point-label.active').forEach(p=>p.classList.remove('active'));$('#selectedDetail').className='selected-detail empty';$('#selectedDetail').textContent='点击地图点位或列表查看完整信息'}
function showTip(e,r){tip.hidden=false;tip.innerHTML=`<strong>${r.name}</strong><span>${r.level} · ${r.city} · ${r.county}<br>${r.type}</span>`;const box=$('.map-card').getBoundingClientRect();tip.style.left=Math.min(e.clientX-box.left+13,box.width-290)+'px';tip.style.top=Math.max(8,e.clientY-box.top-28)+'px'}
function updateTransform(){viewport.setAttribute('transform',`translate(${state.tx} ${state.ty}) scale(${state.scale})`)}
function zoom(mult,cx=450,cy=490){const old=state.scale;state.scale=Math.max(1,Math.min(8,old*mult));state.tx=cx-(cx-state.tx)*(state.scale/old);state.ty=cy-(cy-state.ty)*(state.scale/old);updateTransform()}
function resetView(){state.scale=1;state.tx=0;state.ty=0;updateTransform()}
svg.addEventListener('wheel',e=>{e.preventDefault();const r=svg.getBoundingClientRect();zoom(e.deltaY<0?1.22:.82,(e.clientX-r.left)/r.width*900,(e.clientY-r.top)/r.height*980)},{passive:false});
svg.addEventListener('pointerdown',e=>{state.drag={x:e.clientX,y:e.clientY,tx:state.tx,ty:state.ty};svg.setPointerCapture(e.pointerId);svg.classList.add('dragging')});
svg.addEventListener('pointermove',e=>{if(!state.drag)return;const r=svg.getBoundingClientRect();state.tx=state.drag.tx+(e.clientX-state.drag.x)/r.width*900;state.ty=state.drag.ty+(e.clientY-state.drag.y)/r.height*980;updateTransform()});
svg.addEventListener('pointerup',()=>{state.drag=null;svg.classList.remove('dragging')});
['searchInput','cityFilter','levelFilter','typeFilter'].forEach(id=>$('#'+id).addEventListener(id==='searchInput'?'input':'change',applyFilters));
$('#resetFilters').onclick=()=>{['searchInput','cityFilter','levelFilter','typeFilter'].forEach(id=>$('#'+id).value='');applyFilters();resetView()};$('#zoomIn').onclick=()=>zoom(1.35);$('#zoomOut').onclick=()=>zoom(.74);$('#resetView').onclick=resetView;
Promise.resolve(window.MAP_DATA).then(d=>{state.data=d;state.filtered=d.records;$('#totalCount').textContent=d.total;fillControls();drawMap();applyFilters()}).catch(()=>{$('.map-card').innerHTML='<div class="selected-detail">地图数据加载失败，请刷新页面重试。</div>'});

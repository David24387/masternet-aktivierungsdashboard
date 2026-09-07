const $=s=>document.querySelector(s);const fmt=n=>new Intl.NumberFormat('de-DE').format(n);const pct=n=>`${Number(n).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})} %`;
function color(rate){return rate>=90?'var(--green)':rate>=70?'var(--yellow)':rate>=40?'var(--amber)':'var(--red)'}
const canonicalRegions={
  'badenwurttemberg':'Baden-Württemberg','bayern':'Bayern','berlin':'Berlin','brandenburg':'Brandenburg','bremen':'Bremen','hamburg':'Hamburg','hessen':'Hessen',
  'mecklenburgvorpommern':'Mecklenburg-Vorpommern','niedersachsen':'Niedersachsen','nordrheinwestfalen':'Nordrhein-Westfalen','rheinlandpfalz':'Rheinland-Pfalz',
  'saarland':'Saarland','sachsen':'Sachsen','sachsenanhalt':'Sachsen-Anhalt','schleswigholstein':'Schleswig-Holstein','thuringen':'Thüringen'
};
const austrianRegionKeys=new Set(['osterreich','wien','niederosterreich','oberosterreich','burgenland','karnten','salzburg','steiermark','tirol','vorarlberg']);
function regionKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function canonicalRegion(state,region){const key=regionKey(state);return region==='AT'||austrianRegionKeys.has(key)?'Österreich':(canonicalRegions[key]||String(state||'').trim())}
async function render(data){
  const comparable=data.centers.filter(c=>c.kind!=='unmatched'&&c.name!=='Nicht zugeordnet');
  $('#updated').textContent=new Date(`${data.updated}T12:00:00`).toLocaleDateString('de-DE');
  $('#overallRate').textContent=pct(data.summary.rate);$('#overallBar').style.width=`${data.summary.rate}%`;
  $('#activated').textContent=fmt(data.summary.activated);$('#pending').textContent=fmt(data.summary.pending);$('#total').textContent=fmt(data.summary.total);$('#centerCount').textContent=fmt(comparable.length);
  if(data.mapping?.unmatchedPartnerUsers)$('#mappingNote').textContent=`${data.mapping.matchedPartnerUsers} von ${data.mapping.partnerUsers} Partnerkonten sind bereits Partnerstandorten zugeordnet. ${data.mapping.unmatchedPartnerUsers} Konten bleiben bis zur eindeutigen Klärung außerhalb des Standortvergleichs.`;
  const regionName=c=>canonicalRegion(c.state,c.region);
  const states=Object.values(comparable.filter(c=>regionName(c)&&regionName(c)!=='Nicht zugeordnet').reduce((a,c)=>{const k=regionName(c);a[k]??={name:k,activated:0,total:0,centers:0};a[k].activated+=c.activated;a[k].total+=c.total;a[k].centers++;return a},{})).map(s=>({...s,rate:s.total?s.activated/s.total*100:0})).sort((a,b)=>b.rate-a.rate);
  $('#stateList').innerHTML=states.map(s=>`<article class="state-row"><i class="state-dot" style="background:${color(s.rate)}"></i><strong>${esc(s.name)}</strong><span>${pct(s.rate)}</span></article>`).join('');
  await drawMap(states);
  const sorted=[...comparable].sort((a,b)=>b.rate-a.rate||b.total-a.total||a.name.localeCompare(b.name,'de-DE'));
  const ranked=sorted.slice(0,10);
  $('#leaderboard').innerHTML=ranked.map((c,i)=>`<li><span class="rank">${i+1}</span><span class="place">${esc(c.name)}<small>${c.sc?'SC '+esc(c.sc)+' · ':''}${c.activated}/${c.total} aktiviert</small></span><span class="rate">${c.rate===100?'<em class="achievement">100 % erreicht</em>':pct(c.rate)}</span></li>`).join('');
  const perfect=comparable.filter(c=>c.sc&&c.total>0&&c.activated===c.total&&!/HQ|#N\/A/i.test(c.sc)).sort((a,b)=>a.name.localeCompare(b.name,'de-DE'));
  renderPerfectCenters(perfect);
  const names=[...new Set(comparable.map(regionName).filter(n=>n&&n!=='Nicht zugeordnet'))].sort((a,b)=>a.localeCompare(b,'de-DE'));$('#stateFilter').innerHTML+=[...names].map(s=>`<option>${esc(s)}</option>`).join('');
  const groupName=c=>c.kind==='partner'?(c.region==='AT'?'Franchise AT':'Franchise DE'):'Equity';
  const key=c=>String(c.sc||c.name).toLowerCase();
  const searchable=c=>`${c.name} ${c.sc||''} ${c.area||''} ${c.state||''} ${groupName(c)}`.toLowerCase();
  let selectedKey='';
  function list(){const q=$('#search').value.trim().toLowerCase();const st=$('#stateFilter').value;const rows=comparable.filter(c=>(!st||regionName(c)===st)&&(!q||searchable(c).includes(q))).sort((a,b)=>b.rate-a.rate||a.name.localeCompare(b.name,'de-DE'));$('#centerList').innerHTML=rows.length?rows.map(c=>`<div class="center-row ${key(c)===selectedKey?'selected-location':''}" data-center="${esc(key(c))}"><span class="center-title">${esc(c.name)}<small>${c.sc?'SC '+esc(c.sc)+' · ':''}${c.activated} von ${c.total} aktiviert · ${esc(groupName(c))}</small></span><span class="mini-progress"><i style="width:${c.rate}%;background:${color(c.rate)}"></i></span><span class="center-rate">${c.rate===100?'<em class="achievement">100 %</em>':pct(c.rate)}</span></div>`).join(''):'<p class="empty">Kein Standort gefunden.</p>'}
  $('#search').addEventListener('input',list);$('#stateFilter').addEventListener('change',list);list();

  const quick=$('#quickSearch'),suggestions=$('#quickSuggestions'),spotlight=$('#spotlight');
  function matches(query){return comparable.filter(c=>searchable(c).includes(query.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name,'de-DE')).slice(0,8)}
  function hideSuggestions(){suggestions.hidden=true;quick.setAttribute('aria-expanded','false')}
  function clearSelection(){selectedKey='';spotlight.hidden=true;spotlight.innerHTML='';const params=new URLSearchParams(location.search);params.delete('standort');const query=params.toString();history.replaceState(null,'',`${location.pathname}${query?'?'+query:''}${location.hash}`);list()}
  function showSuggestions(){const q=quick.value.trim();if(!q){hideSuggestions();clearSelection();return}const found=matches(q);suggestions.innerHTML=found.length?found.map(c=>`<button type="button" data-key="${esc(key(c))}"><strong>${esc(c.name)}</strong><span>${c.sc?'SC '+esc(c.sc)+' · ':''}${esc(c.area||regionName(c)||'')} · ${esc(groupName(c))}</span></button>`).join(''):'<p>Kein Standort gefunden.</p>';suggestions.hidden=false;quick.setAttribute('aria-expanded','true')}
  quick.addEventListener('input',showSuggestions);
  quick.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=matches(quick.value.trim())[0];if(first){e.preventDefault();selectLocation(first,true)}}});
  suggestions.addEventListener('click',e=>{const button=e.target.closest('button[data-key]');if(button)selectLocation(comparable.find(c=>key(c)===button.dataset.key),true)});
  document.addEventListener('click',e=>{if(!e.target.closest('.site-finder'))hideSuggestions()});
  function rankIn(items,c){return [...items].sort((a,b)=>b.rate-a.rate||b.total-a.total||a.name.localeCompare(b.name,'de-DE')).findIndex(x=>x===c)+1}
  function selectLocation(c,celebrate){if(!c)return;selectedKey=key(c);quick.value=c.name;hideSuggestions();const group=groupName(c),peers=comparable.filter(x=>groupName(x)===group),region=regionName(c),regional=comparable.filter(x=>regionName(x)===region),regionalTotal=regional.reduce((n,x)=>n+x.total,0),regionalRate=regionalTotal?regional.reduce((n,x)=>n+x.activated,0)/regionalTotal*100:0,delta=c.rate-regionalRate,remaining=Math.max(0,c.total-c.activated);spotlight.hidden=false;spotlight.innerHTML=`<div class="spotlight-head"><div><p class="eyebrow">DEIN STANDORT</p><h2>${esc(c.name)}</h2><p>${c.sc?'SC '+esc(c.sc)+' · ':''}${esc(group)} · ${esc(region)}</p></div><strong>${pct(c.rate)}</strong></div><div class="spotlight-progress"><i style="width:${c.rate}%"></i></div><p class="spotlight-message">${c.rate===100?'Stark – euer Standort ist vollständig aktiviert!':`Noch <b>${remaining}</b> ${remaining===1?'Person':'Personen'} bis zu den 100 %.`}</p><div class="comparison"><span><b>Platz ${rankIn(sorted,c)} von ${sorted.length}</b>gesamt</span><span><b>Platz ${rankIn(peers,c)} von ${peers.length}</b>${esc(group)}</span><span><b>${delta>=0?'+':''}${pct(delta)}</b>zur Region ${esc(region)}</span></div><div class="spotlight-actions"><button id="showInList" type="button">In Übersicht anzeigen</button><button id="copyLink" type="button">Link kopieren</button></div>`;const params=new URLSearchParams(location.search);params.set('standort',c.sc||c.name);history.replaceState(null,'',`${location.pathname}?${params}${location.hash}`);$('#showInList').onclick=()=>{$('#search').value=c.sc||c.name;$('#stateFilter').value='';list();const row=$(`[data-center="${CSS.escape(key(c))}"]`);row?.scrollIntoView({behavior:'smooth',block:'center'})};$('#copyLink').onclick=async e=>{try{await navigator.clipboard.writeText(location.href);e.target.textContent='Link kopiert ✓'}catch{e.target.textContent='Link steht in der Adresszeile'}};if(celebrate&&c.rate===100)confetti()}
  const requested=new URLSearchParams(location.search).get('standort');if(requested){const c=comparable.find(x=>String(x.sc||'').toLowerCase()===requested.toLowerCase()||x.name.toLowerCase()===requested.toLowerCase());if(c)selectLocation(c,false)}
}
function renderPerfectCenters(perfect){
  const groups=[
    {label:'Equity',items:perfect.filter(c=>c.kind!=='partner')},
    {label:'Franchise DE',items:perfect.filter(c=>c.kind==='partner'&&c.region==='DE')},
    {label:'Franchise AT',items:perfect.filter(c=>c.kind==='partner'&&c.region==='AT')}
  ];
  const cards=items=>items.length?items.map(c=>`<article class="perfect-card"><span class="perfect-check">✓</span><span><strong>${esc(c.name.replace(/^EUROMASTER\s+/i,''))}</strong><small>${esc(c.sc)} · ${c.total} ${c.total===1?'Person':'Personen'}</small></span><b>100 %</b></article>`).join(''):'<p class="perfect-empty">Aktuell noch kein Standort.</p>';
  $('.perfect-section').innerHTML=`<div class="perfect-title"><h2>Diese Standorte sind vollständig aktiviert</h2><strong class="perfect-count">${perfect.length} Standorte</strong></div><div class="perfect-groups">${groups.map(g=>`<details class="perfect-group"><summary><span>${g.label}</span><strong>${g.items.length}</strong></summary><div class="perfect-grid">${cards(g.items)}</div></details>`).join('')}</div>`;
  if(!$('#perfectAccordionStyles')){
    const style=document.createElement('style');style.id='perfectAccordionStyles';style.textContent=`
      .perfect-section{padding:0;margin-bottom:18px;overflow:hidden}
      .perfect-title{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 24px}
      .perfect-title h2{margin:0;color:var(--blue);font-size:1.35rem}
      .perfect-group>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px}
      .perfect-group>summary::-webkit-details-marker{display:none}
      .perfect-group>summary:before{content:'›';flex:none;transition:transform .2s;color:var(--cyan);font-size:1.4em}
      .perfect-group>summary>span{flex:1}
      .perfect-group[open]>summary:before{transform:rotate(90deg)}
      .perfect-groups{padding:0 24px 24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:start}
      .perfect-group{border:1px solid var(--line);border-radius:12px;background:#f8fbfe;overflow:hidden}
      .perfect-group>summary{padding:13px 15px;font-weight:800;color:var(--blue)}
      .perfect-group>summary>strong{display:grid;place-items:center;min-width:28px;height:28px;padding:0 8px;border-radius:99px;background:#e8f7ef;color:#168455;font-size:.78rem}
      .perfect-group .perfect-grid{padding:0 12px 12px;grid-template-columns:1fr}
      .perfect-empty{grid-column:1/-1;margin:0;padding:14px;color:var(--muted);font-size:.8rem}
      @media(max-width:900px){.perfect-groups{grid-template-columns:1fr}}
      @media(max-width:560px){.perfect-title{padding:18px}.perfect-title h2{font-size:1rem}.perfect-title .perfect-count{font-size:.7rem}.perfect-groups{padding:0 18px 18px}}
    `;document.head.appendChild(style);
  }
}
async function drawMap(states){
  const geo=await fetch('germany-states.geo.json').then(r=>r.json());
  const byName=Object.fromEntries(states.map(s=>[s.name,s]));
  const rings=[];geo.features.forEach(f=>walk(f.geometry.coordinates,rings));
  const longitudeFactor=Math.cos(51*Math.PI/180);
  const normalized=rings.flat().map(([x,y])=>[x*longitudeFactor,y]),minX=Math.min(...normalized.map(p=>p[0])),maxX=Math.max(...normalized.map(p=>p[0])),minY=Math.min(...normalized.map(p=>p[1])),maxY=Math.max(...normalized.map(p=>p[1]));
  const pad=32,w=620,h=720,scale=Math.min((w-2*pad)/(maxX-minX),(h-2*pad)/(maxY-minY));
  const project=([x,y])=>[pad+(x*longitudeFactor-minX)*scale,h-pad-(y-minY)*scale],svg=$('#germanyMap'),tip=$('#mapTooltip');
  for(const f of geo.features){
    const canonicalName=canonicalRegion(f.properties.name);
    const state=byName[canonicalName]||{name:canonicalName,rate:0,activated:0,total:0};
    const local=[];walk(f.geometry.coordinates,local);
    const d=local.map(r=>'M'+r.map(p=>project(p).map(n=>n.toFixed(1)).join(',')).join('L')+'Z').join('');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);path.setAttribute('fill',color(state.rate));path.setAttribute('class','map-state');path.setAttribute('tabindex','0');path.setAttribute('aria-label',`${state.name}: ${pct(state.rate)}`);
    const show=e=>{tip.hidden=false;tip.innerHTML=`<strong>${esc(state.name)}</strong><br>${pct(state.rate)} aktiviert<br>${state.activated} von ${state.total} Mitarbeitenden`;const box=svg.parentElement.getBoundingClientRect(),x=('clientX'in e?e.clientX:box.left+box.width/2)-box.left,y=('clientY'in e?e.clientY:box.top+box.height/2)-box.top;tip.style.left=`${Math.max(8,Math.min(x+12,box.width-210))}px`;tip.style.top=`${Math.max(8,y-44)}px`};
    path.addEventListener('pointermove',show);path.addEventListener('pointerleave',()=>tip.hidden=true);path.addEventListener('focus',show);path.addEventListener('blur',()=>tip.hidden=true);svg.appendChild(path);
  }
  function walk(c,out){if(typeof c?.[0]?.[0]==='number')out.push(c);else if(Array.isArray(c))c.forEach(x=>walk(x,out))}
}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function confetti(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;const layer=document.createElement('div');layer.className='confetti-layer';layer.setAttribute('aria-hidden','true');for(let i=0;i<70;i++){const bit=document.createElement('i');bit.style.setProperty('--x',`${Math.random()*100}vw`);bit.style.setProperty('--delay',`${Math.random()*.35}s`);bit.style.setProperty('--drift',`${Math.random()*180-90}px`);bit.style.background=['#00a6d6','#003b7a','#28a66a','#f0cd35','#e54d4d'][i%5];layer.appendChild(bit)}document.body.appendChild(layer);setTimeout(()=>layer.remove(),2300)}
fetch('data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(render).catch(()=>{document.querySelector('main').innerHTML='<section class="panel"><h1>Daten konnten nicht geladen werden.</h1><p>Bitte prüfen Sie, ob die Datei <strong>data.json</strong> vorhanden ist.</p></section>'});

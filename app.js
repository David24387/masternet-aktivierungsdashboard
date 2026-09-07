const $=s=>document.querySelector(s);const fmt=n=>new Intl.NumberFormat('de-DE').format(n);const pct=n=>`${Number(n).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})} %`;
function color(rate){return rate>=90?'var(--green)':rate>=70?'var(--yellow)':rate>=40?'var(--amber)':'var(--red)'}
async function render(data){
  const comparable=data.centers.filter(c=>c.kind!=='unmatched'&&c.name!=='Nicht zugeordnet');
  $('#updated').textContent=new Date(`${data.updated}T12:00:00`).toLocaleDateString('de-DE');
  $('#overallRate').textContent=pct(data.summary.rate);$('#overallBar').style.width=`${data.summary.rate}%`;
  $('#activated').textContent=fmt(data.summary.activated);$('#pending').textContent=fmt(data.summary.pending);$('#total').textContent=fmt(data.summary.total);$('#centerCount').textContent=fmt(comparable.length);
  if(data.mapping?.unmatchedPartnerUsers)$('#mappingNote').textContent=`${data.mapping.matchedPartnerUsers} von ${data.mapping.partnerUsers} Partnerkonten sind bereits Partnerstandorten zugeordnet. ${data.mapping.unmatchedPartnerUsers} Konten bleiben bis zur eindeutigen Klärung außerhalb des Standortvergleichs.`;
  const states=Object.values(comparable.filter(c=>c.state&&c.state!=='Nicht zugeordnet').reduce((a,c)=>{const k=c.state;a[k]??={name:k,activated:0,total:0,centers:0};a[k].activated+=c.activated;a[k].total+=c.total;a[k].centers++;return a},{})).map(s=>({...s,rate:s.total?s.activated/s.total*100:0})).sort((a,b)=>b.rate-a.rate);
  $('#stateList').innerHTML=states.map(s=>`<article class="state-row"><i class="state-dot" style="background:${color(s.rate)}"></i><strong>${esc(s.name)}</strong><span>${pct(s.rate)}</span></article>`).join('');
  await drawMap(states);
  const ranked=[...comparable].sort((a,b)=>b.rate-a.rate||b.total-a.total||a.name.localeCompare(b.name,'de-DE')).slice(0,10);
  $('#leaderboard').innerHTML=ranked.map((c,i)=>`<li><span class="rank">${i+1}</span><span class="place">${esc(c.name)}<small>${c.sc?'SC '+esc(c.sc)+' · ':''}${c.activated}/${c.total} aktiviert</small></span><span class="rate">${pct(c.rate)}</span></li>`).join('');
  const perfect=comparable.filter(c=>c.sc&&c.total>0&&c.activated===c.total&&!/HQ|#N\/A/i.test(c.sc)).sort((a,b)=>a.name.localeCompare(b.name,'de-DE'));
  $('#perfectCount').textContent=`${perfect.length} Servicecenter`;
  $('#perfectCenters').innerHTML=perfect.map(c=>`<article class="perfect-card"><span class="perfect-check">✓</span><span><strong>${esc(c.name.replace(/^EUROMASTER\s+/i,''))}</strong><small>${esc(c.sc)} · ${c.total} ${c.total===1?'Person':'Personen'}</small></span><b>100 %</b></article>`).join('');
  const names=[...new Set(comparable.map(c=>c.state))].sort((a,b)=>a.localeCompare(b,'de-DE'));$('#stateFilter').innerHTML+=[...names].map(s=>`<option>${esc(s)}</option>`).join('');
  function list(){const q=$('#search').value.trim().toLowerCase();const st=$('#stateFilter').value;const rows=comparable.filter(c=>(!st||c.state===st)&&(!q||`${c.name} ${c.sc}`.toLowerCase().includes(q))).sort((a,b)=>b.rate-a.rate||a.name.localeCompare(b.name,'de-DE'));$('#centerList').innerHTML=rows.length?rows.map(c=>`<div class="center-row"><span class="center-title">${esc(c.name)}<small>${c.sc?'SC '+esc(c.sc)+' · ':''}${c.activated} von ${c.total} aktiviert</small></span><span class="mini-progress"><i style="width:${c.rate}%;background:${color(c.rate)}"></i></span><span class="center-rate">${pct(c.rate)}</span></div>`).join(''):'<p class="empty">Kein Standort gefunden.</p>'}
  $('#search').addEventListener('input',list);$('#stateFilter').addEventListener('change',list);list();
}
async function drawMap(states){
  const geo=await fetch('germany-states.geo.json').then(r=>r.json());
  const aliases={'Baden-Württemberg':'Baden-Wurttemberg','Mecklenburg-Vorpommern':'Mecklenburg Vorpommern','Thüringen':'Thuringen'};
  const byName=Object.fromEntries(states.map(s=>[s.name,s]));
  const rings=[];geo.features.forEach(f=>walk(f.geometry.coordinates,rings));
  const longitudeFactor=Math.cos(51*Math.PI/180);
  const normalized=rings.flat().map(([x,y])=>[x*longitudeFactor,y]),minX=Math.min(...normalized.map(p=>p[0])),maxX=Math.max(...normalized.map(p=>p[0])),minY=Math.min(...normalized.map(p=>p[1])),maxY=Math.max(...normalized.map(p=>p[1]));
  const pad=32,w=620,h=720,scale=Math.min((w-2*pad)/(maxX-minX),(h-2*pad)/(maxY-minY));
  const project=([x,y])=>[pad+(x*longitudeFactor-minX)*scale,h-pad-(y-minY)*scale],svg=$('#germanyMap'),tip=$('#mapTooltip');
  for(const f of geo.features){
    const state=byName[aliases[f.properties.name]||f.properties.name]||{name:f.properties.name,rate:0,activated:0,total:0};
    const local=[];walk(f.geometry.coordinates,local);
    const d=local.map(r=>'M'+r.map(p=>project(p).map(n=>n.toFixed(1)).join(',')).join('L')+'Z').join('');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);path.setAttribute('fill',color(state.rate));path.setAttribute('class','map-state');path.setAttribute('tabindex','0');path.setAttribute('aria-label',`${state.name}: ${pct(state.rate)}`);
    const show=e=>{tip.hidden=false;tip.innerHTML=`<strong>${esc(state.name)}</strong><br>${pct(state.rate)} aktiviert<br>${state.activated} von ${state.total} Mitarbeitenden`;const box=svg.parentElement.getBoundingClientRect(),x=('clientX'in e?e.clientX:box.left+box.width/2)-box.left,y=('clientY'in e?e.clientY:box.top+box.height/2)-box.top;tip.style.left=`${Math.max(8,Math.min(x+12,box.width-210))}px`;tip.style.top=`${Math.max(8,y-44)}px`};
    path.addEventListener('pointermove',show);path.addEventListener('pointerleave',()=>tip.hidden=true);path.addEventListener('focus',show);path.addEventListener('blur',()=>tip.hidden=true);svg.appendChild(path);
  }
  function walk(c,out){if(typeof c?.[0]?.[0]==='number')out.push(c);else if(Array.isArray(c))c.forEach(x=>walk(x,out))}
}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
fetch('data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(render).catch(()=>{document.querySelector('main').innerHTML='<section class="panel"><h1>Daten konnten nicht geladen werden.</h1><p>Bitte prüfen Sie, ob die Datei <strong>data.json</strong> vorhanden ist.</p></section>'});

const $=s=>document.querySelector(s);const fmt=n=>new Intl.NumberFormat('de-DE').format(n);const pct=n=>`${Number(n).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})} %`;
function color(rate){return rate>=90?'var(--green)':rate>=70?'var(--yellow)':rate>=40?'var(--amber)':'var(--red)'}
function render(data){
  $('#updated').textContent=new Date(`${data.updated}T12:00:00`).toLocaleDateString('de-DE');
  $('#overallRate').textContent=pct(data.summary.rate);$('#overallBar').style.width=`${data.summary.rate}%`;
  $('#activated').textContent=fmt(data.summary.activated);$('#pending').textContent=fmt(data.summary.pending);$('#total').textContent=fmt(data.summary.total);$('#centerCount').textContent=fmt(data.summary.centers);
  const states=Object.values(data.centers.reduce((a,c)=>{const k=c.state||'Nicht zugeordnet';a[k]??={name:k,activated:0,total:0,centers:0};a[k].activated+=c.activated;a[k].total+=c.total;a[k].centers++;return a},{})).map(s=>({...s,rate:s.total?s.activated/s.total*100:0})).sort((a,b)=>b.rate-a.rate);
  $('#stateGrid').innerHTML=states.map(s=>`<article class="state" style="background:${color(s.rate)}"><span class="state-name">${esc(s.name)}</span><strong class="state-rate">${pct(s.rate)}</strong><span class="state-meta">${s.centers} Center · ${s.activated}/${s.total}</span></article>`).join('');
  const ranked=[...data.centers].sort((a,b)=>b.rate-a.rate||b.total-a.total||a.name.localeCompare(b.name,'de-DE')).slice(0,10);
  $('#leaderboard').innerHTML=ranked.map((c,i)=>`<li><span class="rank">${i+1}</span><span class="place">${esc(c.name)}<small>${c.sc?'SC '+esc(c.sc)+' · ':''}${c.activated}/${c.total} aktiviert</small></span><span class="rate">${pct(c.rate)}</span></li>`).join('');
  const names=[...new Set(data.centers.map(c=>c.state))].sort((a,b)=>a.localeCompare(b,'de-DE'));$('#stateFilter').innerHTML+=[...names].map(s=>`<option>${esc(s)}</option>`).join('');
  function list(){const q=$('#search').value.trim().toLowerCase();const st=$('#stateFilter').value;const rows=data.centers.filter(c=>(!st||c.state===st)&&(!q||`${c.name} ${c.sc}`.toLowerCase().includes(q))).sort((a,b)=>b.rate-a.rate||a.name.localeCompare(b.name,'de-DE'));$('#centerList').innerHTML=rows.length?rows.map(c=>`<div class="center-row"><span class="center-title">${esc(c.name)}<small>${c.sc?'SC '+esc(c.sc)+' · ':''}${c.activated} von ${c.total} aktiviert</small></span><span class="mini-progress"><i style="width:${c.rate}%;background:${color(c.rate)}"></i></span><span class="center-rate">${pct(c.rate)}</span></div>`).join(''):'<p class="empty">Kein Standort gefunden.</p>'}
  $('#search').addEventListener('input',list);$('#stateFilter').addEventListener('change',list);list();
}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
fetch('data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(render).catch(()=>{document.querySelector('main').innerHTML='<section class="panel"><h1>Daten konnten nicht geladen werden.</h1><p>Bitte prüfen Sie, ob die Datei <strong>data.json</strong> vorhanden ist.</p></section>'});

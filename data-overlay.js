(()=>{
  const nativeFetch=window.fetch.bind(window);
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
  const stop=new Set('gmbh co kg mbh ges ek e k und u auto autoservice service kfz reifen reifendienst fahrzeugtechnik fahrzeug werkstatt center zentrum'.split(' '));
  const tokens=v=>new Set(norm(v).split(/\s+/).filter(x=>x.length>1&&!stop.has(x)));
  const score=(a,b)=>{const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let hit=0;A.forEach(x=>{if(B.has(x))hit++});return hit/Math.max(A.size,B.size)};
  const apply=(c,a,p)=>{c.activated=a;c.pending=p;c.total=a+p;c.rate=c.total?Math.round(a/c.total*1000)/10:0};
  async function merge(base,latest){
    const internal=new Map(latest.i.map(([n,a,p])=>[norm(n),[a,p]]));
    for(const c of base.centers){if(c.kind==='partner')continue;const hit=internal.get(norm(c.name));if(hit)apply(c,hit[0],hit[1]);}
    const partnerRows=latest.p.map(([name,region,a,p],idx)=>({name,region,a,p,idx,used:false}));
    let matchedUsers=0;
    for(const c of base.centers.filter(x=>x.kind==='partner')){
      const target=`${c.name} ${c.area||''}`;let best=null,bestScore=0;
      for(const r of partnerRows){if(r.used||r.region!==c.region)continue;const s=score(target,r.name);if(s>bestScore){bestScore=s;best=r}}
      if(best&&bestScore>=0.42){apply(c,best.a,best.p);best.used=true;matchedUsers+=best.a+best.p;}
    }
    base.updated=latest.u;
    base.summary={...base.summary,total:latest.s[0],activated:latest.s[1],pending:latest.s[2],rate:latest.s[3]};
    const partnerUsers=latest.p.reduce((n,r)=>n+r[2]+r[3],0);
    base.mapping={...(base.mapping||{}),partnerUsers,matchedPartnerUsers:matchedUsers,unmatchedPartnerUsers:partnerUsers-matchedUsers};
    return base;
  }
  window.fetch=async(input,init)=>{
    const url=typeof input==='string'?input:input?.url||'';
    if(!/(^|\/)data\.json(?:\?|$)/.test(url))return nativeFetch(input,init);
    const [baseRes,statusRes]=await Promise.all([nativeFetch(input,init),nativeFetch('latest-status.json',{cache:'no-store'})]);
    if(!baseRes.ok||!statusRes.ok)return baseRes;
    const merged=await merge(await baseRes.json(),await statusRes.json());
    return new Response(JSON.stringify(merged),{status:200,headers:{'Content-Type':'application/json'}});
  };
})();

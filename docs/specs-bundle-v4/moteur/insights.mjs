// Moteur de calcul des insights OXV Mirror — v2 (corrigée après validation synthétique).
const stddev=a=>{if(a.length<2)return 0;const m=a.reduce((s,v)=>s+v,0)/a.length;return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length);};
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const median=a=>{if(!a.length)return 0;const s=a.slice().sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const haversine=(la1,lo1,la2,lo2)=>{const R=6371000,r=Math.PI/180;const dLa=(la2-la1)*r,dLo=(lo2-lo1)*r;const a=Math.sin(dLa/2)**2+Math.cos(la1*r)*Math.cos(la2*r)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(a));};
const angDiff=(a,b)=>{let d=((a-b+540)%360)-180;return d;};

function groupByLap(frames){const laps=new Map();for(const f of frames){if(!laps.has(f.lap))laps.set(f.lap,[]);laps.get(f.lap).push(f);}return[...laps.entries()].sort((a,b)=>a[0]-b[0]).map(([lap,fr])=>({lap,frames:fr}));}
function withCurviDist(lapFrames){let s=0;const out=[];for(let i=0;i<lapFrames.length;i++){if(i>0){const a=lapFrames[i-1],b=lapFrames[i];s+=haversine(a.latitude,a.longitude,b.latitude,b.longitude);}out.push({...lapFrames[i],s});}return out;}

// CORRECTIF anatomie : un minimum par virage nommé (le plus lent du groupe).
function detectCornersByName(lap){
  const groups={};
  lap.forEach((f,i)=>{ if(f.corner){ if(!groups[f.corner])groups[f.corner]=[]; groups[f.corner].push(i);} });
  // pour chaque virage nommé, l'index du point le plus lent
  const apexes=[];
  for(const [name,idxs] of Object.entries(groups)){
    let best=idxs[0]; for(const i of idxs){ if(lap[i].speed_ms<lap[best].speed_ms) best=i; }
    apexes.push(best);
  }
  return apexes.sort((a,b)=>a-b);
}
// détection générique (sans noms) pour la prod : minima de vitesse + G latéral
function detectCornersGeneric(lap){
  const n=lap.length,W=20,mins=[];
  for(let i=W;i<n-W;i++){const v=lap[i].speed_ms;let isMin=true;
    for(let j=i-W;j<=i+W;j++){if(lap[j].speed_ms<v-0.05){isMin=false;break;}}
    if(isMin&&Math.abs(lap[i].g_force_y)>0.3)mins.push(i);}
  const merged=[];for(const m of mins){if(!merged.length||m-merged[merged.length-1]>W*2)merged.push(m);}
  return merged;
}

// 2.1 anatomie — CORRECTIF : seuils adaptés + un virage unique par nom
function anatomy(lap, apexIdxs){
  return apexIdxs.map(ci=>{
    const apex=lap[ci];
    let bStart=ci; while(bStart>0 && lap[bStart-1].speed_ms>lap[bStart].speed_ms) bStart--; // remonter tant que ça ralentit
    let aEnd=ci; while(aEnd<lap.length-1 && lap[aEnd+1].speed_ms>lap[aEnd].speed_ms) aEnd++; // descendre tant que ça accélère
    return { corner:apex.corner, apexSpeed:+apex.speed_kmh.toFixed(1),
      brakeDist:+Math.max(0,apex.s-lap[bStart].s).toFixed(0),
      accelDist:+Math.max(0,lap[aEnd].s-apex.s).toFixed(0),
      gLatApex:+Math.abs(apex.g_force_y).toFixed(2) };
  });
}

// 2.2 G-G — CORRECTIF : ignorer les transitions de tour (jerk longitudinal aberrant)
function ggEnvelope(frames){
  let maxBrake=0,maxAccel=0,maxLat=0,combined=0,total=0;
  for(let i=1;i<frames.length;i++){
    const f=frames[i];
    if(f.lap!==frames[i-1].lap) continue; // saut de tour
    const gl=f.g_force_x,gy=Math.abs(f.g_force_y);
    if(Math.abs(gl)>1.6||gy>1.6) continue; // garde-fou physique (résidu transition)
    if(gl<maxBrake)maxBrake=gl; if(gl>maxAccel)maxAccel=gl; if(gy>maxLat)maxLat=gy;
    if(Math.abs(gl)>0.3&&gy>0.3)combined++; total++;
  }
  return { maxBrake:+Math.abs(maxBrake).toFixed(2), maxAccel:+maxAccel.toFixed(2),
    maxLat:+maxLat.toFixed(2), combinedPct:+(100*combined/total).toFixed(1) };
}

// 3.1 dispersion — CORRECTIF : écart latéral signé (projeté ⟂ au heading) → amplitude réelle
function trajectoryDispersion(laps){
  const withDist=laps.map(L=>({lap:L.lap,fr:withCurviDist(L.frames)}));
  const step=2,maxS=Math.min(...withDist.map(d=>d.fr[d.fr.length-1].s));
  const resampled=withDist.map(d=>{const out=[];let idx=0;
    for(let s=0;s<maxS;s+=step){while(idx<d.fr.length-2&&d.fr[idx+1].s<=s)idx++;
      const a=d.fr[idx],b=d.fr[idx+1],seg=Math.max(1e-6,b.s-a.s),f=(s-a.s)/seg;
      out.push({s,lat:a.latitude+(b.latitude-a.latitude)*f,lon:a.longitude+(b.longitude-a.longitude)*f,
        v:a.speed_ms+(b.speed_ms-a.speed_ms)*f,hd:a.heading,corner:a.corner});}return out;});
  const N=resampled[0].length,dispAtS=[];
  const mLatDeg=111320,mLonDeg=111320*Math.cos(44.5*Math.PI/180);
  for(let i=0;i<N;i++){
    const latM=resampled.map(r=>r[i].lat*mLatDeg), lonM=resampled.map(r=>r[i].lon*mLonDeg);
    const cLat=mean(latM),cLon=mean(lonM),hd=resampled[0][i].hd*Math.PI/180;
    // projeter chaque écart sur la normale au heading → écart latéral signé en m
    const nx=-Math.sin(hd),ny=Math.cos(hd);
    const offs=resampled.map((r,j)=>{const dx=lonM[j]-cLon,dy=latM[j]-cLat;return dx*nx+dy*ny;});
    dispAtS.push({s:resampled[0][i].s,disp:stddev(offs),corner:resampled[0][i].corner,v:mean(resampled.map(r=>r[i].v))});
  }
  const byCorner={};for(const d of dispAtS){if(d.corner){if(!byCorner[d.corner])byCorner[d.corner]={pts:[]};byCorner[d.corner].pts.push(d);}}
  const result={};for(const[c,o]of Object.entries(byCorner)){const apex=o.pts.reduce((a,b)=>b.v<a.v?b:a);result[c]=+apex.disp.toFixed(2);}
  return result;
}

function idealLap(laps,nSectors=12){
  const perLap=laps.map(L=>{const fr=withCurviDist(L.frames),total=fr[fr.length-1].s,segLen=total/nSectors;
    const times=new Array(nSectors).fill(0);
    for(let i=1;i<fr.length;i++){const sec=Math.min(nSectors-1,Math.floor(fr[i].s/segLen));times[sec]+=(fr[i].elapsed_ms-fr[i-1].elapsed_ms)/1000;}
    return{lap:L.lap,times,total:(fr[fr.length-1].elapsed_ms-fr[0].elapsed_ms)/1000};});
  const bestPerSector=[];for(let s=0;s<nSectors;s++){let best=Infinity;for(const pl of perLap)if(pl.times[s]<best)best=pl.times[s];bestPerSector.push(best);}
  const idealTime=bestPerSector.reduce((a,b)=>a+b,0);
  const realBest=perLap.reduce((a,b)=>b.total<a.total?b:a);
  const loss=realBest.times.map((t,s)=>t-bestPerSector[s]);
  const totalLoss=loss.reduce((a,b)=>a+Math.max(0,b),0);
  const lossPct=loss.map(l=>totalLoss>0?+(100*Math.max(0,l)/totalLoss).toFixed(0):0);
  return{idealTime:+idealTime.toFixed(2),realBest:+realBest.total.toFixed(2),gap:+(realBest.total-idealTime).toFixed(2),
    bestLap:realBest.lap,lossBySector:lossPct,worstSector:lossPct.indexOf(Math.max(...lossPct))};
}

function sessionDrift(laps){
  const times=laps.map(L=>({lap:L.lap,t:(L.frames[L.frames.length-1].elapsed_ms-L.frames[0].elapsed_ms)/1000}));
  let improvingUntil=times[0].lap;for(let i=1;i<times.length;i++)if(times[i].t<times[i-1].t-0.02)improvingUntil=times[i].lap;
  return{lapTimes:times.map(x=>+x.t.toFixed(2)),improvingUntil};
}

function flowCoherence(laps){
  const perLap=laps.map(L=>{const fr=L.frames;let jerkSum=0,nj=0;
    for(let i=1;i<fr.length;i++){if(fr[i].lap!==fr[i-1].lap)continue;const dt=(fr[i].elapsed_ms-fr[i-1].elapsed_ms)/1000||0.04;
      const jx=(fr[i].g_force_x-fr[i-1].g_force_x)/dt,jy=(fr[i].g_force_y-fr[i-1].g_force_y)/dt;jerkSum+=Math.sqrt(jx*jx+jy*jy);nj++;}
    return{lap:L.lap,jerk:jerkSum/nj,t:(fr[fr.length-1].elapsed_ms-fr[0].elapsed_ms)/1000};});
  const js=perLap.map(p=>p.jerk),ts=perLap.map(p=>p.t),mj=mean(js),mt=mean(ts);
  const cov=mean(perLap.map(p=>(p.jerk-mj)*(p.t-mt)));const r=cov/((stddev(js)||1)*(stddev(ts)||1));
  return{perLap:perLap.map(p=>({lap:p.lap,jerk:+p.jerk.toFixed(2),t:+p.t.toFixed(2)})),corr:+r.toFixed(2),
    smoothestLap:perLap.reduce((a,b)=>b.jerk<a.jerk?b:a).lap,fastestLap:perLap.reduce((a,b)=>b.t<a.t?b:a).lap};
}

// 4.4 équilibre — CORRECTIF : yaw géométrique avec le bon signe (gauche=+, comme rotation_z).
// rotation_z (gyro) : positif = yaw selon convention capteur. La trajectoire tourne dans le sens
// du changement de cap : yawGeom = d(heading)/dt. Les deux doivent être dans le même repère.
function chassisBalance(laps){
  const byCorner={};
  for(const L of laps){const fr=L.frames;
    for(let i=2;i<fr.length-1;i++){const f=fr[i];if(!f.corner)continue;if(f.lap!==fr[i-1].lap)continue;
      const dt=(f.elapsed_ms-fr[i-1].elapsed_ms)/1000||0.04;
      const yawGeom=angDiff(f.heading,fr[i-1].heading)/dt;
      const yawReal=f.rotation_z;
      if(Math.abs(f.g_force_y)<0.4||Math.abs(yawGeom)<3)continue;
      // ratio dans le repère commun ; on aligne les signes via le signe du yawGeom
      const ecart=(Math.abs(yawReal)-Math.abs(yawGeom))/Math.abs(yawGeom);
      if(!byCorner[f.corner])byCorner[f.corner]=[];byCorner[f.corner].push(ecart);}}
  const result={};for(const[c,arr]of Object.entries(byCorner)){
    const s=arr.slice().sort((a,b)=>a-b);const t=s.slice(Math.floor(s.length*0.15),Math.ceil(s.length*0.85));
    result[c]=+(100*median(t)).toFixed(0);}
  return result;
}

// 4.5 transfert — CORRECTIF : mesurer la vraie montée du roulis, discriminer par virage
function loadTransfer(laps){
  const byCorner={};
  for(const L of laps){const fr=L.frames;const apex=detectCornersByName(fr);
    for(const ci of apex){const f=fr[ci];if(!f.corner)continue;
      // fenêtre d'entrée : jusqu'à 2.5s (62 frames) avant l'apex, on cherche le début de prise d'appui
      const lookback=Math.max(0,ci-62);
      // entrée = première frame (en partant de lookback) où |g_lat| franchit 0.25g vers le haut
      let entry=lookback;for(let j=lookback;j<ci;j++){if(Math.abs(fr[j].g_force_y)>0.25){entry=j;break;}}
      // pic de vitesse de roulis entre entrée et apex
      let peak=entry,pv=0;for(let j=entry;j<=ci;j++){const rx=Math.abs(fr[j].rotation_x);if(rx>pv){pv=rx;peak=j;}}
      if(pv<1)continue; // pas de roulis exploitable
      // stabilisation = |roll| redescend sous 40% du pic après le pic
      let settle=peak;while(settle<ci&&Math.abs(fr[settle].rotation_x)>pv*0.4)settle++;
      const dt=(fr[settle].elapsed_ms-fr[entry].elapsed_ms)/1000;
      if(dt>0.04&&dt<2.5){if(!byCorner[f.corner])byCorner[f.corner]=[];byCorner[f.corner].push(dt);}}}
  const result={};for(const[c,arr]of Object.entries(byCorner))result[c]=+median(arr).toFixed(2);
  return result;
}

export function computeAllInsights(frames){
  const laps=groupByLap(frames);
  const refLapRaw=laps[laps.length-1].frames;
  const refLap=withCurviDist(refLapRaw);
  const apex=detectCornersByName(refLap);
  return { nLaps:laps.length, nFrames:frames.length,
    anatomy:anatomy(refLap,apex), gg:ggEnvelope(frames),
    dispersion:trajectoryDispersion(laps), ideal:idealLap(laps),
    drift:sessionDrift(laps), flow:flowCoherence(laps),
    balance:chassisBalance(laps), loadTransfer:loadTransfer(laps) };
}

if(import.meta.url===`file://${process.argv[1]}`){
  const {generateSession}=await import('./synth.mjs');
  const {frames}=generateSession(6);
  const ins=computeAllInsights(frames);
  console.log('ANATOMIE:',JSON.stringify(ins.anatomy));
  console.log('G-G:',JSON.stringify(ins.gg));
  console.log('DISPERSION:',JSON.stringify(ins.dispersion));
  console.log('IDEAL:',JSON.stringify(ins.ideal));
  console.log('DRIFT:',JSON.stringify(ins.drift));
  console.log('FLOW:',JSON.stringify(ins.flow));
  console.log('BALANCE (+surv/-sous):',JSON.stringify(ins.balance));
  console.log('TRANSFERT:',JSON.stringify(ins.loadTransfer));
}

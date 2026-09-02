// @ts-nocheck — Deno runtime
// Edge Function : compute-session-insights-v3 (moteur mirror-insights-v3 + modules RaceBox rb-1)
//
// DÉPLOYÉE EN PARALLÈLE de compute-session-insights (v1, live) : la live reste INTACTE.
//
// AJOUT rb-1 (additif, protégé) : remplit throttle_brake / flow_coherence / gg_envelope /
//   load_transfer DÈS QUE des frames RaceBox existent. Auto-calibration des axes
//   (vertical = gravité, longitudinal = corr. avec dV/dt, lacet = corr. avec dCap/dt) +
//   détection d'unités (g vs m/s², deg/s vs rad/s). Calculé sur la fenêtre du MEILLEUR TOUR.
//   Chaque module est protégé : en cas d'échec ou de frames insuffisantes, le champ reste {}
//   (le reste du moteur v3 — anatomy, références, ideal_lap, data_quality — est INCHANGÉ).
//
// Doctrine : FAITS uniquement. La lecture causale appartient à l'espace coach.
// verify_jwt = true.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ENGINE_VERSION = 'mirror-insights-v3';
const MODULES_ENGINE = 'rb-1';
const G = 9.81;
const WARMUP_SLOWER_PCT = 0.07;
const COAST_LONG_G = 0.10;   // |G_long| sous ce seuil = ni accélération ni freinage
const COAST_COMB_G = 0.15;   // ET force totale faible = vraie roue libre
const FRAME_CAP = 8000;      // borne de sécurité sur le nombre de frames lues

function distanceBetweenSpeeds(vFromKmh, vToKmh, gAbs) {
  if (!gAbs || gAbs <= 0) return 0;
  const vFrom = vFromKmh / 3.6, vTo = vToKmh / 3.6;
  return Math.round(Math.abs(vFrom * vFrom - vTo * vTo) / (2 * gAbs * G));
}
function num(v, dflt = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : dflt;
}
function deriveCondition(w) {
  if (!w) return 'unknown';
  const s = String(w).toLowerCase();
  if (/(pluie|humid|wet|mouill)/.test(s)) return 'wet';
  if (s.trim().length > 0) return 'dry';
  return 'unknown';
}

// ---------- Coeur de calcul rb-1 (validé hors-ligne sur frames synthétiques) ----------
function mean(a){let s=0,n=0;for(const x of a){if(Number.isFinite(x)){s+=x;n++;}}return n?s/n:0;}
function median(a){const b=a.filter(Number.isFinite).slice().sort((x,y)=>x-y);if(!b.length)return 0;const m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2;}
function corr(a,b){const n=Math.min(a.length,b.length);if(n<3)return 0;let ma=0,mb=0,k=0;for(let i=0;i<n;i++){if(Number.isFinite(a[i])&&Number.isFinite(b[i])){ma+=a[i];mb+=b[i];k++;}}if(k<3)return 0;ma/=k;mb/=k;let sab=0,saa=0,sbb=0;for(let i=0;i<n;i++){if(Number.isFinite(a[i])&&Number.isFinite(b[i])){const da=a[i]-ma,db=b[i]-mb;sab+=da*db;saa+=da*da;sbb+=db*db;}}if(saa<=0||sbb<=0)return 0;return sab/Math.sqrt(saa*sbb);}
function slope(x,y){const n=Math.min(x.length,y.length);let mx=0,my=0,k=0;for(let i=0;i<n;i++){if(Number.isFinite(x[i])&&Number.isFinite(y[i])){mx+=x[i];my+=y[i];k++;}}if(k<3)return 0;mx/=k;my/=k;let sxy=0,sxx=0;for(let i=0;i<n;i++){if(Number.isFinite(x[i])&&Number.isFinite(y[i])){sxy+=(x[i]-mx)*(y[i]-my);sxx+=(x[i]-mx)*(x[i]-mx);}}return sxx>0?sxy/sxx:0;}
function wrapDeg(d){while(d>180)d-=360;while(d<-180)d+=360;return d;}
function deriv(v,t){const n=v.length,out=new Array(n).fill(0);for(let i=0;i<n;i++){const i0=Math.max(0,i-1),i1=Math.min(n-1,i+1);const dt=t[i1]-t[i0];out[i]=dt>0?(v[i1]-v[i0])/dt:0;}return out;}
function derivHeading(h,t){const n=h.length,out=new Array(n).fill(0);for(let i=0;i<n;i++){const i0=Math.max(0,i-1),i1=Math.min(n-1,i+1);const dt=t[i1]-t[i0];out[i]=dt>0?wrapDeg(h[i1]-h[i0])/dt:0;}return out;}

function calibrateAxes(F){
  const {t,v,ax,ay,az,rx,ry,rz,hdg}=F;
  const accel=[ax,ay,az],rot=[rx,ry,rz];
  const means=accel.map(mean);
  let vertIdx=0;for(let i=1;i<3;i++){if(Math.abs(means[i])>Math.abs(means[vertIdx]))vertIdx=i;}
  const vmean=Math.abs(means[vertIdx]);
  const accelToG=vmean>4?1/G:1;
  const dvdt=deriv(v,t).map(x=>x/G);
  let longIdx=-1,bestC=-1,signLong=1;
  for(let i=0;i<3;i++){if(i===vertIdx)continue;const c=corr(accel[i],dvdt);if(Math.abs(c)>bestC){bestC=Math.abs(c);longIdx=i;signLong=c>=0?1:-1;}}
  if(longIdx<0)longIdx=(vertIdx===0?1:0);
  let latIdx=-1;for(let i=0;i<3;i++){if(i!==vertIdx&&i!==longIdx){latIdx=i;break;}}
  if(latIdx<0)latIdx=(vertIdx===2?(longIdx===0?1:0):2);
  const dhdt=derivHeading(hdg,t);
  const cLat=corr(accel[latIdx],dhdt);const signLat=cLat>=0?1:-1;
  let yawIdx=-1,bestY=-1,signYaw=1;
  for(let i=0;i<3;i++){const c=corr(rot[i],dhdt);if(Math.abs(c)>bestY){bestY=Math.abs(c);yawIdx=i;signYaw=c>=0?1:-1;}}
  if(yawIdx<0)yawIdx=2;
  const kYaw=Math.abs(slope(rot[yawIdx],dhdt));
  const rotToDegs=kYaw>10?(180/Math.PI):1;
  return {longIdx,latIdx,vertIdx,signLong,signLat,accelToG,yawIdx,signYaw,rotToDegs,
    conf:{long:Number(bestC.toFixed(2)),yaw:Number(bestY.toFixed(2)),vertical_mean_g:Number((vmean*accelToG).toFixed(2))}};
}
function channels(F,cal){
  const accel=[F.ax,F.ay,F.az],rot=[F.rx,F.ry,F.rz];const n=F.t.length;
  const gLong=new Array(n),gLat=new Array(n),gComb=new Array(n),yaw=new Array(n);
  for(let i=0;i<n;i++){
    gLong[i]=accel[cal.longIdx][i]*cal.signLong*cal.accelToG;
    gLat[i]=accel[cal.latIdx][i]*cal.signLat*cal.accelToG;
    gComb[i]=Math.hypot(gLong[i],gLat[i]);
    yaw[i]=rot[cal.yawIdx][i]*cal.signYaw*cal.rotToDegs;
  }
  return {gLong,gLat,gComb,yaw};
}
function detectApexes(t,v){
  const n=v.length;if(n<5)return [];const thr=median(v)*0.92;const apex=[];let i=0;
  while(i<n){if(v[i]<thr){let j=i,minV=v[i],minIdx=i;while(j<n&&v[j]<thr){if(v[j]<minV){minV=v[j];minIdx=j;}j++;}apex.push({t:t[minIdx],v:minV});i=j;}else i++;}
  return apex;
}
function nearestCorner(apex,tt){if(!apex||!apex.length)return null;let bi=0,bd=Infinity;for(let k=0;k<apex.length;k++){const d=Math.abs(apex[k].t-tt);if(d<bd){bd=d;bi=k;}}return bi+1;}

function throttleBrake(F,ch,apex){
  const t=F.t,n=t.length;if(n<3)return {};
  const cls=new Array(n);
  for(let i=0;i<n;i++){const a=ch.gLong[i],comb=ch.gComb[i];let c;if(a>COAST_LONG_G)c='a';else if(a<-COAST_LONG_G)c='b';else c=(comb<COAST_COMB_G?'c':'b');cls[i]=c;}
  let coastS=0;for(let i=0;i<n;i++){const i0=Math.max(0,i-1),i1=Math.min(n-1,i+1);const dt=(t[i1]-t[i0])/2;if(cls[i]==='c')coastS+=dt;}
  let bestLen=0,bestStart=0,curStart=0,curLen=0,inC=false;
  for(let i=0;i<n;i++){if(cls[i]==='c'){if(!inC){inC=true;curStart=t[i];curLen=0;}curLen=t[i]-curStart;}else{if(inC){if(curLen>bestLen){bestLen=curLen;bestStart=curStart;}inC=false;}}}
  if(inC&&curLen>bestLen){bestLen=curLen;bestStart=curStart;}
  const lapDur=t[n-1]-t[0];const M=Math.min(50,n);const phases=[];
  for(let k=0;k<M;k++){phases.push(cls[Math.floor(k*(n-1)/(M-1))]);}
  return {coasting_s:Number(coastS.toFixed(2)),coasting_pct:lapDur>0?Number((100*coastS/lapDur).toFixed(1)):0,
    longest_zone:{t_start_s:Number(bestStart.toFixed(2)),dur_s:Number(bestLen.toFixed(2)),corner_index:nearestCorner(apex,bestStart+bestLen/2)},
    phases,threshold_g:COAST_LONG_G};
}
function flowCoherence(F,ch,apex){
  const t=F.t,n=t.length;if(n<4)return {};
  const jerk=deriv(ch.gComb,t);
  let svj=0;for(let i=0;i<n;i++){const i0=Math.max(0,i-1),i1=Math.min(n-1,i+1);const dt=(t[i1]-t[i0])/2;svj+=Math.abs(jerk[i])*dt;}
  const absj=jerk.map(Math.abs).filter(Number.isFinite).sort((a,b)=>a-b);
  const p95=absj.length?absj[Math.floor(0.95*(absj.length-1))]:0;
  let hi=0,hv=-1;for(let i=0;i<n;i++){if(Math.abs(jerk[i])>hv){hv=Math.abs(jerk[i]);hi=i;}}
  return {svj:Number(svj.toFixed(2)),jerk_mean:Number(mean(jerk.map(Math.abs)).toFixed(2)),jerk_p95:Number(p95.toFixed(2)),
    harshest:{t_s:Number(t[hi].toFixed(2)),corner_index:nearestCorner(apex,t[hi])},n};
}
function ggEnvelope(F,ch,segments){
  const n=F.t.length;let gl=0,gb=0,ga=0,gc=0;
  for(let i=0;i<n;i++){const lat=Math.abs(ch.gLat[i]);if(lat>gl)gl=lat;const lo=ch.gLong[i];if(lo<0&&-lo>gb)gb=-lo;if(lo>0&&lo>ga)ga=lo;if(ch.gComb[i]>gc)gc=ch.gComb[i];}
  const maxSegGlat=(segments||[]).reduce((m,s)=>{const g=Number(s.g_lat_apex!=null?s.g_lat_apex:s.max_g_lateral)||0;return g>m?g:m;},0);
  const refG=Math.max(gl,maxSegGlat,0.1);
  const corners=(segments||[]).map(s=>{
    const apexKmh=Number(s.apex_speed_kmh)||0;const gLatApex=Number(s.g_lat_apex!=null?s.g_lat_apex:s.max_g_lateral)||0;
    if(apexKmh<=0||gLatApex<=0)return {corner_index:Number(s.corner_index!=null?s.corner_index:s.segment_index)||0,apex_kmh:apexKmh};
    const vms=apexKmh/3.6;const R=(vms*vms)/(gLatApex*G);const vTheo=Math.sqrt(refG*R*G)*3.6;
    return {corner_index:Number(s.corner_index!=null?s.corner_index:s.segment_index)||0,apex_kmh:Number(apexKmh.toFixed(1)),g_lat:Number(gLatApex.toFixed(2)),R_m:Number(R.toFixed(0)),v_theo_kmh:Number(vTheo.toFixed(0)),delta_kmh:Number((vTheo-apexKmh).toFixed(0))};
  });
  return {g_lat_max:Number(gl.toFixed(2)),g_brake_max:Number(gb.toFixed(2)),g_accel_max:Number(ga.toFixed(2)),g_comb_max:Number(gc.toFixed(2)),ref_g:Number(refG.toFixed(2)),corners};
}
function loadTransfer(F,ch,apex){
  const t=F.t,n=t.length;if(n<4)return {};
  let yawMax=0;for(let i=0;i<n;i++){const a=Math.abs(ch.yaw[i]);if(a>yawMax)yawMax=a;}
  const extr=[];
  for(let i=2;i<n-2;i++){const g=ch.gLat[i];
    if(Math.abs(g)>0.30&&Math.abs(g)>=Math.abs(ch.gLat[i-1])&&Math.abs(g)>=Math.abs(ch.gLat[i+1])&&Math.abs(g)>Math.abs(ch.gLat[i-2])&&Math.abs(g)>Math.abs(ch.gLat[i+2])){
      const s=g>0?1:-1;const last=extr[extr.length-1];if(!last||last.sign!==s||t[i]-last.t>0.6){extr.push({t:t[i],sign:s});}}}
  const transitions=[];
  for(let k=1;k<extr.length;k++){if(extr[k].sign!==extr[k-1].sign){const dt=extr[k].t-extr[k-1].t;if(dt>0&&dt<3.0){transitions.push({t_s:Number(extr[k-1].t.toFixed(2)),switch_time_s:Number(dt.toFixed(2)),corner_from:nearestCorner(apex,extr[k-1].t),corner_to:nearestCorner(apex,extr[k].t)});}}}
  return {yaw_rate_max_degs:Number(yawMax.toFixed(0)),transitions};
}
function buildF(frames){
  const t=[],v=[],ax=[],ay=[],az=[],rx=[],ry=[],rz=[],hdg=[];
  for(const f of frames){
    t.push(num(f.elapsed_ms)/1000);
    v.push(f.speed_ms!=null?num(f.speed_ms):num(f.speed_kmh)/3.6);
    ax.push(num(f.g_force_x));ay.push(num(f.g_force_y));az.push(num(f.g_force_z));
    rx.push(num(f.rotation_x));ry.push(num(f.rotation_y));rz.push(num(f.rotation_z));
    hdg.push(num(f.heading));
  }
  return {t,v,ax,ay,az,rx,ry,rz,hdg};
}
async function fetchFrames(supabase, sessionId, loMs, hiMs, cap){
  const page=1000;let from=0;const out=[];
  while(out.length<cap){
    let q=supabase.from('telemetry_frames')
      .select('elapsed_ms,speed_ms,speed_kmh,g_force_x,g_force_y,g_force_z,rotation_x,rotation_y,rotation_z,heading,fix_valid')
      .eq('session_id',sessionId).order('elapsed_ms',{ascending:true}).range(from,from+page-1);
    if(loMs!=null)q=q.gte('elapsed_ms',loMs);
    if(hiMs!=null)q=q.lte('elapsed_ms',hiMs);
    const {data,error}=await q;
    if(error||!data||!data.length)break;
    for(const r of data)out.push(r);
    if(data.length<page)break;
    from+=page;
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return new Response(JSON.stringify({ error: 'sessionId requis' }), { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    );

    const { data: session } = await supabase
      .from('telemetry_sessions')
      .select('id, user_id, circuit_id, vehicle_id, weather, started_at')
      .eq('id', sessionId)
      .maybeSingle();
    if (!session) return new Response(JSON.stringify({ error: 'session_not_found' }), { status: 404 });

    const condition = deriveCondition(session.weather);

    // 1) Anatomy (1 segment = 1 virage).
    const { data: segRows } = await supabase
      .from('app_segment_analyses')
      .select('segment_index, apex_speed_kmh, entry_speed_kmh, min_speed_kmh, exit_speed_kmh, max_g_lateral, max_g_braking, max_g_accel, margin_percent')
      .eq('telemetry_session_id', sessionId)
      .order('segment_index', { ascending: true });

    const anatomy = (segRows ?? []).map((s) => ({
      corner_index: num(s.segment_index),
      apex_speed_kmh: s.apex_speed_kmh != null ? Number(num(s.apex_speed_kmh).toFixed(1)) : 0,
      brake_dist_m: distanceBetweenSpeeds(num(s.entry_speed_kmh), num(s.min_speed_kmh), num(s.max_g_braking)),
      accel_dist_m: distanceBetweenSpeeds(num(s.exit_speed_kmh), num(s.min_speed_kmh), num(s.max_g_accel)),
      g_lat_apex: Number(num(s.max_g_lateral).toFixed(2)),
    }));

    // 2) Tours + classification.
    const { data: lapRows } = await supabase
      .from('laps')
      .select('lap_number, duration_seconds, is_outlap, is_inlap, is_best_lap, started_at, ended_at')
      .eq('session_id', sessionId)
      .order('lap_number', { ascending: true });

    const laps = (lapRows ?? []).map((l) => ({
      n: num(l.lap_number), t: num(l.duration_seconds), out: !!l.is_outlap, in: !!l.is_inlap,
    }));

    const hotCandidates = laps.filter((l) => !l.out && !l.in && l.t > 0);
    const bestHot = hotCandidates.length ? Math.min(...hotCandidates.map((l) => l.t)) : 0;
    const hotIdx = hotCandidates.map((l) => l.n);
    const firstHot = hotIdx.length ? Math.min(...hotIdx) : null;
    const lastHot = hotIdx.length ? Math.max(...hotIdx) : null;

    const lap_classification = laps.map((l) => {
      let cls = 'hot_valid';
      if (l.out) cls = 'out_lap';
      else if (l.in) cls = 'in_lap';
      else if (l.t > 0 && bestHot > 0 && l.t > bestHot * (1 + WARMUP_SLOWER_PCT) && (l.n === firstHot || l.n === lastHot)) cls = 'warmup_cooldown';
      return { lap_index: l.n, class: cls, off_track: false, valid_for_count: cls === 'hot_valid', lap_time_s: l.t > 0 ? Number(l.t.toFixed(3)) : null };
    });

    const validLaps = lap_classification.filter((l) => l.valid_for_count);
    const warmupLaps = lap_classification.filter((l) => l.class === 'warmup_cooldown');
    const warmup = { n_laps: warmupLaps.length, lap_indexes: warmupLaps.map((l) => l.lap_index) };

    // 3) Références.
    let bestOfDay = null;
    if (validLaps.length) {
      const b = validLaps.reduce((m, l) => (l.lap_time_s < m.lap_time_s ? l : m), validLaps[0]);
      bestOfDay = { lap_index: b.lap_index, lap_time_s: b.lap_time_s };
    }

    let recordTime = null;
    let recordScope = { circuit: true, vehicle: false, condition: null };
    if (session.circuit_id) {
      const { data: hist } = await supabase
        .from('telemetry_sessions').select('id, vehicle_id, weather')
        .eq('user_id', session.user_id).eq('circuit_id', session.circuit_id);
      const vehKnown = session.vehicle_id != null;
      const condKnown = condition === 'dry' || condition === 'wet';
      const comparable = (hist ?? []).filter((h) => {
        if (vehKnown && h.vehicle_id !== session.vehicle_id) return false;
        if (condKnown && deriveCondition(h.weather) !== condition) return false;
        return true;
      });
      recordScope = { circuit: true, vehicle: vehKnown, condition: condKnown ? condition : null };
      const ids = comparable.map((h) => h.id);
      if (ids.length) {
        const { data: histLaps } = await supabase.from('laps').select('duration_seconds, is_outlap, is_inlap').in('session_id', ids);
        const v = (histLaps ?? []).filter((l) => !l.is_outlap && !l.is_inlap && num(l.duration_seconds) > 0).map((l) => num(l.duration_seconds));
        if (v.length) recordTime = Number(Math.min(...v).toFixed(3));
      }
    }
    const reference_laps = {
      best_of_day: bestOfDay,
      personal_record: recordTime != null ? { lap_time_s: recordTime, scope: recordScope } : null,
    };

    // LA FORME À PLAT EST ÉCRITE EN PLUS DE LA FORME IMBRIQUÉE — décision du
    // fondateur du 02/09/2026, et elle lève une exclusion structurelle.
    //
    // `session_insights` porte UNIQUE (telemetry_session_id) : une ligne par
    // séance. v1 et v3 font toutes deux `delete` puis `insert` sur cette clé,
    // donc la seconde efface la première, intégralement. Or les deux écrivaient
    // `ideal_lap` sous deux formes différentes :
    //
    //     v1   { ideal_time_s, real_best_s, … }              À PLAT
    //     v3   { theoretical_day, theoretical_record }       IMBRIQUÉE
    //
    // et `chronosLisibles` (`src/components/insights/disponibilite.ts`) n'ouvre
    // « Potentiel démontré » que sur la forme À PLAT. Conséquence mesurée :
    // v3 ouvrait les quatre lectures de modules et FERMAIT le potentiel ; v1
    // faisait l'inverse. Aucun ordre d'appel ne donnait les deux.
    //
    // Les champs à plat portent le POTENTIEL DU JOUR — le meilleur tour réel de
    // la séance, ce que v1 calculait. Le potentiel du RECORD reste disponible
    // dans `theoretical_record` : la décision de le montrer un jour n'est pas
    // fermée par ce geste, elle est seulement laissée à plus tard.
    //
    // CE QU'ON N'ÉCRIT PAS. `worst_sector` est OMIS, et `loss_by_sector_pct`
    // reste vide : aucun découpage en secteurs n'est calculé ici. v1 écrivait
    // `worst_sector: 0`, qui nomme un secteur inexistant — l'en-tête de v1 pose
    // pourtant la règle en toutes lettres, « l'absence n'est pas un zéro ». La
    // vue le supporte : elle lit `loss_by_sector_pct ?? []` et ne rend rien.
    const potentielDuJour = bestOfDay
      ? {
          ideal_time_s: bestOfDay.lap_time_s,
          real_best_s: bestOfDay.lap_time_s,
          gap_s: 0,
          best_lap: bestOfDay.lap_index,
          loss_by_sector_pct: [],
          sector_sources: [],
        }
      : null;

    const ideal_lap = (bestOfDay || recordTime != null) ? {
      // À plat, et seulement quand le tour du jour existe : sans lui, le
      // portillon doit rester fermé plutôt que de présenter un record comme
      // s'il était la séance.
      ...(potentielDuJour ?? {}),
      theoretical_day: potentielDuJour,
      theoretical_record: recordTime != null ? { ideal_time_s: recordTime, real_best_s: recordTime, gap_s: 0, sector_sources: [] } : null,
    } : null;

    // 4) Fiabilité (frames).
    const { count: frameCount } = await supabase
      .from('telemetry_frames').select('id', { count: 'exact', head: true }).eq('session_id', sessionId);
    const { count: validCount } = await supabase
      .from('telemetry_frames').select('id', { count: 'exact', head: true }).eq('session_id', sessionId).eq('fix_valid', true);
    const frames = Math.max(0, frameCount ?? 0);
    const valid = validCount != null ? Math.max(0, validCount) : frames;
    const data_quality = {
      frames_used: frames,
      frames_dropped: Math.max(0, frames - valid),
      pct_valid: frames > 0 ? Math.round((valid / frames) * 100) : 0,
      corners_detected: anatomy.length,
      laps_total: laps.length,
      laps_valid: validLaps.length,
    };

    // 5) ===== Modules RaceBox rb-1 (additifs, protégés) =====
    let throttle_brake = {}, flow_coherence = {}, gg_envelope = {}, load_transfer = {};
    let modulesMeta = { engine: MODULES_ENGINE, state: 'no_frames' };
    try {
      if (frames > 0) {
        let loMs = null, hiMs = null, frameWindow = 'session_capped';
        const bestRow = (lapRows ?? []).find((l) => bestOfDay && num(l.lap_number) === bestOfDay.lap_index);
        if (bestRow && bestRow.started_at && session.started_at) {
          const off = new Date(bestRow.started_at).getTime() - new Date(session.started_at).getTime();
          const dur = num(bestRow.duration_seconds) * 1000;
          if (off >= 0 && dur > 0) { loMs = Math.max(0, off - 500); hiMs = off + dur + 500; frameWindow = 'best_lap'; }
        }
        const fr = await fetchFrames(supabase, sessionId, loMs, hiMs, FRAME_CAP);
        if (fr.length >= 50) {
          const F = buildF(fr);
          const cal = calibrateAxes(F);
          const ch = channels(F, cal);
          const apex = detectApexes(F.t, F.v);
          const segForGg = anatomy.map((a) => ({ corner_index: a.corner_index, apex_speed_kmh: a.apex_speed_kmh, g_lat_apex: a.g_lat_apex }));
          throttle_brake = throttleBrake(F, ch, apex) || {};
          flow_coherence = flowCoherence(F, ch, apex) || {};
          gg_envelope = ggEnvelope(F, ch, segForGg) || {};
          load_transfer = loadTransfer(F, ch, apex) || {};
          modulesMeta = {
            engine: MODULES_ENGINE, state: 'ok', frames_window: frameWindow, frames_in_window: fr.length,
            apex_count: apex.length,
            axes: { long: cal.longIdx, lat: cal.latIdx, vert: cal.vertIdx, yaw: cal.yawIdx },
            accel_to_g: Number(cal.accelToG.toFixed(3)), rot_to_degs: Number(cal.rotToDegs.toFixed(2)), confidence: cal.conf,
          };
        } else {
          modulesMeta = { engine: MODULES_ENGINE, state: 'insufficient_frames', frames_in_window: fr.length };
        }
      }
    } catch (mErr) {
      throttle_brake = {}; flow_coherence = {}; gg_envelope = {}; load_transfer = {};
      modulesMeta = { engine: MODULES_ENGINE, state: 'error', detail: (mErr && mErr.message) ? mErr.message : String(mErr) };
    }
    data_quality.modules = modulesMeta;

    const row = {
      telemetry_session_id: sessionId,
      user_id: session.user_id,
      circuit_id: session.circuit_id ?? null,
      condition,
      vehicle_id: session.vehicle_id ?? null,
      engine_version: ENGINE_VERSION,
      computed_at: new Date().toISOString(),
      n_laps: validLaps.length,
      n_frames: frames,
      anatomy,
      lap_classification,
      off_track_events: [],
      warmup,
      reference_laps,
      ideal_lap,
      trajectory: null,
      dispersion: {},
      gg_envelope,
      throttle_brake,
      session_drift: {},
      flow_coherence,
      chassis_balance: {},
      load_transfer,
      data_quality,
    };

    await supabase.from('session_insights').delete().eq('telemetry_session_id', sessionId);
    const { error: insErr } = await supabase.from('session_insights').insert(row);
    if (insErr) return new Response(JSON.stringify({ error: 'persist_failed', detail: insErr.message }), { status: 500 });

    return new Response(JSON.stringify({
      ok: true, engine: ENGINE_VERSION, modules: modulesMeta.state, sessionId,
      condition, vehicle_id: session.vehicle_id ?? null,
      corners: anatomy.length, laps_total: laps.length, laps_valid: validLaps.length,
      warmup: warmup.n_laps, frames,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

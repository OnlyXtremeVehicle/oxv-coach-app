// Génère un tour de circuit synthétique cohérent au format telemetry_frames (25 Hz).
const HZ = 25, DT = 1 / HZ, MU = 1.1, G = 9.81;

const segments = [
  { type:'straight', len:240, vtarget:62 },
  { type:'corner', angle:90,  radius:45, dir:-1, name:'V1' },
  { type:'straight', len:160, vtarget:55 },
  { type:'corner', angle:75,  radius:80, dir:+1, name:'V2' },
  { type:'straight', len:120, vtarget:48 },
  { type:'corner', angle:110, radius:30, dir:-1, name:'V3' },
  { type:'straight', len:200, vtarget:60 },
  { type:'corner', angle:60,  radius:95, dir:+1, name:'V4' },
  { type:'straight', len:90,  vtarget:42 },
  { type:'corner', angle:95,  radius:38, dir:-1, name:'V5' },
  { type:'straight', len:140, vtarget:52 },
  { type:'corner', angle:80,  radius:55, dir:+1, name:'V6' },
  { type:'straight', len:180, vtarget:58 },
];
const cornerSpeed = r => Math.sqrt(MU*G*r);

function buildPath(){
  const pts=[]; let x=0,y=0,heading=0,s=0; const step=2;
  for (const seg of segments){
    if (seg.type==='straight'){
      const n=Math.max(1,Math.round(seg.len/step));
      for(let i=0;i<n;i++){ x+=step*Math.cos(heading); y+=step*Math.sin(heading); s+=step;
        pts.push({s,x,y,heading,curv:0,vmax:seg.vtarget,corner:null}); }
    } else {
      const r=seg.radius, ang=seg.angle*Math.PI/180, dir=seg.dir, vmax=cornerSpeed(r);
      const arc=r*ang, n=Math.max(2,Math.round(arc/step)), dp=ang/n;
      for(let i=0;i<n;i++){ heading+=dir*dp; x+=step*Math.cos(heading); y+=step*Math.sin(heading); s+=step;
        pts.push({s,x,y,heading,curv:dir/r,vmax,corner:seg.name}); }
    }
  }
  return pts;
}
function speedProfile(pts, skill){
  const AB=9.0*skill.brake, AA=5.0*skill.accel;
  const v=pts.map(p=>p.vmax);
  for(let i=pts.length-2;i>=0;i--){ const ds=pts[i+1].s-pts[i].s; v[i]=Math.min(v[i],Math.sqrt(v[i+1]**2+2*AB*ds)); }
  for(let i=1;i<pts.length;i++){ const ds=pts[i].s-pts[i-1].s; v[i]=Math.min(v[i],Math.sqrt(v[i-1]**2+2*AA*ds)); }
  return v;
}

// Échantillonnage robuste : on marche le long de pts par index, en accumulant la distance.
function sampleLap(pts, v, lapIndex, skill, t0){
  const frames=[]; const totalS=pts[pts.length-1].s;
  const lat0=44.50, lon0=-0.20, mLat=111320, mLon=111320*Math.cos(lat0*Math.PI/180);
  let t=0, sPos=0;
  // index courant tel que pts[idx].s <= sPos < pts[idx+1].s
  let idx=0;
  while (sPos < totalS - 0.5){
    // avancer idx
    while (idx<pts.length-2 && pts[idx+1].s<=sPos) idx++;
    const p=pts[idx], pn=pts[idx+1];
    const segLen=Math.max(1e-6, pn.s-p.s);
    const f=Math.min(1,(sPos-p.s)/segLen);
    const x=p.x+(pn.x-p.x)*f, y=p.y+(pn.y-p.y)*f;
    const heading=p.heading+(pn.heading-p.heading)*f;
    const curv=p.curv;
    // vitesse interpolée
    const vi=v[idx]+(v[idx+1]-v[idx])*f;
    const vNext=v[Math.min(idx+1,v.length-1)];
    const gLong=((vNext-vi)/DT)/G;
    const gLat=(vi*vi*curv)/G;
    const yawGeom=(vi*curv)*(180/Math.PI);
    const bal=skill.oversteerByCorner[p.corner] ?? 0;
    const yawReal=yawGeom*(1+bal)+(Math.random()-0.5)*skill.yawNoise;
    const rollRate=gLat*skill.rollGain+(Math.random()-0.5)*2;
    const disp=skill.dispByCorner[p.corner] ?? skill.dispBase;
    const nx=-Math.sin(heading), ny=Math.cos(heading), off=(Math.random()-0.5)*disp;
    const X=x+nx*off, Y=y+ny*off;
    frames.push({
      lap:lapIndex, elapsed_ms:Math.round((t0+t)*1000),
      latitude:+(lat0+Y/mLat).toFixed(7), longitude:+(lon0+X/mLon).toFixed(7),
      speed_ms:+vi.toFixed(3), speed_kmh:+(vi*3.6).toFixed(2),
      heading:+(((heading*180/Math.PI)%360+360)%360).toFixed(2),
      g_force_x:+gLong.toFixed(3), g_force_y:+gLat.toFixed(3),
      g_force_z:+(1+(Math.random()-0.5)*0.05).toFixed(3),
      rotation_x:+rollRate.toFixed(2),
      rotation_y:+((gLong*skill.pitchGain)+(Math.random()-0.5)).toFixed(2),
      rotation_z:+yawReal.toFixed(2),
      yaw_geom:+yawGeom.toFixed(2), corner:p.corner, dist_m:+sPos.toFixed(2),
      fix_valid:true, pdop:1.2, satellites:14, gps_accuracy_m:0.9,
    });
    sPos+=vi*DT; t+=DT;
    if (t>600) break; // garde-fou dur
  }
  return {frames, lapTime:t};
}

export function generateSession(nLaps=6){
  const pts=buildPath();
  const base={ brake:1.0, accel:1.0, yawNoise:3, rollGain:8, pitchGain:6, dispBase:0.5,
    dispByCorner:{V1:0.3,V2:0.7,V3:0.9,V4:1.8,V5:0.6,V6:1.0},
    oversteerByCorner:{V1:0.02,V2:0.05,V3:0.18,V4:0.04,V5:-0.16,V6:0.09} };
  const allFrames=[], lapTimes=[]; let t0=0;
  for(let l=0;l<nLaps;l++){
    const prog=Math.min(1,l/4);
    const skill={...base, brake:base.brake*(0.92+0.08*prog), accel:base.accel*(0.93+0.07*prog)};
    const v=speedProfile(pts, skill);
    const {frames,lapTime}=sampleLap(pts,v,l+1,skill,t0);
    frames.forEach(f=>allFrames.push(f)); lapTimes.push(lapTime); t0+=lapTime;
  }
  return {frames:allFrames, lapTimes, trackLength:pts[pts.length-1].s};
}

if (import.meta.url===`file://${process.argv[1]}`){
  const {frames,lapTimes,trackLength}=generateSession(6);
  console.log('Longueur circuit :', trackLength.toFixed(0),'m');
  console.log('Frames :', frames.length, '(~'+Math.round(frames.length/lapTimes.length)+'/tour)');
  console.log('Tours (s) :', lapTimes.map(t=>t.toFixed(2)).join(', '));
  const mid=frames[Math.floor(frames.length/2)];
  console.log('Frame médiane :', JSON.stringify(mid));
}

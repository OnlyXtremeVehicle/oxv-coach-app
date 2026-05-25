/**
 * Génère une fixture .ubx synthétique pour tester `parseUbxFile` sans
 * device RaceBox physique.
 *
 * Sem 13 J4. Tant que le RaceBox réel n'est pas branché à la chaîne de
 * tests, on crée un fichier UBX binaire valide à partir des `buildDemoTrackVizSamples`
 * du module trackviz. Le checksum Fletcher-8 est calculé pour que chaque
 * trame passe la validation du parser réel.
 *
 * Usage :
 *   npx tsx scripts/generate-fixture-ubx.ts [output_path]
 *
 * Le fichier produit ne doit PAS être commité (taille ~20 ko, non utile
 * en revue). Le `.gitignore` couvre déjà `tests/fixtures/*.ubx`.
 */

import * as fs from 'fs';
import * as path from 'path';

import { buildDemoTrackVizSamples } from '../src/trackviz/analysis';
import { RACEBOX_PROTOCOL } from '../src/types/telemetry';

const OUTPUT = process.argv[2] ?? path.join('tests', 'fixtures', 'demo-session.ubx');

function writeUint32LE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function writeInt32LE(view: DataView, offset: number, value: number): void {
  view.setInt32(offset, value | 0, true);
}

function writeInt16LE(view: DataView, offset: number, value: number): void {
  view.setInt16(offset, value | 0, true);
}

function buildFrame(sample: ReturnType<typeof buildDemoTrackVizSamples>[number]): Uint8Array {
  const payloadSize = RACEBOX_PROTOCOL.RACEBOX_DATA_PAYLOAD_SIZE; // 80
  const totalSize = RACEBOX_PROTOCOL.RACEBOX_DATA_TOTAL_SIZE; // 88
  const frame = new Uint8Array(totalSize);

  frame[0] = RACEBOX_PROTOCOL.UBX_SYNC_1;
  frame[1] = RACEBOX_PROTOCOL.UBX_SYNC_2;
  frame[2] = RACEBOX_PROTOCOL.RACEBOX_CLASS;
  frame[3] = RACEBOX_PROTOCOL.RACEBOX_DATA_ID;
  frame[4] = payloadSize & 0xff;
  frame[5] = (payloadSize >> 8) & 0xff;

  const dv = new DataView(frame.buffer, 6, payloadSize);

  // iTOW (offset 0 du payload, soit offset 6 dans la trame)
  writeUint32LE(dv, 0, sample.elapsed_ms);
  // year/month/day/hour/min/sec : on remplit avec des valeurs cohérentes
  dv.setUint16(4, 2026, true);
  dv.setUint8(6, 5);
  dv.setUint8(7, 25);
  dv.setUint8(8, 14);
  dv.setUint8(9, 30);
  dv.setUint8(10, Math.min(59, Math.floor(sample.elapsed_ms / 1000) % 60));
  // nanoseconds (offset 16)
  writeUint32LE(dv, 16, 0);

  // fix (offset 20)
  dv.setUint8(20, sample.gps_fix);
  // fixStatusFlags (offset 21) — bit 5 = headingValid
  dv.setUint8(21, sample.heading_deg !== null ? 0x20 : 0);
  // dateTimeFlags (offset 22)
  dv.setUint8(22, 0);
  // satellites (offset 23)
  dv.setUint8(23, sample.satellites ?? 0);
  // longitude (offset 24) — int32 LE, deg × 1e7
  writeInt32LE(dv, 24, Math.round(sample.longitude * 1e7));
  // latitude (offset 28)
  writeInt32LE(dv, 28, Math.round(sample.latitude * 1e7));
  // altitude WGS84 (offset 32) — mm
  writeInt32LE(dv, 32, Math.round((sample.altitude_m ?? 0) * 1000));
  // altitude MSL (offset 36)
  writeInt32LE(dv, 36, Math.round((sample.altitude_m ?? 0) * 1000));
  // accuracy horizontal (offset 40) — mm
  writeUint32LE(dv, 40, Math.round((sample.gps_accuracy_m ?? 1) * 1000));
  // accuracy vertical (offset 44)
  writeUint32LE(dv, 44, Math.round((sample.gps_accuracy_m ?? 1) * 1000));
  // speed (offset 48) — mm/s, on convertit depuis km/h
  writeUint32LE(dv, 48, Math.round((sample.speed_kmh / 3.6) * 1000));
  // heading (offset 52) — deg × 1e5
  writeUint32LE(dv, 52, Math.round((sample.heading_deg ?? 0) * 1e5));
  // gForce X/Y/Z (offset 68/70/72) — milli-g
  writeInt16LE(dv, 68, Math.round(sample.g_force_x * 1000));
  writeInt16LE(dv, 70, Math.round(sample.g_force_y * 1000));
  writeInt16LE(dv, 72, Math.round(sample.g_force_z * 1000));
  // rotRate X/Y/Z (offset 74/76/78)
  writeInt16LE(dv, 74, 0);
  writeInt16LE(dv, 76, 0);
  writeInt16LE(dv, 78, 0);
  // battery (offset 67) — bit 7 charging, bits 0..6 niveau
  dv.setUint8(67, (sample.battery_level ?? 80) & 0x7f);

  // Checksum Fletcher-8 sur les octets 2..(2+4+80-1) = 2..85
  let ckA = 0;
  let ckB = 0;
  for (let i = 2; i < 6 + payloadSize; i++) {
    ckA = (ckA + frame[i]) & 0xff;
    ckB = (ckB + ckA) & 0xff;
  }
  frame[86] = ckA;
  frame[87] = ckB;

  return frame;
}

function main(): void {
  const samples = buildDemoTrackVizSamples();
  console.log(`Génération de ${samples.length} trames UBX synthétiques...`);

  const frames: Uint8Array[] = samples.map(buildFrame);
  const totalBytes = frames.reduce((sum, f) => sum + f.length, 0);
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const f of frames) {
    merged.set(f, offset);
    offset += f.length;
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, Buffer.from(merged));

  console.log(`OK → ${OUTPUT}`);
  console.log(`   ${frames.length} trames, ${totalBytes} octets`);
}

main();

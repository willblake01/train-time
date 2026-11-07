// Builds data/schedule.json from Amtrak's GTFS feed.
//
//   npm run build:schedule                         download the official feed
//   npm run build:schedule -- --zip ./GTFS.zip     use a zip you already have
//   npm run build:schedule -- --summary out.md     also write a change summary
//
// Exits with an error, without touching schedule.json, if the feed looks broken.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import {
  ConversionError,
  OPTIONAL_FILES,
  REQUIRED_FILES,
  convertGtfs,
  serializeSchedule,
  summarizeSchedule,
  validateSchedule,
} from './schedule/convert';
import type { Schedule } from '../utils/timetableTypes';

const FEED_URL = process.env.GTFS_URL ?? 'https://content.amtrak.com/content/gtfs/GTFS.zip';
const OUT_PATH = 'data/schedule.json';
const NEEDED = new Set<string>([...REQUIRED_FILES, ...OPTIONAL_FILES]);

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

async function loadZip(): Promise<Uint8Array> {
  const local = arg('--zip');
  if (local) return new Uint8Array(readFileSync(local));
  console.log(`Downloading ${FEED_URL}`);
  const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'train-time schedule builder (https://train-time-rosy.vercel.app)' } });
  if (!res.ok) throw new ConversionError(`Download failed: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function main() {
  const zip = await loadZip();
  // Only unpack the files we use; shapes.txt alone is over 15 MB
  const unzipped = unzipSync(zip, { filter: (file) => NEEDED.has(file.name.split('/').pop() ?? '') });
  const files = Object.fromEntries(Object.entries(unzipped).map(([name, data]) => [name.split('/').pop() ?? name, strFromU8(data)]));

  const schedule = convertGtfs(files);
  const problems = validateSchedule(schedule, new Date().toISOString().slice(0, 10));
  if (problems.length) {
    console.error(`Not updating ${OUT_PATH}. The feed looks wrong:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }

  const previous: Schedule | undefined = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, 'utf8')) : undefined;
  const summary = summarizeSchedule(schedule, previous);
  writeFileSync(OUT_PATH, serializeSchedule(schedule));
  console.log(`Wrote ${OUT_PATH}\n\n${summary}`);

  const summaryPath = arg('--summary');
  if (summaryPath) writeFileSync(summaryPath, summary);
}

main().catch((error) => {
  console.error(error instanceof ConversionError ? `Schedule build failed: ${error.message}` : error);
  process.exit(1);
});

// Fills width, height, duration, type and fingerprint of each entry from ffprobe and the file.
// node scripts/measure.mjs [id…]  (every entry when no id is given)
import { join } from "node:path";
import { fingerprint, pickEntries, probe, readManifest, root, writeManifest } from "./media.mjs";

const manifest = readManifest();
for (const entry of pickEntries(manifest.entries, process.argv.slice(2))) {
  const file = join(root, entry.file);
  const measured = probe(file);
  delete entry.duration;
  Object.assign(entry, measured, { fingerprint: fingerprint(file) });
  console.log(`${entry.id}: ${measured.type} ${measured.width}x${measured.height}${measured.duration ? ` ${measured.duration}s` : ""} ${entry.fingerprint}`);
}
writeManifest(manifest);

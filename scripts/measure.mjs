// Fills width, height, duration and type of each manifest item from ffprobe.
// node scripts/measure.mjs [id…]  (every item when no id is given)
import { join } from "node:path";
import { probe, readManifest, root, writeManifest } from "./media.mjs";

const manifest = readManifest();
const ids = process.argv.slice(2);
const unknown = ids.filter((id) => !manifest.items.some((item) => item.id === id));
if (unknown.length) {
  console.error(`Not in the manifest: ${unknown.join(", ")}`);
  process.exit(1);
}

for (const item of manifest.items) {
  if (ids.length && !ids.includes(item.id)) continue;
  const measured = probe(join(root, item.file));
  delete item.duration;
  Object.assign(item, measured);
  console.log(`${item.id}: ${measured.type} ${measured.width}x${measured.height}${measured.duration ? ` ${measured.duration}s` : ""}`);
}
writeManifest(manifest);

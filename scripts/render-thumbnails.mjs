// Renders thumbnails/<id>.png from each clip at its thumbnailAt, 640x360.
// node scripts/render-thumbnails.mjs [id…]  (every item when no id is given)
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { readManifest, root, thumbnailPath, thumbnailSize, thumbnailsDir } from "./media.mjs";

const { items } = readManifest();
const ids = process.argv.slice(2);
const unknown = ids.filter((id) => !items.some((item) => item.id === id));
if (unknown.length) {
  console.error(`Not in the manifest: ${unknown.join(", ")}`);
  process.exit(1);
}

mkdirSync(thumbnailsDir, { recursive: true });
const { width, height } = thumbnailSize;
for (const item of items) {
  if (ids.length && !ids.includes(item.id)) continue;
  const seek = item.type === "video" ? ["-ss", String(item.thumbnailAt ?? 0)] : [];
  execFileSync("ffmpeg", [
    "-v", "error", "-y",
    ...seek,
    "-i", join(root, item.file),
    "-frames:v", "1",
    "-vf", `scale=${width}:${height}:flags=lanczos`,
    "-map_metadata", "-1",
    thumbnailPath(item.id),
  ]);
  console.log(`thumbnails/${item.id}.png`);
}

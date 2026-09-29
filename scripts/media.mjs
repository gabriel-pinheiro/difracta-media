// What the scripts share: where things are, the manifest's field order, and ffprobe.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const manifestPath = join(root, "manifest.json");
export const clipsDir = join(root, "clips");
export const thumbnailsDir = join(root, "thumbnails");
export const thumbnailSize = { width: 640, height: 360 };

/** Item keys in the order they are written; the measured ones come last. */
export const fieldOrder = [
  "id",
  "name",
  "description",
  "notes",
  "file",
  "type",
  "recommended",
  "loop",
  "hit",
  "beats",
  "firstBeat",
  "thumbnailAt",
  "width",
  "height",
  "duration",
];

export function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

export function writeManifest(manifest) {
  const items = manifest.items.map((item) =>
    Object.fromEntries(fieldOrder.filter((key) => key in item).map((key) => [key, item[key]])),
  );
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, items }, null, 2) + "\n");
}

export const thumbnailPath = (id) => join(thumbnailsDir, `${id}.png`);

/** Width, height, type and, for a video, duration in seconds rounded to milliseconds. */
export function probe(file) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=format_name,duration", "-of", "json", file],
    { encoding: "utf8" },
  );
  const { streams, format } = JSON.parse(out);
  const stream = streams?.[0];
  if (!stream) throw new Error(`${file} has no video stream`);
  const image = /image2|_pipe$/.test(format.format_name);
  const measured = { type: image ? "image" : "video", width: stream.width, height: stream.height };
  if (!image) measured.duration = Math.round(Number(format.duration) * 1000) / 1000;
  return measured;
}

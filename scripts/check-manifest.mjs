// Validates manifest.json against clips/ and thumbnails/; exits 1 listing every problem.
// node scripts/check-manifest.mjs
import { existsSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { clipsDir, fieldOrder, probe, readManifest, root, thumbnailPath, thumbnailSize, thumbnailsDir } from "./media.mjs";

const problems = [];
const problem = (message) => problems.push(message);
const text = (value) => typeof value === "string" && value.trim().length > 0;

const manifest = readManifest();
if (!Number.isInteger(manifest.version) || manifest.version < 1) problem("version must be a positive integer");
if (!Array.isArray(manifest.items)) {
  console.error("manifest.json: items must be an array");
  process.exit(1);
}

const ids = new Set();
const names = new Set();
for (const [index, item] of manifest.items.entries()) {
  const where = `items[${index}]${text(item.id) ? ` (${item.id})` : ""}`;
  for (const key of Object.keys(item)) if (!fieldOrder.includes(key)) problem(`${where}: unknown field "${key}"`);
  for (const key of ["id", "name", "description", "notes", "file"]) if (!text(item[key])) problem(`${where}: ${key} is missing or empty`);
  if (!text(item.id) || !text(item.file)) continue;

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id)) problem(`${where}: id must be lowercase words joined by hyphens`);
  if (ids.has(item.id)) problem(`${where}: id is used twice`);
  ids.add(item.id);
  if (text(item.name)) {
    if (names.has(item.name)) problem(`${where}: name "${item.name}" is used twice`);
    names.add(item.name);
  }
  if (!item.file.startsWith("clips/") || basename(item.file, extname(item.file)) !== item.id)
    problem(`${where}: file must be clips/${item.id}.<ext>, not ${item.file}`);
  for (const flag of ["recommended", "loop", "hit"])
    if (flag in item && item[flag] !== true) problem(`${where}: ${flag} is either true or left out`);

  const file = join(root, item.file);
  if (!existsSync(file)) {
    problem(`${where}: ${item.file} does not exist`);
    continue;
  }
  const measured = probe(file);
  for (const key of ["type", "width", "height"])
    if (item[key] !== measured[key]) problem(`${where}: ${key} is ${item[key]}, ffprobe says ${measured[key]} (run npm run measure)`);
  if (measured.type === "video") {
    if (typeof item.duration !== "number" || Math.abs(item.duration - measured.duration) > 0.01)
      problem(`${where}: duration is ${item.duration}, ffprobe says ${measured.duration} (run npm run measure)`);
    if (typeof item.thumbnailAt !== "number" || item.thumbnailAt < 0 || item.thumbnailAt >= measured.duration)
      problem(`${where}: thumbnailAt must be a time from 0 to below the duration, ${measured.duration}`);
  } else if ("duration" in item) problem(`${where}: an image has no duration`);

  const thumbnail = thumbnailPath(item.id);
  if (!existsSync(thumbnail)) problem(`${where}: thumbnails/${item.id}.png is missing (run npm run thumbnails -- ${item.id})`);
  else {
    const { width, height } = probe(thumbnail);
    if (width !== thumbnailSize.width || height !== thumbnailSize.height)
      problem(`${where}: thumbnails/${item.id}.png is ${width}x${height}, not ${thumbnailSize.width}x${thumbnailSize.height}`);
  }
}

const listed = new Set(manifest.items.map((item) => item.file));
for (const name of readdirSync(clipsDir)) if (!listed.has(`clips/${name}`)) problem(`clips/${name} has no manifest entry`);
if (existsSync(thumbnailsDir))
  for (const name of readdirSync(thumbnailsDir))
    if (!ids.has(basename(name, ".png"))) problem(`thumbnails/${name} belongs to no manifest entry`);

if (problems.length) {
  console.error(`manifest.json has ${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const message of problems) console.error(`- ${message}`);
  process.exit(1);
}
console.log(`manifest.json is valid: ${manifest.items.length} items, version ${manifest.version}.`);

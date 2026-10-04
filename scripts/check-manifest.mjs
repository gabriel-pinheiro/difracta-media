// Validates .difracta/pack.json against clips/, thumbs/ and proxies/; exits 1 listing every problem.
// node scripts/check-manifest.mjs
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  clipsDir, fieldOrder, fingerprint, fingerprintPattern, knownTags, packId, packName, probe, proxiesDir, proxyPath,
  readManifest, root, thumbPath, thumbnailSize, thumbsDir,
} from "./media.mjs";

const problems = [];
const problem = (message) => problems.push(message);
const text = (value) => typeof value === "string" && value.trim().length > 0;

const manifest = readManifest();
for (const key of Object.keys(manifest)) if (!["version", "id", "name", "readOnly", "entries"].includes(key)) problem(`unknown field "${key}"`);
if (manifest.version !== 1) problem("version must be 1");
if (manifest.id !== packId) problem(`id must be "${packId}"`);
if (manifest.name !== packName) problem(`name must be "${packName}"`);
if (manifest.readOnly !== true) problem("readOnly must be true");
if (!Array.isArray(manifest.entries)) {
  console.error("pack.json: entries must be an array");
  process.exit(1);
}

const ids = new Set();
const names = new Set();
const fingerprints = new Set();
for (const [index, entry] of manifest.entries.entries()) {
  const where = `entries[${index}]${text(entry.id) ? ` (${entry.id})` : ""}`;
  for (const key of Object.keys(entry)) if (!fieldOrder.includes(key)) problem(`${where}: unknown field "${key}"`);
  for (const key of ["id", "name", "description", "notes", "file"]) if (!text(entry[key])) problem(`${where}: ${key} is missing or empty`);
  if (!text(entry.id) || !text(entry.file)) continue;

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id)) problem(`${where}: id must be lowercase words joined by hyphens`);
  if (ids.has(entry.id)) problem(`${where}: id is used twice`);
  ids.add(entry.id);
  if (text(entry.name)) {
    if (names.has(entry.name)) problem(`${where}: name "${entry.name}" is used twice`);
    names.add(entry.name);
  }
  if (!/^clips\/[a-z0-9][a-z0-9._-]*$/.test(entry.file)) problem(`${where}: file must be clips/<name>.<ext> in lowercase, not ${entry.file}`);
  if (!Array.isArray(entry.tags) || entry.tags.some((tag) => !text(tag) || tag !== tag.trim()))
    problem(`${where}: tags must be a list of trimmed, non-empty strings (may be empty)`);
  else {
    const folded = entry.tags.map((tag) => tag.toLowerCase());
    if (new Set(folded).size !== folded.length) problem(`${where}: a tag repeats`);
    for (const tag of knownTags) if (entry.tags.includes(tag) && !folded.includes(tag)) problem(`${where}: the tag ${tag} is lowercase`);
    if (entry.tags.includes("loop") && entry.tags.includes("hit")) problem(`${where}: a clip is a loop or a hit, not both`);
  }

  const file = join(root, entry.file);
  if (!existsSync(file)) {
    problem(`${where}: ${entry.file} does not exist`);
    continue;
  }
  const measured = probe(file);
  for (const key of ["type", "width", "height"])
    if (entry[key] !== measured[key]) problem(`${where}: ${key} is ${entry[key]}, ffprobe says ${measured[key]} (run npm run measure)`);
  if (measured.type === "video") {
    if (typeof entry.duration !== "number" || Math.abs(entry.duration - measured.duration) > 0.01)
      problem(`${where}: duration is ${entry.duration}, ffprobe says ${measured.duration} (run npm run measure)`);
    if (typeof entry.thumbnailAt !== "number" || entry.thumbnailAt < 0 || entry.thumbnailAt >= measured.duration)
      problem(`${where}: thumbnailAt must be a time from 0 to below the duration, ${measured.duration}`);
  } else {
    if ("duration" in entry) problem(`${where}: an image has no duration`);
    if ("thumbnailAt" in entry) problem(`${where}: an image has no thumbnailAt`);
  }
  if ("beats" in entry) {
    if (measured.type !== "video") problem(`${where}: only a video has beats`);
    if (typeof entry.beats !== "number" || !(entry.beats > 0)) problem(`${where}: beats must be a number above 0`);
    if (Array.isArray(entry.tags) && entry.tags.includes("hit")) problem(`${where}: a hit has no beats`);
  }
  if ("firstBeat" in entry) {
    if (!("beats" in entry)) problem(`${where}: firstBeat needs beats`);
    if (typeof entry.firstBeat !== "number" || !(entry.firstBeat > 0) || entry.firstBeat >= measured.duration)
      problem(`${where}: firstBeat must be a time above 0 and below the duration, ${measured.duration}; leave it out for 0`);
  }

  if (!text(entry.fingerprint) || !fingerprintPattern.test(entry.fingerprint)) {
    problem(`${where}: fingerprint is missing or malformed (run npm run measure -- ${entry.id})`);
    continue;
  }
  if (entry.fingerprint !== fingerprint(file)) problem(`${where}: fingerprint is ${entry.fingerprint}, the file says ${fingerprint(file)} (run npm run measure -- ${entry.id})`);
  if (fingerprints.has(entry.fingerprint)) problem(`${where}: fingerprint is used twice`);
  fingerprints.add(entry.fingerprint);

  const thumb = thumbPath(entry.fingerprint);
  if (!existsSync(thumb)) problem(`${where}: .difracta/thumbs/${entry.fingerprint}.webp is missing (run npm run bake -- ${entry.id})`);
  else {
    const { width, height } = probe(thumb);
    if (width > thumbnailSize.width || height > thumbnailSize.height || (width < thumbnailSize.width && height < thumbnailSize.height))
      problem(`${where}: the thumbnail is ${width}x${height}, not fitted to ${thumbnailSize.width}x${thumbnailSize.height}`);
  }
  if (measured.type === "video" && !existsSync(proxyPath(entry.fingerprint)))
    problem(`${where}: .difracta/proxies/${entry.fingerprint}.mp4 is missing (run npm run bake -- ${entry.id})`);
}

const listed = new Set(manifest.entries.map((entry) => entry.file));
for (const name of readdirSync(clipsDir)) if (!listed.has(`clips/${name}`)) problem(`clips/${name} has no manifest entry`);
if (existsSync(thumbsDir))
  for (const name of readdirSync(thumbsDir))
    if (!name.endsWith(".webp") || !fingerprints.has(name.slice(0, -5))) problem(`.difracta/thumbs/${name} belongs to no entry`);
if (existsSync(proxiesDir))
  for (const name of readdirSync(proxiesDir))
    if (!name.endsWith(".mp4") || !fingerprints.has(name.slice(0, -4))) problem(`.difracta/proxies/${name} belongs to no entry`);

if (problems.length) {
  console.error(`pack.json has ${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const message of problems) console.error(`- ${message}`);
  process.exit(1);
}
console.log(`pack.json is valid: ${manifest.entries.length} entries, version ${manifest.version}.`);

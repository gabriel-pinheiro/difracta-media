// What the scripts share: where things are, the manifest's field order, the fingerprint, and ffprobe.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const clipsDir = join(root, "clips");
export const packDir = join(root, ".difracta");
export const manifestPath = join(packDir, "pack.json");
export const thumbsDir = join(packDir, "thumbs");
export const proxiesDir = join(packDir, "proxies");

/** The Pack's own fields; the entries' metadata is theirs. */
export const packId = "bundled";
export const packName = "Bundled";

/** Thumbnails fit inside this box, keeping the clip's shape. */
export const thumbnailSize = { width: 640, height: 360 };
/** Proxies are H.264 at most this tall, at this bitrate, with no audio. */
export const proxy = { height: 480, bitrateKbps: 1500 };
/** Difracta reads these three tags; every other tag is free-form. */
export const knownTags = ["recommended", "loop", "hit"];

/** Entry keys in the order they are written; the measured ones come last. */
export const fieldOrder = [
  "id",
  "file",
  "type",
  "name",
  "description",
  "notes",
  "tags",
  "beats",
  "firstBeat",
  "thumbnailAt",
  "fingerprint",
  "width",
  "height",
  "duration",
];

export function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

export function writeManifest(manifest) {
  const entries = manifest.entries.map((entry) =>
    Object.fromEntries(fieldOrder.filter((key) => key in entry).map((key) => [key, entry[key]])),
  );
  const ordered = { version: manifest.version, id: manifest.id, name: manifest.name, readOnly: manifest.readOnly, entries };
  writeFileSync(manifestPath, JSON.stringify(ordered, null, 2) + "\n");
}

export const thumbPath = (fingerprint) => join(thumbsDir, `${fingerprint}.webp`);
export const proxyPath = (fingerprint) => join(proxiesDir, `${fingerprint}.mp4`);

/** How many leading bytes the fingerprint hashes. */
export const fingerprintBytes = 1024 * 1024;
export const fingerprintPattern = /^[0-9a-f]{16}-[0-9a-z]+$/;

/**
 * The fingerprint Difracta keys thumbnails and proxies by: the first sixteen
 * hex characters of the SHA-256 of the file's first 1 MiB (the whole file
 * when shorter), a hyphen, and the file's size in bytes in base 36.
 */
export function fingerprint(file) {
  const { size } = statSync(file);
  const buffer = Buffer.alloc(Math.min(size, fingerprintBytes));
  const fd = openSync(file, "r");
  try {
    let read = 0;
    while (read < buffer.length) {
      const got = readSync(fd, buffer, read, buffer.length - read, read);
      if (got === 0) break;
      read += got;
    }
  } finally {
    closeSync(fd);
  }
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  return `${hash}-${size.toString(36)}`;
}

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
  const image = /image2|_pipe$|^webp/.test(format.format_name);
  const measured = { type: image ? "image" : "video", width: stream.width, height: stream.height };
  if (!image) measured.duration = Math.round(Number(format.duration) * 1000) / 1000;
  return measured;
}

/** The entries `ids` name, every entry when none is given; exits naming ids the manifest lacks. */
export function pickEntries(entries, ids) {
  const unknown = ids.filter((id) => !entries.some((entry) => entry.id === id));
  if (unknown.length) {
    console.error(`Not in the manifest: ${unknown.join(", ")}`);
    process.exit(1);
  }
  return ids.length ? entries.filter((entry) => ids.includes(entry.id)) : entries;
}

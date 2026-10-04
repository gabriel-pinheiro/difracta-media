// Bakes .difracta/thumbs/<fingerprint>.webp for every entry and .difracta/proxies/<fingerprint>.mp4
// for every video, with the settings Difracta's own baker uses, skipping files already there.
// node scripts/bake.mjs [--force] [id…]  (every entry when no id is given)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pickEntries, proxy, proxyPath, readManifest, root, thumbPath, thumbnailSize, thumbsDir, proxiesDir } from "./media.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const { entries } = readManifest();
mkdirSync(thumbsDir, { recursive: true });
mkdirSync(proxiesDir, { recursive: true });

const ffmpeg = (ffmpegArgs) => execFileSync("nice", ["-n", "19", "ffmpeg", "-v", "error", "-y", ...ffmpegArgs]);
const { width, height } = thumbnailSize;
for (const entry of pickEntries(entries, args.filter((arg) => arg !== "--force"))) {
  if (!entry.fingerprint) {
    console.error(`${entry.id}: no fingerprint (run npm run measure -- ${entry.id})`);
    process.exit(1);
  }
  const file = join(root, entry.file);
  const thumb = thumbPath(entry.fingerprint);
  if (force || !existsSync(thumb)) {
    const seek = entry.type === "video" ? ["-ss", String(entry.thumbnailAt ?? 0)] : [];
    ffmpeg([
      ...seek,
      "-i", file,
      "-frames:v", "1",
      "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      "-c:v", "libwebp", "-quality", "80",
      thumb,
    ]);
    console.log(`.difracta/thumbs/${entry.fingerprint}.webp (${entry.id})`);
  }
  if (entry.type !== "video") continue;
  const out = proxyPath(entry.fingerprint);
  if (force || !existsSync(out)) {
    ffmpeg([
      "-i", file,
      "-an",
      "-vf", `scale=-2:'min(${proxy.height},ih)'`,
      "-c:v", "libx264", "-preset", "veryfast", "-b:v", `${proxy.bitrateKbps}k`,
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      out,
    ]);
    console.log(`.difracta/proxies/${entry.fingerprint}.mp4 (${entry.id})`);
  }
}

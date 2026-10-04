# Difracta Media

The Bundled Pack of [Difracta](https://github.com/gabriel-pinheiro/difracta):
short white-on-black video clips for projection mapping, laid out as a Pack
Difracta can read as it is. Difracta pins a release of this repository and
downloads its tarball when it builds, so the clips reach every Installation
without living in Difracta's own history. The Pack is read-only in Difracta: it
is attached to every Installation and its metadata is edited here.

White on black suits a projector: black is no light, so a clip shows only its
white shapes on a Surface. In Difracta a clip plays through the Video Visual; on
an Additive Layer its black adds nothing and the Tint colours the white.

## Layout

A Pack is a folder of images and videos with a `.difracta/` folder holding its
manifest and what Difracta bakes from the files. This repository is one:

- `clips/`: the clips, VP9 WebM, 1920x1080, 30 fps, one to eight seconds each.
- `.difracta/pack.json`: the manifest, one entry per clip.
- `.difracta/thumbs/<fingerprint>.webp`: one frame of each clip at its
  `thumbnailAt`, fitted inside 640x360.
- `.difracta/proxies/<fingerprint>.mp4`: a low-resolution copy of each video
  for hover previews and scrubbing: H.264, at most 480 tall, 1500 kbps, no audio.
- `scripts/`: measuring, baking and checking; Node 24 and `ffmpeg`/`ffprobe`
  on the `PATH`, no packages.

Thumbnails and proxies are keyed by the file's fingerprint, not its id, so
Difracta finds them again after a clip is renamed or moved inside the Pack.

## Manifest

`.difracta/pack.json` is
`{ "version": 1, "id": "bundled", "name": "Bundled", "readOnly": true, "entries": [...] }`.
`version` is the schema version and changes only when the shape of an entry
does. `id` is the Pack's id, which every Installation refers to; `readOnly`
tells Difracta never to write into this Pack. Each entry has:

- `id`: assigned once and never changed, so a Layer keeps working across a
  rename. Here it is the clip's original file name without its extension.
- `file`: the clip's path from the repository root, `clips/<name>.<ext>`.
- `type`: `video` or `image`, measured.
- `name`: a short Title Case name, unique in the manifest.
- `description`: one sentence a person reads while choosing a clip.
- `notes`: a paragraph for whoever composes with it: how it reads on a
  Surface, what to stack it with, when to use it.
- `tags`: a list of free-form words, may be empty. Difracta reads three:
  `recommended` for a good default, `loop` when the clip loops without a
  visible seam, `hit` when it works as a one-shot on a beat. A riser that
  builds into a drop has neither `loop` nor `hit`. Tags are compared
  case-folded; write these three in lowercase.
- `beats`: how many beats the clip lasts, for a video with a steady pulse:
  16 for a four-bar loop. Its tempo is `beats × 60 / duration`, so a 7.5 second
  loop of 16 beats is at 128 BPM. Difracta's Video uses it to follow a song's
  tempo. Left out on a clip without a pulse to follow, and on every hit.
- `firstBeat`: the time in seconds of the first beat, when the clip does not
  start on one; left out for zero. Only with `beats`.
- `thumbnailAt`: the time in seconds of the frame the thumbnail shows; videos
  only.
- `fingerprint`: measured. The first sixteen hex characters of the SHA-256 of
  the file's first 1 MiB (the whole file when shorter), a hyphen, and the
  file's size in bytes in base 36: `3c36ef0ee09c9362-g7jy`. Difracta computes
  the same for every Pack it scans.
- `width`, `height`: in pixels, measured.
- `duration`: in seconds, measured; videos only.

## Scripts

```sh
npm run measure [-- id…]        # width, height, duration, type and fingerprint
npm run bake [-- [--force] id…] # thumbs and proxies for entries lacking them
npm run check                   # validates pack.json against clips/ and .difracta/
```

`measure` rewrites only the measured fields and keeps the hand-written ones.
`bake` skips a thumbnail or proxy already there for the entry's fingerprint;
`--force` renders them again, which a changed `thumbnailAt` needs. It runs
ffmpeg one job at a time at low priority, with the settings Difracta's own
baker uses, so the Pack ships prepared and Difracta never bakes it.

`check` fails when a clip has no entry or an entry no clip, an id or a name
repeats, a field is missing or unknown, `tags` is not a list of trimmed words
or holds both `loop` and `hit`, a measured field or the fingerprint disagrees
with the file, `beats` is on an image or a hit or is not above zero,
`firstBeat` has no `beats` or falls outside the clip, `thumbnailAt` falls
outside the clip, a thumbnail or proxy is missing or a thumbnail is not fitted
to 640x360, or a file in `thumbs/` or `proxies/` belongs to no entry.

## Adding a clip

1. Put the file in `clips/`, named in lowercase words joined by hyphens. White
   on black, 1920x1080, 30 fps.
2. Add its entry to `.difracta/pack.json`: `id` (the file name without its
   extension), `file`, `name`, `description`, `notes` and `tags`. For a loop or
   a riser made to a tempo, `beats`: its length in seconds times the tempo,
   over 60.
3. Run `npm run measure -- <id>`.
4. Pick `thumbnailAt`: extract a few frames with ffmpeg and look at them. A
   loop takes a frame from the middle; a hit or a riser takes its peak. Never a
   near-black frame.
5. Run `npm run bake -- <id>`.
6. Run `npm run check`.

Write `description` and `notes` after watching the clip: say what is on screen
and how it moves, plainly.

Replacing a clip's file changes its fingerprint: run `measure`, then `bake`,
and delete the old fingerprint's files from `thumbs/` and `proxies/`, which
`check` points out.

## Releases

Pushing a tag `vX.Y.Z` runs `.github/workflows/release.yml`: it installs
ffmpeg, runs the check, and creates a GitHub Release with one asset,
`difracta-media-X.Y.Z.tar.gz`, holding `clips/` and `.difracta/` at the root
of the archive. Difracta pins that version. Every push and pull request runs
the same check (`.github/workflows/check.yml`).

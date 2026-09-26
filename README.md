# Difracta Media

The Bundled Media of [Difracta](https://github.com/gabriel-pinheiro/difracta):
short white-on-black video clips for projection mapping, a `manifest.json` that
describes each one, and a thumbnail rendered from each clip. Difracta pins a
release of this repository and downloads its tarball when it builds, so the
clips reach every Installation without living in Difracta's own history.

White on black suits a projector: black is no light, so a clip shows only its
white shapes on a Surface. In Difracta a clip plays through the Video Visual; on
an Additive Layer its black adds nothing and the Tint colours the white.

## Layout

- `clips/`: the clips, VP9 WebM, 1920x1080, 30 fps, one to eight seconds each.
- `manifest.json`: one entry per clip.
- `thumbnails/<id>.png`: a 640x360 frame of each clip at its `thumbnailAt`.
- `scripts/`: measuring, thumbnail rendering and checking; Node 24 and
  `ffmpeg`/`ffprobe` on the `PATH`, no packages.

## Manifest

`manifest.json` is `{ "version": 1, "items": [...] }`. `version` is the schema
version and changes only when the shape of an item does. Each item has:

- `id`: the clip's file name without its extension; it never changes.
- `name`: a short Title Case name, unique in the manifest.
- `description`: one sentence a person reads while choosing a clip.
- `notes`: a paragraph for whoever composes with it: how it reads on a
  Surface, what to stack it with, when to use it.
- `file`: the clip's path from the repository root, `clips/<id>.<ext>`.
- `type`: `video` or `image`, measured.
- `recommended`: `true` for a good default; left out otherwise.
- `loop`: `true` when the clip loops without a visible seam; left out otherwise.
- `hit`: `true` when the clip works as a one-shot on a beat; left out
  otherwise. A riser that builds into a drop has neither `loop` nor `hit`.
- `thumbnailAt`: the time in seconds of the frame the thumbnail shows.
- `width`, `height`: in pixels, measured.
- `duration`: in seconds, measured; videos only.

## Scripts

```sh
npm run measure [-- id…]      # width, height, duration and type from ffprobe
npm run thumbnails [-- id…]   # thumbnails/<id>.png at thumbnailAt
npm run check                 # validates the manifest against clips/ and thumbnails/
```

`measure` rewrites only the measured fields and keeps the hand-written ones.
`check` fails when a clip has no entry or an entry no clip, an id does not match
its file name, an id or a name repeats, a field is missing or unknown, a flag
is `false` instead of left out, a measured field disagrees with ffprobe,
`thumbnailAt` falls outside the clip, or a thumbnail is missing or not 640x360.

## Adding a clip

1. Put the file in `clips/`, named `<id>.webm` in lowercase words joined by
   hyphens. White on black, 1920x1080, 30 fps.
2. Add its entry to `manifest.json`: `id`, `name`, `description`, `notes`,
   `file` and whichever of `recommended`, `loop` and `hit` hold.
3. Run `npm run measure -- <id>`.
4. Pick `thumbnailAt`: extract a few frames with ffmpeg and look at them. A
   loop takes a frame from the middle; a hit or a riser takes its peak. Never a
   near-black frame.
5. Run `npm run thumbnails -- <id>`.
6. Run `npm run check`.

Write `description` and `notes` after watching the clip: say what is on screen
and how it moves, plainly.

## Releases

Pushing a tag `vX.Y.Z` runs `.github/workflows/release.yml`: it installs
ffmpeg, runs the check, and creates a GitHub Release with one asset,
`difracta-media-X.Y.Z.tar.gz`, holding `manifest.json`, `clips/` and
`thumbnails/` at the root of the archive. Difracta pins that version. Every
push and pull request runs the same check (`.github/workflows/check.yml`).

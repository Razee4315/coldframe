---
name: coldframe
description: Render a Remotion video in the cloud on free GitHub machines instead of on this computer. Use when the user asks to render, export or re-render a Remotion composition "in the cloud", "on GitHub", "without heating my laptop", or asks for a final/full-quality render of any video.
---

# Cloud renders with coldframe

coldframe renders Remotion compositions on GitHub Actions: the frames are split across up to 20 free machines that render in parallel, the pieces are stitched without re-encoding, every frame is counted, and the MP4 comes back to `out/cloud/` (and to Google Drive, if connected).

Before designing or animating any video, follow the `video-rules`, `motion-direction` and `sound-design` skills.

## Keep the computer cold

- Preview with low-res stills only: `npx remotion still <Comp> --scale=0.25 --frame=N`. When you need many, bundle once and call `renderStill` from `@remotion/renderer` for a list of frames.
- Never run a full local render unless the user asks. A single still for a thumbnail is fine.

## Render

Requirements: `npx github:Razee4315/coldframe setup` has been run once in the Remotion project (GitHub CLI, sign-in, repo, workflow, skills, optional Drive).

1. Commit and push. The cloud renders what is on GitHub, not local edits. On slow uploads, push big media (music, footage) in separate commits.
2. Run:
   ```bash
   npx github:Razee4315/coldframe render <CompositionId> --chunks 8
   ```
   It starts the workflow, waits, and downloads the MP4 to `out/cloud/`. For long renders, use `--no-wait` and check with `gh run list --workflow coldframe.yml`, or run it in the background.
3. Verify every render before showing it:
   - frame count = composition duration (`ffprobe -count_packets`); the job summary says it matched
   - duration, resolution, fps, audio stream present
   - loudness and peak (`sound-design`: about -14 LUFS integrated, true peak ≤ -1 dBTP)
   - a contact sheet of 12–20 frames, compared against the storyboard
   - the checklists in `video-rules` and `motion-direction`

Chunks: about one machine per 5–10 s of video, max 20. Each machine spends ~40 s getting ready, so short videos gain little from more chunks.

Useful inputs: `--props '<json>'`, `--name file.mp4`, `--ref <branch>`, `--chunks <n>`.
WebGL / three.js renders with `--gl=swangle` on CPU runners (the workflow default). It works but is slow; render heavy 3D shots once on a local GPU and use them as clips.
If the `RCLONE_CONF` repo secret is set, the MP4 is also copied to Google Drive (`gdrive:coldframe/`).

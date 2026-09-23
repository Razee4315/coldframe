---
name: coldframe
description: Render a Remotion video in the cloud instead of on this computer. Use when the user asks to render, export or re-render a Remotion composition "in the cloud", "on GitHub", "on Colab", "without heating my laptop", or asks for a final/full-quality render of a long video.
---

# Cloud renders with coldframe

coldframe renders Remotion compositions on free cloud machines. Two backends:

| Backend | Use for | Speed |
|---|---|---|
| **GitHub Actions** (default) | Final renders | Frames split across up to 20 machines in parallel |
| **Google Colab** via the `colab-mcp` MCP server | Experiments, GPU tests, very long single jobs | One 2-vCPU machine (sometimes a T4 GPU) |

Keep local work light: preview with `npx remotion still <Comp> --scale=0.25 --frame=N`, never full local renders unless asked.

## GitHub Actions (default)

Requirements: `gh` signed in, the Remotion project pushed to GitHub, and `.github/workflows/coldframe.yml` in it (add it with `npx github:Razee4315/coldframe init`).

1. Commit and push the changes to render. The cloud renders what is on GitHub, not local edits.
2. Run:
   ```bash
   npx github:Razee4315/coldframe render <CompositionId> --chunks 8
   ```
   This starts the workflow, waits (`gh run watch`), and downloads the MP4 to `out/cloud/`.
   For long renders, use `--no-wait` and check with `gh run list --workflow coldframe.yml`, or run it in the background.
3. Check the result: extract a few frames with ffmpeg and look at them, and confirm the job summary says the frame count matched.

Useful inputs: `--props '<json>'`, `--name file.mp4`, `--ref <branch>`.
WebGL / three.js content renders with `--gl=swangle` on CPU runners (the workflow default).
If the `RCLONE_CONF` repo secret is set, the MP4 is also copied to Google Drive (`gdrive:coldframe/`).

## Google Colab (through colab-mcp)

The user must have a Colab notebook open in their browser and connected to the MCP server. Every Colab tool call times out after 30 s, so never run long commands in the foreground. Use the helper, which runs work in the background:

```python
!curl -fsSL https://raw.githubusercontent.com/Razee4315/coldframe/main/colab/coldframe_colab.py -o coldframe_colab.py
import coldframe_colab as cf
cf.gpu()                                        # what machine did we get
cf.setup("<owner>/<repo>", project_dir=".")     # background install, ~2-4 min
cf.status()                                     # poll until "ready"
cf.render("<CompositionId>")                    # background render
cf.status()                                     # poll until "done"
cf.to_drive("coldframe")                        # user clicks "Allow" for Drive the first time
```

Private repos need a Colab secret named `GITHUB_TOKEN` that the notebook is allowed to read. Never paste tokens into cells.
Poll `cf.status()` every 30-60 s. Free Colab disconnects after ~90 min idle, so keep the tab open.

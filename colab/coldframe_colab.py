"""coldframe for Google Colab: render a Remotion project on a Colab runtime.

Every call returns within a few seconds, so an agent driving Colab through the
Colab MCP server (30 s tool timeout) can start a long render and poll it:

    import coldframe_colab as cf
    cf.setup("Razee4315/coldframe", project_dir="example")   # ~2-4 min, runs in background
    cf.status()                                              # poll until "ready"
    cf.render("ColdframePromo")                              # background render
    cf.render("ColdframePromo", gpu=True)                    # on a T4 runtime (experimental)
    cf.status()                                              # poll until "done"
    cf.to_drive()                                            # copy the MP4 to My Drive/coldframe

Private repos: add a Colab secret named GITHUB_TOKEN (key icon in the left bar)
and allow this notebook to read it.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import time
from pathlib import Path

ROOT = Path("/content/coldframe-work")
LOG = ROOT / "coldframe.log"
STATE = ROOT / "state.json"

_SETUP = r"""
set -euo pipefail
echo "[setup] node"
if ! node -v 2>/dev/null | grep -q '^v2[2-9]'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v
echo "[setup] chrome libraries"
apt-get update -qq >/dev/null
apt-get install -y -qq --no-install-recommends libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
  libgbm1 libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 \
  ffmpeg >/dev/null || true
apt-get install -y -qq libasound2 >/dev/null 2>&1 || apt-get install -y -qq libasound2t64 >/dev/null 2>&1 || true
apt-get install -y -qq libcups2 >/dev/null 2>&1 || apt-get install -y -qq libcups2t64 >/dev/null 2>&1 || true
apt-get install -y -qq libvulkan1 >/dev/null 2>&1 || true  # for GPU rendering on T4 runtimes
# Colab ships the NVIDIA driver in /usr/lib64-nvidia but doesn't register it for EGL or Vulkan,
# so Chrome falls back to CPU (Mesa llvmpipe / SwiftShader). Register both.
if [ -e /usr/lib64-nvidia/libEGL_nvidia.so.0 ]; then
  echo "[setup] register NVIDIA EGL + Vulkan"
  mkdir -p /usr/share/glvnd/egl_vendor.d /etc/vulkan/icd.d
  echo '{{"file_format_version":"1.0.0","ICD":{{"library_path":"/usr/lib64-nvidia/libEGL_nvidia.so.0"}}}}' > /usr/share/glvnd/egl_vendor.d/10_nvidia.json
  echo '{{"file_format_version":"1.0.0","ICD":{{"library_path":"/usr/lib64-nvidia/libEGL_nvidia.so.0","api_version":"1.3.0"}}}}' > /etc/vulkan/icd.d/nvidia_icd.json
  echo /usr/lib64-nvidia > /etc/ld.so.conf.d/zz-nvidia.conf
  ldconfig 2>/dev/null || true
fi
echo "[setup] clone {repo}@{ref}"
rm -rf {dest}
git clone -q --depth 1 --branch {ref} {url} {dest}
cd {dest}/{project_dir}
echo "[setup] npm ci"
npm ci --no-audit --no-fund --loglevel=error
fix() {{
  [ -f "node_modules/$1/package.json" ] || return 0
  [ -d "node_modules/$2" ] && return 0
  v=$(node -p "require('./node_modules/$1/package.json').version")
  npm i --no-save --no-audit --no-fund "$2@$v"
}}
fix @rspack/binding @rspack/binding-linux-x64-gnu
fix @remotion/renderer @remotion/compositor-linux-x64-gnu
npx remotion browser ensure
echo "[setup] ready"
"""


def _state() -> dict:
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def _save(**kw) -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps({**_state(), **kw}))


def _background(script: str, phase: str) -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    with open(LOG, "a") as log:
        log.write(f"\n===== {phase} {time.strftime('%H:%M:%S')} =====\n")
    runner = ROOT / f"{phase}.sh"
    runner.write_text(script + "\n")
    (ROOT / f"{phase}.code").unlink(missing_ok=True)
    q = lambda p: shlex.quote(Path(p).as_posix())
    proc = subprocess.Popen(
        ["bash", "-c", f"bash {q(runner)} >> {q(LOG)} 2>&1; echo $? > {q(ROOT / (phase + '.code'))}"],
        start_new_session=True,
    )
    _save(phase=phase, pid=proc.pid, started=time.time())


def setup(repo: str, ref: str = "main", project_dir: str = ".", token_secret: str = "GITHUB_TOKEN") -> None:
    """Clone the repo and install everything, in the background. Poll with status()."""
    token = None
    try:
        from google.colab import userdata  # type: ignore

        token = userdata.get(token_secret)
    except Exception:
        pass  # public repo, or secret not shared with this notebook
    url = f"https://x-access-token:{token}@github.com/{repo}.git" if token else f"https://github.com/{repo}.git"
    dest = ROOT / repo.split("/")[-1]
    _save(repo=repo, project=str(dest / project_dir), output=None)
    _background(_SETUP.format(repo=repo, ref=ref, url=shlex.quote(url), dest=dest, project_dir=project_dir), "setup")
    print(f"Setting up {repo}@{ref} in the background. Call status() to follow along.")


def render(
    composition: str,
    output: str | None = None,
    props: str = "{}",
    gl: str = "swangle",
    concurrency: str = "100%",
    extra: str = "",
    frames: str | None = None,
    gpu: bool = False,
) -> None:
    """Start `remotion render` in the background. Poll with status().

    gpu=True uses Remotion's cloud-GPU flags (chrome-for-testing + Vulkan). Pick a
    T4 runtime first (Runtime > Change runtime type) and confirm with gpu_check().
    It mostly speeds up WebGL / three.js scenes; plain HTML frames are CPU-bound.
    """
    st = _state()
    if not st.get("project"):
        raise RuntimeError("Run setup() first.")
    output = output or f"{composition}-{time.strftime('%Y%m%d-%H%M')}.mp4"
    out_path = ROOT / "out" / output
    args = [
        "npx", "remotion", "render", composition, str(out_path),
        f"--props={props}", f"--concurrency={concurrency}",
    ] + (["--chrome-mode=chrome-for-testing", "--gl=vulkan"] if gpu else [f"--gl={gl}"]) + ([f"--frames={frames}"] if frames else []) + shlex.split(extra)
    script = f"set -euo pipefail\ncd {shlex.quote(st['project'])}\nmkdir -p {ROOT / 'out'}\n" + shlex.join(args)
    _save(output=str(out_path))
    _background(script, "render")
    print(f"Rendering {composition} -> {out_path}. Call status() to follow along.")


def status(tail: int = 12) -> str:
    """One-line state plus the last lines of the log. Safe to call often."""
    st = _state()
    phase = st.get("phase")
    if not phase:
        print("idle")
        return "idle"
    code_file = ROOT / f"{phase}.code"
    elapsed = int(time.time() - st.get("started", time.time()))
    if code_file.exists():
        code = code_file.read_text().strip()
        word = ("ready" if phase == "setup" else "done") if code == "0" else f"failed (exit {code})"
    else:
        word = "running"
    lines = LOG.read_text(errors="replace").splitlines()[-tail:] if LOG.exists() and tail > 0 else []
    # Remotion rewrites its progress line with \r; keep only the latest state of each line.
    lines = [l.split("\r")[-1] for l in lines]
    print(f"{phase}: {word} ({elapsed // 60}m {elapsed % 60}s)")
    if word == "done" and st.get("output"):
        size = Path(st["output"]).stat().st_size / 1e6
        print(f"output: {st['output']} ({size:.1f} MB)")
    print("\n".join(lines))
    return word


_GPU_CHECK = r"""
cd {project}
npx remotion browser ensure --chrome-mode=chrome-for-testing >/dev/null 2>&1 || true
C=$(find node_modules/.remotion -path "*chrome-for-testing*" -name chrome -type f | head -1)
cat > /tmp/cf-gl.html <<'EOF'
<body><script>
const g = document.createElement('canvas').getContext('webgl'); let r = 'none';
if (g) {{ const e = g.getExtension('WEBGL_debug_renderer_info'); r = e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); }}
document.body.innerText = 'WebGL renderer: ' + r;
</script></body>
EOF
for gl in vulkan egl; do
  flags="--use-angle=vulkan --use-vulkan --enable-features=Vulkan"
  [ "$gl" = egl ] && flags="--use-angle=gl-egl --use-gl=angle"
  r=$(timeout 30 "$C" --headless=new --no-sandbox --ignore-gpu-blocklist --enable-gpu $flags \
      --virtual-time-budget=3000 --dump-dom file:///tmp/cf-gl.html 2>/dev/null | grep -o 'WebGL renderer: [^<]*')
  echo "$gl: ${{r:-WebGL renderer: none}}"
done
echo "(NVIDIA / Tesla in the name = GPU. SwiftShader or llvmpipe = CPU fallback.)"
"""


def gpu_check() -> None:
    """Check which device Chrome draws WebGL with (background; read the result with status()).

    `npx remotion gpu` reports chrome://gpu, which says "Disabled" in headless mode on
    Colab even when WebGL runs on the T4, so this asks WebGL itself.
    """
    st = _state()
    if not st.get("project"):
        raise RuntimeError("Run setup() first.")
    _background(_GPU_CHECK.format(project=shlex.quote(st["project"])), "gpucheck")
    print("Checking GPU access in the background. Call status() in ~30 s.")


def gpu() -> None:
    """Print the runtime's CPU/GPU so you know what you are rendering on."""
    print(subprocess.run("nproc; free -g | head -2; nvidia-smi -L 2>/dev/null || echo 'no GPU'", shell=True,
                         capture_output=True, text=True).stdout)


def to_drive(folder: str = "coldframe", path: str | None = None) -> str:
    """Copy the last render (or `path`) to My Drive/<folder>. Asks for Drive access the first time."""
    from google.colab import drive  # type: ignore

    if not Path("/content/drive/MyDrive").exists():
        drive.mount("/content/drive")
    src = Path(path or _state().get("output") or "")
    if not src.is_file():
        raise FileNotFoundError(f"Nothing to copy: {src}")
    dest = Path("/content/drive/MyDrive") / folder
    dest.mkdir(parents=True, exist_ok=True)
    subprocess.run(["cp", str(src), str(dest / src.name)], check=True)
    print(f"Saved to My Drive/{folder}/{src.name}")
    return str(dest / src.name)


def download(path: str | None = None) -> None:
    """Download the last render to this computer through the browser."""
    from google.colab import files  # type: ignore

    files.download(path or _state()["output"])

"""Synthesise the launch film soundtracks (public/launch-*.wav). No samples, no licences.

Cue times come from src/launch/launch.json, the same config the video reads, so sound
and picture can't drift apart. One track per cut.

Laptop fan under the problem -> hard cut to silence -> thump + calm pad on the solution,
key ticks on typing, a soft click per machine finishing, a chime on "every frame counted",
a whoosh into the wipe, a clean end chord. Peak normalised to -1.5 dBFS.
"""
import json
import pathlib
import wave

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent.parent
CFG = json.loads((HERE / "src" / "launch" / "launch.json").read_text(encoding="utf-8"))
SR = 48000
FPS = CFG["fps"]
PEAK_DB = -1.5


def build(cut: dict, seed: int) -> np.ndarray:
    scenes = cut["scenes"]
    dur = (scenes[-1]["from"] + scenes[-1]["dur"]) / FPS
    t = np.arange(int(SR * dur)) / SR
    rng = np.random.default_rng(seed)
    sec = lambda frames: frames / FPS

    def env(a, d, start, end):
        e = np.clip((t - start) / max(a, 1e-4), 0, 1) * np.clip((end - t) / max(d, 1e-4), 0, 1)
        return e * (t >= start) * (t <= end)

    def lowpass(x, k):
        return np.convolve(x, np.ones(k) / k, mode="same")

    def whoosh(at, length=0.5, gain=0.12):
        n = lowpass(rng.standard_normal(t.size), 9)
        return n * env(length * 0.7, length * 0.3, at - length * 0.7, at + length * 0.3) * gain

    def ping(at, f, gain=0.1, decay=5.0):
        tt = t - at
        return np.where(tt >= 0, np.sin(2 * np.pi * f * tt) * np.exp(-np.clip(tt, 0, None) * decay), 0) * gain

    def thump(at, gain=0.5):
        tt = np.clip(t - at, 0, None)
        return np.where(t >= at, np.sin(2 * np.pi * (46 + 70 * np.exp(-tt * 20)) * tt) * np.exp(-tt * 7), 0) * gain

    def tick(at, gain=0.05):
        # Short filtered noise burst: a soft key / click.
        n = rng.standard_normal(t.size)
        n = n - lowpass(n, 5)
        return n * env(0.002, 0.03, at, at + 0.035) * gain

    by = {}
    for s in scenes:
        by.setdefault(s["type"], []).append(s)
    sol = by["solution"][0]
    sol_t = sec(sol["from"])

    # 1. Laptop fan: band-limited noise plus a faint whine, rising through the problem, cut dead on the solution.
    fan = (lowpass(rng.standard_normal(t.size), 6) - lowpass(rng.standard_normal(t.size), 60)) * 0.9
    fan += 0.07 * np.sin(2 * np.pi * 1180 * t + 0.4 * np.sin(2 * np.pi * 3 * t))
    rise = np.interp(t, [0, sol_t], [0.16, 0.28])
    fan *= np.clip(t / 0.5, 0, 1) * (t < sol_t) * rise

    fx = np.zeros_like(t)
    for s in by.get("edit", []):
        s0 = sec(s["from"])
        for k in range(0, 15, 3):
            fx += tick(s0 + sec(s["typeAt"] + k), 0.06)
        fx += thump(s0 + sec(s["resetAt"]), 0.28)  # the bar snaps back to 0
    for s in by.get("blocked", []):
        fx += whoosh(sec(s["from"]) + 0.1, 0.5, 0.07)  # zoom out

    # 2. Solution: silence, then a thump and the pad.
    mark_t = sol_t + sec(sol["markAt"])
    fx += thump(mark_t, 0.6)
    fx += whoosh(sol_t + sec(sol["stripAt"]) + 0.3, 0.6, 0.07)
    chord = [(73.42, 0.5), (110, 0.32), (146.83, 0.28), (185, 0.22), (220, 0.16), (329.63, 0.08)]  # D major 9
    pad = sum(g * np.sin(2 * np.pi * f * t + 0.25 * np.sin(2 * np.pi * 0.11 * t + i)) for i, (f, g) in enumerate(chord))
    pad *= env(1.4, 2.0, mark_t + 0.1, dur) * 0.15

    for s in by.get("command", []):
        s0 = sec(s["from"])
        for fr in range(s["typeAt"], s["typeEnd"], 2):
            fx += tick(s0 + sec(fr), 0.035 + 0.01 * rng.random())
        fx += tick(s0 + sec(s["enterAt"]), 0.09) + thump(s0 + sec(s["enterAt"]), 0.12)
        fx += whoosh(s0 + sec(s["collapseAt"] + 14), 0.45, 0.1)

    for s in by.get("split", []):
        s0 = sec(s["from"])
        fx += whoosh(s0 + sec(s["splitAt"] + 8), 0.45, 0.11)
        fx += tick(s0 + sec(s["planAt"] + 6), 0.05)
        mx = max(CFG["run"]["chunkSeconds"])
        for c in CFG["run"]["chunkSeconds"]:
            fin = s["fillAt"] + round(c / mx * (s["fillEnd"] - s["fillAt"]))
            fx += ping(s0 + sec(fin), 1567.98, 0.04, 16) + tick(s0 + sec(fin), 0.04)
        if s.get("counter"):
            end = s0 + sec(s["fillEnd"])
            fx += ping(end, 987.77, 0.1, 3) + ping(end, 1479.98, 0.065, 3)

    for s in by.get("stitch", []):
        s0 = sec(s["from"])
        fx += whoosh(s0 + 0.55, 0.5, 0.1)  # chunks join
        at = s0 + sec(s["checkAt"])
        fx += ping(at, 987.77, 0.11, 3) + ping(at, 1479.98, 0.07, 3)  # verified chime

    for s in by.get("audio", []):
        fx += whoosh(sec(s["from"]) + 0.5, 0.6, 0.09)  # zoom into the seam

    for s in by.get("deliver", []):
        s0 = sec(s["from"])
        fx += whoosh(s0 + 0.4, 0.4, 0.06)
        for key in ("dropA", "dropB"):
            fx += thump(s0 + sec(s[key] + 18), 0.14) + tick(s0 + sec(s[key] + 18), 0.05)

    for s in by.get("proof", []):
        fx += thump(sec(s["from"]), 0.22) + tick(sec(s["from"]), 0.05)  # hard cut on the beat

    for s in by.get("cta", []):
        s0 = sec(s["from"])
        fx += whoosh(s0, 0.55, 0.14)  # wipe
        end_chord = [(146.83, 0.12), (220, 0.09), (293.66, 0.08), (369.99, 0.05), (440, 0.04)]
        fx += thump(s0 + 0.15, 0.3)
        for f0, g in end_chord:
            fx += ping(s0 + 0.15, f0, g, 0.7)

    mono = fan + pad + fx
    stereo = np.stack([mono + 0.3 * np.roll(pad, 240), mono + 0.3 * np.roll(pad, -240)], axis=1)
    stereo *= np.clip((dur - t) / 1.2, 0, 1)[:, None]  # clean fade on the end card
    stereo *= 10 ** (PEAK_DB / 20) / max(1e-9, np.abs(stereo).max())
    return stereo


for i, (cid, cut) in enumerate(CFG["cuts"].items()):
    audio = build(cut, 11 + i)
    out = HERE / "public" / cut["audio"]
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype("<i2").tobytes())
    peak = 20 * np.log10(np.abs(audio).max())
    print(f"{cid}: {out.name} {audio.shape[0] / SR:.2f} s, peak {peak:.2f} dBFS, {out.stat().st_size / 1e6:.1f} MB")

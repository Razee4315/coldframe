"""Synthesise the demo's 20 s soundtrack (public/soundtrack.wav). No samples, no licences.

Cue times follow the scene starts in src/Composition.tsx (30 fps):
problem 0 s, solution 2.8 s, split 5.8 s, stitch 12.8 s, wipe ~16.1 s, CTA 16.3 s.
"""
import numpy as np, wave, pathlib

SR, DUR = 48000, 20.0
t = np.arange(int(SR * DUR)) / SR
rng = np.random.default_rng(11)
S_SOL, S_SPLIT, S_STITCH, S_CTA = 84 / 30, 174 / 30, 384 / 30, 489 / 30

def env(a, d, start, end):
    e = np.clip((t - start) / max(a, 1e-4), 0, 1) * np.clip((end - t) / max(d, 1e-4), 0, 1)
    return e * (t >= start) * (t <= end)

def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, mode="same")

# 1. Laptop fan under the problem scene: band-limited noise plus a faint whine. Cuts hard at the solution.
fan = (lowpass(rng.standard_normal(t.size), 6) - lowpass(rng.standard_normal(t.size), 60)) * 0.9
fan += 0.08 * np.sin(2 * np.pi * 1180 * t + 0.4 * np.sin(2 * np.pi * 3 * t))
fan *= np.clip(t / 0.6, 0, 1) * (t < S_SOL - 0.06) * 0.22

# 2. Calm pad from the solution onward (D major 9, open voicing), fades out at the end.
chord = [(73.42, .5), (110, .32), (146.83, .28), (185, .22), (220, .16), (329.63, .08)]
pad = sum(g * np.sin(2 * np.pi * f * t + 0.25 * np.sin(2 * np.pi * 0.11 * t + i)) for i, (f, g) in enumerate(chord))
pad *= env(1.2, 2.2, S_SOL + 0.15, DUR) * 0.16

def whoosh(at, length=0.5, gain=0.14):
    return lowpass(rng.standard_normal(t.size), 10) * env(length * 0.75, length * 0.25, at - length * 0.75, at + length * 0.25) * gain

def ping(at, f, gain=0.1, decay=5.0):
    return np.where(t >= at, np.sin(2 * np.pi * f * (t - at)) * np.exp(-(t - at) * decay), 0) * gain

def thump(at, gain=0.5):
    tt = np.clip(t - at, 0, None)
    return np.where(t >= at, np.sin(2 * np.pi * (46 + 70 * np.exp(-tt * 20)) * tt) * np.exp(-tt * 7), 0) * gain

fx = thump(S_SOL, 0.55)                                  # hard cut lands after the fan stops
fx += whoosh(S_SOL + 44 / 30, 0.6, 0.08)                 # timeline bar draws
fx += whoosh(S_SPLIT + 10 / 30, 0.45, 0.12)              # strip splits
for fr in [138, 141, 144, 147, 150, 156, 166, 172]:      # each runner finishing
    fx += ping(S_SPLIT + fr / 30, 1567.98, 0.045, 14)
fx += whoosh(S_STITCH + 0.2, 0.5, 0.12)                  # chunks join
fx += ping(S_STITCH + 1.0, 987.77, 0.11, 3) + ping(S_STITCH + 1.0, 1479.98, 0.07, 3)  # checked
fx += whoosh((489 - 8 + 8) / 30, 0.55, 0.16)             # wipe
fx += thump(S_CTA + 0.1, 0.35) + ping(S_CTA + 0.1, 293.66, 0.12, 0.8) + ping(S_CTA + 0.1, 440, 0.08, 0.8)

mono = fan + pad + fx
stereo = np.stack([mono + 0.3 * np.roll(pad, 240), mono + 0.3 * np.roll(pad, -240)], axis=1)
stereo *= np.clip((DUR - t) / 1.0, 0, 1)[:, None]
stereo /= max(1e-9, np.abs(stereo).max()) / 0.8

out = pathlib.Path(__file__).resolve().parent.parent / "public" / "soundtrack.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype("<i2").tobytes())
print(out, round(out.stat().st_size / 1e6, 1), "MB")

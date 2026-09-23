"""Synthesise the demo's 16 s ambient soundtrack (public/soundtrack.wav). No samples, no licences."""
import numpy as np, wave, pathlib

SR, DUR = 48000, 16.0
t = np.arange(int(SR * DUR)) / SR
rng = np.random.default_rng(7)

def env(a, d, start, end):
    """Attack/decay envelope between start and end seconds."""
    e = np.clip((t - start) / a, 0, 1) * np.clip((end - t) / d, 0, 1)
    return e * (t >= start) * (t <= end)

# Cold pad: A minor 9, slow chorus detune, fades in and out.
pad = sum(np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.13 * t + i)) * g
          for i, (f, g) in enumerate([(110, .5), (164.81, .35), (196, .3), (246.94, .25), (329.63, .12), (493.88, .06)]))
pad *= env(2.5, 3.0, 0, DUR) * 0.16

# Shimmer: filtered noise swelling under the "split" scene.
noise = np.convolve(rng.standard_normal(t.size), np.ones(24) / 24, mode="same")
shimmer = noise * np.sin(2 * np.pi * 0.5 * t) ** 2 * env(1.5, 2.0, 3.3, 9.6) * 0.05

def whoosh(at, length=0.6, gain=0.18):
    e = env(length * 0.7, length * 0.3, at - length * 0.7, at + length * 0.3)
    return np.convolve(rng.standard_normal(t.size), np.ones(12) / 12, mode="same") * e * gain

def ping(at, f, gain=0.2, decay=1.4):
    s = np.where(t >= at, np.sin(2 * np.pi * f * (t - at)) * np.exp(-(t - at) * decay), 0)
    return s * gain

def thump(at, gain=0.5):
    tt = np.clip(t - at, 0, None)
    return np.where(t >= at, np.sin(2 * np.pi * (48 + 60 * np.exp(-tt * 18)) * tt) * np.exp(-tt * 6), 0) * gain

fx = whoosh(3.33) + whoosh(9.33) + whoosh(12.8, 0.8, 0.22)
# One soft tick per runner finishing (frames 150-162 of the split scene, which starts at 3.33 s).
for fr in [138, 141, 144, 147, 150, 152, 158, 162]:
    fx += ping(3.33 + fr / 30, 1318.5, 0.05, 9)
fx += ping(9.33 + 45 / 30, 880, 0.12, 3) + ping(9.33 + 45 / 30, 1318.5, 0.08, 3)  # verified
fx += thump(12.8) + ping(12.8, 220, 0.18, 0.9) + ping(12.8, 329.63, 0.1, 0.9)       # end card

mono = pad + shimmer + fx
stereo = np.stack([mono + 0.4 * np.roll(shimmer, 480), mono + 0.4 * np.roll(shimmer, -480)], axis=1)
stereo *= np.clip((DUR - t) / 1.2, 0, 1)[:, None]  # clean tail
stereo /= max(1e-9, np.abs(stereo).max()) / 0.8

out = pathlib.Path(__file__).resolve().parent.parent / "public" / "soundtrack.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype("<i2").tobytes())
print(out, round(out.stat().st_size / 1e6, 1), "MB")

"""Build coldframe's CC0 sound-effect library: trim, loudness-match, fade, write library.json and templates/sound.tsx.

Sources (all CC0): Kenney Interface Sounds, UI Audio and Impact Sounds (kenney.nl), and whoosh.wav / whip.wav
from remotion.media. Unzip them, convert every file to 48 kHz stereo WAV named <prefix>_<name>.wav
(prefix: if = Interface Sounds, ui = UI Audio, im = Impact Sounds, rm = remotion.media), then:

    python scripts/build_sfx.py <converted-wav-folder> sfx
"""
import json, pathlib, wave, sys
import numpy as np

SRC = pathlib.Path(sys.argv[1])  # folder of converted 48 kHz stereo WAVs (prefix_name.wav)
OUT = pathlib.Path(sys.argv[2])  # repo sfx/ folder
OUT.mkdir(parents=True, exist_ok=True)
SR = 48000

KENNEY = {
    "if": ("Kenney · Interface Sounds 1.0", "https://kenney.nl/assets/interface-sounds"),
    "ui": ("Kenney · UI Audio", "https://kenney.nl/assets/ui-audio"),
    "im": ("Kenney · Impact Sounds", "https://kenney.nl/assets/impact-sounds"),
}
REMOTION = {
    "whoosh": "https://freesound.org/s/831936/ (1bob) via remotion.media/whoosh.wav",
    "whip": "https://freesound.org/s/838766/ via remotion.media/whip.wav",
}

# role -> (use, target RMS dB, [source files])
ROLES = {
    "click-soft": ("Cursor click on a small control: tab, link, icon, menu item", -22, ["ui_click1", "ui_click3", "ui_click4"]),
    "click-firm": ("Press on a primary button: Run, Render, Deploy, the CTA", -18, ["if_click_002", "if_click_003", "if_click_005"]),
    "tick": ("Hover, focus or a selection moving; very light", -24, ["if_tick_001", "if_tick_002"]),
    "key": ("One keystroke while typing (rotate variants, one per 1-3 characters)", -24, ["ui_switch13", "ui_switch14", "ui_switch29", "ui_switch10"]),
    "key-enter": ("Enter / Return at the end of a typed command", -19, ["ui_switch16", "ui_switch31"]),
    "toggle-on": ("Switch or checkbox turning on", -20, ["if_toggle_002"]),
    "toggle-off": ("Switch or checkbox turning off", -20, ["if_toggle_001"]),
    "select": ("Item picked in a list, option chosen", -20, ["if_select_001", "if_select_002"]),
    "drop": ("Card or panel lands and snaps into place", -19, ["if_drop_002", "if_drop_003", "if_drop_004"]),
    "pop": ("Notification, badge or small item appearing", -21, ["if_glass_002", "if_glass_005"]),
    "confirm": ("Success, verified, done: the one reward sound", -18, ["if_confirmation_001", "if_confirmation_002"]),
    "error": ("Failure shown on screen; short and low", -20, ["if_error_005"]),
    "open": ("Panel, window or modal expanding (swells into its peak)", -20, ["if_maximize_002", "if_maximize_008"]),
    "close": ("Panel, window or modal collapsing", -20, ["if_minimize_002", "if_minimize_008"]),
    "whoosh": ("Camera move, fly-in, whip pan, fast slide", -18, ["rm_whoosh", "rm_whip"]),
    "impact-soft": ("Element lands with weight; beat accent", -17, ["im_impactSoft_medium_000", "im_impactSoft_medium_002"]),
    "impact": ("The one big moment: palette impact, reveal, logo", -16, ["im_impactSoft_heavy_002", "im_impactSoft_heavy_003", "im_impactPunch_heavy_002"]),
}


def load(name):
    w = wave.open(str(SRC / f"{name}.wav"))
    a = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, 2).astype(np.float64) / 32768
    return a


def process(a, target_rms):
    mono = np.abs(a).max(1)
    pk = mono.max()
    on = np.where(mono > pk * 0.02)[0]
    start = max(0, on[0] - int(0.002 * SR))  # keep 2 ms before the onset
    end = min(len(a), on[-1] + int(0.03 * SR))
    a = a[start:end].copy()
    act = a[np.abs(a).max(1) > pk * 0.05]
    rms = np.sqrt((act ** 2).mean())
    a *= 10 ** (target_rms / 20) / rms
    peak = np.abs(a).max()
    ceiling = 10 ** (-3 / 20)  # never above -3 dBFS
    if peak > ceiling:
        a *= ceiling / peak
    fade = min(len(a) // 4, int(0.012 * SR))
    a[-fade:] *= np.linspace(1, 0, fade)[:, None]
    peak_ms = round(np.abs(a).max(1).argmax() / SR * 1000)
    return a, peak_ms


lib = {"_about": "coldframe sound-effect library. All CC0. `peakMs` = time from file start to its loudest point, so a whoosh can be started early to peak on the fastest frame. Levels are pre-matched; `gain` is the suggested starting volume under a music bed.", "sampleRate": SR, "roles": {}}
credits = []
for role, (use, target, files) in ROLES.items():
    variants = []
    for i, name in enumerate(files, 1):
        a, peak_ms = process(load(name), target)
        fn = f"{role}-{i}.wav" if len(files) > 1 else f"{role}.wav"
        with wave.open(str(OUT / fn), "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(a, -1, 1) * 32767).astype("<i2").tobytes())
        prefix, orig = name.split("_", 1)
        if prefix == "rm":
            src, lic = REMOTION[orig], "CC0"
        else:
            src, lic = f"{KENNEY[prefix][0]} ({orig}.ogg) {KENNEY[prefix][1]}", "CC0"
        variants.append({"file": fn, "ms": round(len(a) / SR * 1000), "peakMs": peak_ms, "source": src, "license": lic})
        credits.append(f"| `{fn}` | {src} | {lic} |")
    lib["roles"][role] = {"use": use, "gain": 1.0, "variants": variants}

(OUT / "library.json").write_text(json.dumps(lib, indent=2) + "\n", encoding="utf-8")
(OUT / "LICENSE.md").write_text(
    "# Sound effects: sources and licenses\n\nEvery file here is CC0 (public domain): free to use, modify and redistribute, no attribution required. "
    "Trimmed, loudness-matched and faded by `scripts/build_sfx.py`.\n\n| File | Source | License |\n|---|---|---|\n" + "\n".join(credits) + "\n",
    encoding="utf-8",
)
total = sum(f.stat().st_size for f in OUT.glob("*.wav"))
print(f"{len(list(OUT.glob('*.wav')))} files, {total / 1e6:.2f} MB")

# Remotion helper with the table inlined (setup copies it to src/coldframe-sound.tsx).
table = {r: {"n": len(v["variants"]), "files": [x["file"] for x in v["variants"]], "peakMs": [x["peakMs"] for x in v["variants"]]} for r, v in lib["roles"].items()}
rows = ",\n".join(f'  "{r}": {{ files: {json.dumps(t["files"])}, peakMs: {json.dumps(t["peakMs"])} }}' for r, t in table.items())
helper = '''// coldframe sound helpers for Remotion. Generated by scripts/build_sfx.py; the files live in public/sfx/.
// Usage:
//   <MusicBed src="music/bed.mp3" duckAt={[240]} />
//   <Sfx role="click-firm" at={96} />            // on the frame the button visibly presses
//   <Sfx role="whoosh" at={150} />               // `at` = the fastest frame of the move; the peak lands there
//   {typingCues(40, 70, cmd.length).map((f, i) => <Sfx key={i} role="key" at={f} />)}
import React from "react";
import { interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";

const LIB = {
%s,
} as const;

export type SfxRole = keyof typeof LIB;

// Sounds that swell into their peak are aligned so the peak (not the start) lands on `at`.
const ALIGN_PEAK: SfxRole[] = ["whoosh", "open", "close"];

/** One sound effect. Variants rotate and pitch varies slightly, so repeats never sound identical. */
export const Sfx: React.FC<{ role: SfxRole; at: number; variant?: number; volume?: number; rate?: number; alignPeak?: boolean }> = ({
  role,
  at,
  variant,
  volume = 1,
  rate,
  alignPeak,
}) => {
  const { fps } = useVideoConfig();
  const lib = LIB[role];
  const i = (variant ?? at) %% lib.files.length;
  const r = rate ?? 1 + (((at * 7919) %% 9) - 4) * 0.008; // 0.968 - 1.032
  const shift = (alignPeak ?? ALIGN_PEAK.includes(role)) ? Math.round((lib.peakMs[i] / 1000) * fps / r) : 0;
  return (
    <Sequence from={Math.max(0, at - shift)} layout="none" name={`sfx ${role}`}>
      <Audio src={staticFile(`sfx/${lib.files[i]}`)} volume={volume} playbackRate={r} />
    </Sequence>
  );
};

/** Frames for keystroke sounds while `chars` characters are typed between two frames (one tap per ~2 characters). */
export const typingCues = (from: number, to: number, chars: number, charsPerTap = 2): number[] => {
  const taps = Math.max(1, Math.round(chars / charsPerTap));
  return Array.from({ length: taps }, (_, k) => Math.round(from + ((to - from) * k) / taps));
};

/** Soft music bed: fades in and out, ducks around the frames in `duckAt` (big reveals, voiceover lines). */
export const MusicBed: React.FC<{ src: string; volume?: number; duckAt?: number[]; duckTo?: number; fadeIn?: number; fadeOut?: number }> = ({
  src,
  volume = 0.35,
  duckAt = [],
  duckTo = 0.35,
  fadeIn = 1,
  fadeOut = 2,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const c = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  return (
    <Audio
      src={staticFile(src)}
      volume={(f) => {
        const fade = Math.min(interpolate(f, [0, fadeIn * fps], [0, 1], c), interpolate(f, [durationInFrames - fadeOut * fps, durationInFrames], [1, 0], c));
        const duck = duckAt.reduce((v, at) => v * interpolate(f, [at - 8, at - 2, at + 10, at + 30], [1, duckTo, duckTo, 1], c), 1);
        return volume * fade * duck;
      }}
    />
  );
};
''' % rows
tmpl = OUT.parent / "templates" / "sound.tsx"
tmpl.parent.mkdir(exist_ok=True)
tmpl.write_text(helper, encoding="utf-8", newline="\n")
print("wrote", tmpl)

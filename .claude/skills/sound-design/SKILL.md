---
name: sound-design
description: Sound for product, launch and social videos in Remotion - a soft music bed, a real sound effect for every click, keystroke, toggle, success and transition, voiceover if asked, mixing levels and loudness. Use whenever a video gets audio, together with video-rules and motion-direction.
---

# Sound design

Sound is half of what makes a film feel expensive. Every visible action gets a sound that matches it, a soft music bed carries the whole film, and the mix is clean and loud enough without clipping.

**Never synthesise the soundtrack in code** (numpy noise, sine pads, beeps). It sounded bad and was cut from the coldframe launch film. Use real recorded sound effects and real music.

## 1. Layers

1. **Music bed** (always, unless the deliverable is silent): soft, instrumental, steady tempo, no vocals. Ambient/electronic/soft piano for dev tools; it sits under everything.
2. **UI sound effects**: one for every visible interaction.
3. **Transition sound effects**: whooshes, swishes, risers, impacts for camera moves and cuts.
4. **Voiceover** (only if the user asks): recorded or high-quality TTS the user approves; always with burned-in captions.

## 2. Sources

| What | Where | Notes |
|---|---|---|
| UI + transition SFX | `public/sfx/`: the coldframe library (§5) | CC0 (Kenney, Remotion `@remotion/sfx`); safe to commit and redistribute |
| More SFX | [Kenney audio packs](https://kenney.nl/assets?q=audio) (CC0), [`@remotion/sfx`](https://www.remotion.dev/docs/sfx) (per-sound license on its page), Freesound (filter CC0) | Record the source + license in `library.json` |
| Music | The user picks: [Pixabay Music](https://pixabay.com/music/) (free, no attribution), [Chosic](https://www.chosic.com/free-music/all/) CC0 filter, YouTube Audio Library, or a track they own | Offer 2–3 options that fit the mood; don't commit Pixabay/YouTube tracks to a **public** repo (their licenses forbid redistributing the file itself); keep them in the project's `public/music/` of a private repo or add to `.gitignore` and upload for the render |
| AI-generated SFX / music / voice | ElevenLabs (sound effects, music, TTS) or similar, only with the user's API key and OK | Listen and approve before use |

## 3. Match each sound to its action

Pick by what the element *is*, how heavy it is, and what just happened. Never reuse the exact same sample twice in a row: alternate variants and vary `playbackRate` 0.96–1.04 and gain ±2 dB.

| On screen | Sound | Level vs. music |
|---|---|---|
| Cursor click on a small control (tab, link, icon) | soft click / tick | subtle, +3 dB |
| Primary button press (Run, Render, Deploy, CTA) | firmer click with a little body | +6 dB |
| Toggle / switch / checkbox | switch (two-state), on ≠ off variant | +4 dB |
| Typing in a terminal/input | key taps, one per 1–3 characters, varied; slightly louder on Enter | subtle |
| Hover / focus / selection moving | very soft tick, or nothing | barely audible |
| Card or panel lands / snaps into place | soft drop / tap | +4 dB |
| Notification, badge, counter completes | pop / soft bell | +5 dB |
| Success / verified / done | confirm chime (the one "reward" sound) | +6 dB |
| Error / failure (only if shown) | low muted buzz, short | +4 dB |
| Camera move, fly-in, whip pan | whoosh / swish whose peak lines up with the fastest frame | +4 dB |
| Palette impact / big reveal | `impact` (low hit), with a riser before it if one has been added to the library | +8 dB, the loudest moment |
| Logo / end card | soft hit + the music's resolving phrase | +6 dB |

Group sounds so the film has 3–4 recognisable families (clicks, whooshes, one reward chime, one impact), not 30 random ones.

## 4. Sync

- Clicks and taps: on the frame the button visibly depresses (or 1 frame before; sound feels late otherwise).
- Whooshes: start early so the **peak** lands on the fastest frame of the move.
- Impacts: exactly on the impact/flash frame. Leave 3–8 frames of near-silence before a big reveal (pull the music down).
- Cut on the music's beat where you can: pick the bpm and snap scene starts to beats (`frames per beat = fps * 60 / bpm`).

## 5. Build it in Remotion

`coldframe setup` installs the library in `public/sfx/` (37 CC0 sounds in 17 roles, trimmed so they start on the frame, loudness-matched; sources in `public/sfx/LICENSE.md`, details in `library.json`) and the helpers in `src/coldframe-sound.tsx`.

| Role | Use |
|---|---|
| `click-soft` | click on a small control (tab, link, icon) |
| `click-firm` | press on a primary button (Run, Render, CTA) |
| `tick` | hover / focus / selection moving |
| `key`, `key-enter` | typing; Enter at the end of a command |
| `toggle-on`, `toggle-off` | switches, checkboxes |
| `select` | option picked in a list |
| `drop` | card/panel lands and snaps into place |
| `pop` | notification, badge, small item appears |
| `confirm` | success / verified / done (the one reward sound) |
| `error` | a failure shown on screen |
| `open`, `close` | panel/window expands or collapses (peak-aligned) |
| `whoosh` | camera move, fly-in, whip pan (peak-aligned) |
| `impact-soft` | element lands with weight, beat accent |
| `impact` | the one big moment: palette impact, reveal, logo |

```tsx
import { MusicBed, Sfx, typingCues } from "./coldframe-sound";

<MusicBed src="music/bed.mp3" volume={0.35} duckAt={[REVEAL]} />
<Sfx role="click-firm" at={PRESS} />                 // the frame the button visibly depresses
<Sfx role="whoosh" at={FASTEST_FRAME} />             // peak lands on `at` automatically
{typingCues(TYPE_START, TYPE_END, cmd.length).map((f) => <Sfx key={f} role="key" at={f} />)}
<Sfx role="key-enter" at={ENTER} />
<Sfx role="confirm" at={RESULT} />
<Sfx role="impact" at={REVEAL} />
```

- Variants rotate and `playbackRate` varies ±3% automatically, so repeated clicks never sound identical.
- Keep every cue frame in the same config object as the visuals (scene-relative frames), so sound and picture can't drift.
- Start with `volume` 1 for effects and 0.3–0.4 for the music bed, then adjust by measuring (§6).
- Audition the whole library: the example project's `SfxAudition` composition (`npx remotion render SfxAudition out/sfx-audition.wav --codec=wav`).
- Need a sound the library doesn't have (riser, deep sub hit, ambience)? Add a CC0 file to `public/sfx/`, note its source in `LICENSE.md`, and ask the user to approve it.

coldframe's chunks carry their audio slice as lossless PCM, so many overlapping `<Audio>` tags render and join sample-exactly in the cloud.

## 6. Levels and loudness

- Final mix: about **-14 LUFS integrated** (YouTube, social), **true peak ≤ -1 dBTP**. Web hero/README versions ship **silent** (strip audio: `ffmpeg -i in.mp4 -an -c:v copy out.mp4`).
- Music bed sits well under effects (roughly -24 to -20 LUFS on its own); duck it 6–10 dB under voiceover and before the big reveal.
- Measure: `ffmpeg -i out.mp4 -af loudnorm=print_format=json -f null -` (integrated, true peak) and `-af volumedetect` (peak). Use the system ffmpeg; Remotion's bundled one lacks these filters.
- No clipping, no pumping, no sound effect louder than the one impact moment.

## 7. Approval before the full render

1. Render the audio only, locally (cheap, no video frames): `npx remotion render <Comp> out/audio-preview.wav --codec=wav`. For long films, cut a 10–15 s sample around the busiest part.
2. Send it to the user with a one-line cue list ("0:03 fly-in whoosh, 0:07 click, 0:09 success chime…") and wait for their OK.
3. Only then render the video in the cloud with coldframe.

## 8. Checklist

- [ ] Music bed chosen by the user (2–3 options offered), license noted, fades in and out cleanly.
- [ ] Every visible click, keystroke, toggle, landing, success and camera move has a matching sound; nothing visible happens in silence unless on purpose.
- [ ] 3–4 sound families, variants rotated, no identical repeats back to back.
- [ ] Impacts on the frame, whoosh peaks on the fastest frame, clicks on the press frame.
- [ ] ~-14 LUFS integrated, true peak ≤ -1 dBTP, no clipping (measured).
- [ ] Audio sample approved by the user before the cloud render.
- [ ] Silent version exported for README / website hero.

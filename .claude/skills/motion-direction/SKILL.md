---
name: motion-direction
description: Direct and build After Effects-level motion in Remotion - cinematic product reveals, 3D/spatial UI, camera moves, depth, match cuts, palette impacts. Use when planning, storyboarding or animating any product, launch, explainer or social video, together with video-rules (what to avoid) and sound-design (audio).
---

# Motion direction

Flat slides with text fading in are not a film. A premium product film has a **camera**, **depth**, **one real product action with a visible result**, **designed transitions**, and **rhythm** (fast moves followed by readable holds). This skill says how to direct that and how to build it in Remotion.

Words like "premium", "wow" or "After Effects style" are goals, not instructions. Always turn them into observable direction: *"camera dollies toward the browser; UI panels separate in Z; the active card snaps into focus; background flips charcoal → cobalt on a 3-frame flash with a low hit."*

## 1. Two-pass workflow (do not skip)

1. **Brief.** Write the four `video-rules` lines (goal, audience, message, placement), then the four layers:
   - *Art:* palette (from the brand), materials, lighting, type, density, mood.
   - *Motion:* what moves, along which path, speed curve, what leads, how it settles.
   - *Scene:* order of reveals, the surprise moment, the feature proved, the final message.
   - *Production:* aspect ratios, platforms, real assets, fps, length, sound deliverable.
2. **Three directions.** Offer three distinct directions. Each gets: a primary style from §2 (+ one supporting texture), palette, one **signature transition**, a 6–8 frame storyboard (one line per frame) and why it fits the audience. The user picks one.
3. **Beat sheet.** For the chosen direction, one row per beat: time · shot · what enters / changes / is proved / exits · camera · foreground/mid/background layers · copy · sound cues · transition out. Get approval.
4. **Styleframes.** Build 4–6 key frames at final quality and show them as stills (`--scale=0.5`) before animating. The look is decided here, not in the render.
5. **Animate, then draft render in the cloud** (coldframe; it's free and doesn't heat the laptop). Watch it, review a contact sheet, give yourself notes in the form below, fix, re-render.

Good notes are mechanical: *"The icon burst happens before the viewer sees the result. Move it after the demo, give the result a 1.5 s hold, cut icons from nine to four, keep the camera still under the final headline."*

## 2. Styles worth naming (pick one primary)

| Style | Look | Motion recipe | Watch out |
|---|---|---|---|
| Cinematic product reveal | Dark or deep negative space, rim light, controlled highlights | Device rises from shadow → camera arcs ~25–30° → screen lights up → square up to a readable front view | Hold product and text long enough to read |
| Kinetic typography | Words are the motion: scale, slice, track, mask | Three short claims on the beat; the last word becomes a mask that reveals the UI | Max one or two lines at once |
| 3D interface explainer | Real screens as stacked cards/panels in depth | UI comes apart by layer → one panel advances → feature plays → layers reassemble | Keep real proportions; text front-facing when read |
| Glass / luminous UI | Frosted panes, blur behind, lit edges | Frosted card slides in front, a highlight runs along its edge, it turns to reveal data | Blur kills legibility; use on one element |
| Editorial minimalism | Big type, whitespace, strict grid, few effects | Sharp statement → clean product crop → slow push-in → benefit | Needs one memorable gesture or it's a slideshow |
| Maximalist energy burst | Fast cuts, palette flips, oversized type, impact frames | Muted intro → hit + colour flip → cards radiate → rapid montage | Social teasers only; add quiet frames between bursts |
| Blueprint to reality | Wireframe/outline becomes polished product | Lines draw on (trim paths) → parts assemble → colour sweeps across → live UI | Great for dev tools, pipelines, build stories |
| Seamless infinite canvas | Connected world of screens, no visible cuts | Zoom into a card → it becomes the next full screen → pull back into a device | Plan the camera path end to end first |
| Data sculpture | Metrics as bars, paths, objects in space | Real input flows through nodes → output → resolves into a result card | Mark metaphor vs. real measured result |

(Also: retro-futurist interface, tactile mixed media, soft organic. Use only when the brand supports it.)

## 3. Motion vocabulary → how to build it in Remotion

Use these exact terms in beat sheets. A few controlled moves beat every effect at once.

| Term | Build it with |
|---|---|
| **Virtual camera** (dolly/push-in, arc/orbit, truck) | Wrap the scene in a `perspective: 1600px` container; animate one "camera" transform on the world: `translate3d`, `rotateY`, `scale`. Children use `transformStyle: preserve-3d`. Keep text you must read front-facing at the end of the move. |
| **Depth planes / parallax** | 3–4 planes (bg, mid, product, fg labels). Each plane's camera offset × its depth factor (e.g. 0.3, 0.6, 1, 1.4). Near moves more than far. |
| **Depth of field / rack focus** | `filter: blur(px)` on out-of-focus planes, animate it to pull focus. Use sparingly (expensive on CPU runners). |
| **Motion blur** | `@remotion/motion-blur` `<CameraMotionBlur shutterAngle={180} samples={8}>` around the fast layer only, or a cheap directional smear (duplicate layer, offset, low opacity) during whips. Never on held text. |
| **Speed curves** | One family per film. Entrances: expo-out `Easing.bezier(0.16,1,0.3,1)`. Exits: expo-in `bezier(0.7,0,0.84,0)`. Camera: `Easing.inOut(Easing.cubic)`. Never linear except constant drift. |
| **Overshoot & settle** | `spring({ frame, fps, config: { damping: 14, stiffness: 140, mass: 0.9 } })` → ~106% then 100%. Only for confirmations (a button press, a success badge), not every entrance. |
| **Anticipation / follow-through** | 3–5 frame dip before a launch; shadows/labels land 2–4 frames after the object. |
| **Stagger** | 2 frames (~60 ms) between related items, in groups. Never stagger everything. |
| **Speed ramp** | Remap time with a piecewise `interpolate(frame, [0, 10, 30], [0, 0.7, 1])`: rush, then decelerate onto the readable state. |
| **Track matte / mask reveal** | `clipPath` (inset, circle, polygon) or `mask-image` / SVG `<mask>` with text; the headline silhouette reveals footage. |
| **Trim paths** | SVG `pathLength={1}` + animated `strokeDasharray`/`strokeDashoffset`. Lines draw on, connectors grow. |
| **Light sweep** | A narrow rotated `linear-gradient` band moving across the product, `mixBlendMode: "soft-light"`, once. |
| **Morph** | Interpolate width/height/radius/position of one element into the next state (pill → command bar, bar → strip). |
| **Exploded view / depth collapse** | Separate UI layers in Z (translateZ per layer), then collapse to 0. |
| **Grain / texture** | A static or slowly shifting noise overlay at 2–4% opacity (`@remotion/noise` or a tiled PNG) so flat vector frames don't look digital-cheap. |
| **Shadows** | Two layered soft shadows (tight + wide) under floating UI. Depth comes from scale, occlusion, shadow and parallax **before** blur. |
| **Device / browser mockup** | Build the frame in JSX (title bar, dots, URL) around real screenshots or rebuilt real UI. No stock 3D phone renders. |

## 4. Transitions that feel designed

Pick one **signature** transition for the film and use each other type at most once or twice. Each needs a reason.

- **Palette impact:** quiet monochrome, then on the product event a 1–3 frame flash, a bass hit, and a new saturated background; change lighting and type contrast at the same moment.
- **Screen portal:** push into a card/device until it fills the frame; its surface *is* the next scene. Match geometry across the cut.
- **Object match:** shot A ends with a shape/motion; shot B starts with the same shape at the same screen position and direction (button → ring → loader; progress bar → timeline).
- **Typography mask:** scale a bold word until a letter's counter fills the frame; reveal the demo through it; remove the type.
- **Depth collapse:** spread components across near/mid/far, pull them together into the final usable UI.
- **UI extraction:** lift a real icon/metric/card out of the screen into space, explain it, put it back in the same place.
- **Whip pan:** fast directional camera move with blur hides the cut; keep direction consistent.
- **Rhythmic stop:** after two or three fast shots, cut to a still product frame with near-silence. The next action lands bigger.

`@remotion/transitions` (`TransitionSeries` with `slide`, `wipe`, `clockWipe`, custom presentations) handles cuts between sequences; camera-based transitions are built in the scene itself.

## 5. Beat template (example, 24–30 s product film)

| Time | What we see | Motion + sound |
|---|---|---|
| 0–3 s | Quiet world, one small line of type, product silhouette far away | Slow push-in; soft music bed enters |
| 3–6 s | Browser/device flies in from depth, rotates ~25°, levels to front | Fast approach, motion blur, slight overshoot, whoosh peaking mid-move, then a readable hold |
| 6–9 s | UI wakes; **one real user action** (click/type) | Cursor moves once, press with click SFX, panel expands |
| 9–12 s | The action's **result**, clearly labelled | 1.5–2 s hold; success chime |
| 12–15 s | Energy shift | Palette impact + low hit; camera pushes through the result |
| 15–20 s | Real capabilities extracted from the UI into space | Staggered by depth, short orbit, resolve into a labelled grid; soft ticks |
| 20–25 s | Resolve around product + headline, then CTA | Motion slows, music resolves, clean end card |

Continuity: every floating icon must be a real capability shown in the product. Show the result **before** the spectacle.

## 6. Quality rules

- One focal point per beat. Never move camera, headline, icons and background at full intensity together.
- Alternate motion and stillness: every fast entrance is followed by a hold the viewer can read (≥ 1.5 s for text).
- One accent colour, used as an **event**; if it's everywhere, the palette impact has no contrast.
- Design each aspect ratio separately. A 16:9 orbit clips in 9:16; re-frame, don't crop.
- The meaning must survive muted playback; sound adds, it doesn't explain.
- Real product only: real screenshots or UI rebuilt to match what exists; exact labels and numbers.
- End on a clean frame: one claim, the product, one CTA with URL.
- 30 fps default (60 for heavy cursor/UI motion, 24 for a filmic look). Budget CPU-heavy effects (blur, motion-blur samples) — they slow cloud renders.

## 7. Checklist before the final render

- [ ] Three directions offered, one picked; beat sheet and styleframes approved.
- [ ] There is a camera: at least push-ins/arcs and 3+ depth planes, not flat slides.
- [ ] One real product action with a visible, held result.
- [ ] One signature transition; other transitions mixed and motivated.
- [ ] Easing from one family; springs only for confirmations; nothing linear by accident.
- [ ] Focal point clear in every contact-sheet frame; holds readable on a phone (check at 390 px wide).
- [ ] Separate framing for every aspect ratio.
- [ ] `sound-design` checklist passed.

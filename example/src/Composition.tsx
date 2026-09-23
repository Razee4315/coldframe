import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Audio } from "@remotion/media";
import { fade } from "@remotion/transitions/fade";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { loadFont as loadGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily: grotesk } = loadGrotesk("normal", { weights: ["500", "700"], subsets: ["latin"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

const C = {
  bg: "#07090C",
  panel: "#0E1319",
  line: "rgba(180,220,255,0.10)",
  text: "#EEF4F8",
  dim: "#7C8B97",
  ice: "#8FD3FF",
  iceDeep: "#3A8DC4",
  ok: "#7FE3B0",
};

const FPS = 30;
const RUNNERS = 8;
const TOTAL_FRAMES = 480;
const T = 12; // transition frames
const SCENES = { title: 112, split: 192, stitch: 116, end: 96 };

const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 over [a, b] with expo-out easing. */
const ease = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: EXPO });

const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: C.bg,
      backgroundImage: `radial-gradient(1200px 700px at 50% 40%, rgba(143,211,255,0.07), transparent 70%),
        linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
      backgroundSize: "100% 100%, 80px 80px, 80px 80px",
      backgroundPosition: "center, -1px -1px, -1px -1px",
    }}
  />
);

const Label: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.08em", textTransform: "uppercase", color: C.dim, ...style }}>
    {children}
  </div>
);

/* ------------------------------------------------------------------ */

const Title: React.FC = () => {
  const f = useCurrentFrame();
  const words = ["Render", "in", "the", "cloud."];
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 180 }}>
      <Label style={{ opacity: ease(f, 0, 20), marginBottom: 28 }}>coldframe · remotion on github actions</Label>
      <div style={{ fontFamily: grotesk, fontWeight: 700, fontSize: 150, lineHeight: 1.02, letterSpacing: "-0.04em", color: C.text }}>
        <div>
          {words.map((w, i) => (
            <Interactive.Span
              key={w}
              name={`Word ${w}`}
              style={{
                display: "inline-block",
                marginRight: 34,
                opacity: ease(f, 4 + i * 5, 30 + i * 5),
                translate: interpolate(f, [4 + i * 5, 34 + i * 5], ["0px 60px", "0px 0px"], { ...clamp, easing: EXPO }),
                filter: `blur(${interpolate(f, [4 + i * 5, 30 + i * 5], [14, 0], clamp)}px)`,
              }}
            >
              {w}
            </Interactive.Span>
          ))}
        </div>
        <Interactive.Div
          name="Second line"
          style={{
            opacity: ease(f, 34, 60),
            translate: interpolate(f, [34, 64], ["0px 50px", "0px 0px"], { ...clamp, easing: EXPO }),
            filter: `blur(${interpolate(f, [34, 58], [14, 0], clamp)}px)`,
            color: C.dim,
          }}
        >
          Your laptop stays{" "}
          <span style={{ color: C.ice, textShadow: `0 0 ${interpolate(f, [55, 80], [0, 40], clamp)}px rgba(143,211,255,0.55)` }}>
            cold.
          </span>
        </Interactive.Div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */

const TRACK = { left: 470, width: 1250, top: 300, gap: 76, h: 30 };
const STRIP = { left: 180, width: 1560, top: 250, h: 30 };
const pieceW = STRIP.width / RUNNERS;
// Each runner finishes at a slightly different time, like real machines do.
const FINISH = [150, 138, 158, 144, 162, 141, 152, 147];

const Split: React.FC = () => {
  const f = useCurrentFrame();
  const split = ease(f, 18, 44); // strip breaks into pieces
  const drop = ease(f, 44, 76); // pieces fly to their runner rows
  const done = FINISH.filter((end) => f >= end).length;
  const rendered = Math.round(
    FINISH.reduce((sum, end) => sum + interpolate(f, [70, end], [0, TOTAL_FRAMES / RUNNERS], clamp), 0),
  );

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 180, top: 110, opacity: ease(f, 0, 18) }}>
        <div style={{ fontFamily: grotesk, fontWeight: 700, fontSize: 64, letterSpacing: "-0.03em", color: C.text }}>
          Split across <span style={{ color: C.ice }}>{RUNNERS} machines.</span>
        </div>
      </div>
      <div style={{ position: "absolute", right: 200, top: 128, textAlign: "right", opacity: ease(f, 60, 80) }}>
        <Label>frames rendered</Label>
        <div style={{ fontFamily: mono, fontSize: 44, color: done === RUNNERS ? C.ok : C.text }}>
          {rendered} / {TOTAL_FRAMES}
        </div>
      </div>

      {Array.from({ length: RUNNERS }).map((_, i) => {
        const from = i * (TOTAL_FRAMES / RUNNERS);
        const to = from + TOTAL_FRAMES / RUNNERS - 1;
        const x0 = STRIP.left + i * pieceW + split * (i - (RUNNERS - 1) / 2) * 10;
        const y0 = STRIP.top + 70;
        const y1 = TRACK.top + 60 + i * TRACK.gap;
        const progress = interpolate(f, [70, FINISH[i]], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
        const finished = f >= FINISH[i];
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: 180,
                top: y1 - 2,
                width: 260,
                opacity: ease(f, 50 + i * 2, 70 + i * 2),
                fontFamily: mono,
                fontSize: 22,
                color: finished ? C.ok : C.dim,
              }}
            >
              runner {String(i + 1).padStart(2, "0")}
              <span style={{ opacity: 0.6 }}> · {from}–{to}</span>
            </div>
            <Interactive.Div
              name={`Chunk ${i + 1}`}
              style={{
                position: "absolute",
                left: interpolate(drop, [0, 1], [x0, TRACK.left]),
                top: interpolate(drop, [0, 1], [y0, y1]),
                width: interpolate(drop, [0, 1], [pieceW - 4 - split * 8, TRACK.width]),
                height: TRACK.h,
                borderRadius: 8,
                backgroundColor: interpolate(drop, [0, 1], [0, 1]) > 0.5 ? C.panel : "rgba(143,211,255,0.18)",
                border: `1px solid ${finished ? "rgba(127,227,176,0.45)" : "rgba(143,211,255,0.28)"}`,
                overflow: "hidden",
                opacity: ease(f, 0, 14),
              }}
            >
              <div
                style={{
                  width: `${progress * 100}%`,
                  height: "100%",
                  background: finished
                    ? `linear-gradient(90deg, ${C.iceDeep}, ${C.ok})`
                    : `linear-gradient(90deg, ${C.iceDeep}, ${C.ice})`,
                  boxShadow: `0 0 24px rgba(143,211,255,${0.35 * progress})`,
                }}
              />
            </Interactive.Div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */

const BAR = { left: 180, width: 1560, top: 470, h: 44 };

const Stitch: React.FC = () => {
  const f = useCurrentFrame();
  const join = ease(f, 6, 40);
  const verified = ease(f, 40, 56);
  const deliver = ease(f, 58, 84);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 180, top: 110, fontFamily: grotesk, fontWeight: 700, fontSize: 64, letterSpacing: "-0.03em", color: C.text }}>
        Stitched. <span style={{ color: C.dim }}>Verified.</span>{" "}
        <span style={{ color: C.ice, opacity: deliver }}>Delivered.</span>
      </div>

      {Array.from({ length: RUNNERS }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: interpolate(join, [0, 1], [TRACK.left, BAR.left + (i * BAR.width) / RUNNERS]),
            top: interpolate(join, [0, 1], [TRACK.top + 60 + i * TRACK.gap, BAR.top]),
            width: interpolate(join, [0, 1], [TRACK.width, BAR.width / RUNNERS + 1]),
            height: interpolate(join, [0, 1], [TRACK.h, BAR.h]),
            borderRadius: interpolate(join, [0, 1], [8, 0]),
            background: `linear-gradient(90deg, ${C.iceDeep}, ${C.ok})`,
            opacity: 0.9,
          }}
        />
      ))}

      <div style={{ position: "absolute", left: BAR.left, top: BAR.top + 80, display: "flex", gap: 48, opacity: verified }}>
        <Label style={{ color: C.ok }}>✓ {TOTAL_FRAMES} / {TOTAL_FRAMES} frames</Label>
        <Label>lossless join · single audio pass · h.264</Label>
      </div>

      <Interactive.Div
        name="Drive pill"
        style={{
          position: "absolute",
          left: BAR.left,
          top: 720,
          opacity: deliver,
          translate: interpolate(deliver, [0, 1], ["0px 30px", "0px 0px"]),
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "22px 34px",
          borderRadius: 18,
          backgroundColor: C.panel,
          border: `1px solid ${C.line}`,
          fontFamily: mono,
          fontSize: 28,
          color: C.text,
        }}
      >
        <DriveGlyph />
        Google Drive <span style={{ color: C.dim }}>/ coldframe /</span> ColdframePromo.mp4
      </Interactive.Div>
    </AbsoluteFill>
  );
};

const DriveGlyph: React.FC = () => (
  <svg width="40" height="36" viewBox="0 0 40 36">
    <path d="M13 1h14l13 22-7 12z" fill="#8FD3FF" opacity="0.9" />
    <path d="M13 1 0 23l7 12L20 13z" fill="#3A8DC4" />
    <path d="M7 35h26l7-12H14z" fill="#7FE3B0" opacity="0.9" />
  </svg>
);

/* ------------------------------------------------------------------ */

const End: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Interactive.Div
        name="Wordmark"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 34,
          opacity: ease(f, 0, 24),
          scale: interpolate(f, [0, 40], [0.94, 1], { ...clamp, easing: EXPO, output: "perceptual-scale" }),
          filter: `blur(${interpolate(f, [0, 20], [12, 0], clamp)}px)`,
        }}
      >
        <FrameMark size={120} />
        <div style={{ fontFamily: grotesk, fontWeight: 700, fontSize: 150, letterSpacing: "-0.05em", color: C.text }}>
          coldframe
        </div>
      </Interactive.Div>
      <div style={{ marginTop: 34, fontFamily: grotesk, fontWeight: 500, fontSize: 40, color: C.dim, opacity: ease(f, 18, 40) }}>
        Free. Parallel. Open source.
      </div>
      <Label style={{ marginTop: 60, color: C.ice, opacity: ease(f, 30, 52) }}>github.com/Razee4315/coldframe</Label>
    </AbsoluteFill>
  );
};

export const FrameMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <rect x="4" y="4" width="56" height="56" rx="14" fill="none" stroke="#8FD3FF" strokeWidth="4" />
    <rect x="16" y="16" width="14" height="32" rx="3" fill="#3A8DC4" />
    <rect x="34" y="16" width="14" height="32" rx="3" fill="#8FD3FF" />
  </svg>
);

/* ------------------------------------------------------------------ */

export const ColdframePromo: React.FC = () => (
  <AbsoluteFill>
    <Backdrop />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENES.title} name="Title">
        <Title />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={SCENES.split} name="Split">
        <Split />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={SCENES.stitch} name="Stitch">
        <Stitch />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />
      <TransitionSeries.Sequence durationInFrames={SCENES.end} name="End">
        <End />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Audio src={staticFile("soundtrack.wav")} />
  </AbsoluteFill>
);

const DURATION = SCENES.title + SCENES.split + SCENES.stitch + SCENES.end - 3 * T; // 480

export const MyComposition = () => (
  <Composition id="ColdframePromo" component={ColdframePromo} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
);

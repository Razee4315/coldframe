import React from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Interactive,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadDisplay } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadBody } from "@remotion/google-fonts/InstrumentSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

// Written to the rules in .claude/skills/video-rules/SKILL.md:
// problem-first hook, one message, real numbers only, brand palette (no dark
// + glow), one emphasis technique (colour on the key word), mixed transitions.

const { fontFamily: display } = loadDisplay("normal", { weights: ["700"], subsets: ["latin"] });
const { fontFamily: body } = loadBody("normal", { weights: ["500"], subsets: ["latin"] });
const { fontFamily: mono } = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

const C = {
  frost: "#F3F6F7",
  panel: "#FFFFFF",
  line: "rgba(13,27,36,0.10)",
  ink: "#0D1B24",
  dim: "#5A6B77",
  cobalt: "#1D5FD0",
  cerulean: "#1FA0DC",
  ice: "#7FD6EE",
  ember: "#E4572E",
  ok: "#1E9D63",
};

const FPS = 30;
const RUNNERS = 8;
const TOTAL_FRAMES = 600;
// Scene starts (frames). Hard cuts between scenes except where noted.
const AT = { problem: 0, solution: 84, split: 174, stitch: 384, cta: 489, end: 600 };

const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: EXPO });

/** Text rising from behind an invisible line (mask reveal). */
const Reveal: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.08em", ...style }}>
      <Interactive.Div
        name="Reveal"
        style={{ translate: interpolate(f, [at, at + 18], ["0px 105%", "0px 0%"], { ...clamp, easing: EXPO }) }}
      >
        {children}
      </Interactive.Div>
    </div>
  );
};

const Mono: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontFamily: mono, fontSize: 30, color: C.dim, fontVariantNumeric: "tabular-nums", ...style }}>{children}</div>
);

const H: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 104, style }) => (
  <div style={{ fontFamily: display, fontWeight: 700, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.035em", color: C.ink, ...style }}>
    {children}
  </div>
);

/** The coldframe mark: a play button cut into three slices. */
export const Mark: React.FC<{ size: number; progress?: number }> = ({ size, progress = 1 }) => {
  const slices = [
    { pts: "11,7 23.8,13.4 23.8,50.6 11,57", c: C.cobalt },
    { pts: "28,15.5 40.8,21.9 40.8,42.1 28,48.5", c: C.cerulean },
    { pts: "45,24 57,32 45,40", c: C.ice },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      {slices.map((s, i) => (
        <polygon
          key={i}
          points={s.pts}
          fill={s.c}
          stroke={s.c}
          strokeWidth={2.2}
          strokeLinejoin="round"
          opacity={interpolate(progress, [i * 0.2, i * 0.2 + 0.4], [0, 1], clamp)}
          transform={`translate(${interpolate(progress, [i * 0.2, i * 0.2 + 0.4], [-6, 0], { ...clamp, easing: EXPO })} 0)`}
        />
      ))}
    </svg>
  );
};

const BAR = { left: 260, width: 1400, top: 760, h: 26 };

/* 1. Problem (hook) ------------------------------------------------- */

const Problem: React.FC = () => {
  const f = useCurrentFrame();
  const pct = interpolate(f, [0, 84], [11, 14], clamp);
  return (
    <AbsoluteFill style={{ padding: "0 260px", justifyContent: "center" }}>
      <Mono style={{ opacity: ease(f, 0, 8) }}>render · MyVideo.mp4 · on this laptop</Mono>
      <Reveal at={2} style={{ marginTop: 22 }}>
        <H size={128}>
          Your laptop is <span style={{ color: C.ember }}>stuck.</span>
        </H>
      </Reveal>
      <div style={{ position: "absolute", left: BAR.left, top: BAR.top, width: BAR.width }}>
        <div style={{ height: BAR.h, borderRadius: 6, background: C.panel, border: `1px solid ${C.line}`, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: C.ember }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <Mono>{pct.toFixed(1)}%</Mono>
          <Mono style={{ color: C.ember }}>CPU 100% · fans on</Mono>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* 2. Solution -------------------------------------------------------- */

const Solution: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: "0 260px", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: -120 }}>
        <Mark size={84} progress={ease(f, 0, 22)} />
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 64, letterSpacing: "-0.045em", color: C.ink, opacity: ease(f, 6, 20) }}>
          coldframe
        </div>
      </div>
      <Reveal at={10} style={{ marginTop: 40 }}>
        <H>
          Render it on <span style={{ color: C.cobalt }}>GitHub</span> instead.
        </H>
      </Reveal>
      {/* The timeline bar that becomes the split strip in the next scene (match cut). */}
      <div style={{ position: "absolute", left: BAR.left, top: BAR.top, width: BAR.width }}>
        <div
          style={{
            height: BAR.h,
            width: `${interpolate(f, [44, 76], [0, 100], { ...clamp, easing: EXPO })}%`,
            borderRadius: 6,
            background: C.ink,
          }}
        />
        <Mono style={{ marginTop: 16, opacity: ease(f, 56, 70) }}>MyVideo · 600 frames</Mono>
      </div>
    </AbsoluteFill>
  );
};

/* 3. Demo: split across machines ------------------------------------- */

const ROWS = { top: 300, gap: 66, left: 560, width: 1100 };
// Real machines finish at different times.
const FINISH = [150, 138, 166, 144, 172, 141, 156, 147];

const Split: React.FC = () => {
  const f = useCurrentFrame();
  const split = ease(f, 6, 26);
  const drop = ease(f, 24, 52);
  const pieceW = BAR.width / RUNNERS;
  const done = FINISH.filter((end) => f >= end).length;
  const rendered = Math.round(
    FINISH.reduce((sum, end) => sum + interpolate(f, [52, end], [0, TOTAL_FRAMES / RUNNERS], clamp), 0),
  );
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: BAR.left, top: 120 }}>
        <Reveal at={4}>
          <H size={84}>
            Split across <span style={{ color: C.cobalt }}>8 machines.</span>
          </H>
        </Reveal>
      </div>
      <div style={{ position: "absolute", right: 260, top: 138, textAlign: "right", opacity: ease(f, 50, 62) }}>
        <Mono style={{ fontSize: 22 }}>frames rendered</Mono>
        <Mono style={{ fontSize: 48, color: done === RUNNERS ? C.ok : C.ink }}>
          {String(rendered).padStart(3, " ")} / {TOTAL_FRAMES}
        </Mono>
      </div>
      {FINISH.map((end, i) => {
        const from = i * (TOTAL_FRAMES / RUNNERS);
        const x0 = BAR.left + i * pieceW + split * (i - (RUNNERS - 1) / 2) * 8;
        const y1 = ROWS.top + i * ROWS.gap;
        const progress = interpolate(f, [52, end], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
        const finished = f >= end;
        return (
          <React.Fragment key={i}>
            <Mono
              style={{
                position: "absolute",
                left: BAR.left,
                top: y1 - 4,
                fontSize: 24,
                opacity: ease(f, 40 + i * 2, 54 + i * 2),
                color: finished ? C.ok : C.dim,
              }}
            >
              {finished ? "✓" : "·"} runner {String(i + 1).padStart(2, "0")}  {from}–{from + TOTAL_FRAMES / RUNNERS - 1}
            </Mono>
            <Interactive.Div
              name={`Chunk ${i + 1}`}
              style={{
                position: "absolute",
                left: interpolate(drop, [0, 1], [x0, ROWS.left]),
                top: interpolate(drop, [0, 1], [BAR.top, y1]),
                width: interpolate(drop, [0, 1], [pieceW - split * 7, ROWS.width]),
                height: BAR.h,
                borderRadius: 6,
                background: drop > 0.5 ? C.panel : C.ink,
                border: `1px solid ${C.line}`,
                overflow: "hidden",
              }}
            >
              <div style={{ width: `${progress * 100}%`, height: "100%", background: finished ? C.cobalt : C.cerulean }} />
            </Interactive.Div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

/* 4. Proof: stitched and checked ------------------------------------- */

const Stitch: React.FC = () => {
  const f = useCurrentFrame();
  const join = ease(f, 0, 26);
  const pieceW = BAR.width / RUNNERS;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: BAR.left, top: 300 }}>
        <Reveal at={18}>
          <H>
            Stitched. Every frame <span style={{ color: C.cobalt }}>checked.</span>
          </H>
        </Reveal>
      </div>
      {FINISH.map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: interpolate(join, [0, 1], [ROWS.left, BAR.left + i * pieceW]),
            top: interpolate(join, [0, 1], [ROWS.top + i * ROWS.gap, BAR.top - 180]),
            width: interpolate(join, [0, 1], [ROWS.width, pieceW + 0.5]),
            height: BAR.h,
            borderRadius: interpolate(join, [0, 1], [6, 0]),
            background: C.cobalt,
          }}
        />
      ))}
      <div style={{ position: "absolute", left: BAR.left, top: BAR.top - 130, display: "flex", flexWrap: "wrap", width: BAR.width, columnGap: 56, rowGap: 14, opacity: ease(f, 30, 42) }}>
        <Mono style={{ color: C.ok, fontSize: 36 }}>✓ 600 / 600 frames</Mono>
        <Mono style={{ fontSize: 36 }}>audio joined sample-exact</Mono>
        <Mono style={{ fontSize: 36 }}>your laptop: free the whole time</Mono>
      </div>
    </AbsoluteFill>
  );
};

/** Wipe with a cobalt leading edge, from Stitch into the end card. */
const Wipe: React.FC = () => {
  const f = useCurrentFrame();
  const x = interpolate(f, [0, 16], [-110, 110], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${x}%`, width: "100%", background: C.frost, borderLeft: `10px solid ${C.cobalt}` }} />
    </AbsoluteFill>
  );
};

/* 5. CTA --------------------------------------------------------------- */

const Cta: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: ease(f, 6, 22) }}>
        <Mark size={128} progress={ease(f, 4, 30)} />
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 140, letterSpacing: "-0.05em", color: C.ink }}>coldframe</div>
      </div>
      <div style={{ marginTop: 28, fontFamily: body, fontWeight: 500, fontSize: 44, color: C.dim, opacity: ease(f, 16, 32) }}>
        Install in <span style={{ color: C.cobalt }}>one command.</span>
      </div>
      <div
        style={{
          marginTop: 44,
          padding: "22px 34px",
          borderRadius: 16,
          background: C.ink,
          color: C.frost,
          fontFamily: mono,
          fontSize: 42,
          opacity: ease(f, 26, 40),
        }}
      >
        <span style={{ color: C.ice }}>$</span> npx github:Razee4315/coldframe init
      </div>
      <Mono style={{ marginTop: 36, fontSize: 38, color: C.ink, opacity: ease(f, 34, 48) }}>razee4315.github.io/coldframe</Mono>
    </AbsoluteFill>
  );
};

/* --------------------------------------------------------------------- */

export const ColdframePromo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.frost }}>
    <Sequence from={AT.problem} durationInFrames={AT.solution - AT.problem} name="1 Problem">
      <Problem />
    </Sequence>
    <Sequence from={AT.solution} durationInFrames={AT.split - AT.solution} name="2 Solution">
      <Solution />
    </Sequence>
    <Sequence from={AT.split} durationInFrames={AT.stitch - AT.split} name="3 Split">
      <Split />
    </Sequence>
    <Sequence from={AT.stitch} durationInFrames={AT.cta - AT.stitch} name="4 Stitch">
      <Stitch />
    </Sequence>
    <Sequence from={AT.cta} durationInFrames={AT.end - AT.cta} name="5 CTA">
      <Cta />
    </Sequence>
    <Sequence from={AT.cta - 8} durationInFrames={18} name="Wipe">
      <Wipe />
    </Sequence>
    <Audio src={staticFile("soundtrack.wav")} />
  </AbsoluteFill>
);

export const MyComposition = () => (
  <Composition id="ColdframePromo" component={ColdframePromo} durationInFrames={AT.end} fps={FPS} width={1920} height={1080} />
);

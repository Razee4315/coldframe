import React, { createContext, useContext } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadBody } from "@remotion/google-fonts/InstrumentSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import LAUNCH from "./launch.json";

export { LAUNCH };
export const C = LAUNCH.colors;

export const fonts = {
  display: loadDisplay("normal", { weights: ["700"], subsets: ["latin"] }).fontFamily,
  body: loadBody("normal", { weights: ["500"], subsets: ["latin"] }).fontFamily,
  mono: loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily,
};

// One motion language for the whole film: expo-out.
export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ease = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: EXPO });
export const mix = (t: number, a: number, b: number) => a + (b - a) * t;

/* Layout: the 16:9 film and the 9:16 cuts share scenes but not positions. ------------- */

export type Rect = { x: number; y: number; w: number; h: number };

export type Layout = {
  tall: boolean;
  W: number;
  H: number;
  padL: number;
  contentW: number;
  headTop: number;
  head: number; // headline size
  bar: Rect; // the laptop progress bar / timeline strip
};

const WIDE: Layout = {
  tall: false,
  W: 1920,
  H: 1080,
  padL: 200,
  contentW: 1520,
  headTop: 170,
  head: 104,
  bar: { x: 200, y: 800, w: 1520, h: 24 },
};

// Vertical: text stays out of the right 160 px and the bottom 20% (platform buttons).
const TALL: Layout = {
  tall: true,
  W: 1080,
  H: 1920,
  padL: 80,
  contentW: 840,
  headTop: 250,
  head: 100,
  bar: { x: 80, y: 1200, w: 840, h: 24 },
};

export const layouts = { wide: WIDE, tall: TALL };
const LayoutCtx = createContext<Layout>(WIDE);
export const LayoutProvider = LayoutCtx.Provider;
export const useLayout = () => useContext(LayoutCtx);

/* Type ------------------------------------------------------------------------------- */

/** A line split into [plain, key, plain...]; odd parts get the one emphasis: colour. */
export const Emph: React.FC<{ parts: string[]; color?: string }> = ({ parts, color = C.cobalt }) => (
  <>
    {parts.map((p, i) => (
      <span key={i} style={i % 2 ? { color } : undefined}>
        {p}
      </span>
    ))}
  </>
);

/** Text rising from behind an invisible line (mask reveal). */
export const Reveal: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.1em", ...style }}>
      <div style={{ transform: `translateY(${interpolate(f, [at, at + 18], [105, 0], { ...clamp, easing: EXPO })}%)` }}>{children}</div>
    </div>
  );
};

export const Headline: React.FC<{ at: number; parts: string[]; color?: string; size?: number; top?: number }> = ({ at, parts, color, size, top }) => {
  const L = useLayout();
  return (
    <div style={{ position: "absolute", left: L.padL, top: top ?? L.headTop, width: L.contentW }}>
      <Reveal at={at}>
        <div
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: size ?? L.head,
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
            color: C.ink,
          }}
        >
          <Emph parts={parts} color={color} />
        </div>
      </Reveal>
    </div>
  );
};

export const Mono: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontFamily: fonts.mono, fontSize: 30, color: C.dim, fontVariantNumeric: "tabular-nums", whiteSpace: "pre", ...style }}>
    {children}
  </div>
);

export const Check: React.FC<{ size?: number; color?: string }> = ({ size = 28, color = C.ok }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "none" }}>
    <circle cx="12" cy="12" r="11" fill={color} />
    <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Pending: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "none" }}>
    <circle cx="12" cy="12" r="10" fill="none" stroke={C.dim} strokeOpacity={0.45} strokeWidth="2" strokeDasharray="3 3" />
  </svg>
);

export const box = (r: Rect): React.CSSProperties => ({ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h });
export const lerpRect = (t: number, a: Rect, b: Rect): Rect => ({
  x: mix(t, a.x, b.x),
  y: mix(t, a.y, b.y),
  w: mix(t, a.w, b.w),
  h: mix(t, a.h, b.h),
});

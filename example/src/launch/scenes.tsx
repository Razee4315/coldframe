import React from "react";
import { AbsoluteFill, Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { Mark } from "../Composition";
import {
  box,
  C,
  Check,
  clamp,
  ease,
  Emph,
  EXPO,
  fonts,
  Headline,
  LAUNCH,
  lerpRect,
  Mono,
  Pending,
  Rect,
  Reveal,
  useLayout,
  Layout,
} from "./ui";

const T = LAUNCH.text;
const RUN = LAUNCH.run;
const N = RUN.chunkSeconds.length;
const PER = RUN.frames / N;

/* Shared pieces ----------------------------------------------------------------------- */

/** The render progress bar on the laptop; in the solution it becomes the video's timeline strip. */
const LaptopBar: React.FC<{ p: number; color?: string; label?: React.ReactNode; labelOpacity?: number }> = ({ p, color = C.ember, label, labelOpacity = 1 }) => {
  const L = useLayout();
  return (
    <div style={{ position: "absolute", left: L.bar.x, top: L.bar.y, width: L.bar.w }}>
      <div style={{ height: L.bar.h, borderRadius: 6, background: C.panel, border: `1px solid ${C.line}`, overflow: "hidden" }}>
        <div style={{ width: `${p * 100}%`, height: "100%", background: color }} />
      </div>
      <Mono style={{ marginTop: 16, opacity: labelOpacity }}>{label ?? `frame ${Math.round(p * RUN.frames)} / ${RUN.frames}`}</Mono>
    </div>
  );
};

/** Eight CPU threads pinned near 100%. */
const CpuMeter: React.FC<{ rect: Rect }> = ({ rect }) => {
  const f = useCurrentFrame();
  const bw = rect.w / 8;
  return (
    <div style={box(rect)}>
      <Mono style={{ position: "absolute", top: -48, color: C.ember, fontSize: 28 }}>CPU 100%</Mono>
      {Array.from({ length: 8 }, (_, i) => {
        const h = 0.95 + 0.05 * Math.sin(f * 0.9 + i * 1.7) * Math.sin(f * 0.37 + i);
        return (
          <div key={i} style={{ position: "absolute", left: i * bw, bottom: 0, width: bw - 12, height: rect.h, borderRadius: 6, background: C.panel, border: `1px solid ${C.line}`, overflow: "hidden" }}>
            <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${h * 100}%`, background: C.ember }} />
          </div>
        );
      })}
    </div>
  );
};

const cpuRect = (L: Layout): Rect => (L.tall ? { x: L.padL, y: 820, w: 640, h: 240 } : { x: 1384, y: 560, w: 336, h: 190 });

/* 1. Hook ---------------------------------------------------------------------------- */

export const Hook: React.FC<{ s: { dur: number; textAt: number; p0: number; p1: number } }> = ({ s }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  return (
    <AbsoluteFill>
      <Mono style={{ position: "absolute", left: L.padL, top: L.headTop - 58, opacity: ease(f, 0, 8) }}>{T.hookLabel}</Mono>
      <Headline at={s.textAt} parts={T.hook} color={C.ember} size={L.tall ? 128 : 124} />
      <CpuMeter rect={cpuRect(L)} />
      <LaptopBar p={interpolate(f, [0, s.dur], [s.p0, s.p1], clamp)} />
    </AbsoluteFill>
  );
};

/* 2. Problem: every edit means another render ----------------------------------------- */

export const Edit: React.FC<{ s: { dur: number; textAt: number; typeAt: number; resetAt: number; p0: number; p1: number } }> = ({ s }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  // Caret deletes "96" and types "104".
  const t = f - s.typeAt;
  const value = t < 0 ? "96" : t < 3 ? "9" : t < 6 ? "" : "104".slice(0, Math.min(3, Math.floor((t - 6) / 3) + 1));
  const caret = t >= 0 ? true : Math.floor(f / 15) % 2 === 0;
  const p = f < s.resetAt ? s.p0 : interpolate(f, [s.resetAt, s.dur], [0, s.p1], clamp);
  const card: Rect = L.tall ? { x: L.padL, y: 540, w: L.contentW, h: 130 } : { x: L.padL, y: 470, w: 820, h: 130 };
  return (
    <AbsoluteFill>
      <div style={{ ...box(card), borderRadius: 16, background: C.panel, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", padding: "0 36px", gap: 32 }}>
        <Mono style={{ fontSize: 30, opacity: 0.5 }}>14</Mono>
        <Mono style={{ fontSize: 40, color: C.ink }}>
          <span style={{ color: C.cobalt }}>fontSize</span>: {value}
          <span style={{ display: "inline-block", width: 3, height: 44, marginLeft: 2, verticalAlign: -8, background: C.ink, opacity: caret ? 1 : 0 }} />,
        </Mono>
      </div>
      <Headline at={s.textAt} parts={T.edit} color={C.ember} />
      <CpuMeter rect={cpuRect(L)} />
      <LaptopBar p={p} />
    </AbsoluteFill>
  );
};

/* 3. Problem: nothing else runs ------------------------------------------------------- */

export const Blocked: React.FC<{ s: { dur: number; textAt: number; p0: number; p1: number } }> = ({ s }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const zoom = interpolate(f, [0, 26], [1.22, 1], { ...clamp, easing: EXPO });
  const w = (L.contentW - 80) / 3;
  return (
    <AbsoluteFill>
      <Headline at={s.textAt} parts={T.blocked} color={C.ember} />
      <div style={{ position: "absolute", left: L.padL, top: 380, width: L.contentW, height: 330, transform: `scale(${zoom})`, transformOrigin: "50% 50%" }}>
        {T.blockedApps.map((name, i) => (
          <div key={name} style={{ position: "absolute", left: i * (w + 40), top: 0, width: w, height: 330, borderRadius: 16, background: C.panel, border: `1px solid ${C.line}`, overflow: "hidden" }}>
            <div style={{ height: 52, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 10, padding: "0 20px" }}>
              {[0, 1, 2].map((d) => (
                <div key={d} style={{ width: 12, height: 12, borderRadius: 6, background: C.line }} />
              ))}
              <Mono style={{ fontSize: 22, marginLeft: 12 }}>{name}</Mono>
            </div>
            <div style={{ padding: 28, opacity: 0.35 }}>
              {[0.8, 0.55, 0.7, 0.4].map((lw, k) => (
                <div key={k} style={{ width: `${lw * 100}%`, height: 16, borderRadius: 8, background: C.dim, marginBottom: 22 }} />
              ))}
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
              <svg width={30} height={30} viewBox="0 0 30 30" style={{ transform: `rotate(${f * 9 + i * 40}deg)` }}>
                <circle cx="15" cy="15" r="11" fill="none" stroke={C.line} strokeWidth="4" />
                <path d="M15 4 a11 11 0 0 1 11 11" fill="none" stroke={C.dim} strokeWidth="4" strokeLinecap="round" />
              </svg>
              <Mono style={{ fontSize: 26 }}>waiting…</Mono>
            </div>
          </div>
        ))}
      </div>
      <LaptopBar p={interpolate(f, [0, s.dur], [s.p0, s.p1], clamp)} />
    </AbsoluteFill>
  );
};

/* 4. Solution ------------------------------------------------------------------------- */

export const Solution: React.FC<{ s: { dur: number; markAt: number; textAt: number; stripAt: number; p0: number } }> = ({ s }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const grow = ease(f, s.stripAt, s.stripAt + 30);
  const top = L.headTop;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: L.padL, top, display: "flex", alignItems: "center", gap: 18 }}>
        <Mark size={L.tall ? 84 : 72} progress={ease(f, s.markAt, s.markAt + 22)} />
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: L.tall ? 64 : 56, letterSpacing: "-0.045em", color: C.ink, opacity: ease(f, s.markAt + 4, s.markAt + 18) }}>
          coldframe
        </div>
      </div>
      <Headline at={s.textAt} parts={T.solution} top={top + (L.tall ? 140 : 120)} />
      <LaptopBar
        p={s.p0 + (1 - s.p0) * grow}
        color={interpolateColors(ease(f, s.stripAt, s.stripAt + 12), [0, 1], [C.ember, C.ink])}
        label={f < s.stripAt + 10 ? undefined : T.strip}
        labelOpacity={f < s.stripAt ? 1 : f < s.stripAt + 10 ? 1 - ease(f, s.stripAt, s.stripAt + 6) : ease(f, s.stripAt + 10, s.stripAt + 20)}
      />
    </AbsoluteFill>
  );
};

/* 5. One command ---------------------------------------------------------------------- */

export const Command: React.FC<{ s: { dur: number; textAt: number; typeAt: number; typeEnd: number; enterAt: number; collapseAt: number } }> = ({ s }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const card: Rect = L.tall ? { x: L.padL, y: 560, w: L.contentW, h: 470 } : { x: L.padL, y: 340, w: L.contentW, h: 300 };
  const open = ease(f, 0, 18);
  const collapse = interpolate(f, [s.collapseAt, s.collapseAt + 18], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const r = lerpRect(collapse, card, L.bar);
  const typed = Math.round(interpolate(f, [s.typeAt, s.typeEnd], [0, T.cmd.length], clamp));
  const contentOpacity = 1 - ease(f, s.collapseAt, s.collapseAt + 6);
  return (
    <AbsoluteFill>
      <Headline at={s.textAt} parts={T.command} />
      <div
        style={{
          ...box(r),
          borderRadius: interpolate(collapse, [0, 1], [18, 6]),
          background: C.ink,
          overflow: "hidden",
          clipPath: `inset(${(1 - open) * 50}% ${(1 - open) * 10}% round 18px)`,
        }}
      >
        <div style={{ opacity: contentOpacity }}>
          <div style={{ height: 56, display: "flex", alignItems: "center", gap: 10, padding: "0 24px", borderBottom: "1px solid rgba(243,246,247,0.08)" }}>
            {[0, 1, 2].map((d) => (
              <div key={d} style={{ width: 13, height: 13, borderRadius: 7, background: "rgba(243,246,247,0.18)" }} />
            ))}
            <Mono style={{ fontSize: 22, marginLeft: 14, color: "rgba(243,246,247,0.45)" }}>coldframe — bash</Mono>
          </div>
          <div style={{ padding: L.tall ? "34px 34px" : "36px 40px" }}>
            <Mono style={{ fontSize: L.tall ? 34 : 32, color: C.frost, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              <span style={{ color: C.ice }}>$ </span>
              {T.cmd.slice(0, typed)}
              <span style={{ display: "inline-block", width: 16, height: 34, verticalAlign: -6, background: C.ice, opacity: f < s.enterAt && (f < s.typeEnd || Math.floor(f / 12) % 2 === 0) ? 0.9 : 0 }} />
            </Mono>
            <Mono style={{ marginTop: 18, fontSize: L.tall ? 28 : 28, color: "rgba(243,246,247,0.78)", whiteSpace: "pre-wrap", lineHeight: 1.45, opacity: f >= s.enterAt + 4 ? 1 : 0 }}>
              {T.cmdOut}
            </Mono>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* 6. Split across 8 machines (laid out like the real Actions run graph) ---------------- */

type Graph = { rows: Rect[]; plan: Rect; stitch: Rect; matrix: Rect; source: { x: number; y: number }; counter: { x: number; y: number } };

export const graph = (L: Layout): Graph => {
  if (L.tall) {
    const x = 100, w = 800, h = 50, gap = 62, y0 = 650;
    const rows = Array.from({ length: N }, (_, i) => ({ x, y: y0 + i * gap, w, h }));
    return {
      rows,
      plan: { x: L.padL, y: 520, w: L.contentW, h: 62 },
      matrix: { x: L.padL, y: y0 - 38, w: L.contentW, h: (N - 1) * gap + h + 58 },
      stitch: { x: L.padL, y: y0 + (N - 1) * gap + h + 62, w: L.contentW, h: 62 },
      source: { x: L.padL, y: 1330 },
      counter: { x: L.padL, y: 1392 },
    };
  }
  const x = 640, w = 640, h = 54, gap = 64, y0 = 290;
  const rows = Array.from({ length: N }, (_, i) => ({ x, y: y0 + i * gap, w, h }));
  const mid = y0 + ((N - 1) * gap + h) / 2;
  return {
    rows,
    plan: { x: L.padL, y: mid - 32, w: 320, h: 64 },
    matrix: { x: x - 30, y: y0 - 40, w: w + 60, h: (N - 1) * gap + h + 64 },
    stitch: { x: 1400, y: mid - 32, w: 320, h: 64 },
    source: { x: L.padL, y: 890 },
    counter: { x: 1400, y: 150 },
  };
};

const Node: React.FC<{ r: Rect; label: string; time?: string; done: boolean; opacity: number }> = ({ r, label, time, done, opacity }) => (
  <div style={{ ...box(r), opacity, borderRadius: 12, background: C.panel, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 14, padding: "0 20px" }}>
    {done ? <Check /> : <Pending />}
    <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 28, color: C.ink, flex: 1 }}>{label}</div>
    {time && <Mono style={{ fontSize: 24 }}>{time}</Mono>}
  </div>
);

const Wires: React.FC<{ g: Graph; tall: boolean; opacity: number }> = ({ g, tall, opacity }) => {
  const dot = (x: number, y: number) => <div style={{ position: "absolute", left: x - 7, top: y - 7, width: 14, height: 14, borderRadius: 7, background: C.cobalt }} />;
  if (tall) {
    const cx = g.plan.x + g.plan.w / 2;
    const a = g.plan.y + g.plan.h, b = g.matrix.y, c = g.matrix.y + g.matrix.h, d = g.stitch.y;
    return (
      <div style={{ position: "absolute", inset: 0, opacity }}>
        <div style={{ position: "absolute", left: cx - 1.5, top: a, width: 3, height: b - a, background: C.cobalt }} />
        <div style={{ position: "absolute", left: cx - 1.5, top: c, width: 3, height: d - c, background: C.cobalt }} />
        {dot(cx, a)}
        {dot(cx, b)}
        {dot(cx, c)}
        {dot(cx, d)}
      </div>
    );
  }
  const cy = g.plan.y + g.plan.h / 2;
  const a = g.plan.x + g.plan.w, b = g.matrix.x, c = g.matrix.x + g.matrix.w, d = g.stitch.x;
  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      <div style={{ position: "absolute", left: a, top: cy - 1.5, width: b - a, height: 3, background: C.cobalt }} />
      <div style={{ position: "absolute", left: c, top: cy - 1.5, width: d - c, height: 3, background: C.cobalt }} />
      {dot(a, cy)}
      {dot(b, cy)}
      {dot(c, cy)}
      {dot(d, cy)}
    </div>
  );
};

const chunkLabel = (i: number) => `Chunk ${String(i).padStart(2, "0")} (${i * PER}–${(i + 1) * PER - 1})`;

/** One chunk row: status, label, progress along the bottom, real time when finished. */
const Row: React.FC<{ r: Rect; i: number; progress: number; done: boolean; bg: string; content: number; fill?: string }> = ({ r, i, progress, done, bg, content, fill = C.cobalt }) => (
  <div style={{ ...box(r), borderRadius: 10, background: bg, border: `1px solid ${C.line}`, overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", opacity: content }}>
      {done ? <Check size={26} /> : <Pending size={26} />}
      <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 28, color: C.ink, flex: 1, whiteSpace: "nowrap" }}>{chunkLabel(i)}</div>
      <Mono style={{ fontSize: 24, opacity: done ? 1 : 0 }}>{RUN.chunkSeconds[i]}s</Mono>
    </div>
    <div style={{ position: "absolute", left: 0, bottom: 0, height: 4, width: `${progress * 100}%`, background: fill, opacity: content }} />
  </div>
);

/** Frame (scene-local) at which each chunk finishes: real durations, scaled to fit. */
export const finishFrames = (s: { fillAt: number; fillEnd: number }) => {
  const max = Math.max(...RUN.chunkSeconds);
  return RUN.chunkSeconds.map((sec) => Math.round(s.fillAt + (sec / max) * (s.fillEnd - s.fillAt)));
};

export const Split: React.FC<{ s: { dur: number; textAt: number; splitAt: number; dropAt: number; planAt: number; fillAt: number; fillEnd: number; counter?: boolean } }> = ({ s }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const g = graph(L);
  const spread = ease(f, s.splitAt, s.splitAt + 16);
  const pw = L.bar.w / N;
  const fin = finishFrames(s);
  const allDone = f >= s.fillEnd;
  const rendered = Math.round(fin.reduce((sum, end) => sum + interpolate(f, [s.fillAt, end], [0, PER], clamp), 0));
  return (
    <AbsoluteFill>
      <Headline at={s.textAt} parts={T.split} size={L.tall ? 92 : 84} top={L.tall ? L.headTop : 110} />
      <div style={{ ...box(g.matrix), borderRadius: 16, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.45)", opacity: ease(f, s.planAt, s.planAt + 12) }}>
        {!L.tall && <Mono style={{ position: "absolute", left: 18, top: -36, fontSize: 20 }}>Matrix: render / chunk</Mono>}
      </div>
      <Wires g={g} tall={L.tall} opacity={ease(f, s.planAt, s.planAt + 12)} />
      <Node r={g.plan} label="Plan" time={`${RUN.planSeconds}s`} done opacity={ease(f, s.planAt, s.planAt + 12)} />
      <Node r={g.stitch} label="Stitch + deliver" done={false} opacity={ease(f, s.planAt + 4, s.planAt + 16)} />
      {RUN.chunkSeconds.map((_, i) => {
        const piece: Rect = { x: L.bar.x + i * pw + spread * (i - (N - 1) / 2) * 10, y: L.bar.y, w: pw - spread * 8, h: L.bar.h };
        const drop = interpolate(f, [s.dropAt + i * 1, s.dropAt + 24 + i * 1], [0, 1], { ...clamp, easing: EXPO });
        return (
          <Row
            key={i}
            i={i}
            r={lerpRect(drop, piece, g.rows[i])}
            bg={interpolateColors(drop, [0.35, 0.7], [C.ink, C.panel])}
            content={ease(f, s.dropAt + 16, s.dropAt + 28)}
            progress={interpolate(f, [s.fillAt, fin[i]], [0, 1], clamp)}
            done={f >= fin[i]}
          />
        );
      })}
      <Mono style={{ position: "absolute", left: g.source.x, top: g.source.y, fontSize: L.tall ? 24 : 22, opacity: ease(f, s.fillAt, s.fillAt + 12) }}>{T.splitSource}</Mono>
      {s.counter && (
        <div style={{ position: "absolute", left: g.counter.x, top: g.counter.y, display: "flex", alignItems: "center", gap: 18, opacity: ease(f, s.fillAt, s.fillAt + 10) }}>
          {allDone && <Check size={48} />}
          <Mono style={{ fontSize: 52, fontWeight: 500, color: allDone ? C.ok : C.ink }}>
            {String(rendered).padStart(3, " ")} / {RUN.frames}
          </Mono>
          <Mono style={{ fontSize: 28 }}>frames</Mono>
        </div>
      )}
    </AbsoluteFill>
  );
};

/* 7. Stitch + verify ------------------------------------------------------------------ */

export const stitchStrip = (L: Layout): Rect => (L.tall ? { x: L.padL, y: 820, w: L.contentW, h: 24 } : { x: L.padL, y: 520, w: L.contentW, h: 24 });

export const Stitch: React.FC<{ s: { dur: number; textAt: number; joinAt: number; checkAt: number } }> = ({ s }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const g = graph(L);
  const strip = stitchStrip(L);
  const pw = strip.w / N;
  const join = interpolate(f, [s.joinAt, s.joinAt + 26], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const fade = 1 - ease(f, 0, 8);
  const count = Math.round(interpolate(f, [s.joinAt + 6, s.checkAt], [0, RUN.frames], { ...clamp, easing: Easing.out(Easing.quad) }));
  const checked = f >= s.checkAt;
  return (
    <AbsoluteFill>
      <div style={{ opacity: fade }}>
        <div style={{ ...box(g.matrix), borderRadius: 16, border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.45)" }} />
        <Wires g={g} tall={L.tall} opacity={1} />
        <Node r={g.plan} label="Plan" time={`${RUN.planSeconds}s`} done opacity={1} />
        <Node r={g.stitch} label="Stitch + deliver" done={false} opacity={1} />
      </div>
      {g.rows.map((row, i) => (
        <Row
          key={i}
          i={i}
          r={lerpRect(join, row, { x: strip.x + i * pw, y: strip.y, w: pw + 0.5, h: strip.h })}
          bg={interpolateColors(join, [0.2, 0.6], [C.panel, C.cobalt])}
          content={fade}
          progress={1}
          done
        />
      ))}
      <Headline at={s.textAt} parts={T.stitch} top={L.tall ? L.headTop : 200} size={L.tall ? 96 : 100} />
      <div style={{ position: "absolute", left: L.padL, top: strip.y + 80, opacity: ease(f, s.joinAt + 6, s.joinAt + 16) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Mono style={{ fontSize: L.tall ? 104 : 120, fontWeight: 500, color: checked ? C.ok : C.ink, letterSpacing: "-0.02em" }}>
            {String(count).padStart(3, " ")} / {RUN.frames}
          </Mono>
          <div style={{ transform: `scale(${ease(f, s.checkAt, s.checkAt + 10)})` }}>
            <Check size={L.tall ? 72 : 84} />
          </div>
        </div>
        <Mono style={{ marginTop: 10 }}>{T.stitchLabel}</Mono>
      </div>
    </AbsoluteFill>
  );
};

/* 8. Sample-exact audio (zoom into a seam) -------------------------------------------- */

const wave = (w: number, h: number) => {
  const pts: string[] = [];
  for (let x = 0; x <= w; x += 4) {
    const t = x / w;
    const y = Math.sin(t * 38) * 0.5 + Math.sin(t * 91 + 1) * 0.3 + Math.sin(t * 173 + 2) * 0.2;
    const env = 0.55 + 0.45 * Math.sin(t * 7 + 0.5) ** 2;
    pts.push(`${x},${(h / 2 + y * env * h * 0.45).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
};

export const AudioSeam: React.FC<{ s: { dur: number; textAt: number } }> = ({ s }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const strip = stitchStrip(L);
  const seamX = strip.x + strip.w / 2;
  const zoom = interpolate(f, [0, 24], [1, 16], { ...clamp, easing: Easing.in(Easing.cubic) });
  const draw = ease(f, 10, 44);
  const W = L.contentW, H = 260, top = 470;
  const d = wave(W, H);
  return (
    <AbsoluteFill>
      <div style={{ ...box(strip), background: C.cobalt, transform: `scale(${zoom}, ${1 + (zoom - 1) * 0.4})`, transformOrigin: `${seamX - strip.x}px 50%`, opacity: 1 - ease(f, 12, 22) }} />
      <Headline at={s.textAt} parts={T.audio} top={200} />
      <svg width={W} height={H} style={{ position: "absolute", left: L.padL, top }}>
        <defs>
          <clipPath id="left">
            <rect x={0} y={0} width={W / 2} height={H} />
          </clipPath>
          <clipPath id="right">
            <rect x={W / 2} y={0} width={W / 2} height={H} />
          </clipPath>
        </defs>
        <path d={d} pathLength={1} fill="none" stroke={C.cerulean} strokeWidth={4} strokeDasharray={`${draw} 1`} clipPath="url(#left)" />
        <path d={d} pathLength={1} fill="none" stroke={C.cobalt} strokeWidth={4} strokeDasharray={`${draw} 1`} clipPath="url(#right)" />
        <line x1={W / 2} x2={W / 2} y1={0} y2={H} stroke={C.ink} strokeWidth={2} strokeDasharray="6 8" opacity={ease(f, 18, 30)} />
      </svg>
      <Mono style={{ position: "absolute", left: L.padL + W / 2 - 180, top: top + H + 16, fontSize: 24, opacity: ease(f, 18, 30) }}>chunk 03</Mono>
      <Mono style={{ position: "absolute", left: L.padL + W / 2 + 24, top: top + H + 16, fontSize: 24, opacity: ease(f, 18, 30) }}>chunk 04</Mono>
      <Mono style={{ position: "absolute", left: L.padL, top: 890, fontSize: 26, opacity: ease(f, 30, 42) }}>{T.audioSource}</Mono>
    </AbsoluteFill>
  );
};

/* 9. The MP4 lands back on the laptop ------------------------------------------------- */

const FileCard: React.FC<{ r: Rect; content: number; done?: number }> = ({ r, content, done = 0 }) => (
  <div style={{ ...box(r), borderRadius: 12, background: interpolateColors(content, [0, 1], [C.cobalt, C.panel]), border: `1px solid ${C.line}`, overflow: "hidden" }}>
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 18, padding: "0 22px", opacity: content }}>
      <Mark size={48} />
      <Mono style={{ fontSize: 30, color: C.ink, flex: 1 }}>{T.file}</Mono>
      <div style={{ transform: `scale(${done})` }}>
        <Check size={34} />
      </div>
    </div>
  </div>
);

const Folder: React.FC<{ r: Rect; title: string; path: string; opacity: number }> = ({ r, title, path, opacity }) => (
  <div style={{ ...box(r), opacity, borderRadius: 18, background: "rgba(255,255,255,0.5)", border: `1px solid ${C.line}` }}>
    <div style={{ padding: "26px 30px" }}>
      <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 30, color: C.ink }}>{title}</div>
      <Mono style={{ fontSize: 26, marginTop: 6 }}>{path}</Mono>
    </div>
  </div>
);

export const Deliver: React.FC<{ s: { dur: number; textAt: number; dropAt: number } }> = ({ s }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const start: Rect = L.tall ? stitchStrip(L) : { x: L.padL, y: 600, w: L.contentW, h: 24 };
  const shrink = ease(f, 0, 20);
  const center: Rect = L.tall ? { x: L.padL, y: 600, w: L.contentW, h: 96 } : { x: 700, y: 340, w: 520, h: 96 };
  const card = lerpRect(shrink, start, center);
  const content = ease(f, 10, 20);
  const panels: { r: Rect; title: string; path: string; at: number }[] = [
    { r: L.tall ? { x: L.padL, y: 820, w: L.contentW, h: 250 } : { x: L.padL, y: 540, w: L.contentW, h: 250 }, title: "This laptop", path: T.laptopPath, at: s.dropAt },
  ];
  return (
    <AbsoluteFill>
      <Headline at={s.textAt} parts={T.deliver} top={L.tall ? L.headTop : 170} />
      {panels.map((p) => (
        <Folder key={p.title} r={p.r} title={p.title} path={p.path} opacity={ease(f, 8, 20)} />
      ))}
      {f < Math.max(...panels.map((p) => p.at)) + 2 && <FileCard r={card} content={content} />}
      {panels.map((p) => {
        const t = ease(f, p.at, p.at + 18);
        const target: Rect = { x: p.r.x + 30, y: p.r.y + 128, w: p.r.w - 60, h: 92 };
        return f >= p.at ? <FileCard key={p.title} r={lerpRect(t, center, target)} content={1} done={ease(f, p.at + 16, p.at + 26)} /> : null;
      })}
    </AbsoluteFill>
  );
};

/* 10. Proof: one fact per screen ------------------------------------------------------ */

export const Proof: React.FC<{ s: { dur: number; index: number } }> = ({ s }) => {
  const f = useCurrentFrame();
  const L = useLayout();
  const p = T.proof[s.index] as { line: string[]; source: string; grid?: number };
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: L.padL, width: L.contentW, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Reveal at={2}>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: L.tall ? 104 : 120, lineHeight: 1.04, letterSpacing: "-0.035em", color: C.ink, whiteSpace: "pre-line" }}>
            <Emph parts={p.line} />
          </div>
        </Reveal>
        {p.grid && (
          <div style={{ marginTop: 44, display: "flex", gap: 16 }}>
            {Array.from({ length: p.grid }, (_, i) => (
              <div key={i} style={{ width: 56, height: 56, borderRadius: 10, background: interpolateColors(ease(f, 8 + i, 14 + i), [0, 1], [C.panel, C.cobalt]), border: `1px solid ${C.line}` }} />
            ))}
          </div>
        )}
        <Mono style={{ marginTop: 40, fontSize: 32, opacity: ease(f, 10, 22) }}>{p.source}</Mono>
      </div>
    </AbsoluteFill>
  );
};

/* 11. End card ------------------------------------------------------------------------ */

export const Wipe: React.FC = () => {
  const f = useCurrentFrame();
  const x = interpolate(f, [0, 16], [-110, 110], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${x}%`, width: "100%", background: C.frost, borderLeft: `12px solid ${C.cobalt}` }} />
    </AbsoluteFill>
  );
};

export const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const L = useLayout();
  const tall = L.tall;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: L.padL,
          width: L.contentW,
          top: 0,
          height: tall ? 1536 : L.H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: tall ? 22 : 30, opacity: ease(f, 6, 22) }}>
          <Mark size={tall ? 104 : 128} progress={ease(f, 4, 30)} />
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: tall ? 108 : 140, letterSpacing: "-0.05em", color: C.ink }}>coldframe</div>
        </div>
        <Reveal at={16} style={{ marginTop: 30 }}>
          <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: tall ? 52 : 48, color: C.ink }}>
            <Emph parts={T.ctaLine} />
          </div>
        </Reveal>
        <div
          style={{
            marginTop: 44,
            padding: tall ? "24px 32px" : "22px 34px",
            borderRadius: 16,
            background: C.ink,
            color: C.frost,
            fontFamily: fonts.mono,
            fontSize: tall ? 36 : 42,
            lineHeight: 1.4,
            textAlign: "left",
            clipPath: `inset(0 ${(1 - ease(f, 26, 44)) * 100}% 0 0 round 16px)`,
          }}
        >
          {tall ? (
            <>
              <span style={{ color: C.ice }}>$</span> {T.ctaCmdTall[0]}
              <br />
              <span style={{ opacity: 0 }}>$</span> {T.ctaCmdTall[1]}
            </>
          ) : (
            <>
              <span style={{ color: C.ice }}>$</span> {T.ctaCmd}
            </>
          )}
        </div>
        <Mono style={{ marginTop: 40, fontSize: tall ? 40 : 40, color: C.ink, opacity: ease(f, 40, 54) }}>{T.url}</Mono>
      </div>
    </AbsoluteFill>
  );
};

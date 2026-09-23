import React from "react";
import { AbsoluteFill, Composition, Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { Mark } from "../Composition";
import { AudioSeam, Blocked, Command, Cta, Deliver, Edit, Hook, Proof, Solution, Split, Stitch, Wipe } from "./scenes";
import { C, Check, Emph, fonts, LAUNCH, layouts, LayoutProvider, Mono } from "./ui";

// The launch film in three cuts, built to .claude/skills/video-rules/SKILL.md.
// Every text, colour, number and timing lives in launch.json.

type CutId = keyof typeof LAUNCH.cuts;
type Scene = (typeof LAUNCH.cuts)[CutId]["scenes"][number] & Record<string, unknown>;

const SCENES: Record<string, React.FC<{ s: never }>> = {
  hook: Hook,
  edit: Edit,
  blocked: Blocked,
  solution: Solution,
  command: Command,
  split: Split,
  stitch: Stitch,
  audio: AudioSeam,
  deliver: Deliver,
  proof: Proof,
  cta: Cta,
};

const cutLength = (id: CutId) => {
  const sc = LAUNCH.cuts[id].scenes;
  const last = sc[sc.length - 1];
  return last.from + last.dur;
};

const Cut: React.FC<{ id: CutId }> = ({ id }) => {
  const cut = LAUNCH.cuts[id];
  return (
    <LayoutProvider value={layouts[cut.layout as "wide" | "tall"]}>
      <AbsoluteFill style={{ backgroundColor: C.frost }}>
        {(cut.scenes as Scene[]).map((s, i) => {
          const Comp = SCENES[s.type] as React.FC<{ s: Scene }>;
          return (
            <Sequence key={i} from={s.from} durationInFrames={s.dur} name={`${i + 1} ${s.type}`}>
              <Comp s={s} />
            </Sequence>
          );
        })}
        {(cut.scenes as Scene[])
          .filter((s) => s.wipe)
          .map((s) => (
            <Sequence key="wipe" from={s.from - 9} durationInFrames={18} name="wipe">
              <Wipe />
            </Sequence>
          ))}
        <Audio src={staticFile(cut.audio)} />
      </AbsoluteFill>
    </LayoutProvider>
  );
};

/* Thumbnail: the outcome, in five words. */
const Thumb: React.FC = () => {
  const T = LAUNCH.text;
  const R = LAUNCH.run;
  return (
    <AbsoluteFill style={{ backgroundColor: C.frost }}>
      <div style={{ position: "absolute", left: 130, top: 130, display: "flex", alignItems: "center", gap: 16 }}>
        <Mark size={72} />
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 58, letterSpacing: "-0.045em", color: C.ink }}>coldframe</div>
      </div>
      <div style={{ position: "absolute", left: 130, top: 330, fontFamily: fonts.display, fontWeight: 700, fontSize: 176, lineHeight: 0.98, letterSpacing: "-0.045em", color: C.ink }}>
        {T.thumb[0]}
        <br />
        <Emph parts={T.thumb.slice(1)} />
      </div>
      <div style={{ position: "absolute", left: 1180, top: 190, width: 610 }}>
        {R.chunkSeconds.map((sec, i) => (
          <div
            key={i}
            style={{ height: 66, marginBottom: 20, borderRadius: 12, background: C.panel, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 16, padding: "0 22px", position: "relative", overflow: "hidden" }}
          >
            <Check size={32} />
            <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 30, color: C.ink, flex: 1 }}>
              Chunk {String(i).padStart(2, "0")}
            </div>
            <Mono style={{ fontSize: 26 }}>{sec}s</Mono>
            <div style={{ position: "absolute", left: 0, bottom: 0, height: 5, width: "100%", background: C.cobalt }} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const LaunchCompositions: React.FC = () => (
  <>
    <Composition id="LaunchFilm" component={() => <Cut id="LaunchFilm" />} durationInFrames={cutLength("LaunchFilm")} fps={LAUNCH.fps} width={1920} height={1080} />
    <Composition id="LaunchFilmVertical" component={() => <Cut id="LaunchFilmVertical" />} durationInFrames={cutLength("LaunchFilmVertical")} fps={LAUNCH.fps} width={1080} height={1920} />
    <Composition id="LaunchFilm15" component={() => <Cut id="LaunchFilm15" />} durationInFrames={cutLength("LaunchFilm15")} fps={LAUNCH.fps} width={1080} height={1920} />
    <Composition id="LaunchThumb" component={Thumb} durationInFrames={1} fps={LAUNCH.fps} width={1920} height={1080} />
  </>
);

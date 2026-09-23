import React from "react";
import { AbsoluteFill, Composition, Sequence } from "remotion";
import { Sfx, SfxRole } from "./coldframe-sound";

// Plays every sound in the library once per variant, 0.6 s apart, with a label on screen.
// Render audio only: npx remotion render SfxAudition out/sfx-audition.wav --codec=wav
const ROLES: [SfxRole, number][] = [
  ["click-soft", 3], ["click-firm", 3], ["tick", 2], ["key", 4], ["key-enter", 2], ["toggle-on", 1], ["toggle-off", 1],
  ["select", 2], ["drop", 3], ["pop", 2], ["confirm", 2], ["error", 1], ["open", 2], ["close", 2], ["whoosh", 2],
  ["impact-soft", 2], ["impact", 3],
];
const GAP = 18;
const CUES = ROLES.flatMap(([role, n]) => Array.from({ length: n }, (_, v) => ({ role, v })));
export const AUDITION_FRAMES = 15 + CUES.length * GAP + 30;

const Audition: React.FC = () => (
  <AbsoluteFill style={{ background: "#F3F6F7", justifyContent: "center", alignItems: "center", fontFamily: "monospace", fontSize: 64 }}>
    {CUES.map(({ role, v }, i) => (
      <Sequence key={i} from={15 + i * GAP} durationInFrames={GAP}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          {role} {v + 1}
        </AbsoluteFill>
        <Sfx role={role} at={0} variant={v} rate={1} alignPeak={false} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const SfxAuditionComposition = () => (
  <Composition id="SfxAudition" component={Audition} durationInFrames={AUDITION_FRAMES} fps={30} width={1280} height={720} />
);

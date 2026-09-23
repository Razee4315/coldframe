import "./index.css";
import { MyComposition } from "./Composition";
import { LaunchCompositions } from "./launch/LaunchFilm";
import { SfxAuditionComposition } from "./SfxAudition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <LaunchCompositions />
      <SfxAuditionComposition />
    </>
  );
};

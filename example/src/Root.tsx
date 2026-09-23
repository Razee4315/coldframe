import "./index.css";
import { MyComposition } from "./Composition";
import { LaunchCompositions } from "./launch/LaunchFilm";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <LaunchCompositions />
    </>
  );
};

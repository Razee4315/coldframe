# coldframe demo project

Remotion compositions that coldframe renders in the cloud:

- `ColdframePromo`: a 20-second, 1920x1080, 30 fps demo; the end-to-end test (its soundtrack checks that audio joins are sample-exact).
- `LaunchFilm`, `LaunchFilmVertical`, `LaunchFilm15`, `LaunchThumb`: the launch film, all set in `src/launch/launch.json`.
- `SfxAudition`: plays every sound in the `public/sfx/` library.

```bash
npm install
npm run dev                                   # Remotion Studio
npx remotion render ColdframePromo            # local render
```

Cloud render (from the repo root): `node bin/coldframe.mjs render ColdframePromo`.

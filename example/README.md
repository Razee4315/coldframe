# coldframe demo project

A 16-second, 1920x1080, 30 fps Remotion video (`ColdframePromo`) that coldframe renders in the cloud as its end-to-end test. The soundtrack is synthesised by `scripts/make_soundtrack.py`.

```bash
npm install
npm run dev                                   # Remotion Studio
npx remotion render ColdframePromo            # local render
```

Cloud render (from the repo root): `node bin/coldframe.mjs render ColdframePromo`.

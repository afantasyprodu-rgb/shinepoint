# Landing montage videos

The desktop landing background (`src/pages/DesktopLanding.jsx`) plays a 6-cell
video montage. Drop your clips here with these exact names:

```
clip-1.mp4
clip-2.mp4
clip-3.mp4
clip-4.mp4
clip-5.mp4
clip-6.mp4
```

Guidelines:
- Short, seamless loops (5-15s). They autoplay muted + looped.
- Use `.mp4` (H.264) for broad support. `.webm` also works if you update the
  `CLIPS` list in `DesktopLanding.jsx`.
- Keep each file small (ideally < 3-4 MB) so the page loads fast. Compress /
  trim before adding.
- Any missing file gracefully falls back to a gradient cell, so you can add
  them one at a time.

To change the count, layout, or filenames, edit the `CLIPS` array and the grid
in `DesktopLanding.jsx`.

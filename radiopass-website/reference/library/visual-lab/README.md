# FRCR1 Physics Visual Lab

This is the consolidated physics-only project folder.

Open the site from:

`/Users/User1/Desktop/FRCR1/physics/FRCR1_Physics_Visual_Lab/index.html`

Or run it locally:

```bash
cd "/Users/User1/Desktop/FRCR1/physics/FRCR1_Physics_Visual_Lab"
python3 -m http.server 8027
```

Then open:

`http://127.0.0.1:8027/`

Main pages:

- `index.html` - home dashboard
- `lessons.html` - interactive lesson library with local progress tracking
- `physics-question-bank.html` - recovered True/False training question bank
- `xray-tube-physics-canvas.html` - Canvas-only X-ray tube physics simulator
- `visuals/` - recovered MRI, X-ray, CT, ultrasound, mammography and nuclear medicine standalone animations
- `legacy-mri/` - recovered FID, T2 and beam-quality pages from older project folders
- `mri-html-export/` - recovered MRI export pages

Liver anatomy is deliberately excluded from this physics consolidation.

Validation completed:

- Main pages serve successfully from the local server.
- 32 lessons are indexed in `assets/site-data.js`.
- 50 HTML files are present in the consolidated folder.
- Local lesson links were checked for missing targets.

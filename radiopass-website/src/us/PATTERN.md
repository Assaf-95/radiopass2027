# How to build an Ultrasound Physics Lab experiment

Every experiment in this module follows one pattern. Read
`pages/Fundamentals.tsx` and `pages/Impedance.tsx` first — they are the
reference implementations — then follow this document exactly. A learner who
has used one page must be able to read all twenty.

## Teaching philosophy (non-negotiable)

**Guided walkthrough first → manual experimentation second → exam application third.**

- Concepts are met **one event at a time**. Never autoplay a whole explanation.
- Each guided step animates for **1–2 seconds and then freezes** so the learner
  can inspect the physics.
- In guided mode the page is **focused**: the controls column and the analysis
  panel step aside and the step explanation is the largest text on screen.
  Nothing is deleted — "Show the numbers" and "Enter manual lab" bring it back.
- When a control moves, the consequence appears **immediately**, both next to
  the control (hint text) and on the stage (`flash.fire`).

## File layout

```
src/us/
  engine/        physics + content. NO React, NO drawing.
  components/    shared shell, controls, teaching panel, B-mode, icons
  scenes/        canvas drawing for one experiment
  pages/         one file per experiment, wiring the above together
```

Never duplicate a derived value. If a number appears on the page it is computed
by `engine/acoustics.ts` from the page's `State`.

## Page skeleton

```tsx
type State = { /* every parameter the experiment exposes */ }
const DEFAULTS: State = { /* the documented starting point */ }

const STEPS: GuidedStep<State>[] = [ /* 6–9 steps */ ]

export default function XPage() {
  const [state, setState] = useState<State>(DEFAULTS)
  const [showEquation, setShowEquation] = useState(true)
  const [showTrap, setShowTrap] = useState(true)
  const [revision, setRevision] = useState(false)
  const [detail, setDetail] = useState(false)      // "Show the numbers"
  const flash = useFlash()

  const patch = useCallback((n: Partial<State>) => setState(s => ({ ...s, ...n })), [])
  const resetState = useCallback(() => { setState(DEFAULTS); flash.clear() }, [flash])

  const api = useGuided<State>({ steps: STEPS, setState: patch, resetState })
  const clock = useClock(api.playing)          // only if the scene animates

  const derived = useMemo(() => ({ /* engine calls */ }), [state])

  return (
    <UsLab
      path="/ultrasound-lab/x"                 // MUST match US_STAGES
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail}
      stage={<>
        <section className="us-stage" aria-label="…">
          <div className="us-stage-head">
            <h2><UsIcon name="…" size={14}/><b>Stage</b> …</h2>
            <div className="us-legend">…</div>
          </div>
          <div className="us-stage-body">
            <div className="us-canvas-wrap">
              <StageFlash flash={flash} />
              <XScene … time={clock} phase={api.phase as XPhase} />
            </div>
            {/* optional second surface, e.g. a B-mode panel */}
          </div>
          <GuidedTransport
            api={api}
            onShowEquation={() => setShowEquation(v => !v)}
            onShowTrap={() => setShowTrap(v => !v)}
            showingEquation={showEquation}
            showingTrap={showTrap}
            onToggleDetail={() => setDetail(v => !v)}
            detailShown={detail}
          />
          <GuidedCaption api={api} state={state} />
          <p className="us-focus-hint">
            One idea at a time. <b>Show the numbers</b> for the readouts and full
            analysis, or <b>Enter manual lab</b> to …
          </p>
        </section>
        <FocusHide><Readout items={[…]} /></FocusHide>
      </>}
      controls={<>
        <ControlGroup title="…" icon="…" defaultOpen>…</ControlGroup>
        <ControlGroup title="…" icon="…">…</ControlGroup>
        <div className="us-panel">
          <h3><UsIcon name="lightbulb" size={13}/>Check yourself</h3>
          <Predict … />
        </div>
      </>}
      teaching={<>
        <TeachingPanel revision={revision} onRevisionChange={setRevision}
          now={…} why={…}
          equation={showEquation ? `…live working…` : undefined}
          deltas={[…]} clinical={…}
          trap={showTrap ? … : undefined} />
        <MoreDetail title="More detail — …">
          …short paragraphs…
          <TrapNote>…</TrapNote>
          <SourceNote>…</SourceNote>
        </MoreDetail>
        <ModelNote />
      </>}
    />
  )
}
```

## Guided steps

```ts
{
  id: 'stable-id',
  title: 'Sentence case, states the idea',
  phase: 'scene-phase-name',        // what the scene should draw
  state: { /* exact parameters this step teaches at */ },
  duration: 1.4,                   // seconds; 1–2. Omit for the default.
  caption: (state) => <>…</>,      // may be a function of live state
}
```

`state` is what makes Previous/Next restore **exact** physical states. Give it
to any step that depends on particular parameter values.

## Controls announce consequences

Every `onChange` handler must:

1. compute the direction of the change,
2. apply the patch,
3. `flash.fire([...])` with 3–5 short consequences.

```ts
const onFrequency = (value: number) => {
  const up = value > state.frequencyMHz
  patch({ frequencyMHz: value })
  flash.fire([
    { text: up ? 'Frequency increased' : 'Frequency decreased', dir: up ? 'up' : 'down' },
    { text: up ? 'Wavelength shortens' : 'Wavelength lengthens', dir: up ? 'down' : 'up' },
    { text: 'Speed of sound unchanged', dir: 'flat' },
  ])
}
```

`dir` is `'up' | 'down' | 'warn' | 'flat'`. Use `'warn'` for anything that
raises exposure, worsens safety, or introduces an artefact.

## Scenes

- One file per experiment in `scenes/`, exporting a `XPhase` union type.
- Use `prepareCanvas`, `drawLabel`, `drawArrowHead`, `withAlpha`, `UC` from
  `components/theme`.
- Redraw in a `useEffect` keyed on every prop. Do not hold internal state.
- **Give the scene real depth.** Perspective projection, receding guide lines,
  size/opacity/tint depth cues — see `scenes/WaveChamber.tsx`. Flat 2D diagrams
  are not acceptable for the main stage.
- Provide a genuinely descriptive `aria-label` that states the current physics.
- The reconstructed B-mode image must stay clinically greyscale. Colour is for
  invisible physics: beams, vectors, wavefronts, overlays.

## The B-mode component

`<BMode scene={…} settings={…} label="…" overlay={fn} />` computes the image
from the scene, so **shadowing and enhancement are emergent** — give a cyst a
low `attenuation` and the bright band appears by itself. Never draw an artefact
that the physics should produce.

Sensible `settings`: `gainDb` 25–45, `dynamicRangeDb` 45–65, `focusCm` an array
of focal depths, `cycles` 1–6, `apertureMm` 6–24.

## Content

All facts, equations, tables, relationships and questions live in
`engine/facts.ts`, `engine/reference.ts` and `engine/questions.ts`. **Do not
invent exam facts.** Pull the teaching content from those files and cite the
source in `SourceNote` when a source needed correcting.

Priority badges: `core`, `recall`, `trap`, `equation`, `number`, `clinical`,
`safety`, `clarify`.

## Accessibility

The learner has dyslexia. Short paragraphs. **Bold key terms.** Consistent
terminology. No walls of text. The teaching panel gives a concise answer first
with `MoreDetail` for expansion, and revision mode reduces everything to rule,
equation, direction of change and trap.

Every control needs an accessible name. Every canvas needs an `aria-label`
describing the current state. Honour `prefers-reduced-motion` (handled by
`useGuided`).

## Before you finish

- `./node_modules/.bin/tsc -b --noEmit` must pass with no errors.
- No placeholders, no "coming soon", no fake controls, no dead sliders.
- Reset must restore `DEFAULTS`.
- Previous/Next must restore exact guided states.
- Manual mode must not corrupt guided progress.

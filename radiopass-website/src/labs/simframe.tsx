/**
 * The lesson stage, hosting one of the built simulators from /visuals.
 *
 * Those simulators are the accurate ones — real penumbra construction, real
 * ray geometry, real spectra — and they are also the busy ones: every control,
 * every graph, every paragraph on screen at once. The guided lessons want the
 * accuracy without the noise, so this component does NOT redraw anything. It
 * mounts the simulator unchanged in an iframe and then, per concept:
 *
 *   hide   the parts this concept does not need (page header, guide prose,
 *          a graph that has not been introduced yet)
 *   focus  one control, dimming the rest so the eye has one place to go
 *   set    the sliders to the state that makes the point, so arriving at a
 *          concept already shows the situation the text is describing
 *
 * All three are applied from the parent through same-origin DOM access, so the
 * simulator files themselves are untouched — open one directly and it is the
 * full instrument it always was.
 *
 * The iframe is never remounted between concepts of the same lesson: only the
 * injected rules and slider values change, so the simulator keeps its state
 * and the learner sees the SAME diagram respond rather than a fresh page.
 */

import { useEffect, useRef, useState } from 'react'

import { TaskCue, useTask } from './task'

export type SimFrameProps = {
  /** A file under /visuals, e.g. '/visuals/radiographic-magnification.html'. */
  src: string
  /** Accessible name for the frame — what the diagram shows. */
  title: string
  /** Selectors, inside the simulator, to take off the screen for this concept. */
  hide?: string[]
  /** Selectors of the control(s) this concept teaches. Everything else dims. */
  focus?: string[]
  /** Buttons to press on arrival — a mode switch, say. Must be idempotent. */
  click?: string[]
  /** Some simulators carry their own step machine. Rather than reload one to
   *  reach a given step, walk it there with its own buttons — so the concept
   *  arrives on the exact frame it is about, forwards or backwards. */
  tour?: { badge: string; next: string; back: string; to: number }
  /** Slider/input values to arrive at, keyed by selector. */
  set?: Record<string, number | string>
  /** Layout CSS for THIS simulator inside the frame. A simulator sized for a
   *  full browser window drops to one column in a narrower frame, which puts
   *  the very control the concept names below the fold — so the lesson states
   *  the override its instrument needs rather than scrolling the learner. */
  css?: string
  /** Ceiling for the frame, in px. It hugs the simulator's own height below
   *  this; raise it for the concepts that need more room. */
  tall?: boolean
  /**
   * One instruction the learner must carry out on this instrument before the
   * concept will let them move on.
   *
   * While it is open, every control EXCEPT the watched one is held — a learner
   * asked to lengthen SOD who instead drags three sliders has learned nothing.
   * When the change lands, the instruction is replaced by what to notice, the
   * instrument unlocks, and the page's Next opens.
   */
  task?: {
    /** The instruction, imperative: "Drag SOD longer." */
    ask: string
    /** What just happened — revealed only after they have done it. */
    notice: string
    /** The control to watch, e.g. '#sodSlider'. */
    watch: string
    /** Satisfied once the value has moved this far from where it started. */
    by?: number
    /** Or satisfied on crossing a threshold, when direction is the lesson. */
    above?: number
    below?: number
  }
}

/** How tall the frame may grow before the simulator scrolls inside it. */
const CEILING = { normal: 640, tall: 700 }
const FLOOR = 300

/* The control blocks a spotlight can dim, across the simulators in /visuals.
   Each simulator names its rows differently; matching all of them here keeps
   the lesson data free of per-file trivia. */
const BLOCKS = '.control, .ctrl, .slider-row, .toggle, .control-row'

const GUIDE_STYLE_ID = 'rp-guide-style'

const BASE_RULES = `
  .rp-hide { display: none !important; }
  .rp-dim {
    opacity: 0.34;
    filter: saturate(0.35);
    transition: opacity 0.35s ease, filter 0.35s ease;
  }
  .rp-lit {
    transition: box-shadow 0.35s ease;
    box-shadow: 0 0 0 1px rgba(107, 163, 214, 0.5), 0 0 0 7px rgba(107, 163, 214, 0.09);
    border-radius: 10px;
  }
  /* While a task is open, the asked-for control is the only one that works. */
  .rp-locked { pointer-events: none; }
  .rp-locked input, .rp-locked button, .rp-locked select { pointer-events: none; }
  body { overflow-x: hidden; }
`

/** Set a form control and tell the simulator, exactly as a drag would. */
function drive(el: HTMLInputElement | HTMLSelectElement, value: number | string) {
  const win = el.ownerDocument.defaultView
  if (!win) return
  if (String(el.value) === String(value)) return
  el.value = String(value)
  el.dispatchEvent(new win.Event('input', { bubbles: true }))
  el.dispatchEvent(new win.Event('change', { bubbles: true }))
}

export function SimFrame({ src, title, hide, focus, click, tour, set, css, tall, task }: SimFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [height, setHeight] = useState<number | null>(null)

  /* The task is keyed on what this concept asks for, so moving between
     concepts re-arms it and returning to one does not show a stale tick. */
  const { done: taskDone, finish } = useTask(`${src}|${task?.ask ?? ''}`, !!task)

  // Serialised so the effect re-runs on a genuine change of concept, not on
  // every parent render (the arrays and objects are fresh literals each time).
  const hideKey = (hide ?? []).join('|')
  const focusKey = (focus ?? []).join('|')
  const clickKey = (click ?? []).join('|')
  const setKey = JSON.stringify(set ?? {})

  /* A concept may call for a different instrument. Changing src navigates the
     same iframe, so the guide has to wait for the NEW document before it
     dresses anything — otherwise it styles a page that is about to be
     replaced and the new one arrives undressed. */
  useEffect(() => { setReady(false); setHeight(null) }, [src])

  useEffect(() => {
    if (!ready) return
    const doc = ref.current?.contentDocument
    if (!doc?.body) return

    let style = doc.getElementById(GUIDE_STYLE_ID)
    if (!style) {
      style = doc.createElement('style')
      style.id = GUIDE_STYLE_ID
      doc.head.appendChild(style)
    }
    const wanted = BASE_RULES + (css ?? '')
    if (style.textContent !== wanted) style.textContent = wanted

    for (const el of doc.querySelectorAll('.rp-hide')) el.classList.remove('rp-hide')
    for (const sel of hide ?? []) {
      for (const el of doc.querySelectorAll(sel)) el.classList.add('rp-hide')
    }

    for (const el of doc.querySelectorAll('.rp-dim, .rp-lit, .rp-locked')) {
      el.classList.remove('rp-dim', 'rp-lit', 'rp-locked')
    }
    /* An open task IS the spotlight: whatever it asks for is the only thing to
       look at, and — unlike a plain spotlight — the only thing that still
       works. Once it is done the instrument is handed back whole. */
    const gating = !!task && !taskDone
    const spotlights = gating ? [task!.watch] : (focus ?? [])
    if (spotlights.length) {
      const lit = new Set<Element>()
      for (const sel of spotlights) {
        for (const el of doc.querySelectorAll(sel)) {
          lit.add(el.closest(BLOCKS) ?? el)
        }
      }
      for (const el of lit) el.classList.add('rp-lit')
      for (const block of doc.querySelectorAll(BLOCKS)) {
        if (lit.has(block) || block.classList.contains('rp-hide')) continue
        block.classList.add('rp-dim')
        if (gating) block.classList.add('rp-locked')
      }
    }

    /* Buttons before values: a mode switch may be what reveals the sliders
       the next loop is about to drive. */
    for (const sel of click ?? []) {
      const el = doc.querySelector(sel)
      if (el instanceof doc.defaultView!.HTMLElement) el.click()
    }

    if (tour) {
      /* Bounded: a simulator that ignores its own buttons must not spin here. */
      for (let guard = 0; guard < 24; guard++) {
        const at = Number(doc.querySelector(tour.badge)?.textContent?.match(/\d+/)?.[0] ?? NaN)
        if (!Number.isFinite(at) || at === tour.to) break
        const btn = doc.querySelector(at < tour.to ? tour.next : tour.back)
        if (!(btn instanceof doc.defaultView!.HTMLElement)) break
        btn.click()
      }
    }

    for (const [sel, value] of Object.entries(set ?? {})) {
      const el = doc.querySelector(sel)
      if (el instanceof doc.defaultView!.HTMLInputElement || el instanceof doc.defaultView!.HTMLSelectElement) {
        drive(el as HTMLInputElement, value)
      }
    }
    /* Hug the simulator rather than framing it in a fixed box: hiding half a
       page leaves a lot of nothing otherwise. Height is measured after the
       dressing so it reflects what this concept actually shows, and only
       adopted on a real change — these layouts are width-driven, so a height
       change cannot feed back into a new measurement. */
    /* Driving a control can make the frame scroll itself to reveal what it
       just focused. The frame is sized to show everything, so any scroll is a
       stale offset that crops the diagram's top edge. */
    doc.documentElement.scrollTop = 0

    const measure = () => {
      /* scrollHeight is floored at the viewport, so it can only ever say "as
         tall as the frame already is". The content's own extent is the bottom
         of the lowest top-level block. */
      const bottoms = [...doc.body.children]
        .filter((el) => !el.classList.contains('rp-hide'))
        .map((el) => el.getBoundingClientRect().bottom)
      if (!bottoms.length) return
      const pad = parseFloat(getComputedStyle(doc.body).paddingBottom) || 0
      const want = Math.round(Math.max(...bottoms) + pad)
      setHeight((h) => (Math.abs(want - (h ?? 0)) > 8 ? want : h))
    }
    measure()
    const timer = doc.defaultView!.setTimeout(measure, 400)
    return () => doc.defaultView?.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, src, hideKey, focusKey, clickKey, tour?.to, setKey, css, taskDone])

  /* Watch the one control the task names. The baseline is read here rather
     than from the concept's `set`, because the learner may already have moved
     it — the task is "change it from where it is now", not "reach a number
     the lesson happens to know". */
  useEffect(() => {
    if (!ready || !task || taskDone) return
    const doc = ref.current?.contentDocument
    const el = doc?.querySelector(task.watch)
    /* Cross-realm: the element belongs to the iframe, so the parent window's
       HTMLInputElement is a different constructor and a bare `instanceof`
       silently answers false. Ask the frame's own realm. */
    if (!doc || !doc.defaultView || !(el instanceof doc.defaultView.HTMLInputElement)) return

    const start = Number(el.value)
    const satisfied = (v: number) => {
      if (task.above !== undefined && v >= task.above) return true
      if (task.below !== undefined && v <= task.below) return true
      if (task.above !== undefined || task.below !== undefined) return false
      return Math.abs(v - start) >= (task.by ?? 1e-6)
    }

    const check = () => { if (satisfied(Number(el.value))) finish() }
    doc.addEventListener('input', check, true)
    /* Watching the event is not enough, because not every way of moving a
       control goes through one. The magnification simulator lets the learner
       drag the OBJECT along the beam in the scene itself — the natural
       gesture, and the one two of these tasks ask for in words — and its drag
       handler assigns sodSlider.value directly without dispatching anything.
       A learner who did exactly what was asked watched SOD run from 90 to 25,
       saw the whole diagram answer, and still found Next shut.
       So sample the value as well. It costs a number comparison five times a
       second, it stops the moment the task is satisfied (the effect re-runs on
       taskDone and returns at the guard above), and it catches any simulator
       that moves its own controls quietly. */
    const win = doc.defaultView
    const poll = win.setInterval(check, 200)
    return () => { doc.removeEventListener('input', check, true); win.clearInterval(poll) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, src, task?.watch, task?.ask, taskDone])

  const ceiling = tall ? CEILING.tall : CEILING.normal
  const boxed = height ? Math.min(ceiling, Math.max(FLOOR, height)) : undefined

  return (
    <>
      <div
        className={tall ? 'lx-sim lx-sim-tall' : 'lx-sim'}
        style={boxed ? { height: boxed } : undefined}
      >
        <iframe
          ref={ref}
          src={src}
          title={title}
          loading="eager"
          onLoad={() => setReady(true)}
        />
        <a className="lx-sim-open" href={src} target="_blank" rel="noreferrer">
          Open the full simulator ↗
        </a>
      </div>
      {task && (
        <TaskCue ask={task.ask} notice={task.notice} done={taskDone} onSkip={finish} />
      )}
    </>
  )
}

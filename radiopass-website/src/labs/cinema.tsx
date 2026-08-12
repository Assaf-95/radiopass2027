/**
 * The film player — a lesson you can watch.
 *
 * A sequence of continuously animated scenes plays through like a video:
 * each scene is an original procedural drawing (the same canvas language as
 * the lesson player), shown for a fixed duration with a caption, then a
 * crossfade to the next. Play/pause, chapter jumps, and the illustration
 * sound engine are shared with the lesson player. No video files — every
 * frame is drawn live, so it is crisp at any size and weighs nothing.
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from '../home/fx'
import { isSoundOn, subscribeSound } from '../lib/sound'
import { clearPings, setLessonSound, type StepDraw } from './lesson'
import './labs.css'

export type FilmScene = {
  id: string
  title: string
  /** One-line caption shown under the stage while the scene plays. */
  caption: string
  /** Seconds on screen. */
  dur: number
  draw: StepDraw
}

export type FilmMeta = {
  title: string
  kicker: string
  accent: string
  backTo: { label: string; to: string }
}

const FADE = 0.6

export function FilmPage({ meta, scenes }: { meta: FilmMeta; scenes: FilmScene[] }) {
  // ?scene=N deep-links a chapter (1-based).
  const initialScene = (() => {
    if (typeof window === 'undefined') return 0
    const n = Number(new URLSearchParams(window.location.search).get('scene') ?? NaN)
    return Number.isFinite(n) && n >= 1 && n <= scenes.length ? n - 1 : 0
  })()
  const [sceneIdx, setSceneIdx] = useState(initialScene)
  const [playing, setPlaying] = useState(true)
  const [ended, setEnded] = useState(false)
  /* Sound is a site-wide preference, defaulted ON and remembered — the same one
     the lesson player reads. This used to start at a hard `false`, so a film
     opened with the button showing 🔇 while the tones were in fact playing, and
     the first press "unmuted" something that was never muted. Read the real
     preference, and follow it if it changes in another tab or player. */
  const [soundOn, setSoundOnState] = useState(isSoundOn)
  useEffect(() => subscribeSound(() => setSoundOnState(isSoundOn())), [])
  const reduced = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  // The scene clock lives in refs — the rAF loop must not re-render per frame.
  const clockRef = useRef(0)
  const idxRef = useRef(initialScene)
  // The outgoing scene keeps drawing under the incoming one — a true crossfade.
  const prevRef = useRef<{ scene: FilmScene; t: number } | null>(null)
  const endedRef = useRef(false)
  const playingRef = useRef(true)
  playingRef.current = playing && !reduced

  useEffect(() => {
    document.title = `${meta.title} · RadioPass`
    return () => { document.title = 'RadioPass — FRCR Part 1 Physics, Made Visual' }
  }, [meta.title])

  const jump = (i: number) => {
    idxRef.current = Math.max(0, Math.min(scenes.length - 1, i))
    clockRef.current = 0
    prevRef.current = null
    endedRef.current = false
    clearPings()
    setSceneIdx(idxRef.current)
    setEnded(false)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let w = 0, h = 0
    let last = performance.now()

    const size = () => {
      const host = canvas.parentElement
      if (!host) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(host.clientWidth * dpr)
      const ph = Math.round(host.clientHeight * dpr)
      w = host.clientWidth; h = host.clientHeight
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw; canvas.height = ph
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }
    const ro = new ResizeObserver(size)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    size()

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const scene = scenes[idxRef.current]
      if (playingRef.current) {
        clockRef.current += dt
        if (clockRef.current >= scene.dur && !endedRef.current) {
          if (idxRef.current < scenes.length - 1) {
            prevRef.current = { scene, t: clockRef.current }
            idxRef.current += 1
            clockRef.current = 0
            clearPings()
            setSceneIdx(idxRef.current)
          } else {
            // the finale keeps animating behind the endcard
            endedRef.current = true
            setEnded(true)
          }
        }
      }
      const cur = scenes[idxRef.current]
      const t = reduced ? 2.5 : clockRef.current
      ctx.clearRect(0, 0, w, h)
      // crossfade: the outgoing scene dissolves as the incoming one rises
      const xf = reduced ? 1 : Math.min(1, t / FADE)
      if (prevRef.current && xf < 1) {
        if (playingRef.current) prevRef.current.t += dt
        ctx.save()
        ctx.globalAlpha = 1 - xf
        prevRef.current.scene.draw(ctx, w, h, 1, prevRef.current.t)
        ctx.restore()
      } else if (xf >= 1) {
        prevRef.current = null
      }
      ctx.save()
      ctx.globalAlpha = Math.max(0.001, xf)
      cur.draw(ctx, w, h, 1, t)
      ctx.restore()
      // within-scene progress, painted onto the current chapter dot
      trackRef.current?.style.setProperty('--p', String(Math.min(1, t / cur.dur)))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [scenes, reduced])

  const scene = scenes[sceneIdx]
  const replay = () => { jump(0); setPlaying(true) }

  return (
    <main className="lx-root lxf-root" style={{ ['--lx-accent' as string]: meta.accent }}>
      <header className="lx-bar">
        <Link to={meta.backTo.to} className="lx-exit">← {meta.backTo.label}</Link>
        <span className="lx-bar-title">{meta.title}</span>
        <span className="lx-bar-count">{sceneIdx + 1} / {scenes.length}</span>
      </header>

      <section className="lxf-body">
        <div className="lx-stage lxf-stage">
          <canvas ref={canvasRef} aria-hidden="true" />
          <button
            type="button"
            className="lx-sound"
            aria-pressed={soundOn}
            title={soundOn ? 'Mute illustration sound' : 'Illustration sound — hear the machine work'}
            onClick={() => { const next = !soundOn; setLessonSound(next); setSoundOnState(next) }}
          >{soundOn ? '🔊' : '🔇'}</button>
          {ended && (
            <div className="lxf-endcard">
              <p>That is the whole machine.</p>
              <button type="button" className="lx-btn lx-btn-solid" onClick={replay}>↺ Watch again</button>
            </div>
          )}
        </div>

        <div className="lxf-caption" aria-live="polite">
          <h2>{scene.title}</h2>
          <p>{scene.caption}</p>
        </div>

        <div className="lxf-controls">
          <button
            type="button"
            className="lx-btn lx-btn-ghost lxf-play"
            onClick={() => (ended ? replay() : setPlaying((v) => !v))}
          >
            {ended ? '↺ Replay' : playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <div className="lxf-track" aria-hidden="true" ref={trackRef}>
            {scenes.map((s, i) => (
              <button
                key={s.id}
                type="button"
                title={s.title}
                className={i === sceneIdx ? 'is-on' : i < sceneIdx ? 'is-seen' : ''}
                onClick={() => { jump(i); setPlaying(true) }}
              />
            ))}
          </div>
          <button
            type="button"
            className="lx-btn lx-btn-ghost"
            disabled={sceneIdx >= scenes.length - 1}
            onClick={() => { jump(sceneIdx + 1); setPlaying(true) }}
          >
            Skip →
          </button>
        </div>

        {reduced && (
          <p className="lxf-rm-note">Reduced motion is on — use the chapter dots to step through the stills.</p>
        )}
      </section>
    </main>
  )
}

/**
 * Shared audio for the laboratories.
 *
 * The physics being taught is literally waves and pulses, so a short tone on
 * each event helps far more than it distracts — a pulse leaving the probe, an
 * element firing, an RF pulse landing. It is on by default and the preference
 * is remembered, so muting it once mutes it everywhere, permanently.
 *
 * The one thing this cannot do is make noise before the visitor has touched
 * the page: every browser suspends an AudioContext created without a user
 * gesture, and autoplaying audio at someone who has just opened a page is
 * hostile anyway. So the context is created lazily and resumed on the first
 * real interaction — after that, sound simply works, with no button to find.
 */

const KEY = 'radiopass.sound.v1'

let ctx: AudioContext | null = null
let unlocked = false
const listeners = new Set<() => void>()

/** Default ON — a muted preference is only ever set deliberately. */
function readPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

let enabled = typeof window === 'undefined' ? false : readPref()

export function isSoundOn(): boolean {
  return enabled
}

export function setSoundOn(on: boolean) {
  enabled = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // A blocked storage API only costs the preference, never the audio.
  }
  if (on) void unlockAudio()
  listeners.forEach((l) => l())
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Create/resume the context. Safe to call repeatedly; only acts once. */
export async function unlockAudio() {
  if (typeof window === 'undefined') return
  try {
    ctx = ctx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') await ctx.resume()
    unlocked = ctx.state === 'running'
  } catch {
    ctx = null
  }
}

// The first gesture anywhere unlocks audio for the rest of the visit.
if (typeof window !== 'undefined') {
  const onFirstGesture = () => {
    if (enabled) void unlockAudio()
    window.removeEventListener('pointerdown', onFirstGesture)
    window.removeEventListener('keydown', onFirstGesture)
  }
  window.addEventListener('pointerdown', onFirstGesture, { once: false })
  window.addEventListener('keydown', onFirstGesture, { once: false })
}

/**
 * A host that runs scenes ambiently holds one of these for as long as it is
 * mounted, and tones stay silent while any is held.
 *
 * The lesson player earns its clicks: one scene on screen, the learner driving
 * it, and a mute button in the header. A Physics V2 film plate is a different
 * thing — a chapter mounts several looping scenes at once, none of them the
 * one the learner is reading, and the page carries no mute. Four click tracks
 * at a time is noise with no way out, so those hosts silence tones while they
 * own the screen. The stored preference is never written, so leaving the page
 * restores exactly whatever the learner chose in the laboratories.
 */
let suspensions = 0
export function suspendTones(): () => void {
  suspensions += 1
  let released = false
  return () => {
    if (released) return
    released = true
    suspensions -= 1
  }
}

export type ToneShape = 'ping' | 'pulse' | 'sweep' | 'thud'

/**
 * A short tone. Kept quiet and brief: this is punctuation for a diagram, not
 * a soundtrack, and it has to survive being triggered many times a minute.
 */
export function playTone(freq = 880, shape: ToneShape = 'ping', gain = 0.05) {
  if (!enabled || suspensions > 0 || !ctx || !unlocked || ctx.state !== 'running') return
  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()

    if (shape === 'pulse') {
      // A short percussive blip — an element firing, a pulse leaving.
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, now)
      amp.gain.setValueAtTime(gain, now)
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
      osc.start(now); osc.stop(now + 0.07)
    } else if (shape === 'sweep') {
      // A falling sweep — a wave travelling away, an echo returning.
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.35), now + 0.26)
      amp.gain.setValueAtTime(gain * 0.9, now)
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
      osc.start(now); osc.stop(now + 0.32)
    } else if (shape === 'thud') {
      // A low, soft landing — an RF pulse, a gradient switching.
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq * 0.5, now)
      amp.gain.setValueAtTime(gain * 1.1, now)
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      osc.start(now); osc.stop(now + 0.2)
    } else {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      amp.gain.setValueAtTime(gain, now)
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
      osc.start(now); osc.stop(now + 0.12)
    }

    osc.connect(amp)
    amp.connect(ctx.destination)
  } catch {
    // Audio is decoration; never let it break a diagram.
  }
}

/** Fired once per named event per step — stops a rAF loop machine-gunning. */
const fired = new Set<string>()
export function clearToneMemory() {
  fired.clear()
}
export function playOnce(id: string, freq?: number, shape?: ToneShape) {
  if (fired.has(id)) return
  fired.add(id)
  if (fired.size > 800) fired.clear()
  playTone(freq, shape)
}

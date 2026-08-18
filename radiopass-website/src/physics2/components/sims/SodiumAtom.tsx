/**
 * The sodium atom, in the hand — the first object in the physics course.
 *
 * Topic 01 opens on "Matter and radiation", and every mechanism in the exam
 * stands on one picture: a nucleus of protons and neutrons, and electrons in
 * shells at fixed binding energies. So the course opens by putting that
 * picture in front of the candidate as an object they can turn over, rather
 * than as a diagram they read past.
 *
 * WHY SODIUM. Na-23 is the smallest atom that shows all three shells the exam
 * talks about — K, L and M — with a single valence electron making the outer
 * shell unmistakable. The model is exact: 11 protons, 12 neutrons, and 2-8-1
 * electrons. Tungsten would be truer to an X-ray tube and completely
 * unreadable at 74 electrons.
 *
 * THE BOHR CAVEAT, stated rather than glossed. Electrons are not little
 * planets on tracks, and this model draws them that way because that is the
 * picture the FRCR asks about — shells as ENERGY LEVELS, drawn as orbits. The
 * caption says so. What matters and what the model gets right is the
 * ordering: K is closest and most tightly bound, and that binding energy is
 * where characteristic radiation, the K-edge and the photoelectric effect all
 * come from.
 *
 * THE SWIPE HINT. A first-time visitor has no way to know a film plate is
 * draggable, so a hand glyph arcs across it until they touch it — then it goes
 * for good, on this device, because a hint that keeps reappearing after you
 * have understood it is nagging. Reduced motion gets a still hint and no
 * auto-spin; dragging still works, since a drag is the visitor's own motion
 * and never something done at them.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const MODEL = '/models/sodium-atom.glb'

/** Remembers that this visitor has already worked out the drag. */
const HINT_KEY = 'radiopass.sim.dragged.v1'

/** Radians per second the whole atom drifts before anyone touches it. */
const IDLE_SPIN = 0.16
/** Per-shell rotation, outer shells slower — the Bohr picture, turning. */
const SHELL_SPIN: Record<string, number> = {
  'K-shell': 0.55,
  'L-shell': -0.3,
  'M-shell': 0.19,
}

/* ------------------------------------------------------------------ *
 * The model
 * ------------------------------------------------------------------ */

/**
 * Loaded once per page, shared by every mount.
 *
 * A promise rather than state: two mounts of this sim (or a remount from a
 * filter change) must not fetch 400 kB twice, and the second mount should get
 * the geometry immediately rather than flashing its own loading state.
 */
let cached: Promise<THREE.Group> | null = null

function loadAtom(): Promise<THREE.Group> {
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        MODEL,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(err),
      )
    })
  }
  return cached
}

function Atom({
  reduced,
  dragRef,
  grabbedRef,
}: {
  reduced: boolean
  /** Accumulated drag, in radians: [yaw, pitch]. Written by the host. */
  dragRef: React.RefObject<{ yaw: number; pitch: number }>
  grabbedRef: React.RefObject<boolean>
}) {
  const { gl, scene } = useThree()
  const root = useRef<THREE.Group>(null)
  const [model, setModel] = useState<THREE.Group | null>(null)
  const shells = useRef<THREE.Object3D[]>([])

  /* A room environment gives the metallic spheres something to reflect. The
     film plate behind them is near-black, so without this the nucleus reads
     as flat circles rather than as spheres. */
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.06).texture
    scene.environment = env
    return () => {
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  useEffect(() => {
    let live = true
    void loadAtom()
      .then((source) => {
        if (!live) return
        /* Cloned per mount: the cache holds one geometry, and two mounts must
           not fight over one object's transform. */
        const copy = source.clone(true)
        copy.traverse((child) => {
          const mesh = child as THREE.Mesh
          if (!mesh.isMesh) return
          const material = mesh.material as THREE.MeshStandardMaterial
          if (!material?.isMeshStandardMaterial) return
          /* The exported materials are matte diffuse. Made metallic here so
             the nucleus catches the environment, and the electrons and their
             orbits given emission so they read as charge rather than as
             painted beads on wire. */
          const cloned = material.clone()
          const name = material.name
          if (name === 'electron') {
            cloned.emissive = new THREE.Color(cloned.color)
            cloned.emissiveIntensity = 0.55
            cloned.roughness = 0.35
            cloned.metalness = 0.1
          } else if (name.endsWith('-orbit')) {
            cloned.emissive = new THREE.Color(cloned.color)
            cloned.emissiveIntensity = 0.18
            cloned.roughness = 0.6
            cloned.metalness = 0
            cloned.transparent = true
            cloned.opacity = 0.75
          } else {
            cloned.roughness = 0.42
            cloned.metalness = 0.35
          }
          mesh.material = cloned
        })
        shells.current = Object.keys(SHELL_SPIN)
          .map((n) => copy.getObjectByName(n))
          .filter((o): o is THREE.Object3D => !!o)
        setModel(copy)
      })
      .catch(() => {
        /* The plate keeps its caption and its legend; a missing model is a
           quiet absence, never a broken page. */
      })
    return () => {
      live = false
    }
  }, [])

  useFrame((_, delta) => {
    const group = root.current
    if (!group) return
    const drag = dragRef.current ?? { yaw: 0, pitch: 0 }
    /* Idle drift stops for good once the visitor takes hold: after that the
       orientation is theirs, and an object that keeps creeping away from
       where you left it is fighting you. */
    if (!reduced && !grabbedRef.current && drag.yaw === 0 && drag.pitch === 0) {
      group.rotation.y += IDLE_SPIN * delta
    } else {
      group.rotation.y = drag.yaw
    }
    group.rotation.x = drag.pitch
    if (!reduced) {
      for (const shell of shells.current) {
        shell.rotation.y += (SHELL_SPIN[shell.name] ?? 0) * delta
      }
    }
  })

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 6]} intensity={1.5} />
      <directionalLight position={[-5, -2, -4]} intensity={0.4} color="#8fb8ff" />
      <group ref={root} scale={1.35}>
        {model && <primitive object={model} />}
      </group>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * The swipe hint
 * ------------------------------------------------------------------ */

function SwipeHint({ still }: { still: boolean }) {
  return (
    <div className={`v2-atom-hint${still ? ' is-still' : ''}`} aria-hidden="true">
      <span className="v2-atom-hint-glyph">
        <svg viewBox="0 0 44 44" width="40" height="40">
          {/* The arc the finger travels, drawn so the gesture reads even in
              the single still frame a reduced-motion visitor gets. */}
          <path
            d="M8 31 Q22 22 36 31"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeDasharray="3 4"
            opacity="0.55"
          />
          <path d="M33 27 l4 4 -5 3" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
          {/* A hand: index finger extended, the other knuckles folded. */}
          <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round">
            <path d="M22 25 V13" />
            <path d="M22 25 q-5 0 -5 5 v4 a5 5 0 0 0 5 5 h4 a6 6 0 0 0 6 -6 v-6 q0 -3 -3 -3 t-3 3" />
            <path d="M25 22 v-3 q0 -2.5 -2.5 -2.5" opacity="0.8" />
          </g>
        </svg>
      </span>
      <span className="v2-atom-hint-text">Drag to turn it</span>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The plate
 * ------------------------------------------------------------------ */

export function SodiumAtom() {
  const host = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ yaw: 0, pitch: 0 })
  const grabbedRef = useRef(false)

  const [reduced, setReduced] = useState(false)
  const [visible, setVisible] = useState(true)
  const [hinted, setHinted] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(query.matches)
    apply()
    query.addEventListener?.('change', apply)
    return () => query.removeEventListener?.('change', apply)
  }, [])

  /* The hint is per-visitor, not per-mount: once someone has discovered that
     these plates turn, every later one should just be turnable. */
  useEffect(() => {
    try {
      setHinted(localStorage.getItem(HINT_KEY) === 'yes')
    } catch {
      /* Storage blocked — the hint simply shows again, which is harmless. */
    }
  }, [])

  // A WebGL loop running behind a scrolled-past chapter is pure waste, and a
  // topic page mounts a dozen plates.
  useEffect(() => {
    const el = host.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '150px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const pointers = useMemo(() => {
    let lastX = 0
    let lastY = 0
    let active = false

    const takeHint = () => {
      setHinted(true)
      try {
        localStorage.setItem(HINT_KEY, 'yes')
      } catch {
        /* Nothing to persist to; the hint reappears next visit. */
      }
    }

    return {
      onPointerDown: (e: React.PointerEvent) => {
        active = true
        grabbedRef.current = true
        lastX = e.clientX
        lastY = e.clientY
        takeHint()
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!active) return
        const dx = e.clientX - lastX
        const dy = e.clientY - lastY
        lastX = e.clientX
        lastY = e.clientY
        const next = dragRef.current
        next.yaw += dx * 0.009
        /* Pitch is clamped: let it pass vertical and the atom turns inside
           out, which reads as a bug rather than as a rotation. */
        next.pitch = Math.max(-1.1, Math.min(1.1, next.pitch + dy * 0.009))
      },
      onPointerUp: (e: React.PointerEvent) => {
        active = false
        grabbedRef.current = false
        ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      },
    }
  }, [])

  /** Keyboard equivalent — the object is content, and content must be reachable. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 0.22
    const next = dragRef.current
    if (e.key === 'ArrowLeft') next.yaw -= step
    else if (e.key === 'ArrowRight') next.yaw += step
    else if (e.key === 'ArrowUp') next.pitch = Math.max(-1.1, next.pitch - step)
    else if (e.key === 'ArrowDown') next.pitch = Math.min(1.1, next.pitch + step)
    else return
    e.preventDefault()
    grabbedRef.current = true
  }

  return (
    <div className="v2-atom">
      <div
        ref={host}
        className="v2-atom-stage"
        role="img"
        tabIndex={0}
        aria-label="A sodium atom in three dimensions: a nucleus of eleven protons and twelve neutrons, with two electrons in the K shell, eight in the L shell and one in the M shell. Drag, or use the arrow keys, to turn it."
        onKeyDown={onKeyDown}
        {...pointers}
      >
        <Canvas
          frameloop={reduced ? 'demand' : visible ? 'always' : 'never'}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          camera={{ position: [0, 0.6, 5.4], fov: 42 }}
        >
          <Atom reduced={reduced} dragRef={dragRef} grabbedRef={grabbedRef} />
        </Canvas>
        {!hinted && <SwipeHint still={reduced} />}
      </div>

      {/* The legend earns its place: it is the exam's own vocabulary against
          the thing itself, and the last line is the one the rest of the topic
          is built on. */}
      <dl className="v2-atom-key">
        <div>
          <dt>
            <i className="v2-atom-dot is-p" />
            Protons
          </dt>
          <dd>11 — the atomic number Z, and what makes this sodium</dd>
        </div>
        <div>
          <dt>
            <i className="v2-atom-dot is-n" />
            Neutrons
          </dt>
          <dd>12 — mass without charge; Z + N = 23</dd>
        </div>
        <div>
          <dt>
            <i className="v2-atom-dot is-e" />
            Electrons
          </dt>
          <dd>2 in K, 8 in L, 1 in M — filled innermost first</dd>
        </div>
        <div>
          <dt>
            <i className="v2-atom-dot is-k" />
            The K shell
          </dt>
          <dd>Closest in, most tightly bound — where characteristic X-rays and the K-edge come from</dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * The gamma camera detector head, in the hand.
 *
 * Nuclear medicine's whole character comes from one physical fact that a flat
 * diagram cannot convey: the collimator is a SLAB OF LEAD, and it throws away
 * more than 99.9% of everything the patient emits. The long acquisitions, the
 * noise, the thick crystal, PET refusing to use a collimator at all — every one
 * of those is downstream of that slab. A learner should be able to turn it over
 * and see how much of the instrument is simply lead.
 *
 * IT DOES NOT REPLACE THE ASSEMBLING CHAIN below it in the same section. That
 * one shows the mechanism firing — photon in, count out. This one shows what
 * the mechanism is physically made of. Two directions on one story.
 *
 * MATERIALS ARE THE MODEL'S OWN. Nothing here re-colours, re-lights or
 * re-textures anything: the export carries deliberate per-part materials
 * (lead_shield, septa_lead, crystal_nai, pmt_glass, dynode_stack…) and an
 * earlier attempt to "improve" them with generic PBR values and a tinted fill
 * light produced something washed-out and wrong. The only additions are neutral
 * white light and an environment map, which PBR materials need in order to read
 * as material at all.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const MODEL = '/models/gamma-detector-head.glb'

/** Shared with the other draggable plates: the hint is per visitor, not per plate. */
const HINT_KEY = 'radiopass.sim.dragged.v1'

/**
 * Scaled so its bounding sphere has this radius, against a camera that never
 * moves. The distance is deliberately tight: the bounding sphere takes in the
 * patient pad and the full length of the emitted rays, so a comfortable margin
 * left the head itself occupying about a quarter of the plate — and the septa,
 * which are the entire reason this object is worth turning over, were too
 * small to read.
 */
const TARGET_RADIUS = 1
const CAMERA_DISTANCE = 2.75

/**
 * The build, in the order a photon meets it — not the order it is manufactured
 * in, and not outside-in. Each step adds the layer the ray meets next, and
 * nothing already built is taken away, so the head assembles rather than
 * flickering between disconnected views.
 */
const STEPS: { name: string; full: string; parts: string[]; note: string }[] = [
  {
    name: 'Patient',
    full: 'the patient is the source',
    parts: ['part_shell', 'part_source'],
    note: 'The tracer is inside the patient, so the radiation comes from them and leaves in every direction. Nothing about it is aimed.',
  },
  {
    name: 'Gammas',
    full: 'emission is isotropic',
    parts: ['part_shell', 'part_source', 'part_rays'],
    note: 'Only the tiny fraction heading straight at the crystal can say anything useful about where it came from. Everything else is either lost or, worse, misleading.',
  },
  {
    name: 'Collimator',
    full: 'the collimator throws most of them away',
    parts: ['part_shell', 'part_shield', 'part_source', 'part_rays', 'part_collimator'],
    note: 'Lead septa absorb every ray not travelling along a hole. Under 0.1% survives — that is the price of knowing direction, and it is why nuclear medicine images are noisy and slow.',
  },
  {
    name: 'Crystal',
    full: 'NaI(Tl) turns gamma into light',
    parts: ['part_shell', 'part_shield', 'part_source', 'part_rays', 'part_collimator', 'part_crystal', 'part_scint'],
    note: 'A survivor stops in the sodium iodide and its energy reappears as a flash of light. Only 6–13 mm thick: thicker would catch more photons and smear the flash.',
  },
  {
    name: 'Light guide',
    full: 'the flash is shared, deliberately',
    parts: ['part_shell', 'part_shield', 'part_source', 'part_rays', 'part_collimator', 'part_crystal', 'part_scint', 'part_light', 'part_lightguide'],
    note: 'One tube alone could only say that a flash happened. Several tubes sharing it can say where — which is the entire trick behind Anger position logic.',
  },
  {
    name: 'PMTs',
    full: 'photomultipliers make it measurable',
    parts: ['part_shell', 'part_shield', 'part_source', 'part_rays', 'part_collimator', 'part_crystal', 'part_scint', 'part_light', 'part_lightguide', 'part_pmts'],
    note: 'The photocathode turns light into a few electrons; the dynode ladder multiplies them about a million times into a pulse worth measuring.',
  },
  {
    name: 'Logic',
    full: 'position and energy are computed',
    parts: ['part_shell', 'part_shield', 'part_source', 'part_rays', 'part_collimator', 'part_crystal', 'part_scint', 'part_light', 'part_lightguide', 'part_pmts', 'part_electronics', 'part_logic'],
    note: 'Comparing the tubes gives X and Y; summing them gives energy — and the pulse height analyser rejects anything that lost energy by scattering on the way out.',
  },
  {
    name: 'Image',
    full: 'one accepted count lands',
    parts: ['part_shell', 'part_shield', 'part_source', 'part_rays', 'part_collimator', 'part_crystal', 'part_scint', 'part_light', 'part_lightguide', 'part_pmts', 'part_electronics', 'part_logic', 'part_readout'],
    note: 'The image is built one count at a time, hundreds of thousands of them over several minutes. That is why the patient has to hold still.',
  },
]

/** One fetch per page, shared by every mount. */
let cached: Promise<THREE.Group> | null = null
function loadHead(): Promise<THREE.Group> {
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      new GLTFLoader().load(MODEL, (gltf) => resolve(gltf.scene), undefined, reject)
    })
  }
  return cached
}

function Head({
  visible,
  reduced,
  dragRef,
  grabbedRef,
}: {
  visible: string[]
  reduced: boolean
  dragRef: React.RefObject<{ yaw: number; pitch: number }>
  grabbedRef: React.RefObject<boolean>
}) {
  const { gl, scene, size } = useThree()
  const root = useRef<THREE.Group>(null)
  const [model, setModel] = useState<THREE.Group | null>(null)
  /* Read at fit time rather than depended on: R3F reports a fractional height
     that flaps by half a pixel, and depending on it re-runs the load effect on
     a loop, so every fetch resolves into a closure that has already been torn
     down and the model never mounts. */
  const sizeRef = useRef(size)
  sizeRef.current = size

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  useEffect(() => {
    let live = true
    void loadHead()
      .then((source) => {
        if (!live) return
        const copy = source.clone(true)
        /* Sized, not restyled. The bounding sphere is measured with every part
           present, so stepping through the build never makes the view jump. */
        const box = new THREE.Box3().setFromObject(copy)
        const sphere = box.getBoundingSphere(new THREE.Sphere())
        if (sphere.radius > 0) {
          copy.position.sub(sphere.center)
          const { width, height } = sizeRef.current
          const aspect = width > 0 && height > 0 ? width / height : 1
          copy.scale.setScalar((TARGET_RADIUS * Math.min(1, aspect)) / sphere.radius)
        }
        setModel(copy)
      })
      .catch((err) => {
        console.error('[GammaCameraHead] could not load', MODEL, err)
      })
    return () => {
      live = false
    }
  }, [])

  /* The parts sit one level below the export's single root node
     (`gamma_camera_head_section`), so this walks the tree for anything named
     `part_*` rather than iterating the model's own children — which would find
     only that root, fail to match it, and hide the entire head. */
  useEffect(() => {
    if (!model) return
    model.traverse((child) => {
      if (child.name.startsWith('part_')) child.visible = visible.includes(child.name)
    })
  }, [model, visible])

  useFrame((_, delta) => {
    const group = root.current
    if (!group) return
    const drag = dragRef.current ?? { yaw: 0, pitch: 0 }
    if (!reduced && !grabbedRef.current && drag.yaw === 0 && drag.pitch === 0) {
      group.rotation.y += 0.12 * delta
    } else {
      group.rotation.y = drag.yaw
    }
    group.rotation.x = drag.pitch
  })

  return (
    <>
      {/* Neutral white only. A tinted fill light is what turned an earlier
          attempt at this into a blue-washed mess. */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 6]} intensity={1.3} />
      <directionalLight position={[-5, 1, -4]} intensity={0.5} />
      <group ref={root}>{model && <primitive object={model} />}</group>
    </>
  )
}

const CAMERA = {
  position: [0, CAMERA_DISTANCE * 0.14, CAMERA_DISTANCE] as [number, number, number],
  fov: 42,
}

export function GammaCameraHead() {
  const [idx, setIdx] = useState(STEPS.length - 1)
  const step = STEPS[idx]

  const host = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ yaw: 0, pitch: 0 })
  const grabbedRef = useRef(false)
  const [reduced, setReduced] = useState(false)
  const [onScreen, setOnScreen] = useState(true)
  const [hinted, setHinted] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(query.matches)
    apply()
    query.addEventListener?.('change', apply)
    return () => query.removeEventListener?.('change', apply)
  }, [])

  useEffect(() => {
    try {
      setHinted(localStorage.getItem(HINT_KEY) === 'yes')
    } catch {
      /* Storage blocked — the hint simply shows again. */
    }
  }, [])

  useEffect(() => {
    const el = host.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      rootMargin: '150px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const pointers = useMemo(() => {
    let lastX = 0
    let lastY = 0
    let active = false
    return {
      onPointerDown: (e: React.PointerEvent) => {
        active = true
        grabbedRef.current = true
        lastX = e.clientX
        lastY = e.clientY
        setHinted(true)
        try {
          localStorage.setItem(HINT_KEY, 'yes')
        } catch {
          /* Nothing to persist to. */
        }
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!active) return
        const next = dragRef.current
        next.yaw += (e.clientX - lastX) * 0.009
        next.pitch = Math.max(-1.1, Math.min(1.1, next.pitch + (e.clientY - lastY) * 0.009))
        lastX = e.clientX
        lastY = e.clientY
      },
      onPointerUp: (e: React.PointerEvent) => {
        active = false
        grabbedRef.current = false
        ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      },
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const stepSize = 0.22
    const next = dragRef.current
    if (e.key === 'ArrowLeft') next.yaw -= stepSize
    else if (e.key === 'ArrowRight') next.yaw += stepSize
    else if (e.key === 'ArrowUp') next.pitch = Math.max(-1.1, next.pitch - stepSize)
    else if (e.key === 'ArrowDown') next.pitch = Math.min(1.1, next.pitch + stepSize)
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
        aria-label={`A gamma camera detector head, cut away. Step ${idx + 1} of ${STEPS.length}: ${step.full}. Drag, or use the arrow keys, to turn it.`}
        onKeyDown={onKeyDown}
        {...pointers}
      >
        <Canvas
          frameloop={reduced ? 'demand' : onScreen ? 'always' : 'never'}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          camera={CAMERA}
        >
          <Head visible={step.parts} reduced={reduced} dragRef={dragRef} grabbedRef={grabbedRef} />
        </Canvas>
        {!hinted && (
          <div className="v2-atom-hint" aria-hidden="true">
            <span className="v2-atom-hint-glyph">
              <svg viewBox="0 0 44 44" width="40" height="40">
                <path d="M8 31 Q22 22 36 31" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 4" opacity="0.55" />
                <path d="M33 27 l4 4 -5 3" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
                <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round">
                  <path d="M22 25 V13" />
                  <path d="M22 25 q-5 0 -5 5 v4 a5 5 0 0 0 5 5 h4 a6 6 0 0 0 6 -6 v-6 q0 -3 -3 -3 t-3 3" />
                  <path d="M25 22 v-3 q0 -2.5 -2.5 -2.5" opacity="0.8" />
                </g>
              </svg>
            </span>
            <span className="v2-atom-hint-text">Drag to turn it</span>
          </div>
        )}
      </div>

      <div className="v2-ctwin-side">
        <label>
          <span>
            Following one photon <b>{idx + 1} of {STEPS.length} — {step.full}</b>
          </span>
        </label>
        <div className="v2-ctwin-presets" role="group" aria-label="Build the head up, layer by layer">
          {STEPS.map((s, i) => (
            <button key={s.name} type="button" className={i === idx ? 'on' : ''} onClick={() => setIdx(i)}>
              {s.name}
            </button>
          ))}
        </div>
        <p className="v2-atom-note">{step.note}</p>
      </div>
    </div>
  )
}

/**
 * The sodium atom, turning behind the physics home.
 *
 * The owner's model — the same /models/sodium-atom.glb the course opens on —
 * mounted here as scenery rather than as an instrument: no drag, no caption,
 * no legend, nothing to click. It fills what was empty space to the side of
 * the course list with the object the whole syllabus stands on.
 *
 * THE SCROLL IS THE DRIVE. At rest the shells turn at their idle rates. As
 * the page scrolls, scroll SPEED is measured and added to the shell rates, so
 * the electrons whip round while the reader moves and settle back when they
 * stop. Direction is ignored deliberately: scrolling up spins them up too,
 * because the effect is about energy, not about which way the page went.
 *
 * WHAT THIS DELIBERATELY IS NOT: a re-styling of the model. The materials,
 * the lighting rig and the scale are copied from the approved instrument
 * (physics2/components/sims/SodiumAtom.tsx) so the object reads identically
 * in both places. That file is another session's; nothing here imports it.
 *
 * COST. three, the GLTF loader and the room environment already ship for the
 * simulations, but the physics home did not previously load any of them — so
 * this component is imported lazily by the page and mounts after first paint.
 * A learner opening /physics gets their dashboard at the same speed as before
 * and the atom arrives a moment later.
 *
 * Reduced motion gets nothing at all: the page does not mount this component,
 * so there is no canvas, no model fetch and no animation frame.
 */

import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const MODEL = '/models/sodium-atom.glb'

/* THE IDLE RATES ARE A THIRD OF THE INSTRUMENT'S, deliberately.
   The instrument is a hero object you hold and turn; this is scenery behind
   a dashboard. Carried over at the instrument's speed the shells were already
   whipping round at rest, so scrolling could not make them visibly faster —
   the effect the whole thing exists for was invisible. Slow at rest is what
   gives the boost something to be fast against. */
/** Radians per second the whole atom drifts. */
const IDLE_SPIN = 0.06
/** Per-shell idle rates — outer shells slower, the Bohr picture turning. */
const SHELL_SPIN: Record<string, number> = {
  'K-shell': 0.18,
  'L-shell': -0.1,
  'M-shell': 0.06,
}
/** Scroll speed (px/s) that reaches the top of the boost curve.

    Measured against a real wheel rather than guessed: a comfortable reading
    scroll runs about 1000-1400 px/s, so the curve tops out there and ordinary
    scrolling reaches full tilt. It was set at 2200 first, which only a violent
    flick could reach, and the shells barely changed pace for a normal reader.

    Note that programmatic scrolling (anchor links, scroll-to-top) is smoothed
    by `html { scroll-behavior: smooth }` and so produces far lower speeds than
    a wheel — the atom stays calm for those, which is correct: nobody flicked
    anything. */
const SCROLL_FULL = 1200
/** The response any scroll produces, however gentle, before speed is read. */
const SCROLL_FLOOR = 0.45
/** How many times idle speed a full-tilt scroll produces. */
const BOOST_MAX = 12
/** How fast the boost falls back to rest once scrolling stops (per second). */
const BOOST_DECAY = 2.2

let cached: Promise<THREE.Group> | null = null
function loadAtom(): Promise<THREE.Group> {
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      new GLTFLoader().load(MODEL, (gltf) => resolve(gltf.scene), undefined, (err) => reject(err))
    })
  }
  return cached
}

/**
 * Scroll speed as a 0..1 figure, smoothed.
 *
 * Measured against time rather than per scroll event: a trackpad fires a
 * flurry of small deltas and a mouse wheel fires a few large ones, and
 * without dividing by elapsed time the same physical gesture would spin the
 * shells at wildly different rates on the two devices.
 */
function useScrollEnergy() {
  const energy = useRef(0)
  useEffect(() => {
    let lastY = window.scrollY
    let lastT = performance.now()
    const onScroll = () => {
      const now = performance.now()
      const dt = Math.max(16, now - lastT) / 1000
      const dy = Math.abs(window.scrollY - lastY)
      lastY = window.scrollY
      lastT = now
      const speed = dy / dt
      /* ANY scroll gets a floor, then speed takes it the rest of the way.
         Without the floor the effect was hostage to the input device: a
         trackpad's small, frequent deltas measured far slower than a wheel's
         and barely moved the shells, so "it spins when I scroll" came out
         true on one machine and false on another. The floor makes the
         response certain; the speed term still makes a hard flick wilder
         than a gentle nudge. */
      const kick = Math.max(SCROLL_FLOOR, Math.min(1, speed / SCROLL_FULL))
      energy.current = Math.min(1, Math.max(energy.current, kick))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return energy
}

function Atom({ energy }: { energy: React.RefObject<number> }) {
  const { gl, scene } = useThree()
  const root = useRef<THREE.Group>(null)
  const shells = useRef<THREE.Object3D[]>([])
  const [model, setModel] = useState<THREE.Group | null>(null)

  /* The nucleus is metallic; without something to reflect it reads as flat
     circles rather than as spheres. Same environment as the instrument. */
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
        const copy = source.clone(true)
        copy.traverse((child) => {
          const mesh = child as THREE.Mesh
          if (!mesh.isMesh) return
          const material = mesh.material as THREE.MeshStandardMaterial
          if (!material?.isMeshStandardMaterial) return
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
        /* A missing model is a quiet absence, never a broken page. */
      })
    return () => {
      live = false
    }
  }, [])

  useFrame((_, delta) => {
    /* Bleed the scroll energy away so the shells coast back to rest. */
    const e = energy.current ?? 0
    if (energy.current != null) {
      energy.current = Math.max(0, e - BOOST_DECAY * delta)
    }
    const boost = 1 + e * (BOOST_MAX - 1)

    if (root.current) root.current.rotation.y += IDLE_SPIN * boost * delta
    for (const shell of shells.current) {
      shell.rotation.y += (SHELL_SPIN[shell.name] ?? 0) * boost * delta
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

export default function AtomBackdrop() {
  const energy = useScrollEnergy()
  return (
    <div className="ph-atom" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, 6.2], fov: 42 }}
      >
        <Atom energy={energy} />
      </Canvas>
    </div>
  )
}

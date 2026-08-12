/**
 * The homepage hero: one enormous proton suspended in space.
 *
 * This is not a lesson. It carries no labels and no controls — those belong to
 * the MRI laboratory, where the same object becomes the teaching instrument.
 * Here it only has to create wonder and give RadioPass a visual identity:
 * glass, the vertical B₀ beam, internal light, a field of distant protons —
 * and the magnetic moment itself: a luminous axis through the body, tilted
 * obliquely and sweeping a slow cone about the vertical field.
 *
 * NOTE (user decision, 2026-08-06): no equatorial precession ring. The user
 * asked for the sphere and its moment arrow only — do not re-add the torus.
 *
 * Two motions, kept strictly separate, because conflating them is what makes
 * scroll-driven 3D feel sickening:
 *
 *   The proton spins on its own axis, continuously, at a fixed rate. Scrolling
 *   never touches it.
 *   Scrolling moves the *camera* — a slow dolly, a slight orbit and a gentle
 *   vertical drift, as though the visitor were moving around a fixed object.
 *
 * Performance: one instanced mesh carries every background proton, materials
 * are created once, the frame loop is demand-free but pauses entirely when the
 * hero scrolls out of view, and `prefers-reduced-motion` renders a single
 * still frame with no loop at all.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/** Radians per second. Slow enough to read as majestic, never as spinning. */
const SPIN_RATE = 0.085
/** The oblique tilt of the spin axis away from the vertical B₀ beam. */
const TILT = 0.46
/** Radians per second the tilted axis sweeps around B₀ — a slow Larmor cone. */
const PRECESSION_RATE = 0.14

/* -------------------------------------------------------------------------
   Background field
   ------------------------------------------------------------------------- */

const FIELD_COUNT = 340

function useFieldPlacement() {
  return useMemo(() => {
    // Deterministic placement: the same sky every visit, so the hero has a
    // stable identity rather than being different on each load.
    let seed = 0x9e3779b9
    const random = () => {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      seed >>>= 0
      return seed / 4294967296
    }

    const items: { position: THREE.Vector3; scale: number; phase: number }[] = []
    for (let i = 0; i < FIELD_COUNT; i += 1) {
      const depth = random()
      // Pushed well behind the hero and spread wide, so parallax has something
      // to separate. Nothing is allowed near the centre where the proton sits.
      const radius = 7 + depth * 46
      const angle = random() * Math.PI * 2
      items.push({
        position: new THREE.Vector3(
          Math.cos(angle) * radius * (0.6 + random() * 0.8),
          (random() - 0.5) * 34,
          -6 - depth * 60,
        ),
        // Distant protons are smaller and dimmer: real depth cueing, not fog.
        scale: 0.05 + (1 - depth) * 0.2 * (0.4 + random() * 0.9),
        phase: random() * Math.PI * 2,
      })
    }
    return items
  }, [])
}

function ProtonField({ reduced }: { reduced: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const items = useFieldPlacement()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const write = (time: number) => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      dummy.position.copy(item.position)
      // A slow drift, different per instance, so the field breathes without
      // anything visibly travelling.
      dummy.position.y += Math.sin(time * 0.16 + item.phase) * 0.5
      dummy.position.x += Math.cos(time * 0.11 + item.phase) * 0.32
      dummy.scale.setScalar(item.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  useEffect(() => {
    write(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  useFrame(({ clock }) => {
    if (reduced) return
    write(clock.elapsedTime)
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, FIELD_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial
        color="#16233a"
        roughness={0.14}
        metalness={0.4}
        transparent
        opacity={0.7}
        emissive="#12233c"
        emissiveIntensity={0.9}
      />
    </instancedMesh>
  )
}

/* -------------------------------------------------------------------------
   The B₀ beam
   ------------------------------------------------------------------------- */

/**
 * A vertical shaft of light through the proton's axis.
 *
 * Light, not a pole. The first version was a hard-edged white rod slicing the
 * frame; what sells "volumetric" is that the beam tapers away at its ends and
 * has no visible boundary. Both come from one procedural gradient texture —
 * bright centre fading to nothing vertically — applied to three concentric
 * additive cylinders (core, mid, halo). A short interior segment lets the axis
 * glow inside the glass, and two soft pole sprites mark where the beam meets
 * the surface.
 */
/**
 * A 2D falloff texture for the beam impostor: a gaussian column horizontally,
 * tapering to nothing at both ends vertically. Painted once, per-pixel.
 */
function useBeamTexture() {
  return useMemo(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const image = ctx.createImageData(size, size)
      for (let y = 0; y < size; y += 1) {
        // Vertical taper: full through the middle, easing to zero at the ends.
        const v = y / (size - 1)
        const taper = Math.pow(Math.sin(v * Math.PI), 0.7)
        for (let x = 0; x < size; x += 1) {
          // Horizontal gaussian about the centre line.
          const u = (x / (size - 1)) * 2 - 1
          const falloff = Math.exp(-(u * u) * 7)
          const alpha = Math.round(255 * falloff * taper)
          const index = (y * size + x) * 4
          image.data[index] = 255
          image.data[index + 1] = 255
          image.data[index + 2] = 255
          image.data[index + 3] = alpha
        }
      }
      ctx.putImageData(image, 0, 0)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    return texture
  }, [])
}

function FieldBeam({ reduced }: { reduced: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const texture = useBeamTexture()

  useFrame(({ clock, camera }) => {
    const group = groupRef.current
    if (!group) return
    // Cylindrical billboard: the shaft stays vertical but always faces the
    // viewer, so its soft gaussian edge is what the camera sees from any angle.
    const angle = Math.atan2(camera.position.x, camera.position.z)
    group.rotation.y = angle
    if (reduced) return
    const breathe = 1 + Math.sin(clock.elapsedTime * 0.45) * 0.08
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshBasicMaterial
        material.opacity = (child.userData.baseOpacity as number) * breathe
      }
    })
  })

  const sheet = (width: number, height: number, opacity: number, color: string) => (
    <mesh userData={{ baseOpacity: opacity }}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )

  return (
    <group ref={groupRef}>
      {/* Core, inner glow and wide bloom — all soft in every direction. */}
      {sheet(0.3, 17, 0.85, '#eaf9ff')}
      {sheet(1.1, 16, 0.3, '#9adcf7')}
      {sheet(3.2, 15, 0.1, '#4fb6e8')}
      {/* The axis glowing inside the glass. */}
      {sheet(0.5, 4.9, 0.3, '#bfeaff')}
    </group>
  )
}

/* -------------------------------------------------------------------------
   The proton
   ------------------------------------------------------------------------- */

function Proton({ reduced }: { reduced: boolean }) {
  const precessRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (reduced) return
    // Two separate, constant motions — neither touched by scroll. The body
    // turns about its own tilted axis; that axis sweeps a slow cone around
    // the vertical field.
    if (precessRef.current) precessRef.current.rotation.y += PRECESSION_RATE * delta
    if (spinRef.current) spinRef.current.rotation.y += SPIN_RATE * delta
  })

  return (
    <group ref={precessRef}>
    <group rotation={[0, 0, TILT]}>
    <group ref={spinRef}>
      <mesh>
        <sphereGeometry args={[2.5, 128, 128]} />
        {/*
          Physical glass. Transmission plus thickness gives true refraction of
          whatever is behind it; iridescence is thin-film interference, which is
          where the shifting blue-gold sheen on the rim comes from. Flat colour
          could not produce either.
        */}
        <meshPhysicalMaterial
          transmission={0.92}
          thickness={3.4}
          ior={1.5}
          roughness={0.06}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.05}
          iridescence={0.9}
          iridescenceIOR={1.32}
          iridescenceThicknessRange={[140, 560]}
          attenuationColor={new THREE.Color('#061018')}
          attenuationDistance={1.6}
          color={new THREE.Color('#cfe0ee')}
          envMapIntensity={1.1}
        />
      </mesh>

      {/* Interior glow: the proton is lit from within, not only from outside. */}
      <mesh>
        <sphereGeometry args={[1.55, 48, 48]} />
        <meshBasicMaterial
          color="#2a6890"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* The magnetic moment: a shaft of light through the body, poking well
          past both poles, with an arrowhead — this is what precesses. */}
      <mesh>
        <cylinderGeometry args={[0.045, 0.045, 7.2, 12]} />
        <meshBasicMaterial color="#A99EDB" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.14, 0.14, 7.2, 12]} />
        <meshBasicMaterial color="#A99EDB" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, 3.85, 0]}>
        <coneGeometry args={[0.24, 0.6, 24]} />
        <meshBasicMaterial color="#c0b6ee" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
    </group>
    </group>
  )
}

/* -------------------------------------------------------------------------
   Camera: driven by scroll, never by time
   ------------------------------------------------------------------------- */

function ScrollCamera({ progressRef }: { progressRef: React.RefObject<number> }) {
  const { camera } = useThree()
  const smoothed = useRef(0)

  useFrame((_, delta) => {
    const target = progressRef.current ?? 0
    // Critically damped follow: the camera never snaps to the scroll position,
    // which is what keeps fast scrolling from feeling jerky.
    const k = 1 - Math.exp(-delta * 3.2)
    smoothed.current += (target - smoothed.current) * k
    const p = smoothed.current

    // A slow dolly inward, a slight orbit, and a gentle vertical drift. The
    // visitor moves around the proton; the proton itself is never moved.
    const angle = -0.28 * p
    const distance = 11.4 - p * 2.6
    camera.position.set(
      Math.sin(angle) * distance,
      1.05 + p * 1.5,
      Math.cos(angle) * distance,
    )
    camera.lookAt(0, p * 0.55, 0)
  })

  return null
}

/* -------------------------------------------------------------------------
   Scene
   ------------------------------------------------------------------------- */

/**
 * Environment and background, set imperatively.
 *
 * The declarative environment helper washed the whole frame once its virtual
 * scene leaked into the display background — the entire viewport turned powder
 * blue. Something this central to the page's identity should not depend on a
 * helper behaving, so the environment is built here by hand: three's own
 * RoomEnvironment (a procedural studio that ships with the library — no CDN
 * fetch) run through PMREM for *reflections only*, while the display
 * background is pinned to bore black. Kept dim: the room provides the white
 * specular streaks on the glass, the rim lights provide the drama.
 */
function SceneSetup() {
  const { gl, scene } = useThree()

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTexture
    scene.environmentIntensity = 0.18
    scene.background = new THREE.Color('#030508')
    scene.fog = new THREE.Fog('#030508', 20, 80)
    return () => {
      scene.environment = null
      envTexture.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  return null
}

function HeroScene({ progressRef, reduced }: { progressRef: React.RefObject<number>; reduced: boolean }) {
  return (
    <>
      <SceneSetup />

      {/* Rim lighting does the work on glass. The key sits almost directly
          behind on the upper left, which is what draws the bright crescent
          along that edge; a second cool rim grazes the lower right so the
          silhouette never merges with the void; the warm fill is faint and
          frontal; the core light burns inside the sphere. */}
      <ambientLight intensity={0.06} />
      <directionalLight position={[-9, 5, -10]} intensity={7} color="#a8dcff" />
      <directionalLight position={[8, -8, -6]} intensity={2.4} color="#7fc4ea" />
      <directionalLight position={[6, -2, 6]} intensity={0.55} color="#ffd9a8" />
      <pointLight position={[0, 0, 0]} intensity={10} distance={11} color="#4fa8d8" />

      <ScrollCamera progressRef={progressRef} />
      <ProtonField reduced={reduced} />
      <FieldBeam reduced={reduced} />
      <Proton reduced={reduced} />
    </>
  )
}

export function ProtonHero({ progressRef }: { progressRef: React.RefObject<number> }) {
  const [reduced, setReduced] = useState(false)
  const [visible, setVisible] = useState(true)

  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(query.matches)
    apply()
    query.addEventListener?.('change', apply)
    return () => query.removeEventListener?.('change', apply)
  }, [])

  // Stop rendering entirely once the hero has scrolled away: a 60 fps WebGL
  // loop running behind the rest of the page is pure waste.
  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '120px' },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="hm-proton-host" ref={hostRef} aria-hidden="true">
      <Canvas
        frameloop={reduced ? 'demand' : visible ? 'always' : 'never'}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 1.05, 11.4], fov: 42 }}
      >
        <HeroScene progressRef={progressRef} reduced={reduced} />
      </Canvas>
    </div>
  )
}

export default ProtonHero

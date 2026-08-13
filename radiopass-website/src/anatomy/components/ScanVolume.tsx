import { useEffect, useRef } from 'react';
import { getAnatomyStops, POINT_COUNT } from '../lib/anatomy';
import './ScanVolume.css';

export interface ScanState {
  /** Continuous position through the scan, 0 .. stops-1. */
  scanT: number;
  /** Fades the whole volume out once the reader reaches the worklist. */
  opacity: number;
}

interface Props {
  stateRef: React.RefObject<ScanState>;
}

/* Depth is resolved by bucketing rather than sorting: with a fixed point count
   a counting sort is O(n) and allocation-free, which matters at 60fps. */
const DEPTH_BINS = 22;
const TIERS = 10;
const BUCKETS = DEPTH_BINS * TIERS;

const FOCAL = 3.4;

/** Key light, high and to the left in front of the volume — the direction a
    reading-room lamp would come from. */
const LX = -0.42;
const LY = 0.60;
const LZ = 0.68;

/** Shadow end of the ramp. Unlit tissue goes cold rather than black, so the
    far side of the volume still reads as tissue and not as a hole. */
const SHADOW: [number, number, number] = [14, 42, 60];

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

export default function ScanVolume({ stateRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const presetRef = useRef<HTMLSpanElement>(null);
  const windowRef = useRef<HTMLSpanElement>(null);
  const tableRef = useRef<HTMLSpanElement>(null);
  const seriesRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const stops = getAnatomyStops();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Per-point scatter directions, reused every frame. During a transition
       each point travels along its own vector, so the volume disperses and
       reassembles rather than sliding. */
    const scatter = new Float32Array(POINT_COUNT * 3);
    for (let i = 0; i < POINT_COUNT; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const m = 0.35 + Math.random() * 0.85;
      scatter[i * 3] = s * Math.cos(th) * m;
      scatter[i * 3 + 1] = u * m;
      scatter[i * 3 + 2] = s * Math.sin(th) * m;
    }

    const sx = new Float32Array(POINT_COUNT);
    const sy = new Float32Array(POINT_COUNT);
    const size = new Float32Array(POINT_COUNT);
    const bucketOf = new Int32Array(POINT_COUNT);
    const counts = new Int32Array(BUCKETS);
    const starts = new Int32Array(BUCKETS);
    const cursor = new Int32Array(BUCKETS);
    const order = new Int32Array(POINT_COUNT);

    let dpr = 1;
    let cw = 0;
    let ch = 0;

    /* Quality adapts to whatever the machine can hold. `stride` skips points
       rather than dropping the frame rate — a slightly sparser cloud reads far
       better than a stuttering one. */
    let stride = 1;
    let frameCost = 8;

    function resize() {
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = Math.max(1, Math.round(rect.width));
      ch = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      stride = cw < 700 ? 2 : 1;
      // Resizing clears the backing store, so put the volume back straight
      // away rather than leaving a blank frame behind.
      render(performance.now(), true);
    }

    // Pointer parallax, eased so the volume never snaps to the cursor.
    let targetMx = 0;
    let targetMy = 0;
    let mx = 0;
    let my = 0;
    function onPointer(e: PointerEvent) {
      targetMx = (e.clientX / window.innerWidth) * 2 - 1;
      targetMy = (e.clientY / window.innerHeight) * 2 - 1;
    }
    if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });

    let smoothT = stateRef.current?.scanT ?? 0;
    let smoothOpacity = 1;
    let raf = 0;
    let lastPreset = '';
    let lastWindow = '';
    let lastTable = '';
    let lastSeries = '';

    function setText(el: HTMLSpanElement | null, next: string, last: string) {
      if (el && next !== last) el.textContent = next;
      return next;
    }

    function render(now: number, snap = false) {
      if (!ctx || !canvas) return;
      const t0 = snap ? 0 : performance.now();

      const st = stateRef.current;
      const targetT = st ? st.scanT : 0;
      const targetOpacity = st ? st.opacity : 1;

      // Ease toward the scroll position: the volume trails the page slightly,
      // which is what makes the morph feel like mass rather than a crossfade.
      // A snap frame (first paint, resize) lands on the target immediately.
      smoothT += (targetT - smoothT) * (snap || reduced ? 1 : 0.11);
      smoothOpacity += (targetOpacity - smoothOpacity) * (snap ? 1 : 0.2);

      if (smoothOpacity < 0.01) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const maxIdx = stops.length - 1;
      const clamped = clamp(smoothT, 0, maxIdx);
      const idx = Math.min(Math.floor(clamped), maxIdx - 1);
      const raw = clamped - idx;
      // Hold on each region, then move decisively between them.
      const t = smoothstep(clamp((raw - 0.34) / 0.42, 0, 1));
      const transit = Math.sin(t * Math.PI);

      const A = stops[idx];
      const B = stops[idx + 1] ?? stops[idx];
      if (!A || !B) return; // guards a not-yet-laid-out page, where idx is NaN
      const pa = A.positions;
      const pb = B.positions;
      const na = A.normals;
      const nb = B.normals;
      const da = A.density;
      const db = B.density;

      const time = reduced ? 0 : now / 1000;

      mx += (targetMx - mx) * 0.05;
      my += (targetMy - my) * 0.05;

      const yaw = A.yaw + (B.yaw - A.yaw) * t + (reduced ? 0 : 0.10 * Math.sin(time * 0.27)) + mx * 0.28;
      const pitch = A.pitch + (B.pitch - A.pitch) * t + my * 0.15;
      const zoom = A.scale + (B.scale - A.scale) * t;

      const cy = Math.cos(yaw);
      const sYaw = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);

      // Scan plane advancing craniocaudally, the way a helical study acquires.
      const sweep = reduced ? 0.1 : ((time * 0.26) % 1) * 2.5 - 1.25;
      const SLAB = 0.13;

      const tint: [number, number, number] = [
        A.tint[0] + (B.tint[0] - A.tint[0]) * t,
        A.tint[1] + (B.tint[1] - A.tint[1]) * t,
        A.tint[2] + (B.tint[2] - A.tint[2]) * t,
      ];

      /* Wide screens read left to right, so the volume takes the right half and
         the copy takes the shaded left. Narrow ones stack instead: the volume
         sits in the upper third, above the copy rather than behind it. */
      const isWide = cw > 900;
      const originX = (isWide ? 0.655 : 0.5) * cw * dpr;
      const originY = (isWide ? 0.5 : 0.26) * ch * dpr;
      const radius = Math.min(cw, ch * 0.62) * dpr * (isWide ? 0.40 : 0.42) * zoom;

      counts.fill(0);

      // The window travels with the scan, so the transition between two
      // regions is also a transition between their two presets.
      const dLo = A.dLo + (B.dLo - A.dLo) * t;
      const dHi = A.dHi + (B.dHi - A.dHi) * t;
      const winScale = 1 / Math.max(1e-4, dHi - dLo);
      const exposure = A.exposure + (B.exposure - A.exposure) * t;

      const bulge = transit * 0.30;
      const boost = 1 + transit * 0.45;

      for (let i = 0; i < POINT_COUNT; i += stride) {
        const o = i * 3;
        let x = pa[o] + (pb[o] - pa[o]) * t;
        let y = pa[o + 1] + (pb[o + 1] - pa[o + 1]) * t;
        let z = pa[o + 2] + (pb[o + 2] - pa[o + 2]) * t;

        if (bulge > 0.001) {
          x += scatter[o] * bulge;
          y += scatter[o + 1] * bulge;
          z += scatter[o + 2] * bulge;
        }

        // Illumination from the scan plane is computed in model space, before
        // rotation, so the slab always travels head-to-toe on the patient.
        const dist = y - sweep;
        const ad = dist < 0 ? -dist : dist;
        const lit = ad < SLAB ? 1 - ad / SLAB : 0;

        // Rotate position: yaw about Y, then pitch about X.
        const rx = x * cy + z * sYaw;
        const rzt = -x * sYaw + z * cy;
        const ry = y * cp - rzt * sp;
        const rz = y * sp + rzt * cp;

        // Rotate the normal the same way, so the light stays put while the
        // volume turns.
        const mnx = na[o] + (nb[o] - na[o]) * t;
        const mny = na[o + 1] + (nb[o + 1] - na[o + 1]) * t;
        const mnz = na[o + 2] + (nb[o + 2] - na[o + 2]) * t;
        const nrx = mnx * cy + mnz * sYaw;
        const nrzt = -mnx * sYaw + mnz * cy;
        const nry = mny * cp - nrzt * sp;
        const nrz = mny * sp + nrzt * cp;

        const persp = FOCAL / (FOCAL - rz);
        sx[i] = originX + rx * persp * radius;
        sy[i] = originY - ry * persp * radius;

        // Wrapped lambert: the unlit side falls off without going dead.
        const diff = nrx * LX + nry * LY + nrz * LZ;
        const wrapped = diff * 0.5 + 0.5;
        // Rim light where the surface turns away from the viewer — this is
        // what gives a cloud of dots a readable silhouette.
        const az = nrz < 0 ? -nrz : nrz;
        const rim = (1 - az) * (1 - az) * (1 - az);

        /* Window the tissue exactly as the corner readout says: everything
           below the window floor is black, everything above it clips. This is
           why grey and white matter separate under WL 40 / WW 80 and why the
           same brain is a featureless mass under a bone window. */
        const dens = da[i] + (db[i] - da[i]) * t;
        // Gamma lifts the mid-tones so soft tissue carries, without touching
        // the clipped white that bone already sits at.
        const dwin = clamp((dens - dLo) * winScale, 0, 1);
        const dw = dwin * dwin * (3 - 2 * dwin) * 0.35 + Math.pow(dwin, 0.62) * 0.65;

        const depth = clamp((rz + 1.2) / 2.4, 0, 1);
        let b = (dw * (0.14 + 0.86 * wrapped * wrapped) + rim * 0.30 * dw) * exposure + depth * 0.07;
        b = (b * boost + lit * lit * 0.8 * (0.3 + dw)) * smoothOpacity;
        b = clamp(b, 0, 1);

        /* Points stay small and dim on purpose. Additive blending means a
           dense region is the sum of everything behind it, so per-point
           exposure has to be low or the torso solarises to white and the
           anatomy inside it is lost. */
        size[i] = (0.45 + b * 1.05 + persp * 0.22) * dpr;

        const bin = (depth * (DEPTH_BINS - 0.001)) | 0;
        const tier = (b * (TIERS - 0.001)) | 0;
        const bucket = bin * TIERS + tier;
        bucketOf[i] = bucket;
        counts[bucket]++;
      }

      let acc = 0;
      for (let b = 0; b < BUCKETS; b++) {
        starts[b] = acc;
        cursor[b] = acc;
        acc += counts[b];
      }
      for (let i = 0; i < POINT_COUNT; i += stride) order[cursor[bucketOf[i]]++] = i;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';

      for (let bin = 0; bin < DEPTH_BINS; bin++) {
        // Atmospheric falloff — the back of the volume recedes.
        const binAlpha = 0.16 + (bin / (DEPTH_BINS - 1)) * 0.56;
        ctx.globalAlpha = binAlpha;
        for (let tier = 0; tier < TIERS; tier++) {
          const bucket = bin * TIERS + tier;
          const n = counts[bucket];
          if (!n) continue;
          const bb = (tier + 0.5) / TIERS;
          const w = Math.pow(bb, 0.8);
          // Hot points lift toward white the way a bright voxel clips.
          const white = Math.max(0, (bb - 0.7) / 0.3) * 0.8;
          const r = Math.round((SHADOW[0] + (tint[0] - SHADOW[0]) * w) * (1 - white) + 255 * white);
          const g = Math.round((SHADOW[1] + (tint[1] - SHADOW[1]) * w) * (1 - white) + 255 * white);
          const bl = Math.round((SHADOW[2] + (tint[2] - SHADOW[2]) * w) * (1 - white) + 255 * white);
          ctx.fillStyle = `rgb(${r},${g},${bl})`;

          const from = starts[bucket];
          const to = from + n;
          for (let k = from; k < to; k++) {
            const i = order[k];
            const s = size[i];
            ctx.fillRect(sx[i] - s * 0.5, sy[i] - s * 0.5, s, s);
          }

          // Bloom: only the top tier, and only just enough to separate a lit
          // surface from a field of pixels.
          if (tier === TIERS - 1) {
            ctx.globalAlpha = 0.035;
            for (let k = from; k < to; k++) {
              const i = order[k];
              const s = size[i] * 3;
              ctx.fillRect(sx[i] - s * 0.5, sy[i] - s * 0.5, s, s);
            }
            ctx.globalAlpha = binAlpha;
          }
        }
      }

      // The plane itself, drawn as the ring it cuts through the volume.
      if (!reduced) {
        ctx.globalAlpha = 0.2 * smoothOpacity;
        ctx.lineWidth = 1 * dpr;
        ctx.strokeStyle = `rgb(${Math.round(tint[0])},${Math.round(tint[1])},${Math.round(tint[2])})`;
        ctx.beginPath();
        const ringR = A.ringR + (B.ringR - A.ringR) * t;
        const ringX = A.ringX + (B.ringX - A.ringX) * t;
        const ringZ = A.ringZ + (B.ringZ - A.ringZ) * t;
        for (let k = 0; k <= 64; k++) {
          const a = (k / 64) * Math.PI * 2;
          const x = ringX + Math.cos(a) * ringR;
          const z = ringZ + Math.sin(a) * ringR;
          const rx = x * cy + z * sYaw;
          const rzt = -x * sYaw + z * cy;
          const ry = sweep * cp - rzt * sp;
          const rz = sweep * sp + rzt * cp;
          const persp = FOCAL / (FOCAL - rz);
          const px = originX + rx * persp * radius;
          const py = originY - ry * persp * radius;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // Console readouts. Values are the presets a radiologist would actually
      // dial in for each region, interpolated as the study advances.
      const near = raw < 0.5 ? A : B;
      const table = Math.round(A.tablePos + (B.tablePos - A.tablePos) * t);
      lastPreset = setText(presetRef.current, near.window.preset.toUpperCase(), lastPreset);
      lastWindow = setText(windowRef.current, `WL ${near.window.wl}  WW ${near.window.ww}`, lastWindow);
      lastTable = setText(tableRef.current, `${table} mm`, lastTable);
      lastSeries = setText(
        seriesRef.current,
        `SE ${String(idx + (raw > 0.5 ? 2 : 1)).padStart(2, '0')}/07`,
        lastSeries
      );

      if (!snap) {
        frameCost += (performance.now() - t0 - frameCost) * 0.1;
        if (frameCost > 13 && stride < 3) {
          stride++;
          frameCost = 8;
        } else if (frameCost < 4 && stride > 1) {
          stride--;
          frameCost = 8;
        }
      }
    }

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      render(now);
    }

    resize(); // paints the first frame
    window.addEventListener('resize', resize);
    // rAF is suspended while the tab is hidden, so repaint on the way back in
    // rather than showing whatever was on screen when it was backgrounded.
    function onVisible() {
      if (document.visibilityState === 'visible') render(performance.now(), true);
    }
    document.addEventListener('visibilitychange', onVisible);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [stateRef]);

  return (
    <div className="scan-volume" ref={wrapRef} aria-hidden="true">
      <canvas ref={canvasRef} className="scan-canvas" />

      {/* Corner overlay, set the way a workstation annotates a study. */}
      <div className="dcm dcm-tl">
        <span className="dcm-strong">RADIOPASS ANATOMY</span>
        <span>FRCR PART 1 · REVISION</span>
        <span ref={seriesRef}>SE 01/07</span>
      </div>
      <div className="dcm dcm-tr">
        <span className="dcm-strong" ref={presetRef}>
          SCOUT
        </span>
        <span ref={windowRef}>WL 300 WW 1500</span>
      </div>
      <div className="dcm dcm-bl">
        <span>HELICAL · 0.6 mm</span>
        <span>120 kV · 210 mAs</span>
      </div>
      <div className="dcm dcm-br">
        <span>TABLE</span>
        <span className="dcm-strong" ref={tableRef}>
          0 mm
        </span>
      </div>
    </div>
  );
}

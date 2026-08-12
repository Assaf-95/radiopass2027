/* ===========================================================================
   Procedural anatomy volumes

   Every region on the home page is a point cloud built here rather than a
   loaded mesh. All clouds carry the same point count so one can be
   interpolated into the next, which is what lets the volume morph as the
   reader scrolls from head to toe.

   Each point carries three things:

     position   model space, roughly -1..1, y up, z toward the viewer
     normal     the surface direction, so the renderer can light the form
                instead of flat-shading it by depth
     density    how radiodense the tissue is, on the same 0..1 footing a
                window/level control works on — cortical bone near 1, lung
                parenchyma near 0.15. It is what gives the volume its tissue
                contrast, and it is why bone reads through soft tissue here
                the way it does on a film.
   =========================================================================== */

export const POINT_COUNT = 28000;

/* --- Tissue densities -----------------------------------------------------
   Stored on a linear Hounsfield scale mapped into 0..1, so that the window
   and level printed in the corner of the screen can be applied to the volume
   for real rather than quoted at it:

       density = 0.5 + HU / 2000        (water 0 HU sits at 0.5)

   That is the whole reason grey and white matter separate under a brain
   window and vanish under a bone one — which is exactly what happens on the
   workstation these cases are read on. */
export const HU_SPAN = 2000;
const hu = (v: number) => 0.5 + v / HU_SPAN;

const D = {
  air: hu(-1000),
  lung: hu(-700),
  fat: hu(-90),
  csf: hu(0),
  white: hu(25),
  grey: hu(40),
  vessel: hu(45),
  organ: hu(55),
  cartilage: hu(90),
  contrast: hu(320),
  trabecular: hu(300),
  cortical: hu(1000),
} as const;

/** Bone is a bright cortex around a lucent medulla. Soft tissue is not, so
    the hollowing only applies above trabecular density. */
const MEDULLA = hu(240);
function cortexFalloff(d: number, frac: number) {
  return d > D.trabecular ? MEDULLA + (d - MEDULLA) * frac : d;
}

/* --- Numeric helpers ------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const zf = smooth(z - zi);
  let acc = 0;
  for (let dz = 0; dz < 2; dz++) {
    const wz = dz ? zf : 1 - zf;
    for (let dy = 0; dy < 2; dy++) {
      const wy = dy ? yf : 1 - yf;
      for (let dx = 0; dx < 2; dx++) {
        const wx = dx ? xf : 1 - xf;
        acc += hash3(xi + dx, yi + dy, zi + dz) * wx * wy * wz;
      }
    }
  }
  return acc;
}

function fbm(x: number, y: number, z: number, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f, y * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

/* --- Sample scratch -------------------------------------------------------
   Primitives write here rather than allocating, which keeps building all
   seven volumes to a few milliseconds. */

interface Pt {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  d: number;
}

const S: Pt = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, d: 0.5 };

function setNormal(x: number, y: number, z: number) {
  const l = Math.hypot(x, y, z) || 1;
  S.nx = x / l;
  S.ny = y / l;
  S.nz = z / l;
}

/* --- Cloud writer --------------------------------------------------------- */

class Cloud {
  readonly positions = new Float32Array(POINT_COUNT * 3);
  readonly normals = new Float32Array(POINT_COUNT * 3);
  readonly density = new Float32Array(POINT_COUNT);
  private i = 0;
  readonly rnd: () => number;

  constructor(seed: number) {
    this.rnd = mulberry32(seed);
  }

  get room() {
    return POINT_COUNT - this.i;
  }

  private commit() {
    const o = this.i * 3;
    this.positions[o] = S.x;
    this.positions[o + 1] = S.y;
    this.positions[o + 2] = S.z;
    this.normals[o] = S.nx;
    this.normals[o + 1] = S.ny;
    this.normals[o + 2] = S.nz;
    /* A little scatter reads as image noise, which every real acquisition
       has. It is additive and small — about ±12 HU — because a multiplicative
       jitter would swamp a narrow window like the brain's WW 80. */
    this.density[this.i] = S.d + (this.rnd() - 0.5) * 0.012;
    this.i++;
  }

  /** Draw `n` accepted points from `gen`, which writes S and returns false to
      reject the sample (a carved fissure, a hilum, a notch). */
  sample(n: number, gen: (rnd: () => number) => boolean) {
    const want = Math.min(n, this.room);
    let placed = 0;
    let guard = 0;
    while (placed < want && guard < want * 40) {
      guard++;
      if (!gen(this.rnd)) continue;
      this.commit();
      placed++;
    }
  }

  /** Top up any shortfall by jittering points already placed. */
  finish() {
    if (this.i > 0) {
      const placed = this.i;
      while (this.i < POINT_COUNT) {
        const k = Math.floor(this.rnd() * placed);
        const o = k * 3;
        S.x = this.positions[o] + (this.rnd() - 0.5) * 0.01;
        S.y = this.positions[o + 1] + (this.rnd() - 0.5) * 0.01;
        S.z = this.positions[o + 2] + (this.rnd() - 0.5) * 0.01;
        S.nx = this.normals[o];
        S.ny = this.normals[o + 1];
        S.nz = this.normals[o + 2];
        S.d = this.density[k];
        this.commit();
      }
    }
    return this;
  }
}

/* --- Primitives -----------------------------------------------------------
   Each writes position, normal and density into S. */

/** Shell of an ellipsoid. `inner` is the shell's inner radius as a fraction
    (1 = surface only, 0 = solid). */
function ellipsoid(
  rnd: () => number,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  inner: number,
  d: number
) {
  const u = rnd() * 2 - 1;
  const th = rnd() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  const dx = s * Math.cos(th);
  const dy = u;
  const dz = s * Math.sin(th);
  const k = inner + (1 - inner) * Math.cbrt(rnd());
  S.x = cx + rx * dx * k;
  S.y = cy + ry * dy * k;
  S.z = cz + rz * dz * k;
  // Gradient of the implicit ellipsoid gives the true surface normal.
  setNormal(dx / (rx * rx), dy / (ry * ry), dz / (rz * rz));
  S.d = d;
  return true;
}

/** Orthonormal basis with (ax,ay,az) as the primary axis. */
const B = { nx: 0, ny: 0, nz: 0, px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0 };

function basis(ax: number, ay: number, az: number) {
  const len = Math.hypot(ax, ay, az) || 1;
  const nx = ax / len;
  const ny = ay / len;
  const nz = az / len;
  let ux = 0;
  let uy = 0;
  let uz = 1;
  if (Math.abs(nz) > 0.9) {
    ux = 1;
    uz = 0;
  }
  let px = ny * uz - nz * uy;
  let py = nz * ux - nx * uz;
  let pz = nx * uy - ny * ux;
  const pl = Math.hypot(px, py, pz) || 1;
  px /= pl;
  py /= pl;
  pz /= pl;
  B.nx = nx;
  B.ny = ny;
  B.nz = nz;
  B.px = px;
  B.py = py;
  B.pz = pz;
  B.qx = ny * pz - nz * py;
  B.qy = nz * px - nx * pz;
  B.qz = nx * py - ny * px;
}

/** Tapered tube from a to b. `hollow` biases toward the cortex, which is how
    a long bone actually reads: a bright rim with a lucent medulla. */
function tube(
  rnd: () => number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  r0: number,
  r1: number,
  hollow: number,
  d: number
) {
  basis(bx - ax, by - ay, bz - az);
  const t = rnd();
  const frac = hollow + (1 - hollow) * Math.sqrt(rnd());
  const r = (r0 + (r1 - r0) * t) * frac;
  const th = rnd() * Math.PI * 2;
  const c = Math.cos(th);
  const s = Math.sin(th);
  S.x = ax + (bx - ax) * t + (B.px * c + B.qx * s) * r;
  S.y = ay + (by - ay) * t + (B.py * c + B.qy * s) * r;
  S.z = az + (bz - az) * t + (B.pz * c + B.qz * s) * r;
  setNormal(B.px * c + B.qx * s, B.py * c + B.qy * s, B.pz * c + B.qz * s);
  S.d = cortexFalloff(d, frac);
  return true;
}

/** Flat bone: a plate with thickness, normal across the plate. Scapula, iliac
    wing, sternum and the cranial vault are all built from this. */
function plate(
  rnd: () => number,
  cx: number,
  cy: number,
  cz: number,
  ux: number,
  uy: number,
  uz: number,
  vx: number,
  vy: number,
  vz: number,
  thickness: number,
  d: number
) {
  const a = rnd() * 2 - 1;
  const b = rnd() * 2 - 1;
  if (a * a + b * b > 1) return false;
  const side = rnd() < 0.5 ? -1 : 1;
  // Cross product of the two in-plane axes is the plate normal.
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  const h = (thickness * 0.5 * side) / nl;
  S.x = cx + ux * a + vx * b + nx * h;
  S.y = cy + uy * a + vy * b + ny * h;
  S.z = cz + uz * a + vz * b + nz * h;
  setNormal(nx * side, ny * side, nz * side);
  S.d = d;
  return true;
}

/** A point on a curved rib. `arc` sweeps posteriorly to anteriorly. */
function ribArc(
  rnd: () => number,
  side: number,
  y0: number,
  spread: number,
  drop: number,
  depth: number,
  radius: number,
  d: number
) {
  const a = rnd() * Math.PI * 0.98;
  const cx = side * spread * Math.sin(a);
  const cy = y0 - a * drop;
  const cz = -depth * 0.55 + depth * Math.cos(a) * -1;
  // Tangent of the arc, then a random direction perpendicular to it.
  const tx = side * spread * Math.cos(a);
  const ty = -drop;
  const tz = depth * Math.sin(a);
  basis(tx, ty, tz);
  const th = rnd() * Math.PI * 2;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const frac = 0.45 + 0.55 * Math.sqrt(rnd());
  S.x = cx + (B.px * c + B.qx * s) * radius * frac;
  S.y = cy + (B.py * c + B.qy * s) * radius * frac;
  S.z = cz + (B.pz * c + B.qz * s) * radius * frac;
  setNormal(B.px * c + B.qx * s, B.py * c + B.qy * s, B.pz * c + B.qz * s);
  S.d = cortexFalloff(d, frac);
  return true;
}

/* --- Region: whole-body scout --------------------------------------------
   The topogram the scanner takes before any slice is prescribed.

   Built to canonical proportions rather than by eye: the body spans y -1..+1,
   the head is one seven-and-a-halfth of that, the pubic symphysis sits at
   mid-height, and the shoulder, elbow, wrist, knee and ankle lines fall where
   they actually do. Bones carry their real shapes — ribs slope downward and
   forward into costal cartilage, the scapula is a triangular plate, the femur
   has a neck angled off its shaft — because a stick figure made of dots reads
   as a diagram, and this has to read as an acquisition. */

/** Landmark heights, as fractions of body height from the vertex. */
const VERTEX = 1.0;
const CHIN = 0.735;
const SHOULDER = 0.645;
const XIPHOID = 0.36;
const PUBIS = 0.0;
const KNEE = -0.5;
const ANKLE = -0.915;
const SOLE = -1.0;

function buildScout(c: Cloud) {
  /* --- Skull, face and mandible ---------------------------------------- */
  c.sample(1500, (r) => {
    const pick = r();
    if (pick < 0.62) {
      // Cranial vault: an ovoid longer front-to-back than side-to-side.
      ellipsoid(r, 0, 0.885, -0.005, 0.082, 0.098, 0.098, 0.9, D.cortical);
      return S.y > 0.80 || S.z < 0.03;
    }
    if (pick < 0.82) {
      // Facial skeleton: orbits, maxilla and the nasal aperture between them.
      const side = r() < 0.5 ? -1 : 1;
      if (r() < 0.55) return ellipsoid(r, side * 0.035, 0.83, 0.062, 0.026, 0.022, 0.02, 0.85, D.cortical);
      return ellipsoid(r, side * 0.028, 0.785, 0.058, 0.028, 0.026, 0.024, 0.8, D.trabecular);
    }
    // Mandible: a horseshoe, with rami climbing to the condyles.
    if (r() < 0.7) {
      const a = -1.3 + r() * 2.6;
      return tube(r, Math.sin(a) * 0.058, CHIN + 0.012, 0.03 + Math.cos(a) * 0.055,
                     Math.sin(a) * 0.059, CHIN + 0.022, 0.03 + Math.cos(a) * 0.056,
                     0.011, 0.009, 0.5, D.cortical);
    }
    const side = r() < 0.5 ? -1 : 1;
    return tube(r, side * 0.056, CHIN + 0.02, -0.012, side * 0.052, 0.828, -0.028, 0.009, 0.008, 0.5, D.cortical);
  });

  /* --- Vertebral column -------------------------------------------------
     Twenty-four vertebrae plus sacrum, on the three normal sagittal curves.
     Bodies grow steadily caudally; spinous processes point back and down. */
  const LEVELS = 24;
  const vert = (i: number) => {
    const t = i / (LEVELS - 1);
    const y = CHIN - 0.055 - t * 0.735;
    // cervical lordosis, thoracic kyphosis, lumbar lordosis
    const z = -0.035 + 0.038 * Math.sin(t * Math.PI * 2.05 + 0.4);
    return { t, y, z, w: 0.019 + t * 0.020 };
  };
  c.sample(2100, (r) => {
    const g = vert(Math.floor(r() * LEVELS));
    const h = 0.011 + g.t * 0.006;
    return tube(r, 0, g.y - h, g.z, 0, g.y + h, g.z, g.w, g.w, 0.55, D.trabecular);
  });
  c.sample(900, (r) => {
    const i = Math.floor(r() * LEVELS);
    const g = vert(i);
    const droop = 0.016 * Math.sin(Math.min(1, Math.max(0, (g.t - 0.18) / 0.55)) * Math.PI);
    return tube(r, 0, g.y, g.z - g.w * 0.9, 0, g.y - droop, g.z - g.w * 2.6, 0.008, 0.005, 0.5, D.cortical);
  });

  /* --- Ribcage -----------------------------------------------------------
     Twelve pairs. Each rib leaves the spine posteriorly, sweeps laterally,
     then turns forward and downward — the downward slope is what makes a
     ribcage look like a ribcage rather than a barrel of hoops. */
  c.sample(5000, (r) => {
    const rib = Math.floor(r() * 12);
    const side = r() < 0.5 ? -1 : 1;
    const f = rib / 11;
    const yStart = SHOULDER - 0.055 - rib * 0.036;
    // Widest at ribs 7–8, tapering above and below.
    const spread = 0.085 + Math.sin(Math.min(1, f * 1.35) * Math.PI * 0.86) * 0.105;
    const drop = 0.075 + f * 0.055;
    const depth = 0.055 + Math.sin(Math.min(1, f * 1.3) * Math.PI * 0.8) * 0.055;
    const a = r() * Math.PI * (rib > 9 ? 0.62 : 0.98);
    const cx = side * spread * Math.sin(a);
    const cy = yStart - Math.pow(a / Math.PI, 1.35) * drop;
    const cz = -0.045 - depth * Math.cos(a) + depth * 0.55;
    // Cross-section of the rib itself, oriented across its own path.
    const tx = side * spread * Math.cos(a);
    const tz = depth * Math.sin(a);
    basis(tx, -drop * 0.5, tz);
    const th = r() * Math.PI * 2;
    const rad = 0.0055;
    S.x = cx + (B.px * Math.cos(th) + B.qx * Math.sin(th)) * rad;
    S.y = cy + (B.py * Math.cos(th) + B.qy * Math.sin(th)) * rad;
    S.z = cz + (B.pz * Math.cos(th) + B.qz * Math.sin(th)) * rad;
    setNormal(B.px * Math.cos(th) + B.qx * Math.sin(th),
              B.py * Math.cos(th) + B.qy * Math.sin(th),
              B.pz * Math.cos(th) + B.qz * Math.sin(th));
    S.d = D.cortical;
    return true;
  });

  // Costal cartilages sweeping up to the sternum, and the sternum itself.
  c.sample(700, (r) => {
    const rib = Math.floor(r() * 7);
    const side = r() < 0.5 ? -1 : 1;
    const y0 = SHOULDER - 0.13 - rib * 0.036;
    return tube(r, side * 0.13, y0 - 0.055, 0.055, side * 0.017, y0 + 0.012, 0.072,
                0.005, 0.004, 0.5, D.cartilage);
  });
  c.sample(600, (r) =>
    plate(r, 0, SHOULDER - 0.115, 0.078, 0, 0.115, -0.012, 0.019, 0, 0.004, 0.009, D.cortical)
  );

  /* --- Shoulder girdle --------------------------------------------------- */
  c.sample(700, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const t = r();
    // Clavicle: the S is the whole character of the bone.
    const x = side * (0.018 + t * 0.175);
    const z = 0.052 - 0.055 * Math.sin(t * Math.PI * 1.9);
    return tube(r, x, SHOULDER + 0.022, z, x + side * 0.012, SHOULDER + 0.024, z + 0.002,
                0.008, 0.008, 0.5, D.cortical);
  });
  c.sample(1300, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const pick = r();
    if (pick < 0.66) {
      // Triangular blade, widest at the top, narrowing to the inferior angle.
      const a = r() * 2 - 1;
      const b = r() * 2 - 1;
      if (a * a + b * b > 1) return false;
      const up = (b + 1) / 2;
      const halfW = 0.062 * (0.3 + 0.7 * up);
      S.x = side * (0.105 + a * halfW);
      S.y = SHOULDER - 0.135 + up * 0.13;
      S.z = -0.085 + Math.abs(a) * 0.014;
      setNormal(side * 0.3, 0.05, -1);
      S.d = D.trabecular;
      return true;
    }
    if (pick < 0.86) {
      // Spine of the scapula running out to the acromion.
      return tube(r, side * 0.05, SHOULDER - 0.012, -0.082, side * 0.185, SHOULDER + 0.028, -0.048,
                  0.008, 0.009, 0.5, D.cortical);
    }
    return ellipsoid(r, side * 0.185, SHOULDER - 0.005, -0.018, 0.017, 0.02, 0.016, 0.7, D.cortical);
  });

  /* --- Pelvis ------------------------------------------------------------
     Flared iliac wings, sacrum wedged between them, and the obturator ring
     below — the shape that makes a body read as a body at the waist. */
  c.sample(2600, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const pick = r();
    if (pick < 0.5) {
      const u = r();
      const v = r();
      const a = -0.35 + u * 1.72;
      const rad = 0.075 + v * 0.055;
      S.x = side * (0.016 + rad * Math.sin(a) * 1.05);
      S.y = PUBIS + 0.145 - Math.cos(a) * 0.075 - (1 - v) * 0.06;
      S.z = -0.03 + rad * 0.55 * Math.cos(a * 0.8) + (r() - 0.5) * 0.016;
      setNormal(side * Math.sin(a) * 0.75, Math.cos(a) * 0.5, 0.66);
      S.d = v > 0.86 || v < 0.08 ? D.cortical : D.trabecular;
      return true;
    }
    if (pick < 0.66) {
      const t = r();
      const w = 0.032 * (1 - t * 0.6);
      const th = r() * Math.PI * 2;
      const rad = w * Math.sqrt(r());
      S.x = rad * Math.cos(th);
      S.y = PUBIS + 0.13 - t * 0.125;
      S.z = -0.058 + rad * 0.5 * Math.sin(th) + t * 0.022;
      setNormal(Math.cos(th) * 0.6, 0.2, Math.sin(th));
      S.d = D.trabecular;
      return true;
    }
    if (pick < 0.8) {
      // Superior pubic ramus running in to the symphysis.
      return tube(r, side * 0.078, PUBIS + 0.012, 0.012, side * 0.012, PUBIS - 0.012, 0.038,
                  0.008, 0.007, 0.5, D.cortical);
    }
    if (pick < 0.9) {
      // Ischium and its tuberosity.
      return tube(r, side * 0.078, PUBIS + 0.012, 0.012, side * 0.062, PUBIS - 0.062, -0.022,
                  0.008, 0.010, 0.5, D.cortical);
    }
    // Acetabulum and the femoral head seated in it.
    if (r() < 0.5) {
      ellipsoid(r, side * 0.092, PUBIS + 0.03, -0.01, 0.028, 0.028, 0.026, 0.9, D.cortical);
      return true;
    }
    return ellipsoid(r, side * 0.092, PUBIS + 0.028, -0.008, 0.021, 0.021, 0.02, 0.5, D.trabecular);
  });

  /* --- Upper limbs -------------------------------------------------------
     Shoulder at 0.645, elbow at the waist, wrist at the hip, fingertips just
     below — the proportions that stop an arm looking like a stick. */
  c.sample(3000, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const seg = r();
    const shX = side * 0.185;
    const elX = side * 0.212;
    const wrX = side * 0.228;
    if (seg < 0.08) return ellipsoid(r, shX, SHOULDER - 0.01, -0.012, 0.024, 0.026, 0.023, 0.5, D.trabecular);
    if (seg < 0.42) return tube(r, shX, SHOULDER - 0.03, -0.008, elX, 0.295, 0.004, 0.017, 0.014, 0.6, D.cortical);
    if (seg < 0.5) {
      const s2 = r() < 0.5 ? -1 : 1;
      return ellipsoid(r, elX + s2 * 0.014, 0.278, 0.004, 0.014, 0.013, 0.013, 0.55, D.trabecular);
    }
    if (seg < 0.8) {
      // Radius and ulna side by side.
      const off = r() < 0.5 ? -0.011 : 0.011;
      return tube(r, elX + side * off, 0.27, 0.006, wrX + side * off * 0.8, 0.062, 0.012,
                  0.0105, 0.009, 0.6, D.cortical);
    }
    if (seg < 0.88) {
      const k = Math.floor(r() * 4);
      return ellipsoid(r, wrX + side * (k - 1.5) * 0.008, 0.048 - (k % 2) * 0.009, 0.014,
                       0.006, 0.007, 0.006, 0.5, D.trabecular);
    }
    // Metacarpals then phalanges, fanning slightly.
    const digit = Math.floor(r() * 5);
    const fan = (digit - 2) * 0.0085;
    const bx = wrX + side * fan;
    if (r() < 0.55) return tube(r, bx, 0.032, 0.016, bx + side * fan * 0.4, -0.008, 0.016, 0.0045, 0.0038, 0.6, D.cortical);
    return tube(r, bx + side * fan * 0.4, -0.008, 0.016, bx + side * fan * 0.8, -0.048 + Math.abs(digit - 2) * 0.006, 0.016,
                0.0036, 0.0026, 0.6, D.cortical);
  });

  /* --- Lower limbs ------------------------------------------------------- */
  c.sample(4600, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const seg = r();
    const hipX = side * 0.092;
    const kneeX = side * 0.062;
    const ankX = side * 0.055;
    if (seg < 0.07) {
      // Neck and greater trochanter — the angle off the shaft is diagnostic.
      if (r() < 0.6) return tube(r, hipX, PUBIS + 0.022, -0.008, side * 0.128, PUBIS - 0.022, -0.004, 0.014, 0.015, 0.5, D.trabecular);
      return ellipsoid(r, side * 0.132, PUBIS + 0.004, -0.006, 0.017, 0.024, 0.016, 0.55, D.cortical);
    }
    if (seg < 0.40) return tube(r, side * 0.122, PUBIS - 0.03, -0.004, kneeX, KNEE + 0.038, 0.004, 0.021, 0.017, 0.62, D.cortical);
    if (seg < 0.48) {
      const s2 = r() < 0.5 ? -1 : 1;
      return ellipsoid(r, kneeX + s2 * 0.017, KNEE + 0.016, 0.004, 0.019, 0.021, 0.02, 0.5, D.trabecular);
    }
    if (seg < 0.52) return ellipsoid(r, kneeX, KNEE + 0.012, 0.036, 0.015, 0.017, 0.007, 0.5, D.trabecular);
    if (seg < 0.86) {
      // Tibia, with the fibula slender and lateral.
      const fib = r() < 0.3;
      const off = fib ? side * 0.021 : 0;
      return tube(r, kneeX + off, KNEE - 0.02, 0.004, ankX + off, ANKLE + 0.02, 0.0,
                  fib ? 0.0075 : 0.019, fib ? 0.0065 : 0.014, 0.62, D.cortical);
    }
    if (seg < 0.92) {
      if (r() < 0.5) return ellipsoid(r, ankX, ANKLE + 0.006, 0.012, 0.016, 0.013, 0.016, 0.5, D.trabecular);
      return ellipsoid(r, ankX, ANKLE - 0.028, -0.022, 0.017, 0.014, 0.028, 0.5, D.trabecular);
    }
    // Metatarsals and toes, running forward to the toe line.
    const ray = Math.floor(r() * 5);
    const off = (ray - 2) * 0.009;
    if (r() < 0.6) return tube(r, ankX + off, ANKLE - 0.045, 0.03, ankX + off * 1.25, SOLE + 0.022, 0.088, 0.0055, 0.0045, 0.6, D.cortical);
    return tube(r, ankX + off * 1.25, SOLE + 0.022, 0.088, ankX + off * 1.4, SOLE + 0.014, 0.118 - Math.abs(ray - 1) * 0.005,
                0.0042, 0.003, 0.6, D.cortical);
  });

  /* --- Thoracic and abdominal viscera ------------------------------------
     Faint, but it is the difference between a skeleton and a body: on a real
     scout the mediastinum and the liver are plainly there. */
  c.sample(2000, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const pick = r();
    if (pick < 0.5) {
      // Lungs: taller than they are wide, notched by the heart on the left.
      const a = r() * 2 - 1;
      const b = r() * 2 - 1;
      if (a * a + b * b > 1) return false;
      const ly = r();
      const hw = 0.085 * Math.pow(1 - ly, 0.34) + 0.016;
      S.x = side * (0.022 + hw * (a * 0.5 + 0.5));
      S.y = XIPHOID - 0.02 + ly * 0.33;
      S.z = -0.03 + b * (0.06 * Math.pow(1 - ly, 0.3) + 0.014);
      if (side < 0 && ly < 0.4 && a < -0.2 && S.z > -0.03) return false;
      setNormal(a * side, (ly - 0.45) * 1.4, b);
      S.d = D.lung;
      return true;
    }
    if (pick < 0.7) {
      ellipsoid(r, -0.03, XIPHOID + 0.055, 0.022, 0.062, 0.058, 0.045, 0.55, D.organ);
      return true;
    }
    // Liver filling the right upper abdomen, stomach bubble on the left.
    if (pick < 0.94) {
      ellipsoid(r, 0.058, XIPHOID - 0.075, 0.0, 0.098, 0.055, 0.062, 0.5, D.organ);
      return S.x > -0.03;
    }
    return ellipsoid(r, -0.075, XIPHOID - 0.075, 0.02, 0.04, 0.032, 0.03, 0.4, D.air);
  });

  /* --- Body surface ------------------------------------------------------
     A contour, not a cloud: head, neck, shoulders, the taper to the waist,
     the flare at the hips, then two legs. */
  c.sample(3000, (r) => {
    const t = r();
    const y = VERTEX - t * 2.0;
    const th = r() * Math.PI * 2;
    let hw: number;
    let cx = 0;
    let depth = 0.72;
    if (y > CHIN) {
      // Head
      const u = (VERTEX - y) / (VERTEX - CHIN);
      hw = 0.093 * Math.sin(Math.min(1, 0.24 + u * 0.95) * Math.PI * 0.62);
      depth = 1.18;
    } else if (y > SHOULDER + 0.02) {
      hw = 0.048; // neck
      depth = 0.95;
    } else if (y > XIPHOID) {
      const u = (SHOULDER + 0.02 - y) / (SHOULDER + 0.02 - XIPHOID);
      hw = 0.225 - u * 0.055; // shoulders tapering to the chest
      depth = 0.62;
    } else if (y > PUBIS + 0.06) {
      const u = (XIPHOID - y) / (XIPHOID - PUBIS - 0.06);
      hw = 0.17 - 0.022 * Math.sin(u * Math.PI); // waist
      depth = 0.66;
    } else if (y > PUBIS - 0.09) {
      hw = 0.178; // hips
      depth = 0.7;
    } else {
      const u = (PUBIS - 0.09 - y) / (SOLE - PUBIS + 0.09);
      hw = 0.072 - u * 0.032;
      cx = (r() < 0.5 ? -1 : 1) * (0.088 - u * 0.03);
      depth = 0.85;
    }
    S.x = cx + Math.cos(th) * hw;
    S.y = y;
    S.z = -0.01 + Math.sin(th) * hw * depth;
    setNormal(Math.cos(th), 0.04, Math.sin(th) * depth);
    S.d = D.fat;
    return true;
  });

  return c.finish();
}

/* --- Region: head and neck ------------------------------------------------ */

function buildHeadNeck(c: Cloud) {
  /* Cerebral cortex. The displacement is a winding groove field rather than
     plain noise, and the normal is perturbed by its gradient — without that
     the gyri are geometry the light never finds. */
  const GYRUS = 0.088;
  const foldAt = (x: number, y: number, z: number) =>
    Math.cos(6.5 * fbm(x * 1.6 + 8, y * 1.6, z * 1.6, 3) * Math.PI * 2);

  c.sample(12800, (r) => {
    const u = r() * 2 - 1;
    const th = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    let dx = s * Math.cos(th);
    const dy = u;
    const dz = s * Math.sin(th);

    // Open the interhemispheric fissure.
    if (Math.abs(dx) < 0.045) return false;
    const side = dx >= 0 ? 1 : -1;
    dx += side * 0.018;

    const f = foldAt(dx, dy, dz);
    const shell = 0.93 + 0.07 * r();
    const k = (1 + GYRUS * f) * shell;

    // Flatter inferiorly, where the brain rests on the skull base.
    const ry = dy < -0.2 ? 0.42 : 0.52;
    const px = dx * 0.60 * k;
    const py = 0.10 + dy * ry * k;
    const pz = dz * 0.66 * k - 0.02;

    // Posterior fossa belongs to the cerebellum.
    if (py < -0.06 && pz < -0.12) return false;
    // Lateral (Sylvian) fissure, separating the temporal lobe.
    const syl = py - 0.02 + pz * 0.22 + Math.abs(px) * 0.30 - 0.03;
    if (Math.abs(syl) < 0.022 && Math.abs(px) > 0.18) return false;

    S.x = px;
    S.y = py;
    S.z = pz;

    // Gradient of the fold field along two tangents, so ridges catch light.
    const e = 0.05;
    let t1x = -dz;
    const t1z = dx;
    const l1 = Math.hypot(t1x, t1z) || 1;
    t1x /= l1;
    const t1zn = t1z / l1;
    const g1 = (foldAt(dx + t1x * e, dy, dz + t1zn * e) - f) / e;
    const g2 = (foldAt(dx, dy + e, dz) - f) / e;
    const bump = GYRUS * 0.55;
    setNormal(
      dx - (t1x * g1) * bump,
      dy - g2 * bump,
      dz - (t1zn * g1) * bump
    );
    // Cortical grey outside, white matter deeper.
    S.d = shell > 0.955 ? D.grey : D.white;
    return true;
  });

  // Deep grey matter: thalami, lentiform nuclei, caudate heads.
  c.sample(700, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const pick = r();
    if (pick < 0.4) return ellipsoid(r, side * 0.075, 0.02, -0.06, 0.055, 0.05, 0.075, 0.35, D.grey);
    if (pick < 0.75) return ellipsoid(r, side * 0.155, 0.03, 0.02, 0.045, 0.055, 0.06, 0.35, D.grey);
    return ellipsoid(r, side * 0.09, 0.10, 0.10, 0.03, 0.045, 0.05, 0.35, D.grey);
  });

  // Corpus callosum — the midline arc that ties the hemispheres together.
  c.sample(560, (r) => {
    const t = r();
    const a = -0.55 + t * 3.1;
    const px = (r() - 0.5) * 0.07;
    const py = 0.17 + Math.sin(a) * 0.115;
    const pz = -0.03 + Math.cos(a) * 0.235;
    S.x = px;
    S.y = py - (t > 0.86 ? (t - 0.86) * 0.5 : 0);
    S.z = pz;
    setNormal(Math.sin(a) * 0.2, Math.sin(a), Math.cos(a));
    S.d = D.white;
    return true;
  });

  // Lateral ventricles, carved as CSF: dark, and the landmark everything else
  // on an axial slice is described relative to.
  c.sample(620, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const t = r();
    const a = -0.7 + t * 2.5;
    return tube(
      r,
      side * 0.055,
      0.10 + Math.sin(a) * 0.075,
      -0.02 + Math.cos(a) * 0.19,
      side * 0.075,
      0.10 + Math.sin(a + 0.2) * 0.075,
      -0.02 + Math.cos(a + 0.2) * 0.19,
      0.028,
      0.028,
      0.2,
      D.lung
    );
  });

  // Cerebellum — folia are fine, near-horizontal, and far tighter than gyri.
  c.sample(2400, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    ellipsoid(r, side * 0.165, -0.30, -0.28, 0.185, 0.125, 0.165, 0.74, D.grey);
    const fold = 1 + 0.03 * Math.cos(S.y * 82);
    const dy = S.y + 0.30;
    S.x = (S.x - side * 0.165) * fold + side * 0.165;
    S.z = (S.z + 0.28) * fold - 0.28;
    // Analytic normal perturbation for the folia.
    setNormal(S.nx, S.ny - 0.03 * 82 * Math.sin(dy * 82) * 0.4, S.nz);
    return true;
  });
  // Vermis between the hemispheres.
  c.sample(340, (r) => ellipsoid(r, 0, -0.29, -0.27, 0.045, 0.115, 0.14, 0.55, D.grey));

  // Brainstem: midbrain, pons, medulla, then the cervical cord.
  c.sample(1000, (r) => {
    const seg = r();
    if (seg < 0.3) return ellipsoid(r, 0, -0.08, -0.05, 0.07, 0.055, 0.06, 0.4, D.white);
    if (seg < 0.68) return ellipsoid(r, 0, -0.20, -0.04, 0.095, 0.085, 0.09, 0.4, D.white);
    return tube(r, 0, -0.29, -0.06, 0, -0.72, -0.05, 0.045, 0.034, 0.35, D.white);
  });

  /* Cranial vault, opened anteriorly. Bone clips to white under a brain
     window, so a closed vault would sit in front of the brain and hide the one
     thing this region is about. Cutting it away is what an anatomical plate
     does, and it lets the cortex be the subject. */
  c.sample(2100, (r) => {
    ellipsoid(r, 0, 0.08, -0.02, 0.70, 0.62, 0.76, 0.975, D.cortical);
    return S.z < 0.12;
  });

  // Skull base with the sella and petrous temporal bones.
  c.sample(900, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    if (r() < 0.55) {
      return plate(r, side * 0.20, -0.40, -0.10, side * 0.24, 0.03, 0.02, 0, 0.03, 0.30, 0.03, D.cortical);
    }
    return tube(r, side * 0.10, -0.40, -0.30, side * 0.40, -0.36, 0.02, 0.05, 0.035, 0.55, D.cortical);
  });

  // Orbits and globes.
  c.sample(1100, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    if (r() < 0.5) {
      ellipsoid(r, side * 0.245, -0.24, 0.46, 0.145, 0.135, 0.15, 0.94, D.cortical);
      return S.z > 0.36;
    }
    return ellipsoid(r, side * 0.235, -0.23, 0.52, 0.085, 0.085, 0.085, 0.7, D.organ);
  });

  // Maxillary sinuses, ethmoids and the nasal septum.
  c.sample(1400, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const pick = r();
    if (pick < 0.5) {
      ellipsoid(r, side * 0.235, -0.55, 0.42, 0.145, 0.135, 0.13, 0.9, D.cortical);
      S.d = D.cortical;
      return true;
    }
    if (pick < 0.72) return ellipsoid(r, side * 0.08, -0.36, 0.42, 0.05, 0.08, 0.09, 0.85, D.trabecular);
    if (pick < 0.9) {
      return plate(r, 0, -0.50, 0.46, 0, 0.14, 0, 0, 0, 0.15, 0.014, D.cortical);
    }
    return ellipsoid(r, 0, -0.30, 0.30, 0.06, 0.07, 0.06, 0.8, D.trabecular);
  });

  // Mandible and the cervical spine behind it.
  c.sample(1500, (r) => {
    if (r() < 0.62) {
      const a = -1.3 + r() * 2.6;
      const rad = 0.35;
      const cx = Math.sin(a) * rad;
      const cz = 0.10 + Math.cos(a) * rad * 0.85;
      return tube(r, cx, -0.74, cz, cx * 1.01, -0.70, cz, 0.032, 0.026, 0.5, D.cortical);
    }
    const lvl = Math.floor(r() * 5);
    const y = -0.52 - lvl * 0.115;
    if (r() < 0.6) return tube(r, 0, y + 0.035, -0.10, 0, y - 0.035, -0.10, 0.075, 0.075, 0.55, D.trabecular);
    return tube(r, 0, y, -0.19, 0, y - 0.03, -0.30, 0.026, 0.018, 0.45, D.cortical);
  });

  return c.finish();
}

/* --- Region: thorax ------------------------------------------------------- */

function buildThorax(c: Cloud) {
  const lungPoint = (r: () => number, side: number) => {
    const a = r() * 2 - 1;
    const b = r() * 2 - 1;
    if (a * a + b * b > 1) return false;

    const ly = r(); // 0 at the base, 1 at the apex
    const halfW = 0.30 * Math.pow(1 - ly, 0.38) + 0.05;
    const depth = 0.30 * Math.pow(1 - ly, 0.30) + 0.05;

    let x = side * (0.10 + halfW * (a * 0.5 + 0.5));
    const z = b * depth;
    let y = -0.62 + ly * 1.28;
    y += 0.20 * Math.pow(1 - Math.hypot(a, b), 2) * Math.pow(1 - ly, 2.2);

    // Left cardiac notch.
    if (side < 0 && ly < 0.42 && ly > 0.05 && a < -0.25 && z > -0.02) return false;

    // Oblique fissure both sides; horizontal fissure on the right only.
    const oblique = z * 0.72 + (ly - 0.5) * 1.0;
    if (Math.abs(oblique) < 0.022) return false;
    if (side > 0 && Math.abs(ly - 0.60) < 0.016 && z > 0.0) return false;

    x += (r() - 0.5) * 0.01;
    S.x = x;
    S.y = y;
    S.z = z + (r() - 0.5) * 0.01;
    setNormal(a * side, (ly - 0.45) * 1.4, b);
    S.d = D.lung;
    return true;
  };

  c.sample(5200, (r) => lungPoint(r, 1));
  c.sample(4500, (r) => lungPoint(r, -1));

  // Trachea and carina.
  c.sample(520, (r) => tube(r, 0, 0.88, -0.02, 0, 0.30, -0.02, 0.034, 0.032, 0.72, D.organ));

  /* Bronchial tree and, alongside it, the pulmonary arteries — two branching
     systems that run together, which is exactly why they are confused. */
  interface Branch {
    f: [number, number, number];
    t: [number, number, number];
    r: number;
    depth: number;
  }
  const airways: Branch[] = [];
  const vessels: Branch[] = [];
  const grow = (
    into: Branch[],
    from: [number, number, number],
    dir: [number, number, number],
    len: number,
    rad: number,
    depth: number,
    maxDepth: number,
    rnd: () => number
  ) => {
    if (depth > maxDepth || rad < 0.003) return;
    const to: [number, number, number] = [
      from[0] + dir[0] * len,
      from[1] + dir[1] * len,
      from[2] + dir[2] * len,
    ];
    into.push({ f: from, t: to, r: rad, depth });
    for (let k = 0; k < 2; k++) {
      const spread = 0.5 + rnd() * 0.4;
      const nd: [number, number, number] = [
        dir[0] + (k === 0 ? spread : -spread * 0.55) * (0.6 + rnd() * 0.5),
        dir[1] - 0.3 - rnd() * 0.3,
        dir[2] + (rnd() - 0.5) * spread * 1.4,
      ];
      const nl = Math.hypot(nd[0], nd[1], nd[2]) || 1;
      grow(into, to, [nd[0] / nl, nd[1] / nl, nd[2] / nl], len * 0.74, rad * 0.71, depth + 1, maxDepth, rnd);
    }
  };
  const g = mulberry32(77);
  grow(airways, [0, 0.30, -0.02], [0.60, -0.58, 0.1], 0.26, 0.024, 0, 6, g);
  grow(airways, [0, 0.30, -0.02], [-0.60, -0.52, 0.1], 0.24, 0.022, 0, 6, g);
  grow(vessels, [0.04, 0.24, 0.02], [0.62, -0.48, 0.16], 0.24, 0.020, 0, 7, g);
  grow(vessels, [-0.04, 0.24, 0.02], [-0.62, -0.44, 0.16], 0.22, 0.019, 0, 7, g);

  const drawTree = (list: Branch[], d: number) => (r: () => number) => {
    const br = list[Math.floor(r() * list.length)];
    if (!br) return false;
    return tube(r, br.f[0], br.f[1], br.f[2], br.t[0], br.t[1], br.t[2], br.r, br.r * 0.74, 0.3, d);
  };
  c.sample(1900, drawTree(airways, D.organ));
  c.sample(2400, drawTree(vessels, D.vessel));

  // Ribcage, costal cartilages and sternum.
  c.sample(4200, (r) => {
    const rib = Math.floor(r() * 10);
    const side = r() < 0.5 ? -1 : 1;
    const f = rib / 9;
    return ribArc(
      r,
      side,
      0.80 - rib * 0.118,
      0.30 + Math.sin(f * Math.PI * 0.85) * 0.30,
      0.135,
      0.44,
      0.022,
      D.cortical
    );
  });
  c.sample(500, (r) => {
    const rib = Math.floor(r() * 6);
    const side = r() < 0.5 ? -1 : 1;
    const y = 0.52 - rib * 0.10;
    return tube(r, side * 0.30, y - 0.08, 0.34, side * 0.045, y, 0.38, 0.014, 0.012, 0.5, D.cartilage);
  });
  c.sample(560, (r) => plate(r, 0, 0.34, 0.395, 0, 0.32, -0.03, 0.045, 0, 0, 0.022, D.cortical));

  // Thoracic spine behind it all.
  c.sample(900, (r) => {
    const lvl = Math.floor(r() * 10);
    const y = 0.74 - lvl * 0.135;
    if (r() < 0.65) return tube(r, 0, y + 0.05, -0.30, 0, y - 0.05, -0.30, 0.085, 0.085, 0.55, D.trabecular);
    return tube(r, 0, y, -0.40, 0, y - 0.06, -0.52, 0.026, 0.016, 0.45, D.cortical);
  });

  // Heart: four chambers rather than one mass, plus the aortic arch and the
  // great vessels leaving it.
  c.sample(2200, (r) => {
    const pick = r();
    if (pick < 0.34) return ellipsoid(r, -0.16, -0.24, 0.14, 0.17, 0.19, 0.15, 0.55, D.organ);
    if (pick < 0.56) return ellipsoid(r, -0.02, -0.20, 0.20, 0.13, 0.14, 0.12, 0.5, D.organ);
    if (pick < 0.78) return ellipsoid(r, -0.10, -0.03, 0.06, 0.12, 0.10, 0.11, 0.5, D.organ);
    return ellipsoid(r, 0.08, -0.04, 0.10, 0.10, 0.09, 0.10, 0.5, D.organ);
  });
  c.sample(900, (r) => {
    const pick = r();
    if (pick < 0.5) {
      const a = -0.2 + r() * 3.0;
      const cx = -0.02 + Math.cos(a) * 0.135;
      const cy = 0.30 + Math.sin(a) * 0.135;
      return tube(r, cx, cy, 0.02, cx + 0.01, cy, 0.02, 0.036, 0.036, 0.45, D.contrast);
    }
    if (pick < 0.72) return tube(r, -0.14, 0.36, -0.02, -0.13, -0.10, -0.16, 0.034, 0.030, 0.45, D.contrast);
    const side = r() < 0.5 ? -1 : 1;
    return tube(r, side * 0.05, 0.42, 0.0, side * 0.14, 0.72, 0.02, 0.018, 0.014, 0.45, D.contrast);
  });

  // Diaphragm domes.
  c.sample(1300, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const rad = 0.28 * Math.sqrt(r());
    const th = r() * Math.PI * 2;
    const f = rad / 0.28;
    S.x = side * 0.24 + rad * Math.cos(th);
    S.y = -0.60 + 0.20 * Math.cos(f * Math.PI * 0.5);
    S.z = rad * Math.sin(th) * 0.85;
    setNormal(rad * Math.cos(th) * 0.5, 0.9, rad * Math.sin(th) * 0.5);
    S.d = D.organ;
    return true;
  });

  return c.finish();
}

/* --- Region: spine -------------------------------------------------------- */

function buildSpine(c: Cloud) {
  const LEVELS = 24;
  const geom = (i: number) => {
    const t = i / (LEVELS - 1);
    return {
      t,
      y: 0.94 - t * 1.72,
      // Cervical lordosis, thoracic kyphosis, lumbar lordosis.
      z: 0.10 * Math.sin(t * Math.PI * 2.05 + 0.35) - 0.03,
      scale: 0.55 + t * 0.75,
    };
  };

  // Vertebral bodies. Cortical rim, trabecular core — the reason a wedge
  // fracture is visible at all.
  c.sample(7000, (r) => {
    const g = geom(Math.floor(r() * LEVELS));
    const rad = 0.085 * g.scale;
    const h = 0.048 * g.scale;
    return tube(r, 0, g.y - h, g.z + 0.05, 0, g.y + h, g.z + 0.05, rad, rad, 0.55, D.trabecular);
  });

  // Endplates, which are denser than the body between them.
  c.sample(1600, (r) => {
    const g = geom(Math.floor(r() * LEVELS));
    const rad = 0.086 * g.scale * Math.sqrt(r());
    const th = r() * Math.PI * 2;
    const up = r() < 0.5 ? -1 : 1;
    S.x = rad * Math.cos(th);
    S.y = g.y + up * 0.048 * g.scale;
    S.z = g.z + 0.05 + rad * Math.sin(th);
    setNormal(0, up, 0);
    S.d = D.cortical;
    return true;
  });

  // Pedicles and laminae closing the neural arch.
  c.sample(3400, (r) => {
    const g = geom(Math.floor(r() * LEVELS));
    const side = r() < 0.5 ? -1 : 1;
    const rad = 0.085 * g.scale;
    if (r() < 0.55) {
      return tube(
        r,
        side * rad * 0.7, g.y, g.z + 0.03,
        side * rad * 0.9, g.y + 0.008, g.z - 0.06 * g.scale,
        0.019 * g.scale, 0.017 * g.scale, 0.5, D.cortical
      );
    }
    return tube(
      r,
      side * rad * 0.9, g.y + 0.008, g.z - 0.06 * g.scale,
      0, g.y + 0.012, g.z - 0.10 * g.scale,
      0.016 * g.scale, 0.014 * g.scale, 0.5, D.cortical
    );
  });

  // Transverse processes, and ribs stubbing off the thoracic levels.
  c.sample(2000, (r) => {
    const i = Math.floor(r() * LEVELS);
    const g = geom(i);
    const side = r() < 0.5 ? -1 : 1;
    const thoracic = i >= 7 && i <= 18;
    if (thoracic && r() < 0.45) {
      return ribArc(r, side, g.y, 0.30, 0.10, 0.26, 0.014, D.cortical);
    }
    return tube(
      r,
      side * 0.07 * g.scale, g.y, g.z - 0.05 * g.scale,
      side * 0.20 * g.scale, g.y + 0.012, g.z - 0.07 * g.scale,
      0.016 * g.scale, 0.010 * g.scale, 0.5, D.cortical
    );
  });

  // Spinous processes, steeply angled through the thoracic spine — which is
  // exactly what makes a lateral thoracic film hard to read.
  c.sample(2600, (r) => {
    const g = geom(Math.floor(r() * LEVELS));
    const droop = 0.10 * Math.sin(Math.min(1, Math.max(0, (g.t - 0.2) / 0.5)) * Math.PI);
    return tube(
      r,
      0, g.y, g.z - 0.09 * g.scale,
      0, g.y - droop, g.z - 0.21 * g.scale,
      0.019 * g.scale, 0.011 * g.scale, 0.5, D.cortical
    );
  });

  // Facet joints, stacked in a column either side.
  c.sample(1400, (r) => {
    const i = Math.floor(r() * (LEVELS - 1));
    const a = geom(i);
    const b = geom(i + 1);
    const side = r() < 0.5 ? -1 : 1;
    return ellipsoid(
      r,
      side * 0.062 * a.scale,
      (a.y + b.y) / 2,
      (a.z + b.z) / 2 - 0.062 * a.scale,
      0.024 * a.scale, 0.026 * a.scale, 0.022 * a.scale,
      0.6, D.cortical
    );
  });

  // Intervertebral discs, wider than the bodies they sit between.
  c.sample(1900, (r) => {
    const i = Math.floor(r() * (LEVELS - 1));
    const a = geom(i);
    const b = geom(i + 1);
    const th = r() * Math.PI * 2;
    const rad = 0.092 * a.scale * (0.82 + 0.18 * Math.sqrt(r()));
    S.x = rad * Math.cos(th);
    S.y = (a.y + b.y) / 2;
    S.z = (a.z + b.z) / 2 + 0.05 + rad * Math.sin(th);
    setNormal(Math.cos(th), 0, Math.sin(th));
    S.d = D.cartilage;
    return true;
  });

  // Spinal cord running the canal.
  c.sample(1100, (r) => {
    const t = r();
    const i = t * (LEVELS - 1);
    const g = geom(Math.floor(i));
    return tube(r, 0, g.y + 0.03, g.z - 0.02, 0, g.y - 0.03, g.z - 0.02, 0.032, 0.032, 0.3, D.organ);
  });

  // Sacrum with its foramina, and the coccyx.
  c.sample(2000, (r) => {
    const t = r();
    const w = 0.20 * (1 - t * 0.72);
    const th = r() * Math.PI * 2;
    const rad = w * Math.sqrt(r());
    const x = rad * Math.cos(th);
    const y = -0.80 - t * 0.34;
    // Four pairs of sacral foramina.
    const fy = ((t * 4) % 1) - 0.5;
    if (Math.abs(Math.abs(x) - 0.075) < 0.028 && Math.abs(fy) < 0.16 && t < 0.7) return false;
    S.x = x;
    S.y = y;
    S.z = -0.05 + rad * 0.55 * Math.sin(th) + t * 0.12;
    setNormal(Math.cos(th) * 0.5, 0.2, Math.sin(th));
    S.d = t < 0.75 ? D.trabecular : D.cortical;
    return true;
  });

  return c.finish();
}

/* --- Region: abdomen and pelvis ------------------------------------------- */

function buildAbdoPelvis(c: Cloud) {
  // Liver, wedged under the right hemidiaphragm, notched by the falciform.
  c.sample(4600, (r) => {
    ellipsoid(r, 0.22, 0.42, 0.02, 0.48, 0.27, 0.32, 0.55, D.organ);
    const taper = 1 - Math.max(0, (0.22 - S.x) / 0.9);
    S.y = 0.42 + (S.y - 0.42) * taper;
    return !(Math.abs(S.x + 0.06) < 0.016 && S.y < 0.5);
  });

  // Portal and hepatic venous trees inside it — the branching that makes a
  // liver read as a liver rather than a blob.
  {
    interface Br { f: [number, number, number]; t: [number, number, number]; r: number }
    const tree: Br[] = [];
    const grow = (
      from: [number, number, number],
      dir: [number, number, number],
      len: number,
      rad: number,
      depth: number,
      rnd: () => number
    ) => {
      if (depth > 5 || rad < 0.004) return;
      const to: [number, number, number] = [
        from[0] + dir[0] * len,
        from[1] + dir[1] * len,
        from[2] + dir[2] * len,
      ];
      tree.push({ f: from, t: to, r: rad });
      for (let k = 0; k < 2; k++) {
        const sp = 0.55 + rnd() * 0.4;
        const nd: [number, number, number] = [
          dir[0] + (k === 0 ? sp : -sp) * (0.5 + rnd() * 0.6),
          dir[1] + (rnd() - 0.4) * 0.7,
          dir[2] + (rnd() - 0.5) * sp,
        ];
        const nl = Math.hypot(nd[0], nd[1], nd[2]) || 1;
        grow(to, [nd[0] / nl, nd[1] / nl, nd[2] / nl], len * 0.72, rad * 0.7, depth + 1, rnd);
      }
    };
    const g = mulberry32(311);
    grow([-0.06, 0.36, 0.0], [0.85, 0.12, 0.1], 0.22, 0.026, 0, g);
    grow([-0.04, 0.44, -0.06], [0.8, 0.2, -0.3], 0.18, 0.020, 0, g);
    c.sample(2200, (r) => {
      const br = tree[Math.floor(r() * tree.length)];
      if (!br) return false;
      return tube(r, br.f[0], br.f[1], br.f[2], br.t[0], br.t[1], br.t[2], br.r, br.r * 0.72, 0.35, D.contrast);
    });
  }

  // Spleen, stomach and pancreas.
  c.sample(1100, (r) => ellipsoid(r, -0.46, 0.42, -0.10, 0.15, 0.20, 0.13, 0.5, D.organ));
  c.sample(1000, (r) => {
    const t = r();
    const ang = -0.4 + t * 2.2;
    const rad = 0.10 * Math.sin(t * Math.PI) + 0.035;
    const cx = -0.20 + Math.cos(ang) * 0.16;
    return tube(r, cx, 0.44 - t * 0.24, 0.16, cx + 0.01, 0.42 - t * 0.24, 0.16, rad, rad, 0.72, D.organ);
  });
  c.sample(700, (r) => tube(r, -0.34, 0.24, -0.10, 0.10, 0.18, -0.02, 0.04, 0.055, 0.4, D.organ));

  // Kidneys, hilum facing the midline, with a denser cortex than medulla.
  c.sample(2000, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    ellipsoid(r, side * 0.34, 0.10, -0.20, 0.13, 0.22, 0.12, 0.5, D.organ);
    const hx = S.x - side * 0.34;
    if (side * hx < -0.05 && Math.abs(S.y - 0.10) < 0.07) return false;
    return true;
  });
  // Ureters draining to the bladder.
  c.sample(500, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const t = r();
    const y = 0.02 - t * 0.72;
    const x = side * (0.28 - t * 0.16);
    return tube(r, x, y, -0.18 + t * 0.12, x, y - 0.04, -0.18 + t * 0.12, 0.010, 0.010, 0.4, D.contrast);
  });
  c.sample(700, (r) => ellipsoid(r, 0, -0.74, 0.06, 0.14, 0.10, 0.12, 0.6, D.contrast));

  // Aorta, bifurcation, iliacs, and the coeliac and renal branches.
  c.sample(1500, (r) => {
    const pick = r();
    if (pick < 0.42) return tube(r, -0.05, 0.72, -0.24, -0.04, -0.16, -0.20, 0.038, 0.032, 0.4, D.contrast);
    if (pick < 0.62) {
      const side = r() < 0.5 ? 1 : -1;
      return tube(r, -0.04, -0.16, -0.20, side * 0.17, -0.52, -0.16, 0.024, 0.018, 0.4, D.contrast);
    }
    if (pick < 0.78) {
      const side = r() < 0.5 ? 1 : -1;
      return tube(r, -0.05, 0.12, -0.22, side * 0.28, 0.10, -0.20, 0.014, 0.010, 0.4, D.contrast);
    }
    if (pick < 0.9) return tube(r, -0.05, 0.48, -0.22, 0.02, 0.44, -0.02, 0.016, 0.012, 0.4, D.contrast);
    return tube(r, 0.04, 0.66, -0.16, 0.02, -0.20, -0.14, 0.034, 0.030, 0.4, D.vessel);
  });

  // Small bowel and colon: gas-filled loops, sparse and scattered, which is
  // how they actually appear.
  c.sample(1800, (r) => {
    const loop = Math.floor(r() * 9);
    const gg = mulberry32(500 + loop);
    const cx = (gg() - 0.5) * 0.6;
    const cy = 0.05 + (gg() - 0.5) * 0.4;
    const cz = 0.14 + (gg() - 0.5) * 0.2;
    const th = r() * Math.PI * 2;
    const ph = r() * Math.PI * 2;
    const R = 0.075;
    const rr = 0.028;
    S.x = cx + (R + rr * Math.cos(ph)) * Math.cos(th);
    S.y = cy + rr * Math.sin(ph);
    S.z = cz + (R + rr * Math.cos(ph)) * Math.sin(th);
    setNormal(Math.cos(ph) * Math.cos(th), Math.sin(ph), Math.cos(ph) * Math.sin(th));
    S.d = D.organ;
    return true;
  });

  // Iliac wings.
  c.sample(4000, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const u = r();
    const v = r();
    const a = -0.30 + u * 1.7;
    const rad = 0.26 + v * 0.26;
    S.x = side * (0.05 + rad * Math.sin(a) * 0.95);
    // v runs from the acetabular margin up to the iliac crest, so the wing
    // has height as well as sweep.
    S.y = -0.30 - Math.cos(a) * 0.26 - (1 - v) * 0.26;
    S.z = -0.14 + rad * 0.50 * Math.cos(a * 0.75) + (r() - 0.5) * 0.05;
    // The normal has to follow the arc of the wing. A constant one lights the
    // whole pelvis identically and it reads as a flat band, not a bone.
    setNormal(side * Math.sin(a) * 0.7, Math.cos(a) * 0.55, 0.7);
    S.d = v > 0.88 || v < 0.07 ? D.cortical : D.trabecular;
    return true;
  });

  // Acetabula, pubic rami, ischial tuberosities and the femoral heads.
  c.sample(1900, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    const pick = r();
    if (pick < 0.28) {
      ellipsoid(r, side * 0.30, -0.62, -0.02, 0.10, 0.10, 0.095, 0.9, D.cortical);
      return S.y < -0.58;
    }
    if (pick < 0.52) return tube(r, 0, -0.84, 0.16, side * 0.24, -0.70, 0.06, 0.028, 0.024, 0.5, D.cortical);
    if (pick < 0.72) return tube(r, side * 0.24, -0.70, 0.06, side * 0.20, -0.88, -0.04, 0.026, 0.030, 0.5, D.cortical);
    return ellipsoid(r, side * 0.31, -0.60, -0.02, 0.068, 0.068, 0.065, 0.5, D.trabecular);
  });

  // Sacrum wedging the ring closed behind.
  c.sample(1200, (r) => {
    const t = r();
    const w = 0.17 * (1 - t * 0.65);
    const th = r() * Math.PI * 2;
    const rad = w * Math.sqrt(r());
    S.x = rad * Math.cos(th);
    S.y = -0.42 - t * 0.34;
    S.z = -0.28 + rad * 0.5 * Math.sin(th) + t * 0.10;
    setNormal(Math.cos(th) * 0.6, 0.2, Math.sin(th));
    S.d = D.trabecular;
    return true;
  });

  // Lumbar spine, seen end on behind the aorta.
  c.sample(900, (r) => {
    const lvl = Math.floor(r() * 5);
    const y = 0.56 - lvl * 0.17;
    if (r() < 0.7) return tube(r, 0, y + 0.06, -0.34, 0, y - 0.06, -0.34, 0.10, 0.10, 0.55, D.trabecular);
    return tube(r, 0, y, -0.44, 0, y - 0.02, -0.58, 0.028, 0.018, 0.5, D.cortical);
  });

  return c.finish();
}

/* --- Region: upper limb --------------------------------------------------- */

function buildUpperLimb(c: Cloud) {
  // Clavicle — the S curve is the whole character of the bone.
  c.sample(900, (r) => {
    const t = r();
    const x = -0.42 + t * 0.62;
    const z = 0.14 * Math.sin(t * Math.PI * 2) + 0.06;
    return tube(r, x, 0.92, z, x + 0.012, 0.92, z + 0.002, 0.026, 0.026, 0.5, D.cortical);
  });

  // Scapula: blade, spine, acromion, coracoid, glenoid.
  c.sample(2400, (r) => {
    const pick = r();
    if (pick < 0.55) {
      const a = r() * 2 - 1;
      const b = r() * 2 - 1;
      if (a * a + b * b > 1) return false;
      // Widest at the spine of the scapula, narrowing to the inferior angle.
      const up = (b + 1) / 2;
      const halfW = 0.30 * (0.26 + 0.74 * up);
      const face = r() < 0.5 ? -1 : 1;
      S.x = -0.40 + a * halfW;
      S.y = 0.54 + up * 0.34;
      S.z = -0.17 + a * halfW * 0.18 + face * 0.008;
      setNormal(0.28 * face, 0.05, -face);
      S.d = Math.abs(a) > 0.86 || up > 0.94 ? D.cortical : D.trabecular;
      return true;
    }
    if (pick < 0.72) return tube(r, -0.60, 0.86, -0.15, -0.17, 0.90, -0.05, 0.026, 0.032, 0.5, D.cortical);
    if (pick < 0.84) return tube(r, -0.30, 0.86, 0.02, -0.19, 0.84, 0.10, 0.022, 0.020, 0.5, D.cortical);
    return ellipsoid(r, -0.13, 0.83, -0.01, 0.055, 0.085, 0.055, 0.75, D.cortical);
  });

  // Humerus: head, tuberosities, surgical neck, shaft, condyles.
  c.sample(1300, (r) => ellipsoid(r, -0.10, 0.82, -0.02, 0.105, 0.105, 0.10, 0.55, D.trabecular));
  c.sample(500, (r) => ellipsoid(r, -0.01, 0.83, 0.02, 0.045, 0.05, 0.045, 0.7, D.cortical));
  c.sample(2600, (r) => tube(r, -0.05, 0.74, 0.0, 0.02, 0.14, 0.02, 0.054, 0.046, 0.62, D.cortical));
  c.sample(1400, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    // Capitellum laterally, trochlea medially — different shapes, and the
    // reason a radiocapitellar line works.
    if (side > 0) return ellipsoid(r, 0.075, 0.10, 0.02, 0.05, 0.048, 0.048, 0.5, D.trabecular);
    return tube(r, -0.055, 0.10, 0.02, 0.005, 0.10, 0.02, 0.048, 0.048, 0.45, D.trabecular);
  });

  // Ulna: olecranon, coronoid, shaft, styloid.
  c.sample(800, (r) => ellipsoid(r, -0.01, 0.155, -0.055, 0.048, 0.055, 0.05, 0.5, D.trabecular));
  c.sample(2200, (r) => tube(r, 0.0, 0.11, -0.01, 0.04, -0.44, 0.0, 0.040, 0.022, 0.6, D.cortical));

  // Radius: head, neck, tuberosity, shaft flaring at the wrist.
  c.sample(600, (r) => tube(r, 0.10, 0.125, 0.03, 0.10, 0.085, 0.03, 0.032, 0.030, 0.45, D.trabecular));
  c.sample(2200, (r) => tube(r, 0.10, 0.08, 0.03, 0.15, -0.44, 0.03, 0.024, 0.042, 0.6, D.cortical));

  // Carpus: eight bones in two rows, scaphoid set apart because it is the one
  // that gets missed.
  c.sample(1900, (r) => {
    const proximal = r() < 0.5;
    const k = Math.floor(r() * 4);
    const cx = 0.045 + k * 0.042;
    if (proximal && k === 0) {
      return ellipsoid(r, 0.055, -0.505, 0.035, 0.026, 0.036, 0.024, 0.5, D.trabecular);
    }
    return ellipsoid(
      r, cx, -0.50 - (proximal ? 0 : 0.058), 0.025,
      0.024, 0.026, 0.022, 0.5, D.trabecular
    );
  });

  // Metacarpals and phalanges, fanned as a PA hand is positioned.
  c.sample(4600, (r) => {
    const digit = Math.floor(r() * 5);
    const spread = (digit - 2) * 0.055;
    const baseX = 0.05 + spread;
    const lean = spread * 0.9;
    const seg = r();
    if (digit === 0) {
      if (seg < 0.5) return tube(r, 0.0, -0.60, 0.06, -0.10, -0.74, 0.12, 0.020, 0.017, 0.55, D.cortical);
      if (seg < 0.8) return tube(r, -0.10, -0.74, 0.12, -0.17, -0.83, 0.15, 0.016, 0.013, 0.55, D.cortical);
      return tube(r, -0.17, -0.83, 0.15, -0.22, -0.89, 0.17, 0.013, 0.010, 0.55, D.cortical);
    }
    if (seg < 0.42) return tube(r, baseX, -0.62, 0.02, baseX + lean * 0.5, -0.80, 0.02, 0.019, 0.016, 0.58, D.cortical);
    if (seg < 0.70) return tube(r, baseX + lean * 0.5, -0.80, 0.02, baseX + lean, -0.92, 0.02, 0.015, 0.013, 0.58, D.cortical);
    if (seg < 0.89) return tube(r, baseX + lean, -0.92, 0.02, baseX + lean * 1.3, -0.99, 0.02, 0.013, 0.011, 0.58, D.cortical);
    return tube(r, baseX + lean * 1.3, -0.99, 0.02, baseX + lean * 1.5, -1.04, 0.02, 0.011, 0.008, 0.58, D.cortical);
  });

  // Soft-tissue envelope of the arm and hand.
  c.sample(2900, (r) => {
    const t = r();
    const th = r() * Math.PI * 2;
    let cx: number;
    let cy: number;
    let cz: number;
    let rad: number;
    if (t < 0.45) {
      const u = t / 0.45;
      cx = -0.07 + u * 0.09;
      cy = 0.80 - u * 0.66;
      cz = 0.01;
      rad = 0.105 - u * 0.025;
    } else if (t < 0.82) {
      const u = (t - 0.45) / 0.37;
      cx = 0.02 + u * 0.09;
      cy = 0.14 - u * 0.58;
      cz = 0.015;
      rad = 0.085 - u * 0.022;
    } else {
      const u = (t - 0.82) / 0.18;
      cx = 0.06 + u * 0.01;
      cy = -0.50 - u * 0.44;
      cz = 0.02;
      rad = 0.075 - u * 0.045;
    }
    S.x = cx + Math.cos(th) * rad;
    S.y = cy;
    S.z = cz + Math.sin(th) * rad * 0.72;
    setNormal(Math.cos(th), 0.06, Math.sin(th) * 0.72);
    S.d = D.fat;
    return true;
  });

  return c.finish();
}

/* --- Region: lower limb --------------------------------------------------- */

function buildLowerLimb(c: Cloud) {
  // Acetabulum framing the joint.
  c.sample(1300, (r) => {
    ellipsoid(r, -0.28, 0.86, -0.02, 0.17, 0.15, 0.14, 0.92, D.cortical);
    return !(S.y < 0.82 && S.x > -0.24);
  });

  // Femoral head, neck, trochanters. The neck–shaft angle is the measurement
  // this region is always asked about.
  c.sample(1500, (r) => ellipsoid(r, -0.24, 0.82, 0.0, 0.092, 0.092, 0.088, 0.5, D.trabecular));
  c.sample(1000, (r) => tube(r, -0.19, 0.78, 0.0, -0.05, 0.63, 0.0, 0.052, 0.055, 0.5, D.trabecular));
  c.sample(800, (r) => ellipsoid(r, 0.02, 0.70, -0.01, 0.058, 0.078, 0.052, 0.55, D.cortical));
  c.sample(360, (r) => ellipsoid(r, -0.06, 0.585, -0.03, 0.032, 0.030, 0.028, 0.6, D.cortical));

  // Femoral shaft, with its anterior bow and a bright linea aspera behind.
  c.sample(3400, (r) => tube(r, -0.04, 0.62, 0.0, 0.02, -0.10, 0.03, 0.056, 0.048, 0.66, D.cortical));
  c.sample(500, (r) => tube(r, -0.03, 0.58, -0.048, 0.015, -0.08, -0.018, 0.010, 0.010, 0.6, D.cortical));

  // Condyles and the intercondylar notch between them.
  c.sample(1900, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    return ellipsoid(r, 0.02 + side * 0.062, -0.15, 0.02, 0.060, 0.070, 0.078, 0.5, D.trabecular);
  });

  // Patella, riding anterior to the joint.
  c.sample(800, (r) => ellipsoid(r, 0.02, -0.14, 0.135, 0.052, 0.058, 0.026, 0.5, D.trabecular));

  // Tibia: plateau, tuberosity, shaft with a subcutaneous anterior border,
  // and the medial malleolus.
  c.sample(1200, (r) => {
    const side = r() < 0.5 ? -1 : 1;
    return ellipsoid(r, 0.02 + side * 0.055, -0.24, 0.02, 0.058, 0.032, 0.062, 0.55, D.trabecular);
  });
  c.sample(400, (r) => ellipsoid(r, 0.02, -0.30, 0.075, 0.030, 0.035, 0.026, 0.6, D.cortical));
  c.sample(3600, (r) => tube(r, 0.02, -0.27, 0.02, 0.03, -0.80, 0.02, 0.054, 0.038, 0.68, D.cortical));
  c.sample(600, (r) => tube(r, 0.02, -0.80, 0.02, -0.005, -0.885, 0.02, 0.036, 0.020, 0.5, D.cortical));

  // Fibula — slender, lateral, its head sitting below the joint line.
  c.sample(500, (r) => ellipsoid(r, 0.10, -0.275, -0.01, 0.028, 0.028, 0.026, 0.5, D.trabecular));
  c.sample(2000, (r) => tube(r, 0.10, -0.30, -0.01, 0.10, -0.82, 0.0, 0.024, 0.020, 0.62, D.cortical));
  c.sample(500, (r) => tube(r, 0.10, -0.82, 0.0, 0.112, -0.905, 0.01, 0.022, 0.014, 0.5, D.cortical));

  // Hindfoot: talus and calcaneus.
  c.sample(1100, (r) => ellipsoid(r, 0.04, -0.90, 0.035, 0.055, 0.040, 0.055, 0.5, D.trabecular));
  c.sample(1300, (r) => ellipsoid(r, 0.02, -0.965, -0.055, 0.058, 0.045, 0.095, 0.5, D.trabecular));

  // Midfoot: navicular, cuboid, three cuneiforms.
  c.sample(900, (r) => {
    const k = Math.floor(r() * 3);
    return ellipsoid(r, 0.03 + (k - 1) * 0.03, -0.94, 0.13, 0.030, 0.028, 0.030, 0.5, D.trabecular);
  });

  // Metatarsals and toes.
  c.sample(2400, (r) => {
    const ray = Math.floor(r() * 5);
    const off = (ray - 2) * 0.032;
    const seg = r();
    if (seg < 0.55) return tube(r, 0.03 + off, -0.955, 0.17, 0.04 + off * 1.3, -0.985, 0.33, 0.019, 0.015, 0.6, D.cortical);
    if (seg < 0.85) return tube(r, 0.04 + off * 1.3, -0.985, 0.33, 0.04 + off * 1.5, -0.995, 0.40, 0.014, 0.012, 0.6, D.cortical);
    return tube(r, 0.04 + off * 1.5, -0.995, 0.40, 0.04 + off * 1.6, -1.0, 0.45, 0.012, 0.009, 0.6, D.cortical);
  });

  // Soft-tissue envelope: thigh, calf and foot.
  c.sample(3300, (r) => {
    const t = r();
    const th = r() * Math.PI * 2;
    let cx: number;
    let cy: number;
    let cz: number;
    let rad: number;
    if (t < 0.45) {
      const u = t / 0.45;
      cx = -0.13 + u * 0.14;
      cy = 0.80 - u * 0.68;
      cz = 0.01;
      rad = 0.145 - u * 0.045;
    } else if (t < 0.85) {
      const u = (t - 0.45) / 0.4;
      cx = 0.02;
      cy = -0.14 - u * 0.70;
      cz = 0.015;
      rad = 0.105 - u * 0.048 - 0.03 * Math.sin(u * Math.PI) * -1;
    } else {
      const u = (t - 0.85) / 0.15;
      cx = 0.03;
      cy = -0.94;
      cz = -0.09 + u * 0.55;
      rad = 0.072 - u * 0.03;
    }
    S.x = cx + Math.cos(th) * rad;
    S.y = cy + (t >= 0.85 ? Math.sin(th) * rad * 0.5 : 0);
    S.z = cz + (t >= 0.85 ? 0 : Math.sin(th) * rad * 0.78);
    setNormal(Math.cos(th), 0.06, Math.sin(th) * 0.78);
    S.d = D.fat;
    return true;
  });

  return c.finish();
}

/* --- Assembly ------------------------------------------------------------- */

export interface AnatomyStop {
  /** Section id, or 'scout' for the whole-body topogram in the hero. */
  key: string;
  positions: Float32Array;
  normals: Float32Array;
  density: Float32Array;
  /** Rendering tint. The ramp runs cool at the head and warm at the feet, so
      colour itself tells you where in the scan you are. */
  tint: [number, number, number];
  /** Window level and width, as a radiologist would set them — and as the
      renderer actually applies them. */
  window: { wl: number; ww: number; preset: string };
  /** That window resolved into density space: below dLo renders black, above
      dHi clips white. */
  dLo: number;
  dHi: number;
  /** Table position in millimetres from the vertex. */
  tablePos: number;
  /** Baseline yaw so each region opens at a readable angle. */
  yaw: number;
  pitch: number;
  scale: number;
  /** Radius of the scan plane's ring, measured off the model so the plane
      hugs a brain as closely as it hugs a whole body, and the horizontal
      centre it should be drawn about. */
  ringR: number;
  ringX: number;
  ringZ: number;
  /** Compensates for how much of a region actually survives its own window.
      A brain under WW 80 puts a fraction of the ink on screen that a bone
      window does, and without this the soft-tissue regions would simply be
      darker — which is a property of the window, not of the anatomy. */
  exposure: number;
}

/** 88th percentile of horizontal radius — wide enough to contain the region,
    tight enough that the ring never reads as a halo around it. */
function crossSection(positions: Float32Array) {
  // Centre first — a limb sits well off the midline, and a ring drawn about
  // the origin would miss it entirely.
  let cx = 0;
  let cz = 0;
  let n = 0;
  for (let i = 0; i < POINT_COUNT; i += 8) {
    const o = i * 3;
    cx += positions[o];
    cz += positions[o + 2];
    n++;
  }
  cx /= n;
  cz /= n;
  const radii: number[] = [];
  for (let i = 0; i < POINT_COUNT; i += 8) {
    const o = i * 3;
    radii.push(Math.hypot(positions[o] - cx, positions[o + 2] - cz));
  }
  radii.sort((a, b) => a - b);
  return { r: radii[Math.floor(radii.length * 0.88)] * 1.18, x: cx, z: cz };
}

/** Ink a region lays down per unit of the area it covers on screen.

    Mean density alone is the wrong measure: the points are drawn additively,
    so what sets the apparent brightness is how many of them land on the same
    pixel. A cortical shell spreads its points thinly over a large silhouette
    and comes out dim; a vertebral column packs the same count into a narrow
    one and comes out bright. Dividing by the projected area is what puts the
    two on the same footing. */
function inkPerArea(
  density: Float32Array,
  positions: Float32Array,
  dLo: number,
  dHi: number,
  ringR: number
) {
  const span = Math.max(1e-4, dHi - dLo);
  let sum = 0;
  let yLo = Infinity;
  let yHi = -Infinity;
  for (let i = 0; i < POINT_COUNT; i += 4) {
    const v = (density[i] - dLo) / span;
    sum += v < 0 ? 0 : v > 1 ? 1 : v;
    const y = positions[i * 3 + 1];
    if (y < yLo) yLo = y;
    if (y > yHi) yHi = y;
  }
  const area = Math.max(0.05, 2 * ringR * (yHi - yLo));
  return sum / area;
}

/** Measured off the scout and the two limbs, which land within a few per cent
    of each other and are the look everything else is levelled to. On this
    scale the spine comes down slightly and the brain — thinly spread, and
    windowed to an 80 HU slice — is lifted nearly threefold. */
const INK_TARGET = 4400;

let cache: AnatomyStop[] | null = null;

export function getAnatomyStops(): AnatomyStop[] {
  if (cache) return cache;

  const make = (
    key: string,
    cloud: Cloud,
    tint: [number, number, number],
    window: { wl: number; ww: number; preset: string },
    tablePos: number,
    yaw: number,
    pitch: number,
    scale: number
  ): AnatomyStop => ({
    key,
    positions: cloud.positions,
    normals: cloud.normals,
    density: cloud.density,
    tint,
    window,
    tablePos,
    yaw,
    pitch,
    scale,
    ...(() => {
      const cs = crossSection(cloud.positions);
      return { ringR: cs.r, ringX: cs.x, ringZ: cs.z };
    })(),
    // The printed window is the window that gets applied.
    dLo: hu(window.wl - window.ww / 2),
    dHi: hu(window.wl + window.ww / 2),
    exposure: 1,
  });

  cache = [
    make('scout', buildScout(new Cloud(11)), [178, 214, 236], { wl: 300, ww: 1500, preset: 'Scout' }, 0, -0.22, 0.02, 1.0),
    make('head-neck', buildHeadNeck(new Cloud(23)), [122, 212, 224], { wl: 40, ww: 80, preset: 'Brain' }, 90, -1.12, 0.06, 1.24),
    make('thorax', buildThorax(new Cloud(37)), [228, 118, 170], { wl: -600, ww: 1500, preset: 'Lung' }, 380, 0.44, 0.05, 1.04),
    make('spine', buildSpine(new Cloud(53)), [255, 184, 96], { wl: 50, ww: 250, preset: 'Soft tissue' }, 640, -1.30, 0.0, 1.0),
    make('abdo-pelvis', buildAbdoPelvis(new Cloud(71)), [240, 146, 104], { wl: 50, ww: 350, preset: 'Abdomen' }, 880, 0.32, 0.12, 1.10),
    make('upper-limb', buildUpperLimb(new Cloud(97)), [216, 228, 242], { wl: 300, ww: 1500, preset: 'Bone' }, 1120, 0.20, 0.03, 1.04),
    make('lower-limb', buildLowerLimb(new Cloud(113)), [238, 214, 172], { wl: 300, ww: 1500, preset: 'Bone' }, 1620, -0.32, 0.03, 1.02),
  ];
  for (const stop of cache) {
    const ink = inkPerArea(stop.density, stop.positions, stop.dLo, stop.dHi, stop.ringR);
    stop.exposure = Math.min(3.4, Math.max(0.55, INK_TARGET / Math.max(1, ink)));
  }
  return cache;
}

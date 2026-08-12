/**
 * 5.1 — The MR machine.
 *
 * The section that everything else inherits from. Two things have to leave this
 * page fixed in the reader's head: what each cylinder in the bore is for, and
 * which way the axes point. Sections 5.6 to 5.9 are unteachable without the
 * second, and 5.21 is unteachable without the first.
 *
 * So the scanner is built here rather than shown. The finished cross-section is
 * five nested cylinders, a field arrow, a legend and a switching waveform all
 * at once, and meeting the whole of it in one picture is how a reader learns to
 * look at a diagram instead of reading it. The first concept is therefore an
 * empty bore, and every concept after it adds exactly one cylinder — the same
 * component, one layer longer — until the last hands over the whole instrument
 * with every control live. Nothing is cut and nothing is simplified: the final
 * state is the simulation as it has always been, and the build-up is only the
 * approach to it.
 *
 * One point of care: gradient coils are routinely described as "producing a
 * field along x" or "along y". They do not. All three gradient sets add a field
 * along z, in line with B₀; what distinguishes them is the direction along
 * which that added field varies. The page says so explicitly, because the
 * alternative reading makes the difference between a gradient and B₁
 * incomprehensible two sections later.
 */

import { Concept, SectionPage } from '../Section'
import { MriAxes } from '../sims/MriAxes'
import { ScannerCrossSection } from '../sims/ScannerCrossSection'

export default function MrMachinePage() {
  return (
    <SectionPage
      slug="mr-machine"
      lede="An MR scanner is a set of cylinders nested inside one another, with the patient at the centre of all of them. Each layer exists to fix a problem created by the layer outside it — and the axis convention printed on that geometry is the one every later section uses."
      highYield={[
        'B₀ lies along **z**, head to foot, and is **never switched off** — the main magnet is a superconductor running in persistent mode.',
        'From the outside in: **main magnet → shim coils → gradient coils → RF coil → patient**. Everything that has to be close to the patient is closest.',
        'Shim coils **correct** field inhomogeneity; gradient coils **deliberately create** it. All three gradients add a field **along z** — they differ only in the direction along which it varies.',
        'Gradient **switching** in the presence of B₀ is what produces the acoustic noise, and rapid **dB/dt** is what causes peripheral nerve stimulation.',
        'The RF coil transmits **B₁ in the transverse plane, perpendicular to B₀**, at the Larmor frequency. Only a field perpendicular to B₀ can tip the magnetisation.',
        'A **small surface coil** gives the best SNR over a small region; the **body coil** covers everything with the worst SNR; a **phased array** buys small-coil SNR with large-coil coverage.',
      ]}
      checkpoint={{
        stem: 'The y-gradient coil is switched on. What does it do to the magnetic field inside the bore?',
        options: [
          'It adds a field along y, tilting the net field away from the z axis',
          'It makes the z-component of the field vary linearly with position along y',
          'It makes the z-component of the field vary linearly with position along z',
          'It rotates the transverse magnetisation about the y axis',
        ],
        answer: 1,
        explain:
          'A gradient coil is named for the **direction along which the field varies**, not the direction of the field it adds. All three gradient sets add a field **parallel to B₀**, along z; the y-gradient makes the size of that addition proportional to y, so a nucleus 10 cm anterior to isocentre sits in a slightly different field from one 10 cm posterior. A field genuinely perpendicular to B₀ would exert a torque on the magnetisation and tip it — that is **B₁**, and producing it is the RF coil’s job, not the gradient’s.',
      }}
    >
      <Concept
        id="empty-bore"
        title="Start with an empty bore"
        what="A sixty-centimetre tube and the axis it runs along — **z**, from the feet at −z to the head at +z — because every cylinder in the machine is built around that line."
        watch={<ScannerCrossSection built={[]} />}
        why={
          'The next five screens each add one cylinder, and nothing else changes. **Main magnet**, then **shim coils**, then **gradient coils**, then the **RF body coil**, and last the **patient**. A layer that has not been added yet is not hidden or greyed out: it is not there.\n\nWatch the order rather than being told it. It is the order the physics demands — the thing that creates the field is furthest out, the thing that has to listen to the patient is closest in, and the patient is inside all of it.'
        }
      />

      <Concept
        id="main-magnet"
        title="The main magnet is a superconductor, and it is never off"
        what="**The outermost cylinder, and the largest thing in the room.** Clinical whole-body scanners use **superconducting** magnets: niobium–titanium windings cooled by liquid helium to about **4 K**, carrying a current that circulates in a closed loop with no power supply attached."
        watch={<ScannerCrossSection built={['magnet']} />}
        why={
          'It sits outermost because of its size. Superconducting windings have to run in a bath of liquid helium inside a vacuum cryostat, and that assembly is roughly two metres across to leave a sixty-centimetre bore for a person. It is also the only layer that is on permanently.\n\nThree ways to make a magnetic field, and only one of them is practical at 1.5 T over a volume big enough for a person.\n\nA **permanent** magnet needs no power and produces no fringe field to speak of, but it is enormously heavy and tops out well below 0.5 T. A **resistive** electromagnet can be switched off, which is convenient, but the current needed for a diagnostic field would dissipate hundreds of kilowatts as heat. A **superconducting** magnet has zero resistance below its transition temperature — about 9 K for niobium–titanium — so once the current is established it keeps circulating with no dissipation at all.\n\nThat is what **persistent mode** means. The magnet is ramped up once at installation, a superconducting switch closes the loop, the supply is disconnected, and the field then decays by less than about 0.1 ppm per hour. It stays on through a power cut. It stays on overnight. It stays on when the scanner is being serviced. The only way to remove it in a hurry is a **quench** — driving part of the winding normal so the stored energy boils the helium off — and that is a controlled emergency, not a switch.\n\nEverything about MR safety follows from this one fact: **the field is always there**, whether or not anyone is scanning.\n\nRaising B₀ raises the Larmor frequency in exact proportion, because **f = γ̄B₀** with γ̄ = 42.58 MHz/T. It also raises signal-to-noise roughly in proportion, which is the reason to want 3 T. It lengthens T1, widens the frequency separation between fat and water, worsens susceptibility artefact, and increases RF power deposition steeply — so the higher field is a trade, not a free upgrade.'
        }
        task={{
          ask: 'Drag the B₀ slider up to 3 T.',
          notice:
            'f₀ followed it exactly — 63.9 MHz at 1.5 T, 127.7 MHz at 3 T — because f = γ̄B₀ and nothing else. The same proportionality is why one part per million of the field is now 128 Hz rather than 64, which is precisely what makes a 3 T magnet harder to shim.',
        }}
      />

      <Concept
        id="shims"
        title="Shim coils buy homogeneity, and homogeneity is expensive"
        what="No magnet is uniform enough as built, and no patient leaves the field as they found it. **Shimming** — passive iron and active correction coils — flattens what is left."
        watch={<ScannerCrossSection built={['magnet', 'shim']} />}
        why={
          'The shim coils sit just inside the magnet, because their job is to correct the magnet’s own residual error and they have to act over the same volume the magnet does.\n\nThe requirement is brutal. Imaging assumes that any difference in precession frequency is caused by a gradient the scanner applied deliberately. A stray field variation is indistinguishable from position information, so it corrupts the image directly.\n\nHow tight is tight? One part per million at 1.5 T is 1.5 µT, which is about **64 Hz** of Larmor frequency. A typical specification is a few parts per million or better over a 40 cm sphere at isocentre. That is the number the shim system exists to deliver.\n\n**Passive shims** are small pieces of ferromagnetic material fitted into trays in the bore at installation, chosen to cancel the magnet’s manufacturing imperfections. They are set once and left.\n\n**Active shims** are additional coils, each shaped to generate one term of the field error, driven by adjustable currents. Some are superconducting and set at installation; the room-temperature ones are re-optimised **for every patient**, because a body is not magnetically neutral — air, bone, fat and tissue have different susceptibilities, and an air–tissue interface such as the skull base or the lung apex distorts the local field by several parts per million all by itself.\n\nWhen shimming fails, the failure is recognisable: fat suppression that works in one part of the image and not another, geometric distortion in echo-planar sequences, and a shortened T2* everywhere.'
        }
        change={
          'The shim patches sit at fixed azimuths and shimmer as they trim, because each one corrects a different term of the error. Read **1 ppm of B₀** underneath the diagram: that is how many hertz of Larmor frequency the shim system is chasing.'
        }
      />

      <Concept
        id="gradient-coils"
        title="Three gradient coils, one field direction"
        what="Each gradient coil adds a field **parallel to B₀**, along z. What distinguishes X, Y and Z is the **direction along which that added field varies** — not the direction it points."
        watch={<ScannerCrossSection built={['magnet', 'shim', 'gradient']} />}
        why={
          'The gradient coils sit inside the shims and close to the patient, because gradient efficiency falls off steeply with radius: for a given current, a smaller coil produces a much stronger gradient. A gradient set is also heavy and mechanically braced, and it is the layer that visibly flexes when it switches.\n\nNow the idea itself, which is the single most commonly mangled one in the whole chapter, so it is worth stating flatly. The **x-gradient** does not produce a field along x. It produces a field along **z** whose magnitude increases as you move along x. Written out: **B_z(x, y, z) = B₀ + G_x·x + G_y·y + G_z·z**, and the three coil sets supply the three terms independently.\n\nThe reason this matters is that a field with a component perpendicular to B₀ would exert a torque on the magnetisation and tip it. Gradients never tip anything. They only change how fast spins precess, according to where those spins are.\n\nThe geometry differs because the job differs. The **Z gradient** is a **Maxwell pair**: two coaxial loops carrying current in opposite directions, so the field they add opposes B₀ at one end of the pair and reinforces it at the other, passing through zero at isocentre. The **X and Y gradients** cannot be made from coaxial rings, because the variation has to run across the bore rather than along it; they use **Golay saddle coils** — arcs wrapped onto the cylinder — and the Y set is simply the X set rotated by ninety degrees about z.\n\nTypical amplitudes are **20 to 45 mT/m**, with slew rates up to a couple of hundred tesla per metre per second. Those two numbers set the thinnest slice you can select, the shortest echo time you can reach, and how fast k-space can be traversed.\n\nTwo consequences worth carrying forward. First, a gradient coil is a current-carrying conductor sitting in a 1.5 T field, so switching it produces a large **Lorentz force** on the coil former: the former flexes, the flex radiates sound, and that is the knocking — routinely over 100 dB(A), which is why ear protection is not optional. Second, a rapidly changing magnetic field **induces currents in the patient**, and above a threshold that causes **peripheral nerve stimulation**. It is the rate of change, dB/dt, that is limited — not the gradient amplitude itself.'
        }
        /* The chooser opens on Z, so asking for Z would ask for nothing. The
           action has to leave the Maxwell pair to be an action at all. */
        task={{
          ask: 'Switch Gradient axis on show from Z to X.',
          notice:
            'Z was a Maxwell pair: two coaxial rings with their currents running opposite ways, so the field they add subtracts from B₀ at one end and adds to it at the other, and is exactly zero at isocentre. X cannot be built that way, because the variation has to run across the bore rather than along it — so it is a set of saddles wrapped onto the cylinder, and Y is the same saddles rotated a quarter turn about z.',
        }}
        change={
          'Raise **Gradient amplitude** and read the frequency spread across a 40 cm field of view — that spread is the raw material every encoding section is built from. The coil former jitters each time the waveform reverses; that is the Lorentz force, and it is the noise.'
        }
      />

      <Concept
        id="rf-coils"
        title="RF coils: one job on transmit, a different job on receive"
        what="On transmit an RF coil produces **B₁**, an oscillating field **in the transverse plane, perpendicular to B₀**, at the Larmor frequency. On receive it detects the tiny voltage that rotating transverse magnetisation induces in it."
        watch={<ScannerCrossSection built={['magnet', 'shim', 'gradient', 'rf']} />}
        why={
          'The RF body coil is closest of all, just outside the bore liner, because the signal it has to detect is minute and the coupling between a coil and the tissue it is listening to falls off with distance.\n\nTransmit first. A field parallel to B₀ can do nothing at all to the magnetisation — it just adds to B₀. To tip magnetisation away from z you need a torque, and that requires a field **perpendicular** to z. B₁ is that field, and it also has to oscillate at the Larmor frequency, because only then does it stay in step with the precession long enough to accumulate a rotation. Perpendicular and on-resonance: both conditions, or nothing happens.\n\nB₁ is also feeble compared with B₀ — tens of microtesla against 1.5 T — which is exactly why resonance is required.\n\nReceive is the mirror image. Transverse magnetisation rotating at the Larmor frequency is a changing magnetic flux, and a coil in that flux develops a voltage across it by Faraday induction. Longitudinal magnetisation, being static, induces nothing. **Only transverse magnetisation is ever detectable.**\n\nThe coils themselves come in a small family.\n\n**Body coil.** Built permanently into the bore, just outside the liner, usually a birdcage. Large, and therefore B₁ is uniform across the whole patient — which is why almost all transmission is done with it. As a receiver it is the worst option available, because a big coil sees a big volume of tissue and therefore picks up noise from all of it.\n\n**Head, knee and other volume coils.** Same birdcage idea, but wrapped closely around one part. Closer fit, smaller sensitive volume, better signal-to-noise. Some transmit and receive; many now receive only, with the body coil transmitting.\n\n**Surface or local coils.** A small loop laid directly on the patient. The best signal-to-noise of anything, because it is close to the tissue and sees very little else — but its sensitivity falls away with depth, roughly beyond one coil radius, so it is bright at the surface and useless deep. Coverage is small and uniformity is poor.\n\n**Phased arrays.** Several small coils arranged over a region, each with its own receive channel, combined afterwards. Each element keeps the signal-to-noise of a small coil over its own patch, while the array as a whole covers what a large coil would. This is the answer to the trade, and it is why almost every modern receive coil is an array. It has a second benefit: because each element has a different spatial sensitivity, the array carries some position information of its own, and that is what makes **parallel imaging** possible.\n\nThe trade in one line: **signal comes from tissue near the coil; noise comes from all the tissue the coil can see.** Make the coil smaller and you lose coverage but gain signal-to-noise. Make it bigger and you gain coverage but drown in noise. An array refuses the choice.'
        }
        change={
          'The rungs of the birdcage do not all carry the same current: the pattern runs as cos(θ − ωt) round the cylinder, and that is exactly what makes the field inside it uniform and **transverse**. Watch the B₁ arrow rotate in the plane at right angles to B₀ — then watch the same cage go quiet and receive.'
        }
      />

      <Concept
        id="patient"
        title="And the patient, at isocentre, inside all of it"
        what="**Isocentre** is the point every cylinder shares: the field is at its most uniform there and all three gradients are zero there, which is why it is the origin the image is reconstructed about."
        watch={<ScannerCrossSection built={['magnet', 'shim', 'gradient', 'rf', 'patient']} />}
        why={
          'The patient goes in last and at the centre, because the centre is where the machine is at its best. The magnet is specified for homogeneity over a sphere at isocentre, the shim system is optimised for that same volume, and the gradients are linear there and increasingly non-linear towards the ends of their windings.\n\nThat is why couch position is a clinical matter and not a convenience. Anatomy scanned well away from isocentre sits in a less uniform field and in the non-linear tails of the gradient coils, so it suffers geometric distortion, and fat suppression — which depends on a precisely known resonant frequency — becomes patchy. Centring the region of interest at isocentre is part of getting the image right.\n\nIt is also worth being clear about what the patient contributes. Every signal the scanner records comes from hydrogen inside this cylinder and from nothing else: the coils create the conditions, and the tissue supplies the entire signal. The body is not passive, either — it changes the field it sits in, which is what the per-patient shim is correcting for, and it is the dominant source of the noise the receive coil hears.'
        }
        change={
          'Take a fixed **Viewpoint** — **From the feet** looks straight down the bore, and the whole nesting collapses into one set of concentric rings with the patient in the middle of them.'
        }
      />

      <Concept
        id="nested-cylinders"
        title="The whole machine, and why it nests in that order"
        what="Five cylinders sharing one axis: the **main magnet**, the **shim coils**, the **X, Y and Z gradient coils**, the **RF transmit/receive coil**, and the **patient** at isocentre."
        watch={<ScannerCrossSection />}
        why={
          'The order is not arbitrary, and it is not a filing system — it falls out of what each layer has to do. **Field creation furthest out, listening closest in**, and everything between them placed by how strongly its job depends on being near the patient: the magnet by its sheer size, the shims by having to act over the volume the magnet does, the gradients by an efficiency that improves steeply as the coil gets smaller, the RF coil by a signal that fades with distance.\n\nRead the same stack the other way and it sorts by permanence instead. The magnet is never off. The shims are set at installation and re-trimmed once per patient. The gradients switch thousands of times a second, all through the scan. The RF coil is live only in the microseconds it is transmitting or listening. The further in you go, the faster the layer changes — and the two orderings agreeing is not a coincidence, because the layers that have to act quickly are the ones that have to act locally.\n\nThis is also the whole instrument, with nothing suppressed. Every control is live again, including the one that pins a layer and follows it round the timeline.'
        }
        task={{
          ask: 'Set Separate the layers to pulled apart.',
          notice:
            'Five cylinders and nothing else — that is the entire machine. Pulled apart, the ordering is legible in one glance: the magnet outermost, the patient inside all of it, and each layer between them sitting exactly as close to the patient as its job requires.',
        }}
        change={
          'Pin a layer with **Highlight a layer** and watch what changes: the magnet’s current never stops, the shims shimmer as they trim, the gradients reverse and knock, and the RF coil’s rungs carry a pattern that rotates. Switch **Gradient axis on show** between X, Y and Z — the Z gradient is a pair of opposed rings, while X and Y are the same saddle geometry rotated a quarter turn about the bore. Drag the scene to rotate it, or take a fixed **Viewpoint** if you would rather not drag.'
        }
      />

      <Concept
        id="axes"
        title="The axis convention, which every later section assumes"
        what="**z** runs head to foot along the bore and carries **B₀**. **x** runs left to right and **y** runs anterior to posterior, so **+y is posterior**; together they span the **transverse plane**, perpendicular to B₀."
        watch={<MriAxes />}
        why={
          'The convention is fixed by the machine, not by the patient. z is the bore axis because that is the direction the main magnet’s field points, so **B₀ is along +z by definition**. Everything else is described relative to it: +z towards the head, +x towards the patient’s left, +y towards the back. Those three form a **right-handed** set — x̂ × ŷ = ẑ — and that is the convention DICOM calls **LPS**, for left, posterior, superior.\n\nHandedness is not bookkeeping. It fixes which way precession runs about +z and the sign of the phase a gradient writes, so a set built the other way round would silently invert both. Take the anterior direction as +y instead and the triad becomes left-handed, which is why the convention is written with +y pointing at the couch.\n\nThe consequence used constantly from here on is that **longitudinal** means along z and **transverse** means in the x–y plane. Magnetisation recovering along z is T1 recovery; magnetisation decaying in the x–y plane is T2 decay. They are two different components of one vector, not two different things.\n\nThe three cardinal planes are then just the three coordinate planes:\n\n**Axial** (transverse) spans **x–y**, with its normal along **z**. **Sagittal** spans **y–z**, normal along **x**. **Coronal** spans **x–z**, normal along **y**.\n\nAnd this is where the convention starts to pay. Slice selection works by applying a gradient **along the normal of the slice you want**, so an axial slice is selected with **G_z**, a sagittal slice with **G_x**, and a coronal slice with **G_y**. An oblique slice needs a combination of all three, played simultaneously — which is why an MR scanner can image at any angle without moving the patient, and a CT scanner cannot.\n\nOne caution worth keeping: unlike z, the sign conventions for x and y are not universal across vendors and display packages, and a displayed image is oriented by radiological convention rather than by the physics axes. What is universal, and what is examined, is that **z lies along B₀**.'
        }
        task={{
          ask: 'Drag the diagram round until you are looking straight up the bore from the foot of the couch.',
          notice:
            'The triad turned with the scene: z still runs up the bore, x still points to the patient’s left, y still points down at the couch. The axes are fixed to the machine, not to your view of it — which is why x̂ × ŷ = ẑ holds from every angle, and why every later section can say "longitudinal" and "transverse" without telling you where to stand.',
        }}
        change={
          'The caption under the diagram says **drag to rotate**, and dragging is the point — spin it with a finger or the mouse, or jump to a fixed viewpoint. Switch between **Axial**, **Sagittal** and **Coronal** and watch which axis the plane is perpendicular to — that is the axis whose gradient selects it. Then push **Slice offset** outwards: the outline in the corner panel is solved from where the plane actually cuts the body, so it follows the body’s own width along the slice’s normal — widening at the shoulders, narrowing at the crown — and disappears entirely once the plane clears the patient.'
        }
      />
    </SectionPage>
  )
}

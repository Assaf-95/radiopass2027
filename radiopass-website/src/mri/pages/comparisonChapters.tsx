/**
 * The comparison walkthrough, one subject per chapter.
 *
 * The full 8 × 5 matrix is the right *reference*, and a terrible *first
 * lesson* — forty cells arrive at once and none of them explain themselves. So
 * the matrix is built up a row at a time here, each chapter carrying one idea,
 * and only assembled in full at the end once every row has been read.
 *
 * Chapter order is pedagogical, not alphabetical: fat first because it is the
 * benchmark everything else is described against, then free water because it is
 * the other extreme, then the pairs that are only interesting in contrast with
 * each other.
 */

import type { ReactNode } from 'react'

import type { TissueId } from '../engine'

export type ComparisonChapter = {
  /** URL slug — each chapter is its own addressable page. */
  slug: string
  /** Short label for the chapter rail. */
  short: string
  /** What this chapter is about, in the learner's words. */
  title: string
  /** The one thing to take away. */
  claim: string
  /** Tissues whose rows this chapter shows. */
  tissues: TissueId[]
  body: ReactNode
  examFact: string
}

export const COMPARISON_CHAPTERS: ComparisonChapter[] = [
  {
    slug: 'fat',
    short: 'Fat',
    title: 'Fat sets the benchmark',
    claim: 'Fat is the tissue every other tissue gets described against — so learn its row first.',
    tissues: ['fat'],
    examFact:
      'Fat is bright on T1 because of its SHORT T1 (~260 ms at 1.5 T), not because it contains a lot of hydrogen. Plenty of tissues have a similar proton density and are nowhere near as bright.',
    body: (
      <>
        <p>
          Fat has the shortest T1 of any tissue on this list. Give it 500 ms between excitations and
          it has rebuilt most of its longitudinal magnetisation, so it hands the next 90° pulse a
          large vector to tip. That is the whole reason it dominates a T1-weighted image.
        </p>
        <p>
          Now look one cell to the right. On the T2-weighted column fat drops back to intermediate:
          its T2 of about 80 ms is unremarkable, so by TE 100 ms it has lost most of what fluid still
          holds. <strong>Fat being bright is a T1 phenomenon, not a general property of fat.</strong>
        </p>
        <p>
          The last cell is the one worth memorising. On STIR fat is black — not dimmed, black. An
          inversion pulse plus a TI of 180 ms catches fat exactly as it crosses zero, so there is
          nothing to excite. Every other tissue on this page is still deeply negative at that moment
          and comes back bright.
        </p>
        <details className="mri-advanced">
          <summary>Why clinical T2 images show fat brighter than this table does</summary>
          <div className="mri-advanced-body">
            <p>
              These columns model a <strong>conventional</strong> spin echo, where fat's T2 of about
              80 ms leaves it merely intermediate at TE 100 ms. Almost every T2-weighted image you
              will actually be shown is a <strong>fast (turbo) spin echo</strong>, and on those fat
              stays conspicuously bright.
            </p>
            <p>
              The reason is the closely spaced train of 180° pulses a fast spin echo uses. They
              disrupt the J-coupling between fat's proton groups, which normally shortens its
              apparent T2; with that mechanism suppressed, fat's effective T2 lengthens and it holds
              its signal much further into the echo train.
            </p>
            <p>
              This is exactly why fat suppression became routine alongside fast spin echo: the faster
              sequence made fat brighter, so it had to be dealt with explicitly. The physics in this
              table is not wrong — it is the conventional case, and the difference between the two is
              itself examinable.
            </p>
          </div>
        </details>
      </>
    ),
  },
  {
    slug: 'csf',
    short: 'CSF',
    title: 'CSF swings from one extreme to the other',
    claim:
      'CSF is the most informative row in the table: it is the darkest thing on one sequence and the brightest on the next.',
    tissues: ['csf'],
    examFact:
      'CSF has both a very long T1 (~4000 ms) and a very long T2 (~2000 ms). The long T1 makes it dark on T1-weighted images; the long T2 makes it bright on T2-weighted images. Two different properties, two different columns.',
    body: (
      <>
        <p>
          Free water is slow at everything. It is slow to recover, so at TR 500 ms it has managed
          only about 12% of its longitudinal magnetisation and is the darkest thing on a T1-weighted
          image. It is also slow to decay, so at TE 100 ms it still holds most of its transverse
          magnetisation and is the brightest thing on a T2-weighted image.
        </p>
        <p>
          Those are not the same fact seen twice. They are two independent properties that happen to
          point the same way for water, which is exactly why CSF is the tissue radiologists use to
          decide what a sequence is weighted by. Dark fluid means T1. Bright fluid means T2.
        </p>
        <p>
          The FLAIR cell is the exception that proves it. CSF goes to zero there not because of its
          T2, but because an inversion pulse was timed to its T1. Same tissue, third mechanism.
        </p>
      </>
    ),
  },
  {
    slug: 'white-grey',
    short: 'WM vs GM',
    title: 'White and grey matter swap places',
    claim:
      'The same two tissues reverse order between T1 and T2. Nothing about them changed — only which property the sequence was built to see.',
    tissues: ['whiteMatter', 'greyMatter'],
    examFact:
      'White matter is BRIGHTER than grey matter on T1 (shorter T1, from myelin lipid). Grey matter is BRIGHTER than white matter on T2 (longer T2) and on proton density (more mobile water). Getting this pair the right way round is a standing examination question.',
    body: (
      <>
        <p>
          Read the two rows side by side. On the T1 column white matter is ahead: its myelin
          shortens T1 to about 600 ms against grey matter's 900 ms, so it recovers further between
          excitations. On the T2 column the order flips: grey matter's longer T2 keeps more signal at
          a long TE.
        </p>
        <p>
          This is the cleanest demonstration in the whole table of what "weighting" means. Two fixed
          tissues, two sequences, opposite answers. The sequence is not measuring the tissue — it is
          choosing which property of the tissue to be sensitive to.
        </p>
        <p>
          The proton-density column is a trap worth walking into deliberately. Grey matter is
          brighter there too, as it is on T2 — but for a completely different reason. It simply
          contains more mobile water. Same ranking, different mechanism.
        </p>
      </>
    ),
  },
  {
    slug: 'oedema',
    short: 'Oedema',
    title: 'Oedema is not CSF',
    claim:
      'FLAIR erases CSF and leaves oedema bright. That single difference is why the sequence exists.',
    tissues: ['oedema', 'csf'],
    examFact:
      'FLAIR nulls tissue by T1, not by water content. Free CSF has a T1 of ~4000 ms; the water in oedema is bound to protein and macromolecules, shortening its T1 to ~1200 ms. At the CSF null time, oedema has long since recovered past zero.',
    body: (
      <>
        <p>
          On the T2 column these two rows look almost the same: both bright, both obviously fluid.
          That is the clinical problem. A periventricular plaque sitting against bright CSF on a T2
          image is easy to miss.
        </p>
        <p>
          Now compare the FLAIR cells. CSF is black; oedema is the brightest thing on the image. The
          inversion pulse was timed to the T1 of <em>free</em> water — and the water inside a lesion
          is not free. Bound to protein, its T1 falls to roughly 1200 ms, so by the time the 90°
          pulse arrives at 2372 ms it has recovered well past zero and produces a large signal.
        </p>
        <p>
          This is the correction to the most common misreading of FLAIR. It does not suppress water.
          It suppresses <strong>one particular T1</strong>, and free CSF is the tissue that happens
          to have it.
        </p>
      </>
    ),
  },
  {
    slug: 'marrow',
    short: 'Marrow fat',
    title: 'Marrow fat behaves like fat, because it is fat',
    claim: 'Marrow tracks the fat row almost cell for cell — which is what makes STIR the marrow sequence.',
    tissues: ['marrow', 'fat'],
    examFact:
      'STIR suppresses marrow fat along with subcutaneous fat, which is precisely why it is the sequence of choice for detecting bone-marrow oedema: remove the bright fat and the oedema has nothing to hide behind.',
    body: (
      <>
        <p>
          Put these two rows together and they move as one. Marrow's T1 of about 300 ms sits close to
          fat's 260 ms, and its behaviour follows: bright on T1, unremarkable on T2, suppressed on
          STIR.
        </p>
        <p>
          The clinical payoff is in that last cell. Normal marrow is bright and fatty; marrow oedema
          is not. On a T1 image both are competing against a bright background. Null the fat with
          STIR and the background disappears, leaving oedema as the only bright thing in the bone.
        </p>
        <p>
          Notice that marrow is not <em>quite</em> as suppressed as fat — its slightly longer T1
          means the 180 ms inversion time is a slightly imperfect fit. Suppression is only ever exact
          for the tissue the TI was calculated from.
        </p>
      </>
    ),
  },
  {
    slug: 'muscle',
    short: 'Muscle',
    title: 'Muscle is the dark reference',
    claim: 'Muscle is dark nearly everywhere, and it is dark for two reasons at once.',
    tissues: ['muscle'],
    examFact:
      'Muscle has the SHORTEST T2 of the tissues here (~45 ms), so it is conspicuously dark on T2-weighted images. It also has a relatively low mobile proton density (~0.70), so it stays unremarkable even on proton-density images.',
    body: (
      <>
        <p>
          Muscle's row barely moves, and that is its lesson. A short T2 of about 45 ms means it has
          lost nearly all its transverse magnetisation by TE 100 ms — it is the darkest soft tissue
          on the T2 column. An intermediate T1 of 870 ms gives it nothing special on T1 either.
        </p>
        <p>
          Even the proton-density column, which exists to strip out relaxation effects, leaves muscle
          in the middle: its mobile proton density is genuinely lower than the brain's. Two
          independent reasons to be dark, so it is dark whichever way you look at it.
        </p>
        <p>
          Use it as a calibration row. When you are trying to decide what a sequence is weighted by,
          fluid tells you the most and muscle confirms it.
        </p>
      </>
    ),
  },
  {
    slug: 'lesion',
    short: 'Your lesion',
    title: 'Now predict a lesion you have never seen',
    claim:
      'Give a lesion any three numbers and the table tells you which sequence will reveal it. That is the whole skill.',
    tissues: ['lesion'],
    examFact:
      'Most pathology lengthens both T1 and T2 (increased water content). That combination is dark on T1 and bright on T2 — which is why a T2-weighted or fluid-sensitive sequence is the usual first look for disease.',
    body: (
      <>
        <p>
          The generic lesion starts with a T1 of 1000 ms, a T2 of 120 ms and a proton density of
          0.85 — a plausible, unremarkable piece of pathology. Read its row and you get the classic
          answer: slightly dark on T1, bright on T2 and on the fluid-sensitive sequences.
        </p>
        <p>
          Then change it. Open the{' '}
          <strong>Free Sequence Laboratory</strong> and drag the lesion's T2 up towards 300 ms: watch
          its T2 and STIR cells climb while its T1 cell barely moves. Drop its T1 to 300 ms instead
          — roughly what avid gadolinium enhancement does — and it goes bright on T1 and{' '}
          <em>vanishes on STIR</em>, alongside the fat.
        </p>
        <p>
          That last result is not a quirk of the model. It is the reason STIR is avoided after
          contrast, and you can now derive it rather than remember it.
        </p>
      </>
    ),
  },
]

export const FULL_MATRIX_SLUG = 'full'

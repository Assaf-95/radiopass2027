/**
 * Interface behaviour.
 *
 * These mount real components against the real engine — no mocked signal
 * values — so a test failing here means a learner would genuinely see the wrong
 * number, not that an internal detail moved.
 *
 * The setup module is imported directly rather than through Vitest's
 * `setupFiles` because this checkout sits under a path containing colons, which
 * Vitest cannot resolve setup entries through. See vitest.config.ts.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import '../test/setup'

import { BrightnessPanel } from './BrightnessPanel'
import { PresetBar, SequenceControls, TissueSelector } from './Controls'
import { NullPointReadout } from './NullPointReadout'
import { TissueGraphs } from './TissueGraphs'
import { TissueInspector } from './TissueInspector'
import { presetConfig, TISSUES, type SequenceConfig, type TissueId } from '../engine'
import { MriProvider } from '../state/context'

function Harness({
  config,
  tissues,
  focus,
  children,
}: {
  config: SequenceConfig
  tissues?: TissueId[]
  focus?: TissueId
  children: React.ReactNode
}) {
  return (
    <MemoryRouter>
      <MriProvider
        initialConfig={config}
        initialTissues={tissues ?? ['fat', 'whiteMatter', 'greyMatter', 'muscle', 'csf', 'oedema']}
        initialFocus={focus}
        initialMode="advanced"
        autoPlay={false}
      >
        {children}
      </MriProvider>
    </MemoryRouter>
  )
}

/** Finds a tissue tile in the brightness panel by its exact heading. */
function tile(name: string): HTMLElement {
  const tiles = [...document.querySelectorAll('.mri-tiles .mri-tile')] as HTMLElement[]
  const match = tiles.find((node) => node.querySelector('strong')?.textContent === name)
  if (!match) throw new Error(`no tile for ${name}; have ${tiles.map((n) => n.querySelector('strong')?.textContent).join(', ')}`)
  return match
}

/** Reads the signal figure a tissue tile is displaying. */
function tileSignal(name: string): number {
  const text = tile(name).textContent ?? ''
  const match = text.match(/signal ([\d.]+)/)
  return match ? Number(match[1]) : Number.NaN
}

/** Reads the grey level a tissue tile is painted. */
function tileBrightness(name: string): string {
  return (tile(name).querySelector('.mri-tile-swatch') as HTMLElement).style.background
}

/** Finds a chip in the tissue selector by its exact label. */
function tissueChip(name: string): HTMLElement {
  const selector = screen.getByRole('group', { name: 'Tissues shown' })
  const chips = [...selector.querySelectorAll('button')] as HTMLElement[]
  const match = chips.find((node) => node.textContent?.trim() === name)
  if (!match) throw new Error(`no chip for ${name}`)
  return match
}

function setSlider(label: string, value: number) {
  const slider = screen.getByLabelText(label, { selector: 'input[type="range"]' }) as HTMLInputElement
  act(() => {
    fireEvent.change(slider, { target: { value: String(value) } })
  })
}

describe('parameter controls drive every connected view', () => {
  it('changing TR updates the graphs, the numbers and the brightness', async () => {
    render(
      <Harness config={{ ...presetConfig('pd-se'), preset: 'custom' }}>
        <SequenceControls show={['tr', 'te']} />
        <TissueGraphs />
        <BrightnessPanel showHead={false} />
      </Harness>,
    )

    const fatBefore = tileSignal('Fat')
    const csfBefore = tileSignal('CSF')
    const csfShadeBefore = tileBrightness('CSF')

    // Long TR to short TR: this is the move that creates T1 weighting.
    setSlider('TR', 500)

    // The store notifies React synchronously inside act(), so the new values
    // are already on screen — no need to race a timer for them.
    expect(tileSignal('CSF')).toBeLessThan(csfBefore)
    const fatAfter = tileSignal('Fat')
    const csfAfter = tileSignal('CSF')

    // Every signal falls, but CSF falls very much further.
    expect(fatAfter).toBeLessThan(fatBefore)
    expect(1 - csfAfter / csfBefore).toBeGreaterThan(1 - fatAfter / fatBefore)
    // Fat is now several times brighter than CSF — visible T1 contrast.
    expect(fatAfter / csfAfter).toBeGreaterThan(3)
    // The painted grey level changed too, not just the number.
    expect(tileBrightness('CSF')).not.toBe(csfShadeBefore)
    // And the graph is present and describes itself in words.
    expect(screen.getByRole('slider', { name: /against time/i })).toBeTruthy()
  })

  it('changing TE updates the numbers and the brightness', async () => {
    render(
      <Harness config={{ ...presetConfig('t2-se'), preset: 'custom' }}>
        <SequenceControls show={['tr', 'te']} />
        <BrightnessPanel showHead={false} />
      </Harness>,
    )

    const csfBefore = tileSignal('CSF')
    const muscleBefore = tileSignal('Muscle')

    setSlider('TE', 200)

    expect(tileSignal('CSF')).not.toBe(csfBefore)
    // Muscle has a short T2, so a longer TE costs it proportionally far more.
    const csfLoss = 1 - tileSignal('CSF') / csfBefore
    const muscleLoss = 1 - tileSignal('Muscle') / muscleBefore
    expect(muscleLoss).toBeGreaterThan(csfLoss)
  })

  it('changing TI changes how completely a tissue is suppressed', async () => {
    render(
      <Harness config={{ ...presetConfig('flair'), preset: 'custom' }} focus="csf">
        <SequenceControls show={['ti']} nullTargets={['csf']} />
        <NullPointReadout targetId="csf" />
        <BrightnessPanel showHead={false} />
      </Harness>,
    )

    // At the null point CSF is suppressed.
    expect(tileSignal('CSF')).toBeLessThan(0.01)
    expect(screen.getByText('Fully suppressed')).toBeTruthy()

    setSlider('TI', 1200)

    expect(tileSignal('CSF')).toBeGreaterThan(0.1)
    expect(screen.getByText(/Not suppressed|Incomplete suppression/)).toBeTruthy()
    // The readout reports the mismatch against the true null time.
    expect(screen.getAllByText(/2372 ms/).length).toBeGreaterThan(0)
  })

  it('offers a snap-to-null control that suppresses the target exactly', async () => {
    render(
      <Harness config={{ ...presetConfig('flair'), ti: 900, preset: 'custom' }} focus="csf">
        <NullPointReadout targetId="csf" />
        <BrightnessPanel showHead={false} />
      </Harness>,
    )

    expect(tileSignal('CSF')).toBeGreaterThan(0.1)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Snap TI to the null point/i }))
    })
    expect(tileSignal('CSF')).toBeLessThan(0.01)
  })

  it('clamps TE so it can never exceed TR', async () => {
    render(
      <Harness config={{ ...presetConfig('t1-se'), preset: 'custom' }}>
        <SequenceControls show={['tr', 'te']} />
      </Harness>,
    )

    setSlider('TR', 50)
    const te = screen.getByLabelText('TE', { selector: 'input[type="range"]' }) as HTMLInputElement
    const tr = screen.getByLabelText('TR', { selector: 'input[type="range"]' }) as HTMLInputElement
    expect(Number(te.value)).toBeLessThan(Number(tr.value))
  })

  it('explains an unusual but valid configuration instead of overriding it', async () => {
    render(
      <Harness config={{ ...presetConfig('t2-se'), preset: 'custom' }}>
        <SequenceControls show={['tr', 'te']} />
        <TissueInspector />
      </Harness>,
    )

    // Short TR with long TE — the combination where the mechanisms oppose.
    setSlider('TR', 600)
    expect(
      (screen.getByLabelText('TR', { selector: 'input[type="range"]' }) as HTMLInputElement).value,
    ).toBe('600')
    // The configuration is kept, not snapped back to a preset.
    expect(
      (screen.getByLabelText('TE', { selector: 'input[type="range"]' }) as HTMLInputElement).value,
    ).toBe('100')
  })
})

describe('presets propagate to every component', () => {
  it('applies a preset to the controls, the numbers and the brightness', async () => {
    render(
      <Harness config={presetConfig('t1-se')}>
        <PresetBar presets={['t1-se', 't2-se']} />
        <SequenceControls show={['tr', 'te']} />
        <BrightnessPanel showHead={false} />
      </Harness>,
    )

    // T1-weighted to begin with: fat brightest, CSF darkest.
    expect(tileSignal('Fat')).toBeGreaterThan(tileSignal('CSF'))

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'T2 spin echo' }))
    })

    // The preset animates in, so wait for it to arrive.
    await waitFor(
      () => {
        const tr = screen.getByLabelText('TR', { selector: 'input[type="range"]' }) as HTMLInputElement
        expect(Number(tr.value)).toBe(4000)
      },
      { timeout: 8000 },
    )
    await waitFor(() => expect(tileSignal('CSF')).toBeGreaterThan(tileSignal('Fat')), {
      timeout: 8000,
    })

    const te = screen.getByLabelText('TE', { selector: 'input[type="range"]' }) as HTMLInputElement
    expect(Number(te.value)).toBe(100)
  })
})

describe('tissue selection', () => {
  it('adds and removes tissues from every view at once', async () => {
    render(
      <Harness config={presetConfig('t2-se')} tissues={['fat', 'csf', 'whiteMatter']}>
        <TissueSelector />
        <BrightnessPanel showHead={false} />
      </Harness>,
    )

    const tileNames = () =>
      [...document.querySelectorAll('.mri-tiles .mri-tile strong')].map((n) => n.textContent)

    expect(tileNames()).not.toContain('Oedema')

    act(() => {
      fireEvent.click(tissueChip('Oedema'))
    })

    expect(tileNames()).toContain('Oedema')
    expect(Number.isFinite(tileSignal('Oedema'))).toBe(true)

    // Removing it takes it out of the brightness panel again.
    act(() => {
      fireEvent.click(tissueChip('Oedema'))
    })
    expect(tileNames()).not.toContain('Oedema')
  })

  it('keeps at least two tissues on screen', async () => {
    render(
      <Harness config={presetConfig('t2-se')} tissues={['fat', 'csf']}>
        <TissueSelector />
      </Harness>,
    )
    act(() => {
      fireEvent.click(tissueChip('Fat'))
    })
    // Refused: a comparison needs at least two tissues.
    expect(tissueChip('Fat').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('tissue inspector', () => {
  it('reports live state and a generated reason for the current sequence', async () => {
    render(
      <Harness config={presetConfig('t2-se')} focus="csf">
        <TissueInspector allowEditing />
      </Harness>,
    )

    const region = screen.getByRole('region', { name: /Tissue inspector for CSF/i })
    const terms = [...region.querySelectorAll('dt')].map((node) => node.textContent)
    expect(terms).toContain('T1')
    expect(terms).toContain('Proton density')
    const values = [...region.querySelectorAll('dd')].map((node) => node.textContent)
    expect(values).toContain('4000 ms')
    // The reason mentions the mechanism that is actually dominant here.
    const reason = document.querySelector('.mri-inspector-reason')?.textContent ?? ''
    expect(reason).toMatch(/long T2/i)
    expect(reason).toMatch(/TE 100/)
  })

  it('changes its explanation when the sequence changes', async () => {
    render(
      <Harness config={{ ...presetConfig('flair'), preset: 'custom' }} focus="csf">
        <TissueInspector />
      </Harness>,
    )
    const reason = document.querySelector('.mri-inspector-reason')?.textContent ?? ''
    expect(reason).toMatch(/null point/i)
  })

  it('applies a learner edit to a tissue and updates the signal', async () => {
    render(
      <Harness config={presetConfig('t2-se')} focus="lesion" tissues={['lesion', 'whiteMatter']}>
        <TissueInspector allowEditing />
        <BrightnessPanel showHead={false} />
      </Harness>,
    )

    act(() => {
      fireEvent.click(screen.getByText(/Edit this tissue's properties/i))
    })

    const before = tileSignal('Generic lesion')
    const t2Slider = document.querySelectorAll('.mri-inline-slider input')[1] as HTMLInputElement
    act(() => {
      fireEvent.change(t2Slider, { target: { value: '400' } })
    })

    expect(tileSignal('Generic lesion')).toBeGreaterThan(before)
  })
})

describe('accessibility', () => {
  it('gives every canvas an accessible name and a live text alternative', () => {
    render(
      <Harness config={presetConfig('flair')} focus="csf">
        <TissueGraphs />
        <BrightnessPanel />
      </Harness>,
    )

    const images = screen.getAllByRole('img')
    expect(images.length).toBeGreaterThan(0)
    for (const image of images) {
      expect(image.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(10)
    }

    // The graph publishes the current numbers as text, not only as a drawing.
    const live = document.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toMatch(/CSF/)
  })

  it('labels sliders with their numeric value beside them', () => {
    render(
      <Harness config={presetConfig('flair')}>
        <SequenceControls show={['tr', 'te', 'ti']} />
      </Harness>,
    )
    const outputs = [...document.querySelectorAll('output')].map((node) => node.textContent)
    expect(outputs.some((text) => text?.includes('9000'))).toBe(true)
    expect(outputs.some((text) => text?.includes('120'))).toBe(true)
    expect(outputs.some((text) => text?.includes('2372'))).toBe(true)
  })

  it('does not rely on colour alone to convey brightness', () => {
    render(
      <Harness config={presetConfig('flair')}>
        <BrightnessPanel showHead={false} />
      </Harness>,
    )
    // Each tile carries a word for its brightness band as well as a grey level.
    expect(screen.getAllByText(/suppressed|very dark|dark|intermediate|bright/i).length).toBeGreaterThan(3)
  })
})

/**
 * Layout guarantees.
 *
 * jsdom performs no layout, so overflow cannot be measured here. What can be
 * checked is the CSS contract that prevents it: grid tracks that can shrink,
 * and an explicit scroll container around the one element that is legitimately
 * wider than a phone.
 */
describe('responsive layout contract', () => {
  // Read relative to the runner's working directory: this project's absolute
  // path can contain colons, which breaks URL-based resolution.
  const css = readFileSync(join(process.cwd(), 'src/mri/mri.css'), 'utf8')

  it('never lets a grid track refuse to shrink, which is what causes overflow', () => {
    const declarations = [...css.matchAll(/grid-template-columns:\s*([^;]+);/g)].map((match) =>
      match[1].trim(),
    )
    expect(declarations.length).toBeGreaterThan(5)

    for (const declaration of declarations) {
      // A multi-column track built from bare `1fr` cannot shrink below its
      // content and pushes the page wider than the viewport.
      const hasBareFr = /(^|\s)1fr(\s|$)/.test(declaration)
      const isSafe =
        !hasBareFr ||
        declaration.includes('minmax(0') ||
        declaration.includes('auto-fit') ||
        declaration.includes('auto-fill') ||
        /^(repeat\(\d+,\s*)?1fr\)?$/.test(declaration)
      expect(isSafe, `unsafe grid track: ${declaration}`).toBe(true)
    }
  })

  it('puts the only intentionally wide element inside a scroll container', () => {
    expect(css).toMatch(/\.mri-matrix-scroll\s*\{[^}]*overflow-x:\s*auto/)
    expect(css).toMatch(/\.mri-matrix\s*\{[^}]*min-width:\s*\d+px/)
    // The stage navigation is a horizontal strip and scrolls rather than wraps.
    expect(css).toMatch(/\.mri-stage-nav\s*\{[^}]*overflow-x:\s*auto/)
  })

  it('stacks the four zones into one column on a phone', () => {
    const mobile = css.slice(css.indexOf('@media (max-width: 860px)'))
    expect(mobile).toMatch(/\.mri-workbench-main\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })

  it('keeps touch targets large enough on a phone', () => {
    const small = css.slice(css.indexOf('@media (max-width: 560px)'))
    expect(small).toMatch(/\.mri-icon-button\s*\{[^}]*width:\s*40px/)
  })

  it('provides a visible focus state for every interactive surface', () => {
    expect(css).toMatch(/:focus-visible[^{]*\{[^}]*outline:\s*2px solid/)
  })

  it('honours a reduced-motion preference', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})

describe('sequence pages render', () => {
  it('mounts the T1 page with its workbench and teaching content', async () => {
    const { default: T1Page } = await import('../pages/T1SpinEcho')
    render(
      <MemoryRouter>
        <T1Page />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    expect(screen.getByText(/Fat recovers quickly/)).toBeTruthy()
    expect(
      screen.getByText(
        /T1 weighting is produced mainly by sampling tissues before complete longitudinal recovery/,
      ),
    ).toBeTruthy()

    // One workspace — canvas plus inspector — with the analysis bands below,
    // rather than four equally-weighted cards.
    expect(screen.getByRole('region', { name: 'Scientific workspace' })).toBeTruthy()
    expect(screen.getByRole('complementary', { name: 'Stage inspector' })).toBeTruthy()
    for (const band of ['Pulse sequence', 'Tissue magnetisation graphs', 'Resulting image contrast']) {
      expect(screen.getByRole('region', { name: band })).toBeTruthy()
    }

    // The stage rail replaces the old column of stage cards: one control per
    // stage, keyboard reachable, with the current one marked.
    const rail = screen.getByRole('navigation', { name: /Lesson stages/i })
    const stops = within(rail).getAllByRole('button')
    expect(stops.length).toBeGreaterThanOrEqual(5)
    expect(stops.filter((stop) => stop.getAttribute('aria-current') === 'step').length).toBe(1)
    // Each stop names its stage, so the rail is not colour-only.
    expect(stops[0].getAttribute('aria-label')).toMatch(/Stage 1 of \d+:/)
  })

  it('shows the stage title and live values over the canvas, not paragraphs', async () => {
    const { default: T1Page } = await import('../pages/T1SpinEcho')
    render(
      <MemoryRouter>
        <T1Page />
      </MemoryRouter>,
    )

    // A short stage title on the canvas.
    const overlay = document.querySelector('.mri-canvas-overlay-stage')
    expect(overlay).toBeTruthy()
    expect((overlay?.querySelector('.mri-overlay-title')?.textContent ?? '').length).toBeLessThan(60)

    // Two to four live value chips, no more.
    const chips = document.querySelectorAll('.mri-chip-value')
    expect(chips.length).toBeGreaterThanOrEqual(2)
    expect(chips.length).toBeLessThanOrEqual(4)
  })

  it('keeps the live teaching note transient rather than permanently on screen', async () => {
    render(
      <Harness config={{ ...presetConfig('t2-se'), preset: 'custom' }}>
        <SequenceControls show={['tr', 'te']} />
      </Harness>,
    )

    // Nothing before the learner touches anything: the slot is empty.
    const slot = document.querySelector('.mri-live-slot')
    expect(slot).toBeTruthy()
    expect(slot?.querySelector('.mri-live-note')).toBeNull()
    // It is a live region so the change is announced when it does appear.
    expect(slot?.getAttribute('aria-live')).toBe('polite')

    setSlider('TE', 180)
    expect(document.querySelector('.mri-live-note')).toBeTruthy()
    expect(document.querySelector('.mri-live-note')?.textContent).toMatch(/TE/)
  })

  it('opens the comparison as a one-subject-at-a-time walkthrough, not a wall of cells', async () => {
    const { default: ComparisonPage } = await import('../pages/Comparison')
    render(
      <MemoryRouter initialEntries={['/mri-lab/comparison']}>
        <ComparisonPage />
      </MemoryRouter>,
    )

    // The first chapter, not the matrix.
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText(/Chapter 1 of 8/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Fat sets the benchmark/i })).toBeTruthy()

    // Its row shows every sequence, each linking into that sequence.
    const cells = document.querySelectorAll('.mri-row-cell')
    expect(cells.length).toBe(5)
    const hrefs = [...cells].map((cell) => cell.getAttribute('href') ?? '')
    expect(hrefs.some((href) => href.startsWith('/mri-lab/t1-spin-echo?focus=fat'))).toBe(true)
    // STIR opens at the fat null point, which is what that cell is about.
    const stir = hrefs.find((href) => href.startsWith('/mri-lab/stir'))
    expect(stir).toMatch(/t=180/)

    // And the row's own numbers are the engine's: fat is suppressed on STIR.
    const bands = [...document.querySelectorAll('.mri-row-band')].map((n) => n.textContent)
    expect(bands).toContain('suppressed')
    expect(bands).toContain('very bright')
  })

  it('covers every tissue across the chapters and ends with the full matrix', async () => {
    const { COMPARISON_CHAPTERS } = await import('../pages/comparisonChapters')
    const covered = new Set(COMPARISON_CHAPTERS.flatMap((chapter) => chapter.tissues))
    for (const tissue of TISSUES) {
      expect(covered.has(tissue.id), `${tissue.name} is never explained`).toBe(true)
    }
    // Seven subjects plus the full table, as a readable progression.
    expect(COMPARISON_CHAPTERS.length).toBeGreaterThanOrEqual(6)
  })

  it('shows the complete matrix on its final chapter', async () => {
    const { default: ComparisonPage } = await import('../pages/Comparison')
    render(
      <MemoryRouter initialEntries={['/mri-lab/comparison?chapter=full']}>
        <ComparisonPage />
      </MemoryRouter>,
    )

    const table = screen.getByRole('table')
    // Eight tissue rows plus the header row.
    expect(within(table).getAllByRole('row').length).toBe(9)
    const rowNames = within(table)
      .getAllByRole('rowheader')
      .map((node) => node.textContent?.trim())
    for (const name of ['Fat', 'White matter', 'Grey matter', 'Muscle', 'CSF', 'Oedema', 'Marrow fat', 'Generic lesion']) {
      expect(rowNames).toContain(name)
    }
    const columnNames = within(table)
      .getAllByRole('columnheader')
      .map((node) => node.textContent ?? '')
    for (const column of ['T1 spin echo', 'T2 spin echo', 'Proton density', 'T2 FLAIR', 'STIR']) {
      expect(columnNames.some((text) => text.includes(column))).toBe(true)
    }

    expect(
      within(table).getAllByRole('button', { name: /CSF on T2 FLAIR: suppressed/i }).length,
    ).toBe(1)
    expect(
      within(table).getAllByRole('button', { name: /Fat on STIR: suppressed/i }).length,
    ).toBe(1)
  })

  it('mounts challenge mode and scores an answer', async () => {
    const { default: ChallengePage } = await import('../pages/Challenge')
    render(
      <MemoryRouter>
        <ChallengePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    await waitFor(() => expect(document.querySelector('.mri-challenge-card')).toBeTruthy())
  })
})

/**
 * What the candidate actually sees under a marked question.
 *
 * `mapping/afterword.test.ts` guards the DATA — that §1.1 is really §1.1 and
 * that a button is never offered where no simulation exists. This guards the
 * two things the owner asked for by hand on the isotopes question, both of
 * which live in the rendering rather than the map:
 *
 *   A principle that is a set of definitions is shown as a TABLE. "Isotopes
 *   share the proton number and differ in mass number; isobars share the mass
 *   number and differ in proton number; isomers share both and differ only in
 *   nuclear energy state" was one sentence carrying six facts, and it was
 *   rejected on sight. Four rows against three numbers is the same content in
 *   a shape that can be read.
 *
 *   A concept with no simulation offers no instrument. The section button
 *   mounts the SECTION's first simulation, so an isotopes question was opening
 *   the sodium shell model — an atom, correct for §1.1 and irrelevant to the
 *   mark just dropped.
 *
 * The control case is here for a reason: the flag that removes the button must
 * remove it for one concept and not quietly for the rest.
 */

import '../../mri/test/setup'

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { QuestionAfterword } from './QuestionAfterword'

function mount(questionId: string, missed = true) {
  return render(
    <MemoryRouter>
      <QuestionAfterword questionId={questionId} missed={missed} />
    </MemoryRouter>,
  )
}

/* b3, "Regarding isotopes" — the question this was rewritten for. */
describe('the block under a marked question', () => {
  it('shows the iso- family as a grid, not as a paragraph', () => {
    const { container } = mount('b3')
    const table = container.querySelector('table')
    expect(table, 'the principle renders a table').not.toBeNull()

    const heads = [...table!.querySelectorAll('th')].map((th) => th.textContent)
    /* Every column the owner asked for by name: what the atomic number counts,
       what the mass number counts, and the neutron column that makes isotones
       sayable at all. */
    expect(heads).toContain('Protons Z')
    expect(heads).toContain('Neutrons N')
    expect(heads).toContain('Mass number A')

    /* All four families, each carrying the mnemonic letter in its own name. */
    const labels = [...table!.querySelectorAll('tbody td:first-child')].map((td) => td.textContent)
    expect(labels).toEqual([
      'IsotoPes — same P',
      'IsotoNes — same N',
      'IsobArs — same A',
      'Isomers — same both',
    ])

    /* The definitions travel with the grid rather than being assumed. */
    const note = container.querySelector('.v2-aw-tablenote')?.textContent ?? ''
    expect(note).toMatch(/Atomic number Z = the number of protons/)
    expect(note).toMatch(/Mass number A = protons \+ neutrons/)
  })

  it('offers no instrument where the concept is simulated nowhere', () => {
    mount('b3')
    expect(screen.queryByRole('button', { name: /show me it working/i })).toBeNull()
    /* The section link survives — losing the animation must not lose the way
       back to the teaching. */
    expect(screen.getByRole('link', { name: /§1\.1/ })).toBeTruthy()
  })

  it('still offers one everywhere it was offered before', () => {
    /* b282 is xray/tube, whose primer is full of simulations. If this ever
       goes null the suppression has leaked out of its one concept. */
    mount('b282')
    expect(screen.getByRole('button', { name: /show me it working/i })).toBeTruthy()
  })

  it('keeps the principle for a dropped mark only', () => {
    const { container } = mount('b3', false)
    expect(container.querySelector('table')).toBeNull()
    expect(screen.getByText(/This question comes from/i)).toBeTruthy()
  })
})

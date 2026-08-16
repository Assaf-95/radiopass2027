/**
 * Renders a section's primer blocks. Hierarchy is fixed here, once:
 * principle (large serif, bronze rule) > prose > structured blocks (equation,
 * relationships, numbers, trap, comparison) > film plates > folded detail.
 */

import { Fragment, useEffect, useRef, useState } from 'react'
import type { PrimerBlock, V2Sim } from '../types'

/** **bold** and \n\n paragraphs — same micro-markup the V1 content uses. */
export function Prose({ text, className = 'v2-prose' }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n\n+/)
  return (
    <div className={className}>
      {paragraphs.map((para, i) => (
        <p key={i}>
          {para.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={j}>{part.slice(2, -2)}</strong>
            ) : (
              <Fragment key={j}>{part}</Fragment>
            ),
          )}
        </p>
      ))}
    </div>
  )
}

/**
 * A same-origin iframe hosting one of the /visuals instruments, presented as a
 * mounted film. Height hugs the sim's own content; listed selectors are
 * removed once the document is ready (headers, prose panels the plate
 * replaces).
 */
function InstrumentFrame({ sim }: { sim: Extract<V2Sim, { kind: 'iframe' }> }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(sim.height ?? 560)

  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    let cancelled = false
    let tries = 0
    const dress = () => {
      if (cancelled) return
      const doc = frame.contentDocument
      const body = doc?.body
      if (!doc || !body || body.childElementCount === 0) {
        if (tries++ < 40) setTimeout(dress, 120)
        return
      }
      if (!doc.getElementById('v2-dress')) {
        // The style element doubles as the "already dressed" marker, so the
        // arrival clicks below run exactly once per document.
        const style = doc.createElement('style')
        style.id = 'v2-dress'
        style.textContent =
          (sim.hide?.length ? `${sim.hide.join(', ')} { display: none !important; }\n` : '') +
          (sim.css ?? '')
        doc.head.appendChild(style)
        for (const selector of sim.click ?? []) {
          ;(doc.querySelector(selector) as HTMLElement | null)?.click()
        }
      }
      const fit = () => {
        if (cancelled) return
        const h = Math.min(sim.height ?? 640, Math.max(320, body.scrollHeight))
        setHeight(h)
      }
      fit()
      const observer = new ResizeObserver(fit)
      observer.observe(body)
    }
    frame.addEventListener('load', dress)
    dress()
    return () => {
      cancelled = true
      frame.removeEventListener('load', dress)
    }
  }, [sim.src])

  return <iframe ref={ref} src={sim.src} title={sim.title} style={{ height }} loading="lazy" />
}

export function FilmPlate({ sim }: { sim: V2Sim }) {
  return (
    <figure className="v2-plate" style={{ margin: 0 }}>
      <div className="v2-plate-film">
        <div className="v2-plate-bar">
          <strong>{sim.title}</strong>
          {sim.annotation && <span>{sim.annotation}</span>}
        </div>
        <div className="v2-plate-stage">
          {sim.kind === 'iframe' ? (
            <InstrumentFrame sim={sim} />
          ) : (
            <div className="v2-plate-mount">{sim.element}</div>
          )}
        </div>
      </div>
      <figcaption className="v2-plate-cap">{sim.caption}</figcaption>
    </figure>
  )
}

export function PrimerBlocks({ blocks }: { blocks: PrimerBlock[] }) {
  return (
    <div className="v2-section-body">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'principle':
            return (
              <p key={i} className="v2-principle">
                {block.text}
              </p>
            )
          case 'prose':
            return <Prose key={i} text={block.text} />
          case 'equation':
            return (
              <div key={i} className="v2-equation">
                <b>{block.formula}</b>
                {block.note && <span>{block.note}</span>}
              </div>
            )
          case 'relationship':
            return (
              <div key={i} className="v2-rel">
                <table>
                  {block.title && <caption>{block.title}</caption>}
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j}>
                        <td>{row.change}</td>
                        <td>{row.effect}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'numbers':
            return (
              <div key={i} className="v2-numbers">
                {block.title && <div className="v2-tablecap">{block.title}</div>}
                <dl>
                  {block.rows.map((row, j) => (
                    <Fragment key={j}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
            )
          case 'trap':
            return (
              <div key={i} className="v2-trap">
                <span>{block.text}</span>
              </div>
            )
          case 'compare':
            return (
              <div key={i} className="v2-rel">
                <table>
                  {block.title && <caption>{block.title}</caption>}
                  <thead>
                    <tr>
                      <th />
                      <th>{block.a}</th>
                      <th>{block.b}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j}>
                        <td>{row[0]}</td>
                        <td>{row[1]}</td>
                        <td>{row[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'sim':
            return <FilmPlate key={i} sim={block.sim} />
          case 'detail':
            return (
              <details key={i} className="v2-detail">
                <summary>{block.summary}</summary>
                <Prose text={block.text} />
              </details>
            )
          default:
            return null
        }
      })}
    </div>
  )
}

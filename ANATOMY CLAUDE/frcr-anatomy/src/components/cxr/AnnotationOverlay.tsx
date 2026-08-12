import { useMemo } from 'react';
import type { CxrStructure } from '../../data/cxr/chestStructures';
import type { Placement } from '../../data/cxr/radiographs';

export interface Box {
  left: number;
  top: number;
  w: number;
  h: number;
}

export interface Placed {
  s: CxrStructure;
  p: Placement;
  side: 'left' | 'right';
  /** Final rail position after collision resolution, 0..1 of image height. */
  y: number;
}

/** Stacks the labels on each rail so none overlaps its neighbour, starting
    from where each one would like to sit and pushing down only as far as it
    must. */
export function layoutLabels(items: { s: CxrStructure; p: Placement }[]): Placed[] {
  const out: Placed[] = [];
  for (const side of ['left', 'right'] as const) {
    const mine = items
      .filter((i) => i.p.labelSide === side)
      .sort((a, b) => a.p.labelY - b.p.labelY);
    if (!mine.length) continue;
    // Gap scales with how many labels share the rail, so a full list stays
    // legible instead of running off the bottom.
    const gap = Math.min(0.052, 0.955 / mine.length);
    const ys: number[] = [];
    let last = -Infinity;
    for (const it of mine) {
      const y = Math.max(0.02, Math.max(it.p.labelY, last + gap));
      ys.push(y);
      last = y;
    }
    /* One downward pass can push the tail off the bottom. Rather than clamp —
       which piles the overflow into one spot and overlaps it — slide the whole
       run back up by however far it ran over, then re-separate upward. */
    const overflow = ys[ys.length - 1] - 0.98;
    if (overflow > 0) {
      for (let i = 0; i < ys.length; i++) ys[i] -= overflow;
      for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - gap);
      const under = 0.02 - ys[0];
      if (under > 0) for (let i = 0; i < ys.length; i++) ys[i] += under;
    }
    mine.forEach((it, i) => out.push({ s: it.s, p: it.p, side, y: ys[i] }));
  }
  return out;
}

interface Props {
  box: Box;
  placed: Placed[];
  activeId: number | null;
  hoverId: number | null;
  pulseId: number | null;
  /** Quiz hides the text but keeps one arrow. */
  quizOnly?: number | null;
  onPick: (id: number) => void;
  onHover: (id: number | null) => void;
  railGap: number;
}

export default function AnnotationOverlay({
  box,
  placed,
  activeId,
  hoverId,
  pulseId,
  quizOnly,
  onPick,
  onHover,
  railGap,
}: Props) {
  const shown = useMemo(
    () => (quizOnly != null ? placed.filter((p) => p.s.id === quizOnly) : placed),
    [placed, quizOnly]
  );

  return (
    <>
      <svg className="cxr-overlay" aria-hidden="true">
        <defs>
          <marker
            id="cxr-tip"
            viewBox="0 0 8 8"
            refX="6.4"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.4 L 6.4 4 L 0 6.6 z" />
          </marker>
        </defs>

        {shown.map((pl) => {
          const tx = box.left + pl.p.targetX * box.w;
          const ty = box.top + pl.p.targetY * box.h;
          const lx = pl.side === 'left' ? box.left - railGap : box.left + box.w + railGap;
          const ly = box.top + pl.y * box.h;
          // A gentle S: leaves the rail horizontally, arrives at the anatomy
          // along its own line, so the tip is never buried under the leader.
          const c1x = pl.side === 'left' ? lx + (tx - lx) * 0.55 : lx - (lx - tx) * 0.55;
          const on = activeId === pl.s.id || hoverId === pl.s.id;
          const cls = [
            'cxr-leader',
            on ? 'is-on' : '',
            pulseId === pl.s.id ? 'is-pulse' : '',
            quizOnly != null ? 'is-quiz' : '',
            pl.p.uncertain ? 'is-uncertain' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <g key={pl.s.id} className={cls}>
              <path
                d={`M ${lx} ${ly} C ${c1x} ${ly}, ${c1x} ${ty}, ${tx} ${ty}`}
                fill="none"
                markerEnd="url(#cxr-tip)"
              />
              <circle cx={tx} cy={ty} r={on ? 3.4 : 2.2} />
            </g>
          );
        })}
      </svg>

      {quizOnly == null &&
        shown.map((pl) => (
          <button
            type="button"
            key={pl.s.id}
            className={[
              'cxr-label',
              `cxr-label-${pl.side}`,
              activeId === pl.s.id || hoverId === pl.s.id ? 'is-on' : '',
              pl.p.uncertain ? 'is-uncertain' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              top: box.top + pl.y * box.h,
              ...(pl.side === 'left'
                ? { right: `calc(100% - ${box.left - railGap - 6}px)` }
                : { left: box.left + box.w + railGap + 6 }),
            }}
            onMouseEnter={() => onHover(pl.s.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(pl.s.id)}
            onBlur={() => onHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              onPick(pl.s.id);
            }}
          >
            {pl.s.shortName}
            {pl.p.uncertain && (
              <span className="cxr-flag" title="Edge inferred rather than sharply seen">
                ?
              </span>
            )}
          </button>
        ))}
    </>
  );
}

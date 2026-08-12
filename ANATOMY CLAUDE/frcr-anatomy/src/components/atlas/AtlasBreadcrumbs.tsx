import { Link } from 'react-router-dom';

/* Structure Atlas / Thorax / Right ventricle — every step of it a link back.
   On a phone the trail collapses to a single "back to the level above"
   control, because a three-level trail in 320 pixels is unreadable. */

export interface Crumb {
  label: string;
  to?: string;
}

export default function AtlasBreadcrumbs({ trail }: { trail: Crumb[] }) {
  const parent = [...trail].reverse().find((c) => c.to);

  return (
    <div className="atlas-crumbs-row">
      {parent && (
        <Link className="atlas-back back-link" to={parent.to!}>
          ← {parent.label}
        </Link>
      )}
      <nav className="atlas-crumbs mono" aria-label="Breadcrumb">
        {trail.map((c, i) => (
          <span key={`${c.label}-${i}`}>
            {i > 0 && <span className="atlas-crumb-sep" aria-hidden="true">/</span>}
            {c.to ? (
              <Link to={c.to}>{c.label}</Link>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}

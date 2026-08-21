/* A harness for verifying the shell in a browser. Not linked from anywhere;
   reachable only by typing the route. Deleted once real pages are migrated. */
import { Shell } from './Shell'

export default function ShellPreview() {
  return (
    <Shell trail={[{ label: 'Atlas', to: '/anatomy/atlas' }, { label: 'Thorax' }]}>
      <p className="rp-label-lg">Anatomy &middot; Library</p>
      <h1 className="rp-display-l">Thorax</h1>
      <p className="rp-body-l rp-prose" style={{ marginTop: 16 }}>
        Cross-sectional and projectional anatomy, learned by region and by modality.
        This paragraph exists to check the reading measure and the body contrast at
        AAA, which is what a candidate reads for three hours at a time.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginTop: 40 }}>
        {['Mediastinum', 'Hila and vessels', 'Pleura and fissures'].map((t) => (
          <a key={t} className="rp-tile" href="#top" style={{ padding: 20, textDecoration: 'none', display: 'block' }}>
            <span className="rp-rule" style={{ display: 'block', marginBottom: 14 }} />
            <span className="rp-tt rp-h3" style={{ display: 'block' }}>{t}</span>
            <span className="rp-meta" style={{ display: 'block', marginTop: 10 }}>24 cases</span>
          </a>
        ))}
      </div>
    </Shell>
  )
}

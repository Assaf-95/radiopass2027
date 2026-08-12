/* Blocks an authoring route for anyone who has not signed in as the author. */
import { Link } from 'react-router-dom';
import { isAdmin } from '../lib/admin';

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  if (isAdmin()) return <>{children}</>;
  return (
    <div className="empty-state">
      <h1>Authoring only</h1>
      <p>This page edits question content, so it is available to the author only.</p>
      <Link className="btn btn-primary" to="/admin">Author sign-in</Link>
    </div>
  );
}

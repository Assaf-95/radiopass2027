import { Link } from 'react-router-dom';
import { SECTION_META } from '../data/sections';
import { computeSectionStats } from '../lib/stats';
import { resetAllProgress } from '../lib/progress';
import { allQuizzes, currentStreak, getActivity } from '../lib/account';
import { useState } from 'react';
import './Dashboard.css';

export default function Dashboard() {
  const [confirmReset, setConfirmReset] = useState(false);
  const allStats = SECTION_META.map((s) => ({ meta: s, stats: computeSectionStats(s.id) }));
  const totals = allStats.reduce(
    (acc, { stats }) => ({
      total: acc.total + stats.total,
      attempted: acc.attempted + stats.attempted,
      fullyCorrect: acc.fullyCorrect + stats.fullyCorrect,
      partiallyCorrect: acc.partiallyCorrect + stats.partiallyCorrect,
      incorrect: acc.incorrect + stats.incorrect,
      rawScore: acc.rawScore + stats.rawScore,
      maxScore: acc.maxScore + stats.maxScore,
    }),
    { total: 0, attempted: 0, fullyCorrect: 0, partiallyCorrect: 0, incorrect: 0, rawScore: 0, maxScore: 0 }
  );

  const activity = getActivity();
  const streak = currentStreak(activity.days);
  const quizzes = allQuizzes();
  const quizAttempts = Object.values(quizzes).reduce((n, q) => n + q.attempts, 0);
  const quizCorrect = Object.values(quizzes).reduce((n, q) => n + q.correct, 0);
  const hours = Math.floor(activity.secondsStudied / 3600);
  const mins = Math.round((activity.secondsStudied % 3600) / 60);

  return (
    <div className="dash">
      <Link to="/" className="back-link">← Back to sections</Link>
      <h1>Progress dashboard</h1>

      {activity.lastActive && (
        <p className="dash-who">
          This browser's record · last studied {new Date(activity.lastActive).toLocaleString()}
        </p>
      )}

      <div className="dash-overall card">
        <div className="dash-overall-item">
          <span className="dash-value">{streak}</span>
          <span className="dash-label">Day streak</span>
        </div>
        <div className="dash-overall-item">
          <span className="dash-value">{activity.days.length}</span>
          <span className="dash-label">Days studied</span>
        </div>
        <div className="dash-overall-item">
          <span className="dash-value">{hours ? `${hours}h ${mins}m` : `${mins}m`}</span>
          <span className="dash-label">Time studied</span>
        </div>
        <div className="dash-overall-item">
          <span className="dash-value">{quizAttempts ? `${quizCorrect}/${quizAttempts}` : '—'}</span>
          <span className="dash-label">Atlas quiz</span>
        </div>
      </div>

      <div className="dash-overall card">
        <div className="dash-overall-item">
          <span className="dash-value">{totals.attempted}/{totals.total}</span>
          <span className="dash-label">Questions attempted</span>
        </div>
        <div className="dash-overall-item">
          <span className="dash-value">{totals.maxScore > 0 ? Math.round((totals.rawScore / totals.maxScore) * 100) : 0}%</span>
          <span className="dash-label">Overall score</span>
        </div>
        <div className="dash-overall-item">
          <span className="dash-value">{totals.rawScore}/{totals.maxScore}</span>
          <span className="dash-label">Raw marks</span>
        </div>
        <div className="dash-overall-item">
          <span className="dash-value">{totals.fullyCorrect}</span>
          <span className="dash-label">Fully correct</span>
        </div>
      </div>

      <table className="dash-table">
        <thead>
          <tr>
            <th>Section</th><th>Total</th><th>Attempted</th><th>Correct</th><th>Partial</th><th>Incorrect</th><th>Score</th><th>%</th><th>Flagged</th><th></th>
          </tr>
        </thead>
        <tbody>
          {allStats.map(({ meta, stats }) => (
            <tr key={meta.id}>
              <td className="dash-section-name">{meta.title}</td>
              <td>{stats.total}</td>
              <td>{stats.attempted}</td>
              <td className="tone-green">{stats.fullyCorrect}</td>
              <td className="tone-amber">{stats.partiallyCorrect}</td>
              <td className="tone-red">{stats.incorrect}</td>
              <td>{stats.rawScore}/{stats.maxScore}</td>
              <td>{stats.percentScore}%</td>
              <td>{stats.flagged}</td>
              <td><Link className="btn" to={`/section/${meta.id}`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="dash-danger">
        {!confirmReset ? (
          <button className="review-chip danger" onClick={() => setConfirmReset(true)}>Reset entire examination</button>
        ) : (
          <div className="confirm-bar card">
            <span>Reset ALL progress across every section? This cannot be undone.</span>
            <div className="confirm-actions">
              <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { resetAllProgress(); window.location.reload(); }}>Confirm reset all</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

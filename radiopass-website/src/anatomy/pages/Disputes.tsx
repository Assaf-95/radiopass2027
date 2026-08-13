import { Link } from 'react-router-dom';
import { useState } from 'react';
import { loadDisputes, updateDispute } from '../lib/progress';
import type { LabelResult } from '../types';
import './Disputes.css';

export default function Disputes() {
  const [disputes, setDisputes] = useState(loadDisputes());

  function accept(id: string, keepAutomatic: boolean, current: { automaticResult: LabelResult; automaticScore: number }) {
    updateDispute(id, {
      manualOverride: {
        result: keepAutomatic ? current.automaticResult : 'correct',
        score: keepAutomatic ? current.automaticScore : 2,
        overriddenAt: new Date().toISOString(),
      },
    });
    setDisputes(loadDisputes());
  }

  return (
    <div className="disp">
      <Link to="/anatomy" className="back-link">← Back to sections</Link>
      <h1>Disputed answers</h1>
      {disputes.length === 0 ? (
        <div className="empty-state card"><p>No disputes have been raised yet. Use "Dispute this result" beside any graded answer to flag it here.</p></div>
      ) : (
        <div className="disp-list">
          {disputes.slice().reverse().map((d) => (
            <div className="disp-card card" key={d.id}>
              <div className="disp-head">
                <span className="pill">{d.section}</span>
                <span className="pill">{d.modality}</span>
                <span className="pill">Q{d.questionNumber} · {d.label}</span>
                <span className="disp-source">{d.sourceFile} p.{Array.isArray(d.sourcePage) ? d.sourcePage.join('-') : d.sourcePage}</span>
              </div>
              <p><strong>Your answer:</strong> {d.userAnswer || <em>blank</em>}</p>
              <p><strong>Correct answer:</strong> {d.officialAnswer}</p>
              <p><strong>Automatic result:</strong> {d.automaticResult} ({d.automaticScore}/2) — {d.reason}</p>
              <p className="disp-note"><strong>Your note:</strong> {d.disputeNote || <em>none provided</em>}</p>
              {d.manualOverride ? (
                <p className="disp-override">Manually overridden to <strong>{d.manualOverride.result}</strong> ({d.manualOverride.score}/2) on {new Date(d.manualOverride.overriddenAt).toLocaleString()}. Original automatic result preserved above.</p>
              ) : (
                <div className="disp-actions">
                  <button className="btn" onClick={() => accept(d.id, true, d)}>Keep automatic result</button>
                  <button className="btn btn-primary" onClick={() => accept(d.id, false, d)}>Accept my answer as correct</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

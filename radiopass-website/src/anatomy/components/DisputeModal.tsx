import { useState } from 'react';
import type { GradedAnswer } from '../types';
import './DisputeModal.css';

interface Props {
  label: string;
  graded: GradedAnswer;
  onClose: () => void;
  onSubmit: (note: string) => void;
}

export default function DisputeModal({ label, graded, onClose, onSubmit }: Props) {
  const [note, setNote] = useState('');
  return (
    <div className="dm-backdrop" onClick={onClose}>
      <div className="dm-panel card" onClick={(e) => e.stopPropagation()}>
        <h3>Dispute grading — {label}</h3>
        <div className="dm-details">
          <p><strong>Your answer:</strong> {graded.userAnswer || <em>blank</em>}</p>
          <p><strong>Correct answer:</strong> {graded.officialAnswer}</p>
          <p><strong>Automatic result:</strong> {graded.result} ({graded.score}/{graded.maxScore})</p>
          <p><strong>Reason given:</strong> {graded.reason}</p>
        </div>
        <label className="dm-note-label" htmlFor="dispute-note">Your note (why you believe this should be marked differently)</label>
        <textarea id="dispute-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
        <div className="dm-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSubmit(note)}>Submit dispute</button>
        </div>
      </div>
    </div>
  );
}

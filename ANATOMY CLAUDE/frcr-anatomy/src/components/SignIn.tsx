import { useState } from 'react';
import { signIn, storageWorks, type Plan } from '../lib/account';
import './SignIn.css';

interface Props {
  onSignedIn: () => void;
}

/** The gate into the app. It is deliberately not pretending to authenticate
    against anything — there is no server — but the account it creates is real
    and everything the learner does from here is kept against it. */
export default function SignIn({ onSignedIn }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [plan, setPlan] = useState<Plan>('pass');
  const persists = storageWorks();

  return (
    <div className="signin">
      <div className="signin-card">
        <p className="eyebrow">RadioPass · Anatomy</p>
        <h1>Sign in to continue</h1>
        <p className="signin-sub">
          Your answers, marks and progress are kept on this device and are still here when you come
          back.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            signIn(name.trim(), email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, '.')}@example.com`, plan);
            onSignedIn();
          }}
        >
          <label className="signin-field">
            <span>Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </label>
          <label className="signin-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@hospital.nhs.uk"
            />
          </label>
          <label className="signin-field">
            <span>Plan</span>
            <select value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
              <option value="pass">Pass — full question bank</option>
              <option value="pass-plus">Pass Plus — bank, atlases and viewers</option>
              <option value="trial">Trial</option>
            </select>
          </label>
          <button type="submit" className="btn btn-primary signin-go">
            Start studying
          </button>
        </form>

        {!persists && (
          <p className="signin-warn">
            This browser is not storing data — private browsing, most likely. You can work, but
            nothing will be here when you come back.
          </p>
        )}
        <p className="signin-note">
          No password, and nothing leaves this browser. Progress lives in this browser's storage on
          this machine, so it survives quitting and restarting — but not clearing site data, and it
          does not follow you to another device.
        </p>
      </div>
    </div>
  );
}

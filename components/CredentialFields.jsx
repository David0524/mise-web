"use client";
import { useState } from "react";
import { PASSWORD_RULES, passwordProblems, checkEmail } from "@/lib/credentials";

/* Email with a one-tap fix for common typos ("gmial.com"). Checked when you
   leave the field, not on every keystroke. */
export function EmailField({ id = "email", value, onChange, label = "Email", className = "" }) {
  const [touched, setTouched] = useState(false);
  const res = value ? checkEmail(value) : { ok: false };
  const show = touched && value && !res.ok;
  return (
    <div className={`cf ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="email" autoComplete="email" required value={value} inputMode="email"
        aria-invalid={show || undefined} aria-describedby={show ? `${id}-msg` : undefined}
        onChange={(e) => onChange(e.target.value)} onBlur={() => setTouched(true)} />
      {show && (
        <p id={`${id}-msg`} className="cf__msg" role="alert">
          {res.suggestion
            ? <>Did you mean <button type="button" className="cf__fix" onClick={() => onChange(res.suggestion)}>{res.suggestion}</button>?</>
            : res.error}
        </p>
      )}
    </div>
  );
}

/* New password + confirm. The rules appear as a short checklist once you
   start typing, and tick off as they're met. */
export function NewPasswordFields({ password, setPassword, confirm, setConfirm, email = "", idPrefix = "pw" }) {
  const [confirmTouched, setConfirmTouched] = useState(false);
  const probs = passwordProblems(password, email);
  const mismatch = confirm && confirm !== password;
  return (
    <div className="cf">
      <label htmlFor={`${idPrefix}-new`}>Password</label>
      <input id={`${idPrefix}-new`} type="password" autoComplete="new-password" required value={password}
        aria-describedby={`${idPrefix}-rules`} onChange={(e) => setPassword(e.target.value)} />
      {password && (
        <ul id={`${idPrefix}-rules`} className="cf__rules" aria-live="polite">
          {PASSWORD_RULES.map(([k, label, test]) => (
            <li key={k} className={test(password) ? "cf__ok" : ""}><span aria-hidden="true">{test(password) ? "✓" : "○"}</span> {label}</li>
          ))}
          {probs.filter((p) => !PASSWORD_RULES.some(([, l]) => l === p)).map((p) => (
            <li key={p} className="cf__bad"><span aria-hidden="true">✕</span> {p}</li>
          ))}
        </ul>
      )}
      <label htmlFor={`${idPrefix}-confirm`}>Confirm password</label>
      <input id={`${idPrefix}-confirm`} type="password" autoComplete="new-password" required value={confirm}
        aria-invalid={(confirmTouched && mismatch) || undefined}
        onChange={(e) => setConfirm(e.target.value)} onBlur={() => setConfirmTouched(true)} />
      {confirmTouched && mismatch && <p className="cf__msg" role="alert">Passwords don&apos;t match.</p>}
      <style dangerouslySetInnerHTML={{ __html: CF_CSS }} />
    </div>
  );
}

/* For the submit button. */
export function credentialsReady({ email, password, confirm, needEmail = true }) {
  return (!needEmail || checkEmail(email).ok) && passwordProblems(password, email).length === 0 && confirm === password;
}

const CF_CSS = `
.cf__rules{list-style:none;margin:.45rem 0 0;padding:0;display:flex;flex-wrap:wrap;gap:.3rem .8rem;font:700 .8rem 'Nunito',system-ui,sans-serif;color:#72645C}
.cf__rules li span{display:inline-block;width:1em;text-align:center}
.cf__ok{color:#1F6B45}
.cf__bad{color:#7A2E1B}
.cf__msg{margin:.35rem 0 0;font:700 .85rem 'Nunito',system-ui,sans-serif;color:#7A2E1B}
.cf__fix{background:none;border:0;padding:0;font:inherit;color:#9A3B1B;text-decoration:underline;cursor:pointer}
`;

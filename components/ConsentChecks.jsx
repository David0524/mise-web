"use client";

/* The two boxes every new account ticks: unticked by default, both required. */
const check = { display: "flex", gap: ".6rem", alignItems: "flex-start", marginTop: 12, fontWeight: 700, fontSize: ".92rem", lineHeight: 1.45, color: "#3B302A", cursor: "pointer", textAlign: "left", fontFamily: "'Nunito', system-ui, sans-serif" };
const box = { width: 22, height: 22, margin: "1px 0 0", flex: "0 0 auto", accentColor: "#B44722" };
const link = { color: "#9A3B1B", fontWeight: 800 };

export default function ConsentChecks({ adult, setAdult, terms, setTerms }) {
  return (
    <div>
      <label style={check}>
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} style={box} />
        <span>I&apos;m 18 or older.</span>
      </label>
      <label style={check}>
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={box} />
        <span>
          I agree to the <a href="/terms" target="_blank" rel="noopener" style={link}>Terms of Service</a> and
          have read the <a href="/privacy" target="_blank" rel="noopener" style={link}>Privacy Policy</a>.
        </span>
      </label>
    </div>
  );
}

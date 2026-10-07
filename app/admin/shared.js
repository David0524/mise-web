import { getSessionUserId } from "@/lib/auth";
import { query } from "@/lib/db";

/* Shared by the stats page (/admin) and the per-person page (/admin/u/[id]):
   the owner-only guard, the recipe rendering and the page styles. */

const admins = () =>
  (process.env.ADMIN_EMAILS || "drudd524@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function isAdmin() {
  const userId = await getSessionUserId();
  if (!userId) return false;
  const { rows } = await query(`select email from users where id = $1`, [userId]);
  return !!rows[0]?.email && admins().includes(rows[0].email.toLowerCase());
}

export const str = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
export function Recipe({ r }) {
  const rec = r.recipe || {};
  const comps = Array.isArray(rec.components) ? rec.components : [];
  const steps = Array.isArray(rec.steps) ? rec.steps : [];
  return (
    <details className="ad__rec">
      <summary>{str(rec.title) || "(untitled)"} <span className="ad__tag">{r.kind}</span> <span className="ad__when">{fmtDay(r.at)}</span></summary>
      <p className="ad__meta">{[str(rec.servings) && `Serves ${str(rec.servings)}`, str(rec.time)].filter(Boolean).join(" · ")}</p>
      {comps.map((c, i) => (
        <div key={i}><strong>{str(c?.name)}</strong>
          <ul>{(Array.isArray(c?.items) ? c.items : []).map((it, j) => <li key={j}>{str(it)}</li>)}</ul></div>
      ))}
      {steps.length > 0 && <ol>{steps.map((st, i) => <li key={i}>{str(st?.do || st)}{str(st?.why) && <em> — {str(st.why)}</em>}</li>)}</ol>}
      {str(rec.assembly) && <p><strong>To serve:</strong> {str(rec.assembly)}</p>}
    </details>
  );
}

export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");
export const ago = (d) => {
  if (!d) return "never";
  const h = (Date.now() - new Date(d).getTime()) / 3.6e6;
  return h < 1 ? "just now" : h < 24 ? `${Math.floor(h)}h ago` : `${Math.floor(h / 24)}d ago`;
};

export const fmtWhen = (d) => (d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

/* "ideas (from shop) · iPhone Safari 17 · 390x844 · abc1234": the context the
   app attaches to feedback and error reports, on one line. */
export function ctxLine(c) {
  if (!c || typeof c !== "object") return "";
  const view = c.view ? (c.from ? `${c.view} (from ${c.from})` : c.view) : "";
  return [view, c.agent, c.viewport, c.build].filter(Boolean).join(" · ");
}

/* Days as YYYY-MM-DD in UTC, oldest first, ending today, so a day with no
   rows still gets a (zero) bar instead of the axis skipping it. */
export function lastDays(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i)).toISOString().slice(0, 10));
  return out;
}

/* A plain bar chart, drawn inline: one bar per day. No chart library, and
   colours come from the page's own variables so dark mode just works. */
export function DailyBars({ data, title, desc }) {
  const W = 600, H = 150, top = 18, bottom = 24;
  const max = Math.max(1, ...data.map((d) => d.n));
  const bw = W / data.length;
  const y = (n) => H - bottom - (n / max) * (H - top - bottom);
  return (
    <svg className="ad__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="dau-t dau-d">
      <title id="dau-t">{title}</title>
      <desc id="dau-d">{desc}</desc>
      <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} className="ad__axis" />
      <text x="2" y="13" className="ad__lbl">{`max ${max}`}</text>
      {data.map((d, i) => (
        <g key={d.day}>
          <rect x={i * bw + bw * 0.15} width={bw * 0.7} y={y(d.n)} height={Math.max(d.n ? 2 : 0, H - bottom - y(d.n))} rx="2" className="ad__barv">
            <title>{`${d.day}: ${d.n}`}</title>
          </rect>
          {/* A date under every seventh bar, counting back from today. */}
          {i % 7 === (data.length - 1) % 7 && (
            <text x={i === data.length - 1 ? W - 2 : i * bw + bw / 2} y={H - 6} textAnchor={i === data.length - 1 ? "end" : "middle"} className="ad__lbl">{d.day.slice(5).replace("-", "/")}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export const CSS = `
:root{--ad-bg:#FBF7F2;--ad-ink:#2A211C;--ad-mute:#72645C;--ad-line:#E6DCD2;--ad-card:#fff;--ad-acc:#C2492A}
@media (prefers-color-scheme: dark){:root{--ad-bg:#1C1714;--ad-ink:#F3ECE6;--ad-mute:#B3A69D;--ad-line:#3A302A;--ad-card:#26201C;--ad-acc:#E7764F}}
body{background:var(--ad-bg)}
.ad{max-width:980px;margin:0 auto;padding:24px 16px 64px;color:var(--ad-ink);font:500 15px/1.45 'Nunito',system-ui,sans-serif}
.ad h1{font-size:1.8rem;margin:0 0 .2rem}
.ad h2{font-size:1.15rem;margin:2rem 0 .6rem}
.ad__sub{color:var(--ad-mute);margin:0 0 1rem}
.ad__tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.ad__tile{background:var(--ad-card);border:1px solid var(--ad-line);border-radius:14px;padding:14px 16px}
.ad__n{font-size:1.9rem;font-weight:800;font-variant-numeric:tabular-nums}
.ad__l{font-weight:800}
.ad__s{color:var(--ad-mute);font-size:.85rem}
.ad__scroll{overflow-x:auto}
.ad__t{width:100%;border-collapse:collapse;background:var(--ad-card);border:1px solid var(--ad-line);border-radius:12px;overflow:hidden}
.ad__t th,.ad__t td{padding:8px 10px;border-bottom:1px solid var(--ad-line);text-align:left;vertical-align:top}
.ad__t th{font-size:.8rem;color:var(--ad-mute);font-weight:800;white-space:nowrap}
.ad__num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.ad__barcell{width:40%}
.ad__who{background:var(--ad-card);border:1px solid var(--ad-line);border-radius:12px;padding:10px 14px;margin:0 0 8px}
.ad__who>summary{cursor:pointer}
.ad__rec{border-top:1px solid var(--ad-line);padding:8px 0 4px;margin-top:8px}
.ad__rec>summary{cursor:pointer;font-weight:700}
.ad__tag{font-size:.75rem;font-weight:800;color:var(--ad-acc);text-transform:uppercase;margin-left:.4rem}
.ad__when{color:var(--ad-mute);font-size:.85rem;margin-left:.3rem}
.ad__meta{color:var(--ad-mute);margin:.3rem 0}
.ad__rec ul,.ad__rec ol{margin:.3rem 0 .6rem 1.2rem;padding:0}
.ad__bar{display:block;height:10px;border-radius:5px;background:var(--ad-acc);min-width:2px}
.ad__chart{display:block;width:100%;height:auto;background:var(--ad-card);border:1px solid var(--ad-line);border-radius:12px;padding:8px;box-sizing:border-box;margin-top:12px}
.ad__barv{fill:var(--ad-acc)}
.ad__axis{stroke:var(--ad-line);stroke-width:1}
.ad__lbl{fill:var(--ad-mute);font-size:14px;font-weight:700}
.ad a{color:var(--ad-acc);font-weight:700}
.ad__msg{white-space:pre-wrap;overflow-wrap:anywhere;min-width:14rem}
.ad__ctx{color:var(--ad-mute);font-size:.82rem}
.ad__err{overflow-wrap:anywhere;min-width:14rem}
.ad__stack{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.4 ui-monospace,Menlo,monospace;color:var(--ad-mute);margin:.4rem 0 0;max-height:18rem;overflow:auto}
.ad__ok{color:var(--ad-mute)}
.ad__bad{color:var(--ad-acc);font-weight:800}
.ad__kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.ad__back{display:inline-block;margin-bottom:.6rem}
.ad h1{overflow-wrap:anywhere}
.ad__t td.ad__d{white-space:nowrap}
`;

import { notFound } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

/* Private stats page: how testers use Mise. Only accounts whose email is in
   ADMIN_EMAILS (comma-separated; defaults to the owner) can open it; everyone
   else gets a plain 404, so the page doesn't advertise that it exists.
   Read-only: every number comes from tables the app already keeps plus the
   events table (lib/events.js). */
export const dynamic = "force-dynamic";
export const metadata = { title: "Stats — Mise", robots: { index: false, follow: false } };

const admins = () =>
  (process.env.ADMIN_EMAILS || "drudd524@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

async function isAdmin() {
  const userId = await getSessionUserId();
  if (!userId) return false;
  const { rows } = await query(`select email from users where id = $1`, [userId]);
  return !!rows[0]?.email && admins().includes(rows[0].email.toLowerCase());
}

const rows = async (sql, params = []) => (await query(sql, params)).rows;


const FEATURES = [
  ["week_planned", "Planned a week"], ["dish_swapped", "Swapped a dish"], ["feedback_sent", "Asked for different ideas"],
  ["list_built", "Built a shopping list"], ["list_edited", "Edited the list with Mise"],
  ["recipe_opened", "Opened a new recipe"], ["recipe_change_asked", "Asked to change a recipe"], ["recipe_changed", "Applied a recipe change"],
  ["ask_mise", "Asked Mise a question"], ["timer_started", "Started a timer"], ["voice_used", "Used voice"],
  ["printed", "Printed"], ["leftovers", "Leftover ideas"], ["dish_rated", "Rated a dish"],
  ["cook_again", "Cooked something again"], ["new_week", "Started a new week"],
];

async function load() {
  await ensureSchema();
  const [totals] = await rows(`
    select (select count(*) from users)::int as users,
           (select count(*) from users where created_at > now() - interval '7 days')::int as new7,
           (select count(distinct user_id) from events where user_id is not null and created_at > now() - interval '1 day')::int as active1,
           (select count(distinct user_id) from events where user_id is not null and created_at > now() - interval '7 days')::int as active7,
           (select count(*) from events where name = 'week_planned' and created_at > now() - interval '7 days')::int as weeks7,
           (select coalesce(sum(count), 0) from api_usage where bucket = 'chat:86400' and window_start > now() - interval '1 day')::int as ai1,
           (select coalesce(sum(count), 0) from api_usage where bucket = 'chat:86400' and window_start > now() - interval '7 days')::int as ai7`);

  const onboard = await rows(`
    select props->>'at' as at, (props->>'step')::int as step, count(*)::int as n
      from events where name = 'onboard' and created_at > now() - interval '30 days'
     group by 1, 2`);
  const [conv] = await rows(`
    select count(*) filter (where name = 'signup')::int as signups,
           count(*) filter (where name = 'paywall_view')::int as paywall,
           count(distinct user_id) filter (where name = 'code_redeemed')::int as codes,
           count(distinct user_id) filter (where name = 'checkout_started')::int as checkouts
      from events where created_at > now() - interval '30 days'`);

  const features = await rows(`
    select name, count(*)::int as n, count(distinct user_id)::int as people
      from events where user_id is not null and created_at > now() - interval '30 days'
     group by name`);
  const screens = await rows(`
    select props->>'v' as v, count(*)::int as n, count(distinct user_id)::int as people
      from events where name = 'view' and created_at > now() - interval '30 days'
     group by 1 order by n desc limit 12`);

  const people = await rows(`
    select u.id, coalesce(u.email, u.phone, '(no email)') as who, u.created_at,
           s.access_code is not null as has_code, s.status,
           (select max(created_at) from events e where e.user_id = u.id) as last_seen,
           (select count(distinct date_trunc('day', created_at)) from events e where e.user_id = u.id)::int as days_active,
           (select count(*) from events e where e.user_id = u.id and e.name = 'week_planned')::int as weeks,
           (select count(*) from events e where e.user_id = u.id and e.name = 'recipe_opened')::int as recipes,
           (select count(*) from events e where e.user_id = u.id and e.name = 'ask_mise')::int as asks,
           (select coalesce(sum(count), 0) from api_usage a where a.user_id = u.id and a.bucket = 'chat:86400'
              and a.window_start > now() - interval '7 days')::int as ai7
      from users u left join subscriptions s on s.user_id = u.id
     order by last_seen desc nulls last, u.created_at desc
     limit 200`);

  // Ratings ride inside the profile blob (favorites), newest last.
  const rated = await rows(`
    select coalesce(u.email, u.phone, '(no email)') as who, f->>'title' as title, (f->>'rating')::int as rating,
           f->>'missing' as missing, f->>'note' as note, f->>'date' as date
      from profiles p join users u on u.id = p.user_id,
           jsonb_array_elements(coalesce(p.data->'favorites', '[]'::jsonb)) f
     order by f->>'date' desc nulls last limit 60`);

  /* Every recipe per person: the log of what Mise wrote (since it started),
     plus anything still saved in their current week or history from before,
     de-duplicated by title. */
  const logged = await rows(`
    select coalesce(u.email, u.phone, '(no email)') as who, r.kind, r.recipe, r.created_at as at
      from recipe_log r join users u on u.id = r.user_id
     order by r.created_at desc limit 3000`);
  const saved = await rows(`
    select coalesce(u.email, u.phone, '(no email)') as who, 'saved' as kind, x.value as recipe, c.updated_at as at
      from current_weeks c join users u on u.id = c.user_id,
           jsonb_each(case when jsonb_typeof(c.data->'recipes') = 'object' then c.data->'recipes' else '{}'::jsonb end) x
    union all
    select coalesce(u.email, u.phone, '(no email)'), 'saved', d->'recipe', (w->>'startedAt')::timestamptz
      from histories h join users u on u.id = h.user_id,
           jsonb_array_elements(case when jsonb_typeof(h.data) = 'array' then h.data else '[]'::jsonb end) w,
           jsonb_array_elements(case when jsonb_typeof(w->'dishes') = 'array' then w->'dishes' else '[]'::jsonb end) d
     where jsonb_typeof(d->'recipe') = 'object'`).catch(() => []);
  const recipes = new Map();
  for (const r of [...logged, ...saved]) {
    if (!r.recipe || typeof r.recipe !== "object") continue;
    const list = recipes.get(r.who) || [];
    const key = `${String(r.recipe.title || "").toLowerCase()}|${r.kind}`;
    if (r.kind === "saved" && list.some((x) => String(x.recipe.title || "").toLowerCase() === key.split("|")[0])) continue;
    if (!list.some((x) => x.key === key && x.at === r.at)) list.push({ ...r, key });
    recipes.set(r.who, list);
  }

  return { totals, onboard, conv, features, screens, people, rated, recipes: [...recipes.entries()] };
}

const str = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
function Recipe({ r }) {
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

const fmtDay = (d) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");
const ago = (d) => {
  if (!d) return "never";
  const h = (Date.now() - new Date(d).getTime()) / 3.6e6;
  return h < 1 ? "just now" : h < 24 ? `${Math.floor(h)}h ago` : `${Math.floor(h / 24)}d ago`;
};

export default async function AdminPage() {
  if (!(await isAdmin().catch(() => false))) notFound();
  const d = await load();
  const t = d.totals;

  // Onboarding funnel: each screen, setup broken out by step.
  const count = (at, step) => d.onboard.filter((r) => r.at === at && (step == null || r.step === step)).reduce((n, r) => n + r.n, 0);
  const setupSteps = [...new Set(d.onboard.filter((r) => r.at === "setup").map((r) => r.step))].sort((a, b) => a - b);
  const funnel = [
    ["Opened onboarding", count("start")],
    ...setupSteps.map((s) => [`Setup step ${s + 1}`, count("setup", s)]),
    ["Tour", count("tour")],
    ["Create-account screen", count("account")],
    ["Signed up", d.conv.signups],
    ["Saw the paywall", d.conv.paywall],
    ["Redeemed a code", d.conv.codes],
    ["Started checkout", d.conv.checkouts],
  ];
  const top = Math.max(1, ...funnel.map(([, n]) => n));
  const feat = Object.fromEntries(d.features.map((f) => [f.name, f]));

  return (
    <main className="ad">
      <h1>Mise stats</h1>
      <p className="ad__sub">Private. Last 30 days unless noted. Onboarding counts screens shown, so one person going back and forth counts more than once.</p>

      <section className="ad__tiles">
        {[
          ["Accounts", t.users, `${t.new7} new this week`],
          ["Active today", t.active1, `${t.active7} this week`],
          ["Weeks planned", t.weeks7, "this week"],
          ["AI calls", t.ai1, `today · ${t.ai7} this week`],
        ].map(([label, n, sub]) => (
          <div className="ad__tile" key={label}><div className="ad__n">{n}</div><div className="ad__l">{label}</div><div className="ad__s">{sub}</div></div>
        ))}
      </section>

      <h2>Onboarding</h2>
      <table className="ad__t">
        <tbody>
          {funnel.map(([label, n]) => (
            <tr key={label}><td>{label}</td><td className="ad__num">{n}</td>
              <td className="ad__barcell"><span className="ad__bar" style={{ width: `${(n / top) * 100}%` }} /></td></tr>
          ))}
        </tbody>
      </table>

      <h2>Features</h2>
      <table className="ad__t">
        <thead><tr><th>What</th><th className="ad__num">Times</th><th className="ad__num">People</th></tr></thead>
        <tbody>
          {FEATURES.map(([k, label]) => (
            <tr key={k}><td>{label}</td><td className="ad__num">{feat[k]?.n || 0}</td><td className="ad__num">{feat[k]?.people || 0}</td></tr>
          ))}
        </tbody>
      </table>

      {d.screens.length > 0 && (<>
        <h2>Screens</h2>
        <table className="ad__t">
          <thead><tr><th>Screen</th><th className="ad__num">Visits</th><th className="ad__num">People</th></tr></thead>
          <tbody>{d.screens.map((s) => <tr key={s.v}><td>{s.v}</td><td className="ad__num">{s.n}</td><td className="ad__num">{s.people}</td></tr>)}</tbody>
        </table>
      </>)}

      <h2>People</h2>
      <p className="ad__sub">Weeks planned: how many times they asked for a weekly plan, re-plans included. Last seen: the last thing they did that's recorded (opening the app, at most once an hour, changing screens, or using a feature).</p>
      <div className="ad__scroll">
        <table className="ad__t">
          <thead><tr><th>Who</th><th>Joined</th><th>Last seen</th><th className="ad__num">Days active</th><th className="ad__num">Weeks planned</th><th className="ad__num">Recipes</th><th className="ad__num">Questions</th><th className="ad__num">AI calls (7d)</th><th>Access</th></tr></thead>
          <tbody>
            {d.people.map((p) => (
              <tr key={p.id}>
                <td>{p.who}</td><td>{fmtDay(p.created_at)}</td><td>{ago(p.last_seen)}</td>
                <td className="ad__num">{p.days_active}</td><td className="ad__num">{p.weeks}</td><td className="ad__num">{p.recipes}</td>
                <td className="ad__num">{p.asks}</td><td className="ad__num">{p.ai7}</td>
                <td>{p.has_code ? "code" : p.status === "active" || p.status === "trialing" ? "paid" : "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Ratings</h2>
      {d.rated.length ? (
        <div className="ad__scroll">
          <table className="ad__t">
            <thead><tr><th>Dish</th><th className="ad__num">Stars</th><th>What was missing</th><th>Note</th><th>Who</th><th>When</th></tr></thead>
            <tbody>
              {d.rated.map((r, i) => (
                <tr key={i}><td>{r.title}</td><td className="ad__num">{r.rating ?? "—"}</td><td>{r.missing || ""}</td><td>{r.note || ""}</td><td>{r.who}</td><td>{fmtDay(r.date)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="ad__sub">No ratings yet.</p>}

      <h2>Recipes</h2>
      <p className="ad__sub">Every recipe Mise wrote for each person: new, changed on request, or saved from earlier weeks. Tap to open.</p>
      {d.recipes.length ? d.recipes.map(([who, list]) => (
        <details className="ad__who" key={who}>
          <summary><strong>{who}</strong> · {list.length} recipe{list.length === 1 ? "" : "s"}</summary>
          {list.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).map((r, i) => <Recipe key={i} r={r} />)}
        </details>
      )) : <p className="ad__sub">No recipes yet.</p>}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

const CSS = `
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
`;

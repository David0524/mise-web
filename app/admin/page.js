import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { isAdmin, Recipe, fmtDay, fmtWhen, ago, ctxLine, lastDays, DailyBars, CSS } from "./shared";

/* Private stats page: how testers use Mise. Only accounts whose email is in
   ADMIN_EMAILS (comma-separated; defaults to the owner) can open it; everyone
   else gets a plain 404, so the page doesn't advertise that it exists.
   Read-only: every number comes from tables the app already keeps plus the
   events table (lib/events.js). */
export const dynamic = "force-dynamic";
export const metadata = { title: "Stats — Mise", robots: { index: false, follow: false } };

const rows = async (sql, params = []) => (await query(sql, params)).rows;


const FEATURES = [
  ["week_planned", "Planned a week"], ["dish_swapped", "Swapped a dish"], ["feedback_sent", "Asked for different ideas"],
  ["list_built", "Built a shopping list"], ["list_edited", "Edited the list with Mise"],
  ["recipe_opened", "Opened a new recipe"], ["recipe_change_asked", "Asked to change a recipe"], ["recipe_changed", "Applied a recipe change"],
  ["ask_mise", "Asked Mise a question"], ["timer_started", "Started a timer"], ["voice_used", "Used voice"],
  ["printed", "Printed"], ["leftovers", "Leftover ideas"], ["dish_rated", "Rated a dish"],
  ["cook_again", "Cooked something again"], ["new_week", "Started a new week"], ["feedback_note", "Sent feedback"],
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

  // Beta observability (lib/telemetry.js). Each read is on its own so a
  // problem with one never blanks the page.
  const dau = await rows(`
    select to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') as day, count(distinct user_id)::int as n
      from events where user_id is not null and created_at > now() - interval '30 days'
     group by 1`).catch(() => []);
  const feedback = await rows(`
    select f.id, f.user_id, coalesce(u.email, u.phone, '(no email)') as who, f.message, f.context, f.created_at
      from feedback f left join users u on u.id = f.user_id
     order by f.created_at desc limit 100`).catch(() => []);
  const errors = await rows(`
    select message, count(*)::int as n, count(distinct user_id)::int as people,
           count(*) filter (where user_id is null)::int as guests, max(created_at) as last_seen,
           (array_agg(stack order by created_at desc))[1] as stack,
           (array_agg(context order by created_at desc))[1] as context
      from client_errors where created_at > now() - interval '30 days'
     group by message order by max(created_at) desc limit 60`).catch(() => []);
  const ai = await rows(`
    select to_char(date_trunc('day', created_at at time zone 'UTC'), 'YYYY-MM-DD') as day, coalesce(tier, 'main') as tier,
           count(*)::int as calls, count(*) filter (where not ok)::int as failures,
           percentile_cont(0.5) within group (order by latency_ms)::int as p50,
           percentile_cont(0.95) within group (order by latency_ms)::int as p95,
           sum(input_tokens)::int as tin, sum(output_tokens)::int as tout
      from ai_calls where created_at > now() - interval '14 days'
     group by 1, 2 order by 1 desc, 2`).catch(() => []);

  return { totals, onboard, conv, features, screens, people, rated, recipes: [...recipes.entries()], dau, feedback, errors, ai };
}

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

      <DailyBars
        data={(() => { const m = Object.fromEntries(d.dau.map((x) => [x.day, x.n])); return lastDays(30).map((day) => ({ day, n: m[day] || 0 })); })()}
        title="People active each day, last 30 days"
        desc="Bars count distinct signed-in people with any recorded activity per day (UTC)." />
      <p className="ad__sub">People active each day, last 30 days.</p>

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
                <td><a href={`/admin/u/${p.id}`}>{p.who}</a></td><td>{fmtDay(p.created_at)}</td><td>{ago(p.last_seen)}</td>
                <td className="ad__num">{p.days_active}</td><td className="ad__num">{p.weeks}</td><td className="ad__num">{p.recipes}</td>
                <td className="ad__num">{p.asks}</td><td className="ad__num">{p.ai7}</td>
                <td>{p.has_code ? "code" : p.status === "active" || p.status === "trialing" ? "paid" : "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Feedback</h2>
      {d.feedback.length ? (
        <div className="ad__scroll">
          <table className="ad__t">
            <thead><tr><th>Message</th><th>Who</th><th>Screen</th><th>When</th></tr></thead>
            <tbody>
              {d.feedback.map((f) => (
                <tr key={f.id}>
                  <td className="ad__msg">{f.message}<div className="ad__ctx">{[f.context?.agent, f.context?.viewport, f.context?.build].filter(Boolean).join(" · ")}</div></td>
                  <td>{f.user_id ? <a href={`/admin/u/${f.user_id}`}>{f.who}</a> : f.who}</td>
                  <td>{f.context?.view || "—"}{f.context?.from && <div className="ad__ctx">from {f.context.from}</div>}</td>
                  <td className="ad__d">{fmtWhen(f.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="ad__sub">No feedback yet.</p>}

      <h2>Errors</h2>
      <p className="ad__sub">What broke in people&apos;s browsers in the last 30 days, grouped by message. Newest first.</p>
      {d.errors.length ? (
        <div className="ad__scroll">
          <table className="ad__t">
            <thead><tr><th>Error</th><th className="ad__num">Times</th><th className="ad__num">People</th><th>Last seen</th></tr></thead>
            <tbody>
              {d.errors.map((e) => (
                <tr key={e.message}>
                  <td className="ad__err">{e.message}
                    <div className="ad__ctx">{ctxLine(e.context)}</div>
                    {e.stack && <details><summary className="ad__ctx">Latest stack</summary><pre className="ad__stack">{e.stack}</pre></details>}
                  </td>
                  <td className="ad__num">{e.n}</td>
                  <td className="ad__num">{e.people}{e.guests ? ` + guests` : ""}</td>
                  <td>{ago(e.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="ad__sub">No errors reported.</p>}

      <h2>AI calls</h2>
      <p className="ad__sub">Last 14 days, by day (UTC) and tier. Latency in seconds; a failure is anything that didn&apos;t return an answer, rate limits included.</p>
      {d.ai.length ? (
        <div className="ad__scroll">
          <table className="ad__t">
            <thead><tr><th>Day</th><th>Tier</th><th className="ad__num">Calls</th><th className="ad__num">Failed</th><th className="ad__num">p50</th><th className="ad__num">p95</th><th className="ad__num">Tokens in / out</th></tr></thead>
            <tbody>
              {d.ai.map((a) => (
                <tr key={a.day + a.tier}>
                  <td className="ad__d">{fmtDay(a.day + "T12:00:00Z")}</td><td>{a.tier}</td><td className="ad__num">{a.calls}</td>
                  <td className={`ad__num ${a.failures ? "ad__bad" : "ad__ok"}`}>{a.failures}</td>
                  <td className="ad__num">{a.p50 != null ? (a.p50 / 1000).toFixed(1) : "—"}</td>
                  <td className="ad__num">{a.p95 != null ? (a.p95 / 1000).toFixed(1) : "—"}</td>
                  <td className="ad__num">{a.tin != null || a.tout != null ? `${(a.tin || 0).toLocaleString()} / ${(a.tout || 0).toLocaleString()}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="ad__sub">No AI calls recorded yet.</p>}

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


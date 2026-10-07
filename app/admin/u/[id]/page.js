import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { isAdmin, Recipe, fmtDay, fmtWhen, ago, ctxLine, CSS } from "../../shared";

/* One tester, everything at once: their setup, what they did and when, the
   weeks and recipes Mise made them, and anything they sent or that broke.
   Same owner-only guard as /admin: anyone else gets a plain 404. */
export const dynamic = "force-dynamic";
export const metadata = { title: "Person — Mise", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rows = async (sql, params) => (await query(sql, params)).rows;
const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const txt = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

async function load(id) {
  await ensureSchema();
  const [user] = await rows(`
    select u.id, coalesce(u.email, u.phone, '(no email)') as who, u.created_at, s.access_code, s.status
      from users u left join subscriptions s on s.user_id = u.id where u.id = $1`, [id]);
  if (!user) return null;
  const one = async (t) => (await rows(`select data, updated_at from ${t} where user_id = $1`, [id]).catch(() => []))[0] || null;
  const [profile, history, current] = [await one("profiles"), await one("histories"), await one("current_weeks")];
  const events = await rows(`select name, props, created_at from events where user_id = $1 order by created_at desc limit 200`, [id]).catch(() => []);
  const logged = await rows(`select kind, recipe, created_at as at from recipe_log where user_id = $1 order by created_at desc limit 500`, [id]).catch(() => []);
  const feedback = await rows(`select id, message, context, created_at from feedback where user_id = $1 order by created_at desc limit 100`, [id]).catch(() => []);
  const errors = await rows(`select id, message, stack, context, created_at from client_errors where user_id = $1 order by created_at desc limit 100`, [id]).catch(() => []);
  const ai = await rows(`
    select tier, slices, model, ok, status, latency_ms, input_tokens, output_tokens, created_at
      from ai_calls where user_id = $1 and created_at > now() - interval '7 days' order by created_at desc limit 300`, [id]).catch(() => []);
  return { user, profile, history, current, events, logged, feedback, errors, ai };
}

export default async function PersonPage({ params }) {
  if (!UUID.test(params?.id || "")) notFound();
  if (!(await isAdmin().catch(() => false))) notFound();
  const d = await load(params.id);
  if (!d) notFound();

  // The profile blob is { profile, favorites, ... } as the app saves it.
  const root = obj(d.profile?.data);
  const p = obj(root.profile);
  const avoiding = [...arr(p.restrictions).map(txt), txt(p.restrictionsNote)].filter(Boolean).join(", ") || "Nothing";

  // Weeks: the current one first, then history, newest first.
  const cur = obj(d.current?.data);
  const cands = arr(cur.candidates);
  const picked = Object.values(obj(cur.week)).map((cid) => txt(cands.find((c) => c?.id === cid)?.title)).filter(Boolean);
  const weeks = [];
  if (picked.length || cands.length) weeks.push({ label: "This week", at: d.current?.updated_at, dishes: picked.length ? picked : cands.map((c) => txt(c?.title)).filter(Boolean), note: picked.length ? "" : "ideas, none picked" });
  for (const w of arr(d.history?.data).slice().sort((a, b) => (Date.parse(b?.startedAt) || 0) - (Date.parse(a?.startedAt) || 0))) {
    weeks.push({ label: "Week", at: w?.startedAt, dishes: arr(w?.dishes).map((x) => txt(x?.title)).filter(Boolean) });
  }

  // Every recipe: what Mise wrote (the log), plus anything saved in their week
  // or history from before the log existed, de-duplicated by title.
  const recipes = d.logged.map((r) => ({ ...r }));
  const seen = new Set(recipes.map((r) => txt(r.recipe?.title).toLowerCase()));
  const saved = [
    ...Object.values(obj(cur.recipes)).map((r) => ({ recipe: r, at: d.current?.updated_at })),
    ...arr(d.history?.data).flatMap((w) => arr(w?.dishes).filter((x) => x?.recipe && typeof x.recipe === "object").map((x) => ({ recipe: x.recipe, at: w?.startedAt }))),
  ];
  for (const r of saved) {
    const k = txt(r.recipe?.title).toLowerCase();
    if (!r.recipe || typeof r.recipe !== "object" || seen.has(k)) continue;
    seen.add(k);
    recipes.push({ kind: "saved", ...r });
  }
  recipes.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  const ratings = arr(root.favorites).slice().sort((a, b) => txt(b?.date).localeCompare(txt(a?.date)));
  const aiFails = d.ai.filter((a) => !a.ok).length;

  return (
    <main className="ad">
      <a className="ad__back" href="/admin">← All stats</a>
      <h1>{d.user.who}</h1>
      <p className="ad__sub">Joined {fmtDay(d.user.created_at)} · last seen {ago(d.events[0]?.created_at)} · {d.user.access_code ? `code ${d.user.access_code}` : d.user.status === "active" || d.user.status === "trialing" ? "paid" : "no access"}</p>

      <h2>Setup</h2>
      <section className="ad__kv">
        {[
          ["Cooking for", txt(p.people) || "—"],
          ["Nights", arr(p.nights).map(txt).join(", ") || "None"],
          ["Adventure", p.adventure ? `${txt(p.adventure)} of 5` : "—"],
          ["Minutes", txt(p.time) || "—"],
          ["Avoiding", avoiding],
          ["Equipment", arr(p.equipment).map(txt).join(", ") || "Basic"],
        ].map(([k, v]) => <div className="ad__tile" key={k}><div className="ad__l">{k}</div><div>{v}</div></div>)}
      </section>

      <h2>Feedback</h2>
      {d.feedback.length ? (
        <div className="ad__scroll"><table className="ad__t">
          <thead><tr><th>Message</th><th>Screen</th><th>When</th></tr></thead>
          <tbody>{d.feedback.map((f) => (
            <tr key={f.id}><td className="ad__msg">{f.message}</td><td className="ad__ctx">{ctxLine(f.context)}</td><td className="ad__d">{fmtWhen(f.created_at)}</td></tr>
          ))}</tbody>
        </table></div>
      ) : <p className="ad__sub">No feedback from them.</p>}

      <h2>Errors</h2>
      {d.errors.length ? (
        <div className="ad__scroll"><table className="ad__t">
          <thead><tr><th>Error</th><th>When</th></tr></thead>
          <tbody>{d.errors.map((e) => (
            <tr key={e.id}><td className="ad__err">{e.message}<div className="ad__ctx">{ctxLine(e.context)}</div>
              {e.stack && <details><summary className="ad__ctx">Stack</summary><pre className="ad__stack">{e.stack}</pre></details>}</td>
              <td className="ad__d">{fmtWhen(e.created_at)}</td></tr>
          ))}</tbody>
        </table></div>
      ) : <p className="ad__sub">No errors reported.</p>}

      <h2>AI calls, last 7 days</h2>
      <p className="ad__sub">{d.ai.length} call{d.ai.length === 1 ? "" : "s"}, {aiFails} failed.</p>
      {d.ai.length > 0 && (
        <div className="ad__scroll"><table className="ad__t">
          <thead><tr><th>When</th><th>Tier</th><th>Doctrine</th><th>Model</th><th>Result</th><th className="ad__num">Seconds</th><th className="ad__num">Tokens in / out</th></tr></thead>
          <tbody>{d.ai.map((a, i) => (
            <tr key={i}><td className="ad__d">{fmtWhen(a.created_at)}</td><td>{a.tier || "main"}</td><td className="ad__ctx">{a.slices || ""}</td><td className="ad__ctx">{a.model || "—"}</td>
              <td className={a.ok ? "ad__ok" : "ad__bad"}>{a.ok ? "ok" : `failed ${a.status ?? ""}`}</td>
              <td className="ad__num">{a.latency_ms != null ? (a.latency_ms / 1000).toFixed(1) : "—"}</td>
              <td className="ad__num">{a.input_tokens != null || a.output_tokens != null ? `${a.input_tokens ?? "—"} / ${a.output_tokens ?? "—"}` : "—"}</td></tr>
          ))}</tbody>
        </table></div>
      )}

      <h2>Weeks</h2>
      {weeks.length ? weeks.map((w, i) => (
        <div className="ad__who" key={i}>
          <strong>{w.label}</strong> <span className="ad__when">{fmtDay(w.at)}</span>{w.note && <span className="ad__when">· {w.note}</span>}
          <ul>{w.dishes.map((t, j) => <li key={j}>{t}</li>)}</ul>
        </div>
      )) : <p className="ad__sub">No weeks yet.</p>}

      <h2>Ratings</h2>
      {ratings.length ? (
        <div className="ad__scroll"><table className="ad__t">
          <thead><tr><th>Dish</th><th className="ad__num">Stars</th><th>What was missing</th><th>Note</th><th>When</th></tr></thead>
          <tbody>{ratings.map((r, i) => (
            <tr key={i}><td>{txt(r?.title)}</td><td className="ad__num">{txt(r?.rating) || "—"}</td><td>{txt(r?.missing)}</td><td>{txt(r?.note)}</td><td>{fmtDay(r?.date)}</td></tr>
          ))}</tbody>
        </table></div>
      ) : <p className="ad__sub">No ratings yet.</p>}

      <h2>Recipes</h2>
      {recipes.length ? <div className="ad__who">{recipes.map((r, i) => <Recipe key={i} r={r} />)}</div> : <p className="ad__sub">No recipes yet.</p>}

      <h2>Timeline</h2>
      <p className="ad__sub">Newest 200 events.</p>
      {d.events.length ? (
        <div className="ad__scroll"><table className="ad__t">
          <thead><tr><th>When</th><th>What</th><th>Details</th></tr></thead>
          <tbody>{d.events.map((e, i) => (
            <tr key={i}><td className="ad__d">{fmtWhen(e.created_at)}</td><td>{e.name}</td>
              <td className="ad__ctx">{Object.entries(obj(e.props)).map(([k, v]) => `${k}: ${v}`).join(" · ")}</td></tr>
          ))}</tbody>
        </table></div>
      ) : <p className="ad__sub">Nothing recorded yet.</p>}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}

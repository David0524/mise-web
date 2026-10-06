import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";

/* Everything we hold about the signed-in person, as one JSON download.
   Not paywalled: your data is yours whether or not you're subscribed. The
   password hash and Stripe ids are left out; they're keys, not your data. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const one = async (sql) => (await query(sql, [userId])).rows[0] || null;
    const user = await one("select * from users where id = $1");
    if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
    const sub = await one("select status, current_period_end, updated_at from subscriptions where user_id = $1");
    const data = async (table) => (await one(`select data, updated_at from ${table} where user_id = $1`)) || null;

    const out = {
      exported_at: new Date().toISOString(),
      account: {
        email: user.email,
        created_at: user.created_at,
        age_confirmed_at: user.age_confirmed_at ?? null,
        terms_accepted_at: user.terms_accepted_at ?? null,
        policy_version: user.policy_version ?? null,
      },
      subscription: sub,
      profile: await data("profiles"),
      history: await data("histories"),
      recipe_book: await data("recipe_books"),
      current_week: await data("current_weeks"),
      note: "Payment details are held by Stripe, not Mise. Your own AI key, if you added one, is stored only in your browser.",
    };
    return new NextResponse(JSON.stringify(out, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mise-data-${out.exported_at.slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("export failed:", e?.code || "", e?.message || e);
    return NextResponse.json({ error: "Couldn't prepare your data right now. Try again in a moment." }, { status: 500 });
  }
}

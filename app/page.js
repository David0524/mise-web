import { S, FilterDefs } from "@/lib/authStyles";
import SiteFooter from "@/components/SiteFooter";
import MiseHello from "@/components/MiseHello";

export default function Landing({ searchParams }) {
  const deleted = searchParams?.deleted === "1";
  return (
    <main id="main" style={{ ...S.wrap, flexDirection: "column" }}>
      <FilterDefs />
      <div style={{ ...S.card, maxWidth: 460, textAlign: "center", paddingTop: "2.4rem" }}>
        {deleted && (
          <p role="status" style={{ ...S.notice, marginBottom: "1rem" }}>
            Your account and data have been deleted, and your subscription is cancelled.
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: ".4rem" }}>
          <MiseHello />
        </div>

        {/* Same hook the app's own intro leads with, so the pitch doesn't change
            between the page that sells it and the product itself. */}
        <h1 style={{ ...S.h1, fontSize: "1.9rem", lineHeight: 1.15, marginTop: ".6rem" }}>
          Nobody needs a whole bunch of dill for one dish.
        </h1>
        <p style={{ ...S.sub, marginBottom: "1.6rem" }}>
          I&apos;m Mise. I&apos;ll help you work out what to cook this week, build a shopping
          list around what actually gets used up, and talk you through it at the stove.
        </p>

        <a href="/start" style={{ ...S.btn, marginTop: 0, display: "block", textDecoration: "none", boxSizing: "border-box" }}>
          Get started
        </a>
        <p style={S.foot}>
          Already have an account? <a href="/login" style={S.link}>Sign in</a>
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}

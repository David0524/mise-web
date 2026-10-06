import { S, FilterDefs } from "@/lib/authStyles";
import { POLICY_DATE } from "@/lib/business";
import SiteFooter from "@/components/SiteFooter";

/* Shared shell for the policy pages: readable measure, real headings for screen
   readers and in-page navigation, the business footer. */
export default function LegalPage({ title, intro, children }) {
  return (
    <main style={{ ...S.wrap, flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }} id="main">
      <FilterDefs />
      <article className="legal" style={{ ...S.card, maxWidth: 760, width: "100%", textAlign: "left" }}>
        <p style={{ margin: "0 0 .3rem" }}><a href="/" style={S.link}>← Mise</a></p>
        <h1 style={{ ...S.h1, marginBottom: ".2rem" }}>{title}</h1>
        <p style={{ ...S.sub, marginBottom: "1rem" }}>Last updated {POLICY_DATE}</p>
        {intro && <p className="legal__intro">{intro}</p>}
        {children}
      </article>
      <style dangerouslySetInnerHTML={{ __html: `
        .legal{font-family:'Nunito',system-ui,sans-serif;color:#221A15;line-height:1.6;font-size:1rem}
        .legal h2{font-size:1.2rem;margin:1.8rem 0 .4rem;letter-spacing:-.01em}
        .legal h3{font-size:1rem;margin:1.1rem 0 .3rem}
        .legal p,.legal li{font-weight:600;color:#3B302A}
        .legal ul{padding-left:1.25rem}
        .legal li{margin:.25rem 0}
        .legal a{color:#9A3B1B;font-weight:800}
        .legal table{border-collapse:collapse;width:100%;font-size:.92rem;margin:.6rem 0}
        .legal th,.legal td{border:1px solid rgba(34,26,21,.18);padding:.5rem .6rem;text-align:left;vertical-align:top}
        .legal th{background:#F4EBE9}
        .legal__intro{font-size:1.05rem}
        .legal a:focus-visible{outline:3px solid #B44722;outline-offset:2px;border-radius:4px}
      ` }} />
      <div style={{ width: "100%" }}><SiteFooter /></div>
    </main>
  );
}

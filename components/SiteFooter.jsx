import { BUSINESS } from "@/lib/business";
import { CookieSettingsButton } from "@/components/CookieBanner";

/* Business details and the policy links, on every public page. */
export default function SiteFooter({ tone = "light" }) {
  const c = tone === "light" ? "#51453D" : "rgba(255,255,255,.8)";
  // 44px tall so each link is a full-size tap target on a phone; the row gap is
  // taken out so the footer stays about as compact as before.
  const link = { color: c, fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 3,
    display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 .2rem" };
  return (
    <footer style={{ fontFamily: "'Nunito', system-ui, sans-serif", fontSize: ".86rem", lineHeight: 1.6, color: c, textAlign: "center", padding: "1.4rem 1rem 2rem", maxWidth: 640, margin: "0 auto" }}>
      <nav aria-label="Policies" style={{ display: "flex", gap: "0 .6rem", justifyContent: "center", flexWrap: "wrap", marginBottom: ".25rem" }}>
        <a href="/privacy" style={link}>Privacy</a>
        <a href="/terms" style={link}>Terms</a>
        <a href="/refunds" style={link}>Refunds</a>
        <a href="/cookies" style={link}>Cookies</a>
        <a href={`mailto:${BUSINESS.email}`} style={link}>Contact</a>
        <CookieSettingsButton style={link} />
      </nav>
      <p style={{ margin: 0 }}>
        {BUSINESS.product} is provided by {BUSINESS.legalName}, {BUSINESS.address}. {BUSINESS.email}
      </p>
    </footer>
  );
}

/* Shared styling for the standalone pages that sit OUTSIDE the app shell —
   sign in, sign up, pricing. These render before MiseApp mounts, so they can't
   use its stylesheet and need the theme restated here.
   
   Previously these were badly out of date: Georgia serif, and the pre-correction
   brick (#A94C40) rather than the current #B44722. Someone signing up hit a page
   that looked like a different product than the one they were joining. */

const BRICK = "#B44722";
const BRICK_EDGE = "#813318";
const ROSE = "#EE9265";
const PLUM = "#573C56";
const INK = "#1A1B24";
const MUTED = "#6E6472";
const RULE = "rgba(87,60,86,.26)";

// Same directional daylight as the app: warm high-left, cool low-right, very
// low saturation. It's light falling on pale surfaces, not colour applied.
const DAYLIGHT = [
  // North-facing light — cool and even. Warm butter here produced a yellow-tan
  // cast against the warm-pink paper, which read as dingy rather than sunlit.
  "radial-gradient(60% 48% at 4% -4%, rgba(226,238,250,.98), transparent 62%)",
  "radial-gradient(70% 40% at 58% -6%, rgba(238,245,251,.85), transparent 64%)",
  "radial-gradient(44% 32% at 100% 46%, rgba(247,236,222,.55), transparent 62%)",
  "radial-gradient(76% 46% at 78% 106%, rgba(199,211,226,.66), transparent 66%)",
].join(",");

const FONT = "'Nunito', system-ui, -apple-system, sans-serif";

export const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,400;0,600;0,700;0,800;0,900;1,600&display=swap";

export const S = {
  wrap: {
    minHeight: "100vh",
    // Pale oak rather than the app's marble: warmer, and these are the pages a
    // stranger sees first. Same north-light gradients layered over it.
    backgroundImage: `${DAYLIGHT},url('/textures/oak.webp')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    // backgroundColor, NOT the `background` shorthand — the shorthand resets
    // backgroundImage set above it, which silently wiped the oak texture.
    backgroundColor: "#FAF5F4",
    backgroundAttachment: "fixed",
    backgroundRepeat: "no-repeat",
    fontFamily: FONT,
    color: INK,
  },

  // Glass: translucent fill, saturation boost, hairline rim, and the specular
  // top highlight that makes it read as a lit pane rather than just see-through.
  card: {
    background: "rgba(255,255,255,.62)",
    // Same real distortion as the app — an SVG filter referenced from inside
    // backdrop-filter, defined once in FilterDefs below and shared by every
    // page that imports this card style.
    WebkitBackdropFilter: "url(#glassDistort) saturate(180%) blur(20px)",
    backdropFilter: "url(#glassDistort) saturate(180%) blur(20px)",
    padding: "2.1rem 1.8rem",
    borderRadius: 30,
    width: "100%",
    maxWidth: 380,
    border: "1px solid rgba(255,255,255,.75)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,.9), 0 2px 6px rgba(87,60,86,.07), 0 18px 44px -16px rgba(87,60,86,.28)",
    boxSizing: "border-box",
  },

  brand: { display: "flex", alignItems: "center", gap: ".6rem", marginBottom: "1.4rem" },
  brandName: { fontFamily: FONT, fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-.02em", color: INK, lineHeight: 1 },
  brandTag: { fontFamily: FONT, fontWeight: 700, fontSize: ".62rem", letterSpacing: ".16em", textTransform: "uppercase", color: BRICK, lineHeight: 1, marginTop: 3 },

  h1: { fontFamily: FONT, fontWeight: 800, fontSize: "1.7rem", letterSpacing: "-.025em", margin: "0 0 .3rem", color: INK },
  sub: { fontFamily: FONT, fontWeight: 600, fontSize: ".98rem", color: MUTED, margin: "0 0 1.2rem", lineHeight: 1.5 },

  label: { display: "block", fontFamily: FONT, fontSize: ".85rem", fontWeight: 800, color: PLUM, marginTop: 16, marginBottom: 6 },
  input: {
    width: "100%", padding: ".8rem .95rem", borderRadius: 16,
    border: `1px solid ${RULE}`, background: "rgba(255,255,255,.8)",
    fontSize: "1rem", fontFamily: FONT, fontWeight: 600, color: INK,
    boxSizing: "border-box", outlineColor: BRICK,
  },

  // The same 2px seated edge + specular highlight as the app's buttons.
  btn: {
    width: "100%", marginTop: 22, padding: ".85rem", borderRadius: 18, border: "none",
    background: BRICK, color: "#fff", fontFamily: FONT, fontWeight: 700, fontSize: "1rem",
    cursor: "pointer",
    boxShadow: `0 2px 0 ${BRICK_EDGE}, inset 0 1px 0 rgba(255,255,255,.25), 0 8px 24px -10px rgba(87,60,86,.22)`,
  },
  btnBusy: { opacity: .6, cursor: "wait" },

  foot: { fontFamily: FONT, fontWeight: 600, fontSize: ".9rem", color: MUTED, marginTop: 18, textAlign: "center" },
  link: { color: BRICK, fontWeight: 800, textDecoration: "none" },

  error: { color: "#7A2E1B", fontFamily: FONT, fontWeight: 700, fontSize: ".92rem", background: "rgba(238,146,101,.20)", padding: ".7rem .9rem", borderRadius: 14, border: `1px solid ${ROSE}`, marginTop: 4 },
  notice: { color: PLUM, fontFamily: FONT, fontWeight: 700, fontSize: ".92rem", background: "rgba(87,60,86,.08)", padding: ".7rem .9rem", borderRadius: 14, marginTop: 4 },

  // pricing
  price: { fontFamily: FONT, fontWeight: 800, fontSize: "2.6rem", letterSpacing: "-.03em", color: INK, margin: ".2rem 0 0", lineHeight: 1 },
  priceUnit: { fontFamily: FONT, fontWeight: 700, fontSize: "1rem", color: MUTED },
  list: { listStyle: "none", padding: 0, margin: "1.3rem 0 0", display: "flex", flexDirection: "column", gap: ".7rem" },
  listItem: { fontFamily: FONT, fontWeight: 600, fontSize: ".97rem", color: INK, lineHeight: 1.45, paddingLeft: "1.6rem", position: "relative" },
  tick: { position: "absolute", left: 0, top: ".15rem", color: BRICK, fontWeight: 800 },
};

/* Renders the SVG filter that S.card's backdropFilter references. Needs to be
   mounted once per page — these pages sit outside MiseApp entirely, so they
   can't share the definition already in the app's own markup. */
export function FilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <filter id="glassDistort" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.010 0.014" numOctaves="2" seed="7" result="n" />
        <feGaussianBlur in="n" stdDeviation="3" result="bn" />
        <feDisplacementMap in="SourceGraphic" in2="bn" scale="26" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

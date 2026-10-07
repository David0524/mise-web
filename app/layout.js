import CookieBanner from "@/components/CookieBanner";

/* Absolute URLs for og:image and friends. Link unfurlers (iMessage, WhatsApp,
   Slack) ignore relative image paths, so this has to be the real public origin.
   Same fallback as lib/business.js. */
const SITE_URL = (process.env.APP_URL || "https://misekitchen.app").replace(/\/$/, "");
const TITLE = "Mise — a weekly cooking collaborator";
const DESCRIPTION = "Plan the week with a chef who talks it through with you, not a recipe database.";
/* The line a friend reads under the preview card — the landing page's own pitch. */
const SHARE_DESCRIPTION =
  "Work out what to cook this week, shop for what actually gets used up, and get talked through it at the stove.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Mise" },
  // The image itself comes from app/opengraph-image.js, which Next adds here.
  openGraph: {
    type: "website",
    siteName: "Mise",
    url: "/",
    title: "Mise — what to cook this week, sorted",
    description: SHARE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mise — what to cook this week, sorted",
    description: SHARE_DESCRIPTION,
  },
};

export const viewport = {
  themeColor: "#B44722",   // matches the corrected persimmon accent, not the old muted brick
  width: "device-width",
  initialScale: 1,
  // Lets content reach the true edges and be pulled back with safe-area insets —
  // without this, a native wrap renders with black bars, or content sits under
  // the notch/home indicator instead of respecting it.
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* Loaded here rather than per-page: the standalone auth and pricing
          pages render before MiseApp mounts, so they can't rely on the
          stylesheet inside it and would otherwise silently fall back to a
          system font while the app itself renders in Nunito. */}
      <head>
        {/* Self-hosted: no request to Google or any other font CDN. */}
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="stylesheet" href="/base.css" />
        <link rel="preload" href="/fonts/nunito.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body
        style={{
          margin: 0,
          // Real device insets in a native wrap, zero everywhere else (a browser
          // tab has no notch, so these resolve to 0 there and do nothing).
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
          minHeight: "100vh",
          /* TRANSPARENT, deliberately — the paper colour lives on <html> in
             MiseApp's CSS instead, and moving it there is load-bearing.

             CSS paints, inside the root stacking context, in this order:
               1. the root/canvas background
               2. negative z-index descendants   <- .surface (z-index:-1)
               3. in-flow block backgrounds      <- this element's own box
             An opaque background HERE is painted at step 3, directly on top of
             the .surface layer at step 2, hiding it everywhere except the rubber-band
             overscroll area outside body's box. It only worked originally
             because body had no background on <html> to compete with, so this
             colour propagated up to the canvas at step 1 and sat harmlessly
             below the texture. The moment <html> got its own background that
             propagation stopped and this became an opaque lid. */
          background: "transparent",
        }}
      >
        {/* First tab stop on every page: jump past the header to the content. */}
        <a href="#main" className="skip-link">Skip to content</a>
        {children}
        <CookieBanner />
        <script
          // Registers the service worker for offline shell + installability.
          // Failing quietly is correct here — a PWA that can't install still
          // has to work as a plain website.
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

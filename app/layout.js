export const metadata = {
  title: "Mise — a weekly cooking collaborator",
  description: "Plan the week with a chef who talks it through with you, not a recipe database.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Mise" },
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,400;0,600;0,700;0,800;0,900;1,600;1,700&display=swap"
        />
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
          // TRANSPARENT on purpose, same reasoning as .app in MiseApp.jsx: body is
          // an in-flow ancestor of .surface (the fixed, z-index:-1 marble layer),
          // and an in-flow element's own background paints ABOVE a negative-z-index
          // descendant in stacking order — an opaque fill here sat directly on top
          // of the marble and hid it outright, only showing during an iOS
          // overscroll bounce that forces a recomposite. html's own background
          // (#F7F3F2, in MiseApp.jsx) is the real fallback.
          background: "transparent",
        }}
      >
        {children}
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

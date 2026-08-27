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
          background: "#FAF5F4",
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

import LegalPage from "@/components/LegalPage";
import { BUSINESS } from "@/lib/business";

export const metadata = { title: "Cookie Policy — Mise" };

export default function Cookies() {
  const B = BUSINESS;
  return (
    <LegalPage
      title="Cookie Policy"
      intro={`${B.product} uses one cookie, to keep you signed in, plus a little storage in your browser to remember your choices. Your plans and settings are kept on our servers with your account, not in cookies. No analytics, no advertising, no tracking.`}
    >
      <h2>What we store</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Why</th><th>How long</th></tr></thead>
        <tbody>
          <tr><td><code>mise_session</code></td><td>Cookie (essential)</td><td>Keeps you signed in. Can't be read by scripts on the page.</td><td>30 days, or until you sign out</td></tr>
          <tr><td><code>mise:consent-v1</code></td><td>Browser storage (essential)</td><td>Remembers your answer to the cookie banner.</td><td>Until you clear it</td></tr>
          <tr><td><code>mise:byok-v1</code></td><td>Browser storage (essential, only if used)</td><td>Your own AI key, if you add one. Never sent to our database.</td><td>Until you remove it</td></tr>
          <tr><td>App files cache</td><td>Service worker (essential)</td><td>Keeps the app icon and install details so Mise can be added to your home screen. Pages and your data are never cached.</td><td>Replaced on each update</td></tr>
        </tbody>
      </table>

      <h2>Essential only</h2>
      <p>
        Everything above is strictly necessary to provide the service you asked for, so the law doesn't require
        consent for it. We ask anyway, and we'll ask again before adding anything optional. Today there are no
        optional cookies, so "Essential only" and "Allow optional" behave the same.
      </p>

      <h2>Third parties</h2>
      <ul>
        <li><strong>Stripe:</strong> when you go to checkout or manage your subscription you're on stripe.com, which sets its own cookies for fraud prevention. See Stripe's cookie policy.</li>
        <li><strong>Fonts</strong> are served from our own servers, so loading a page doesn't contact Google or anyone else.</li>
      </ul>

      <h2>Your choices</h2>
      <p>
        You can change your banner answer with the "Cookie settings" link in the footer, and clear cookies and site
        data in your browser settings at any time. Clearing the <code>mise_session</code> cookie signs you out.
      </p>

      <h2>Contact</h2>
      <p><a href={`mailto:${B.privacyEmail}`}>{B.privacyEmail}</a></p>
    </LegalPage>
  );
}

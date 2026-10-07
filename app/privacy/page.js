import LegalPage from "@/components/LegalPage";
import { BUSINESS } from "@/lib/business";

export const metadata = { title: "Privacy Policy — Mise" };

export default function Privacy() {
  const B = BUSINESS;
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`This explains what ${B.product} collects, why, who it's shared with, and the choices you have. In short: we collect what's needed to plan and cook your meals, we don't sell it, we don't show ads, and you can download or delete it at any time.`}
    >
      <h2>Who we are</h2>
      <p>
        {B.product} is provided by {B.legalName} ("we", "us"), {B.address}. We are the controller of
        the personal information described here. Questions or requests: <a href={`mailto:${B.privacyEmail}`}>{B.privacyEmail}</a>.
      </p>

      <h2>What we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li><strong>Account:</strong> your email address and a password, or, if you sign in with Google, Apple or your phone, your account id from that provider, the email it shares with us, or your phone number. We store only a one-way hash of any password, never the password itself.</li>
        <li><strong>Your kitchen profile:</strong> how many people you cook for, which nights, how much time, heat and adventure preferences, the equipment you own, foods you dislike, and any dietary needs or allergies you choose to tell us.</li>
        <li><strong>What you cook:</strong> your weekly plans, shopping lists, recipes, ratings, notes and any photos you add to a rating.</li>
        <li><strong>What you ask Mise:</strong> the questions and change requests you type or dictate.</li>
        <li><strong>Consent records:</strong> when you agreed to these policies and confirmed your age.</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li><strong>A sign-in cookie</strong> that keeps you logged in (see the <a href="/cookies">Cookie Policy</a>).</li>
        <li><strong>Your IP address,</strong> used briefly in memory to slow down password-guessing attacks. We don't store it, and we don't use it to locate or track you.</li>
        <li><strong>Error logs</strong> that record that a request failed and why, without the content of your plans or questions.</li>
        <li><strong>How you use Mise:</strong> which features and screens you use and when (for example &ldquo;planned a week&rdquo; or &ldquo;opened a recipe&rdquo;), kept in our own database with your account so we can see what works and improve it. It never includes what you type. Before you create an account, onboarding screens are only counted, with nothing that identifies you. We keep these records for up to 400 days, and they're deleted with your account.</li>
      </ul>
      <p>We don't use third-party analytics, advertising or tracking tools, nothing is stored on your device for this, and we don't collect your location, contacts or device identifiers.</p>
      <h3>Payments</h3>
      <p>
        Subscriptions are processed by Stripe. Your card details go directly to Stripe and never reach our servers. We
        keep only your subscription status, renewal date and the Stripe IDs that link your account to it.
      </p>

      <h2>Dietary needs and allergies</h2>
      <p>
        Dietary needs and allergies can reveal information about your health or beliefs. We use them only to plan meals
        that respect them, and only with your explicit consent, which you give with a checkbox when you enter them.
        Untick it, or edit your kitchen settings, and they're deleted. Mise is an AI and can make mistakes, so always check
        ingredients and labels yourself.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To provide the service: planning your week, building your shopping list, writing and changing recipes, and answering questions while you cook.</li>
        <li>To learn your taste <em>within your account</em>, for example from your ratings, so next week's suggestions fit you better.</li>
        <li>To run billing, keep accounts secure and prevent abuse.</li>
        <li>To respond to you when you contact us.</li>
      </ul>
      <p>
        We don't sell or rent your personal information, we don't share it for advertising, and we don't use it to
        make decisions that have legal or similarly significant effects on you.
      </p>
      <p>
        <strong>Legal bases (EU/UK):</strong> performing our contract with you (running the service), your explicit
        consent (dietary needs and allergies), our legitimate interests in security and preventing abuse, and legal
        obligations (for example tax records).
      </p>

      <h2>AI processing</h2>
      <p>
        To generate plans, recipes and answers, we send the relevant parts of your profile, plan and request to an AI
        model provider (currently Google's Gemini API; Anthropic or OpenAI if you add your own key). If you turn on
        Mise's voice in cook mode, the text being read aloud is sent to a text-to-speech provider (Google or OpenAI).
        These providers process the content only to return a response to us under their terms for business customers.
        We don't send your email address or payment details to them.
      </p>
      <p>
        <strong>Your own API key:</strong> if you add one, it's stored only in your browser, sent with each request,
        used once, and never saved on our servers.
      </p>
      <p>
        <strong>Dictation:</strong> if you use the microphone button, speech recognition is performed by your browser
        or device (for example Apple or Google), under their privacy terms.
      </p>

      <h2>Who we share it with</h2>
      <p>Only the service providers that run Mise for us, each bound to use your information only to provide their service:</p>
      <table>
        <thead><tr><th>Provider</th><th>What for</th><th>What they receive</th></tr></thead>
        <tbody>
          <tr><td>Hosting provider</td><td>Running the website and app</td><td>Requests to our servers, including your IP address</td></tr>
          <tr><td>Database provider</td><td>Storing your account and data</td><td>Everything listed under "What we collect"</td></tr>
          <tr><td>Stripe</td><td>Payments and subscriptions</td><td>Email, payment details, billing address</td></tr>
          <tr><td>Google (Gemini API)</td><td>Generating plans, recipes and answers; voice</td><td>The content of each request</td></tr>
          <tr><td>Google / Apple sign-in</td><td>Signing in, if you choose it</td><td>Their sign-in request; they tell us your account id and email</td></tr>
          <tr><td>Twilio</td><td>Texting sign-in codes</td><td>Your phone number</td></tr>
          <tr><td>Resend</td><td>Password reset emails</td><td>Your email address</td></tr>
          <tr><td>OpenAI / Anthropic</td><td>Only if you add your own key, or for voice if configured</td><td>The content of each request</td></tr>
        </tbody>
      </table>
      <p>
        We may also disclose information if the law requires it, to protect someone's safety, or as part of a merger or
        sale of the business, in which case this policy continues to apply to it.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>While your account is open, we keep your account and cooking data so the app works.</li>
        <li>When you delete your account, we delete your data from our systems immediately, and from backups within 30 days.</li>
        <li>Stripe keeps billing records for as long as tax and financial laws require.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <ul>
        <li><strong>Download your data:</strong> My Kitchen → Your data → Download my data.</li>
        <li><strong>Delete your account and data:</strong> My Kitchen → Your data → Delete my account, or email <a href={`mailto:${B.privacyEmail}`}>{B.privacyEmail}</a>.</li>
        <li><strong>Correct it:</strong> edit your profile and plans in the app at any time.</li>
        <li><strong>Withdraw consent</strong> for dietary information by removing it from your profile.</li>
      </ul>
      <p>
        Depending on where you live (for example the EU, UK, California and other US states), you may also have the
        right to access, correct, delete or port your information, to object to or restrict processing, and to
        complain to your data-protection authority. We don't sell or "share" personal information as California law
        defines it. We'll respond to requests within 30 days and won't treat you differently for making one.
      </p>

      <h2>Children</h2>
      <p>
        Mise is for adults. You must be {B.minimumAge} or older to create an account. We don't knowingly collect
        information from anyone under {B.minimumAge}. If you believe a child has given us information, email us and
        we'll delete it.
      </p>

      <h2>Security</h2>
      <p>
        Data travels over encrypted connections, passwords are stored hashed, and your sign-in cookie can't be read
        by scripts on the page. No system is perfectly secure, but we work to protect your information and will tell
        you if a breach affects it.
      </p>

      <h2>International transfers</h2>
      <p>
        Our providers may process data in the United States and other countries. Where the law requires it, we rely on
        appropriate safeguards such as the European Commission's standard contractual clauses.
      </p>

      <h2>Emails</h2>
      <p>
        Mise doesn't send marketing email. We only email you a password reset link when you ask for one, and Stripe sends payment receipts. If we ever start sending newsletters or
        product updates, they'll be opt-in and every one will include an unsubscribe link.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we'll update the date above. If a change is significant, we'll tell you in the app
        before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>{B.legalName}, {B.address}. <a href={`mailto:${B.privacyEmail}`}>{B.privacyEmail}</a></p>
    </LegalPage>
  );
}

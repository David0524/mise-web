import LegalPage from "@/components/LegalPage";
import { BUSINESS } from "@/lib/business";

export const metadata = { title: "Terms of Service — Mise" };

export default function Terms() {
  const B = BUSINESS;
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms are the agreement between you and ${B.legalName} for using ${B.product}. Please read them. By creating an account you agree to them.`}
    >
      <h2>Who can use Mise</h2>
      <p>
        You must be {B.minimumAge} or older and able to enter a binding contract. You're responsible for keeping your
        password safe and for what happens under your account. One person per account.
      </p>

      <h2>Your subscription</h2>
      <ul>
        <li><strong>Price:</strong> {B.price}, shown before you subscribe. Any sales tax or VAT that applies where you live is shown at checkout before you pay. There are no other fees.</li>
        <li><strong>Renewal:</strong> your subscription renews automatically each month, on the same day you started, and is charged to the card you gave Stripe until you cancel.</li>
        <li><strong>Cancelling:</strong> any time, yourself, in My Kitchen → Manage subscription. No email or call needed. You keep access until the end of the period you've already paid for, and you won't be charged again.</li>
        <li><strong>Price changes:</strong> we'll tell you at least 30 days before a new price applies to you. If you don't want to pay it, cancel before then.</li>
        <li><strong>Refunds:</strong> see the <a href="/refunds">Refund Policy</a>.</li>
      </ul>

      <h2>AI-generated content: please read</h2>
      <p>
        Mise uses AI to write meal plans, recipes, shopping lists and answers. AI can be wrong. It can misjudge an
        ingredient, a quantity, a cooking time or a temperature, and it can miss an allergen even when you've told it
        about one.
      </p>
      <ul>
        <li><strong>Allergies and dietary needs:</strong> always read ingredient labels and check every recipe yourself. Don't rely on Mise alone if an allergy is serious.</li>
        <li><strong>Food safety:</strong> cook meat, poultry, fish and eggs to safe internal temperatures, and use your own judgement with knives, heat and hot oil.</li>
        <li><strong>Not medical or nutrition advice:</strong> Mise doesn't give medical, dietary or nutrition advice. Talk to a qualified professional about health conditions.</li>
      </ul>

      <h2>Using Mise fairly</h2>
      <p>Don't:</p>
      <ul>
        <li>break the law, or use Mise to harm anyone;</li>
        <li>try to get into other people's accounts, or probe, overload or disrupt the service;</li>
        <li>scrape, resell or copy the service, or use it to build a competing product;</li>
        <li>try to make the AI produce harmful content.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        What you put into Mise (your profile, notes, ratings and photos) stays yours. You give us permission to store
        and process it only to run the service for you, as described in the <a href="/privacy">Privacy Policy</a>.
        Recipes and plans Mise writes for you are yours to use for personal, non-commercial cooking.
      </p>

      <h2>Your own AI key</h2>
      <p>
        If you add your own Anthropic or OpenAI key, that provider bills you directly under its terms, and you're
        responsible for that usage. The key stays in your browser; we don't store it.
      </p>

      <h2>Ending the agreement</h2>
      <p>
        You can delete your account at any time in My Kitchen → Your data. We may suspend or close an account that
        breaks these terms, with notice where reasonable. If we shut Mise down, we'll give you at least 30 days'
        notice and refund any unused part of a paid period.
      </p>

      <h2>Changes to Mise and these terms</h2>
      <p>
        We improve Mise over time, so features may change. If we change these terms in a way that matters, we'll tell
        you in the app before it takes effect. If you don't agree, you can cancel and delete your account.
      </p>

      <h2>Disclaimers and liability</h2>
      <p>
        Mise is provided "as is". To the extent the law allows, we don't promise it will be uninterrupted or
        error-free, or that AI output will be accurate. To the extent the law allows, our total liability to you for
        any claim is limited to what you paid us in the 12 months before the claim, and we aren't liable for indirect
        or consequential losses. Nothing in these terms limits rights you have as a consumer that can't be limited by
        agreement, or liability that can't be excluded by law, such as for death or personal injury caused by our
        negligence.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of {B.governingLaw}, without overriding any mandatory consumer protections
        of the place you live.
      </p>

      <h2>Contact</h2>
      <p>{B.legalName}, {B.address}. <a href={`mailto:${B.email}`}>{B.email}</a></p>
    </LegalPage>
  );
}

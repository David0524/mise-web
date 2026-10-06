import LegalPage from "@/components/LegalPage";
import { BUSINESS } from "@/lib/business";

export const metadata = { title: "Refund Policy — Mise" };

export default function Refunds() {
  const B = BUSINESS;
  return (
    <LegalPage
      title="Refund Policy"
      intro={`We want ${B.product} to be worth it. If it isn't, here's exactly what happens to your money.`}
    >
      <h2>Your first payment: 14-day refund</h2>
      <p>
        If you're not happy, email <a href={`mailto:${B.email}`}>{B.email}</a> within 14 days of your first payment
        and we'll refund it in full, no questions asked. We'll cancel the subscription at the same time.
      </p>

      <h2>Renewals</h2>
      <p>
        After that, monthly renewals aren't refunded, including for part of a month. When you cancel, you keep using
        Mise until the end of the month you've paid for, and you're never charged again.
      </p>

      <h2>When we always refund</h2>
      <ul>
        <li>You were charged twice, or charged after you cancelled.</li>
        <li>Mise was unavailable for a long stretch of a period you paid for.</li>
        <li>We shut Mise down: you get back the unused part of your current period.</li>
        <li>The law where you live gives you a right to a refund (for example the EU/UK 14-day withdrawal right). This policy never takes those rights away.</li>
      </ul>

      <h2>How to cancel</h2>
      <p>
        In the app: My Kitchen → Manage subscription → Cancel. It takes a few seconds and doesn't need an email or a
        call. Deleting your account also cancels your subscription.
      </p>

      <h2>How refunds are paid</h2>
      <p>
        Refunds go back to the card you paid with, through Stripe. They usually appear within 5–10 business days,
        depending on your bank.
      </p>

      <h2>Questions</h2>
      <p><a href={`mailto:${B.email}`}>{B.email}</a></p>
    </LegalPage>
  );
}

/* Who is behind Mise. Every legal page, the site footer and the pricing page
   read from here, so the details are written once.

   Fill these in before launch — set them as environment variables on your host
   (NEXT_PUBLIC_ because the footer renders them on public pages). Until then
   they show as bracketed placeholders on purpose: a made-up company name or
   address on a legal page is worse than an obvious blank. */
const env = (k, fallback) => (process.env[k] && process.env[k].trim()) || fallback;

export const BUSINESS = {
  product: "Mise",
  legalName: env("NEXT_PUBLIC_BUSINESS_LEGAL_NAME", "[Business legal name]"),
  address: env("NEXT_PUBLIC_BUSINESS_ADDRESS", "[Business mailing address]"),
  email: env("NEXT_PUBLIC_SUPPORT_EMAIL", "[support@your-domain.com]"),
  privacyEmail: env("NEXT_PUBLIC_PRIVACY_EMAIL", env("NEXT_PUBLIC_SUPPORT_EMAIL", "[privacy@your-domain.com]")),
  governingLaw: env("NEXT_PUBLIC_GOVERNING_LAW", "[State / country whose laws govern these terms]"),
  website: env("APP_URL", "[https://your-domain.com]"),
  price: env("NEXT_PUBLIC_PRICE_LABEL", "$12 per month"),
  minimumAge: 18,
};

/* Bump when a policy changes in a way people should agree to again. Signups
   record the version they agreed to. */
export const POLICY_VERSION = "2026-10-06";
export const POLICY_DATE = "October 6, 2026";

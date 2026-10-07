/* Who is behind Mise. Every legal page, the site footer and the pricing page
   read from here, so the details are written once.

   The defaults below are FAKE stand-ins so the pages read finished during
   testing. Replace them before launch by setting the NEXT_PUBLIC_* variables
   on your host (then redeploy): a legal page must name the real business. */
const env = (k, fallback) => (process.env[k] && process.env[k].trim()) || fallback;

export const BUSINESS = {
  product: "Mise",
  legalName: env("NEXT_PUBLIC_BUSINESS_LEGAL_NAME", "Mise Kitchen, Inc."),
  address: env("NEXT_PUBLIC_BUSINESS_ADDRESS", "2261 Market Street #4012, San Francisco, CA 94114, USA"),
  email: env("NEXT_PUBLIC_SUPPORT_EMAIL", "support@misekitchen.app"),
  privacyEmail: env("NEXT_PUBLIC_PRIVACY_EMAIL", env("NEXT_PUBLIC_SUPPORT_EMAIL", "privacy@misekitchen.app")),
  governingLaw: env("NEXT_PUBLIC_GOVERNING_LAW", "the State of California, USA"),
  website: env("APP_URL", "https://misekitchen.app"),
  price: env("NEXT_PUBLIC_PRICE_LABEL", "$12 per month or $120 per year"),
  minimumAge: 18,
};

/* Bump when a policy changes in a way people should agree to again. Signups
   record the version they agreed to. */
export const POLICY_VERSION = "2026-10-06";
export const POLICY_DATE = "October 7, 2026";

/* Plans and access codes. One place for the numbers, so the paywall, the
   checkout and the policies can't disagree. */

export const PLANS = {
  monthly: { id: "monthly", label: "Monthly", amount: 1200, interval: "month", price: "$12", per: "/month", env: "STRIPE_PRICE_MONTHLY" },
  yearly:  { id: "yearly",  label: "Yearly",  amount: 12000, interval: "year", price: "$120", per: "/year", env: "STRIPE_PRICE_YEARLY", note: "2 months free" },
};

/* The first month: 30 days for $1, then the plan's normal price. Offered once
   per account. */
export const INTRO = { days: 30, amount: 100, price: "$1" };

/* Codes that unlock Mise without paying. ACCESS_CODES (comma-separated)
   replaces the default list. Compared case-insensitively. */
export function accessCodes() {
  const raw = process.env.ACCESS_CODES || "VIP26";
  return raw.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
}
export function isAccessCode(code) {
  const c = typeof code === "string" ? code.trim().toUpperCase() : "";
  return !!c && c.length <= 64 && accessCodes().includes(c);
}

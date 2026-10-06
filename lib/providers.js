import { smsConfigured, emailConfigured } from "@/lib/messaging";

/* Which sign-in methods are actually set up on this deployment. Buttons for
   anything that isn't are hidden rather than shown and then failing. */
export function providers() {
  return {
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    apple: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY),
    phone: smsConfigured(),
    reset: emailConfigured(),
  };
}

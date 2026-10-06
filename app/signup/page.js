import { redirect } from "next/navigation";

// Accounts are made at the end of onboarding now, after Mise has learned
// about your kitchen, so there's one way in.
export default function SignupPage() {
  redirect("/start");
}

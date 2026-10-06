import { callback } from "@/lib/oauth";
export const dynamic = "force-dynamic";
// Apple answers with a form POST (response_mode=form_post).
export async function POST(req) {
  const form = await req.formData().catch(() => null);
  const params = new URLSearchParams();
  if (form) for (const [k, v] of form.entries()) if (typeof v === "string") params.set(k, v);
  return callback("apple", params);
}
export const GET = (req) => callback("apple", new URL(req.url).searchParams);

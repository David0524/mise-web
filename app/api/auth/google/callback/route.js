import { callback } from "@/lib/oauth";
export const dynamic = "force-dynamic";
export const GET = (req) => callback("google", new URL(req.url).searchParams);

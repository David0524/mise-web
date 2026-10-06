import { start } from "@/lib/oauth";
export const dynamic = "force-dynamic";
export const GET = (req) => start("google", req);

import { NextResponse } from "next/server";
import { providers } from "@/lib/providers";
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json(providers()); }

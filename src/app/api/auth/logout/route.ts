import { NextRequest, NextResponse } from "next/server";
import { destroySessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await destroySessionCookie();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}

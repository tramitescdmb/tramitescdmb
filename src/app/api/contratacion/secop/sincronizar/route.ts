import { NextRequest, NextResponse } from "next/server";
import { sincronizarSecopTodos } from "@/lib/contratacion";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const resultado = await sincronizarSecopTodos();
  return NextResponse.json(resultado);
}

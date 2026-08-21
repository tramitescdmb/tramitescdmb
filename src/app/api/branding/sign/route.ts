import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildBrandingPath, crearUrlSubidaFirmadaBranding } from "@/lib/branding-storage";

const CAMPOS_VALIDOS = ["logo", "govco", "colombia", "potencia"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede cambiar la apariencia." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const campo = body?.campo ? String(body.campo) : "";
  const fileName = body?.fileName ? String(body.fileName) : "";

  if (!CAMPOS_VALIDOS.includes(campo) || !fileName) {
    return NextResponse.json({ error: "Campo o nombre de archivo inválido." }, { status: 400 });
  }

  const path = buildBrandingPath(campo, fileName);
  const { token } = await crearUrlSubidaFirmadaBranding(path);

  return NextResponse.json({ path, token });
}

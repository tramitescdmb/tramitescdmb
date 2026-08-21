import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getBrandingPublicUrl, deleteBranding } from "@/lib/branding-storage";
import { registrarAuditoria } from "@/lib/auditoria";

const CAMPOS: Record<string, { url: string; path: string; etiqueta: string }> = {
  logo: { url: "logoUrl", path: "logoPath", etiqueta: "Logo de la CDMB" },
  govco: { url: "logoGovcoUrl", path: "logoGovcoPath", etiqueta: "Sello GOV.CO" },
  colombia: { url: "logoColombiaUrl", path: "logoColombiaPath", etiqueta: "Sello de Colombia" },
  potencia: { url: "logoPotenciaUrl", path: "logoPotenciaPath", etiqueta: "Sello Colombia Potencia de la Vida" },
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede cambiar la apariencia." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const campo = body?.campo ? String(body.campo) : "";
  const path = body?.path ? String(body.path) : "";
  const config = CAMPOS[campo];
  if (!config || !path) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  // Borra el archivo anterior de ese mismo campo, si había uno, para no acumular basura en el bucket.
  const actual = await db.configuracionSitio.findUnique({ where: { id: "singleton" } });
  const pathAnterior = actual?.[config.path as keyof typeof actual] as string | null | undefined;

  const url = getBrandingPublicUrl(path);

  await db.configuracionSitio.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", [config.url]: url, [config.path]: path },
    update: { [config.url]: url, [config.path]: path },
  });

  if (pathAnterior) {
    await deleteBranding(pathAnterior).catch(() => {});
  }

  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} actualizó "${config.etiqueta}".`,
    usuarioId: session.userId,
  });

  revalidateTag("configuracion-sitio");

  return NextResponse.json({ ok: true, url });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede cambiar la apariencia." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const campo = body?.campo ? String(body.campo) : "";
  const config = CAMPOS[campo];
  if (!config) return NextResponse.json({ error: "Campo inválido." }, { status: 400 });

  const actual = await db.configuracionSitio.findUnique({ where: { id: "singleton" } });
  const pathAnterior = actual?.[config.path as keyof typeof actual] as string | null | undefined;

  await db.configuracionSitio.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: { [config.url]: null, [config.path]: null },
  });

  if (pathAnterior) {
    await deleteBranding(pathAnterior).catch(() => {});
  }

  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `${session.nombre} quitó "${config.etiqueta}".`,
    usuarioId: session.userId,
  });

  revalidateTag("configuracion-sitio");

  return NextResponse.json({ ok: true });
}

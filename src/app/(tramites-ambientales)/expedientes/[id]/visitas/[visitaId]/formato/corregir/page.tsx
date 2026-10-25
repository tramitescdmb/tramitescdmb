import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedePlanearVisitas } from "@/lib/permisos";
import { accesoCorreccionConcepto } from "@/lib/concepto-visita-db";
import { estructuraDesdeJson, precargaDeVisita } from "@/lib/formatos-visita-db";
import { sanearRespuestas } from "@/lib/formato-visita";
import { EditarConcepto } from "@/components/formatos/EditarConcepto";
import { AccesoRestringido } from "@/components/AccesoRestringido";

export default async function CorregirConceptoPage({ params }: { params: Promise<{ id: string; visitaId: string }> }) {
  const { id, visitaId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  const acceso = await accesoCorreccionConcepto(visitaId, session.userId, puedePlanearVisitas(permisos));
  if ("error" in acceso) {
    if (acceso.status === 404) notFound();
    return <AccesoRestringido titulo="Corregir concepto técnico" quien="quien elabora el concepto o quien planea las visitas" volverHref={`/expedientes/${id}/visitas/${visitaId}`} volverLabel="Volver a la hoja de visita" />;
  }
  if (acceso.expedienteId !== id) notFound();

  const vt = await db.visitaTecnica.findUnique({
    where: { id: acceso.visitaTecnicaId },
    select: {
      inicioReal: true,
      capturadoEn: true,
      respuestas: true,
      resultado: true,
      fotos: { select: { id: true, pie: true }, orderBy: { createdAt: "asc" } },
      formatoVersion: { select: { estructura: true, formato: { select: { titulo: true, codigo: true } } } },
      visitaProgramada: { select: { expediente: { select: { numero: true } } } },
    },
  });
  if (!vt?.formatoVersion) notFound();
  const estructura = estructuraDesdeJson(vt.formatoVersion.estructura);
  const precarga = await precargaDeVisita(visitaId, vt.inicioReal ?? vt.capturadoEn);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Link href={`/expedientes/${id}/visitas/${visitaId}/formato`} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Concepto · {vt.visitaProgramada?.expediente.numero}
      </Link>
      <h2 className="text-lg font-semibold text-stone-900">
        Corregir {vt.formatoVersion.formato.titulo.toLowerCase()} <span className="text-sm font-normal text-stone-500">· {vt.formatoVersion.formato.codigo}</span>
      </h2>
      <EditarConcepto
        visitaId={visitaId}
        expedienteId={id}
        visitaTecnicaId={acceso.visitaTecnicaId}
        estructura={estructura}
        precarga={precarga}
        respuestasIniciales={sanearRespuestas(estructura, vt.respuestas)}
        resultadoInicial={vt.resultado}
        fotosIniciales={vt.fotos.map((f) => ({ id: f.id, url: `/api/visitas-fotos/${f.id}`, pie: f.pie ?? "" }))}
      />
    </div>
  );
}

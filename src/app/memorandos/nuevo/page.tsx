import Link from "next/link";
import { redirect } from "next/navigation";
import { FileEdit, Reply } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { subserieBuscable } from "@/lib/trd-presentacion";
import { listarPlantillas } from "@/lib/plantillas";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { db } from "@/lib/db";
import { anioColombia } from "@/lib/fecha";
import { cargoDelFirmante } from "@/lib/jerarquia-firma";
import { contextoMemorandos, memorandoPendienteDe, puedeRecibirMemorando, DENOMINACIONES_QUE_ENVIAN_MEMORANDOS, TEXTO_QUIEN_ENVIA } from "@/lib/memorandos";
import { CIUDAD_MEMORANDO, fechaLargaMemorando } from "@/lib/memorandos-formato";
import { MemorandoForm, type PersonaOpcion, type RespuestaA } from "@/components/memorandos/MemorandoForm";
import { CabeceraTablero } from "@/components/tablero";

export default async function NuevoMemorandoPage({ searchParams }: { searchParams: Promise<{ respondeAId?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { respondeAId } = await searchParams;
  const permisos = await obtenerPermisosUsuario(session.userId);
  const ctx = await contextoMemorandos(session.userId, permisos);

  if (!ctx.firmante || (!ctx.dependenciaId && !ctx.origenLibre)) {
    return (
      <div className="mx-auto max-w-lg rounded-md border border-stone-200 bg-white p-6 text-center">
        <h2 className="text-base font-semibold text-stone-900">Nuevo memorando</h2>
        <p className="mt-2 text-sm text-stone-600">{TEXTO_QUIEN_ENVIA}</p>
        <Link href="/memorandos" className="mt-4 inline-flex rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
          Ir a la bandeja
        </Link>
      </div>
    );
  }

  const original = respondeAId ? await memorandoPendienteDe(respondeAId, ctx) : null;
  if (respondeAId && !original) redirect(`/memorandos/${respondeAId}?error=${encodeURIComponent("Este memorando ya fue respondido o no está dirigido a su oficina.")}`);

  const [dependencias, series, plantillas, usuarios, config] = await Promise.all([
    listarDependenciasActivas(),
    listarSeriesVigentes(),
    listarPlantillas("INTERNA"),
    db.usuario.findMany({
      where: { activo: true, dependenciaId: { not: null } },
      select: {
        id: true,
        nombre: true,
        dependenciaId: true,
        denominacionEmpleo: true,
        denominacionComplemento: true,
        denominacionEncargo: true,
        sexo: true,
        rolesContratacion: true,
        dependenciasResponsable: { select: { id: true } },
      },
      orderBy: { nombre: "asc" },
    }),
    getConfiguracionSitio(),
  ]);
  const personas: PersonaOpcion[] = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    cargo: cargoDelFirmante(u, "SGDEA"),
    dependenciaId: u.dependenciaId,
    dirige: DENOMINACIONES_QUE_ENVIAN_MEMORANDOS.has(u.denominacionEmpleo ?? "") || u.dependenciasResponsable.some((d) => d.id === u.dependenciaId),
    recibe: puedeRecibirMemorando(u),
  }));
  let yo = personas.find((p) => p.id === session.userId);
  if (!yo && ctx.origenLibre) {
    const u = await db.usuario.findUnique({
      where: { id: session.userId },
      select: { nombre: true, denominacionEmpleo: true, denominacionComplemento: true, denominacionEncargo: true, sexo: true, rolesContratacion: true },
    });
    if (u) yo = { id: session.userId, nombre: u.nombre, cargo: cargoDelFirmante(u, "SGDEA"), dependenciaId: null, dirige: false, recibe: false };
  }
  const origen = dependencias.find((d) => d.id === ctx.dependenciaId) ?? (ctx.origenLibre ? dependencias[0] : undefined);
  if (!yo || !origen) redirect("/memorandos");

  const respondeA: RespuestaA | null =
    original && original.dependenciaOrigenId
      ? {
          id: original.id,
          radicado: original.radicado,
          asunto: original.asunto,
          contenido: original.respuestaTexto,
          dependenciaDestinoId: original.dependenciaOrigenId,
          usuarioDestinoId: personas.find((u) => u.id === original.radicadoPorId && u.dependenciaId === original.dependenciaOrigenId && u.recibe)?.id ?? null,
          proyectoId: original.respuestaPorId,
        }
      : null;

  return (
    <div className="space-y-4">
      <CabeceraTablero
        icon={original ? Reply : FileEdit}
        titulo={original ? `Responder memorando ${original.radicado}` : "Nuevo memorando"}
        descripcion="Diligencie el formato; la vista previa muestra el memorando tal como saldrá. Se firma electrónicamente al enviarlo."
      />
      <MemorandoForm
        dependencias={dependencias.map((d) => ({ id: d.id, nombre: d.nombre, codigo: d.codigo }))}
        origenLibre={Boolean(ctx.origenLibre)}
        series={series
          // Solo la TRD de la oficina que envía (el administrador, que elige la oficina, recibe todas y se filtran en pantalla).
          .filter((s) => ctx.origenLibre || s.dependenciaId === origen.id)
          .map((s) => ({
          id: s.id,
          codigo: s.codigo,
          nombre: s.nombre,
          dependenciaId: s.dependenciaId,
          dependenciaNombre: s.dependencia?.nombre ?? null,
          subseries: s.subseries.map(subserieBuscable),
        }))}
        personas={personas}
        remitente={{ id: yo.id, nombre: yo.nombre, cargo: yo.cargo }}
        dependenciaOrigen={{ id: origen.id, nombre: origen.nombre, codigo: origen.codigo }}
        anio={anioColombia()}
        ciudad={CIUDAD_MEMORANDO}
        fecha={fechaLargaMemorando(new Date())}
        plantillas={plantillas}
        logoUrl={config.logoUrl}
        respondeA={respondeA}
      />
    </div>
  );
}

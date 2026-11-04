import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, LayoutTemplate, Mail } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { CabeceraTablero, Chip } from "@/components/tablero";
import { EditorDisenoCorreo, EditorPlantillaCorreo } from "@/components/admin/EditorPlantillaCorreo";
import { CLAVES_MATRIZ, correoDeUsuario, definicionAviso, MODULOS_AVISO, parametros, partirClave, urlBasePlataforma } from "@/lib/avisos-correo";
import { CLAVE_DISENO, definicionPlantilla, esClavePlantilla, GRUPOS_PLANTILLA, plantillaDeEvento } from "@/lib/plantillas-correo-base";
import { leerPlantillas } from "@/lib/plantillas-correo";
import { formatearFechaHora } from "@/lib/fecha";

export default async function EditarPlantillaCorreoPage({ params }: { params: Promise<{ clave: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Plantillas de correo" quien="administrador del sistema" volverHref="/" volverLabel="Ir al inicio" />;
  const { clave: claveUrl } = await params;
  const clave = claveUrl.toUpperCase();
  const esDiseno = clave === CLAVE_DISENO;
  if (!esDiseno && !esClavePlantilla(clave)) notFound();

  const [vigentes, ajustes, yo] = await Promise.all([leerPlantillas(), parametros(), db.usuario.findUnique({ where: { id: session.userId }, select: { email: true, correoNotificacion: true } })]);
  const urlEfectiva = urlBasePlataforma(ajustes.urlPlataforma);
  const correoPrueba = ajustes.correoPrueba ?? (yo ? (correoDeUsuario(yo) ?? "") : "");
  const etiquetaClave = (c: (typeof CLAVES_MATRIZ)[number]) => {
    const { modulo, evento } = partirClave(c);
    return `${MODULOS_AVISO[modulo]} · ${definicionAviso(evento).evento}`;
  };
  const volver = (
    <Link href="/admin/correo?tab=plantillas" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800">
      <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Correo institucional · Plantillas
    </Link>
  );
  const actualizadoTexto = (m: { actualizadoPor: string | null; updatedAt: Date } | null | undefined) =>
    m ? `Modificada el ${formatearFechaHora(m.updatedAt)}${m.actualizadoPor ? ` por ${m.actualizadoPor}` : ""}` : null;

  if (esDiseno) {
    return (
      <div className="mx-auto max-w-7xl space-y-3">
        {volver}
        <CabeceraTablero
          icon={LayoutTemplate}
          titulo="Diseño general de los correos"
          descripcion="El marco común de todos los correos de la plataforma: un encabezado con el logo o una imagen, el antetítulo verde y el pie de página. Cada plantilla pone el título, el cuerpo y el botón."
        />
        <EditorDisenoCorreo
          inicial={vigentes.diseno}
          personalizada={Boolean(vigentes.disenoPersonalizado)}
          actualizado={actualizadoTexto(vigentes.disenoPersonalizado)}
          urlEfectiva={urlEfectiva}
          correoPrueba={correoPrueba}
          opcionesPrueba={CLAVES_MATRIZ.map((c) => ({ clave: c, etiqueta: etiquetaClave(c) }))}
        />
      </div>
    );
  }

  const claveP = clave as Parameters<typeof definicionPlantilla>[0];
  const def = definicionPlantilla(claveP);
  const guardada = vigentes.personalizadas.get(claveP);
  const usos = CLAVES_MATRIZ.filter((c) => plantillaDeEvento(partirClave(c).evento, partirClave(c).modulo) === claveP);

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      {volver}
      <CabeceraTablero icon={Mail} antetitulo={`Plantilla de correo · ${def.modulo ? MODULOS_AVISO[def.modulo] : GRUPOS_PLANTILLA[def.grupo]}`} titulo={def.nombre} descripcion={def.descripcion}>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
          <span className="mr-0.5">Se usa en:</span>
          {usos.map((c) => (
            <span key={c} title={ajustes.activos.has(c) ? "Se envía por correo" : "Apagada en la matriz: no se envía por correo"}>
              <Chip tono={ajustes.activos.has(c) ? "verde" : "neutro"}>
                {etiquetaClave(c)}
                {ajustes.activos.has(c) ? "" : " · apagada"}
              </Chip>
            </span>
          ))}
        </div>
      </CabeceraTablero>
      <EditorPlantillaCorreo
        clave={claveP}
        inicial={guardada ? { asunto: guardada.asunto, titulo: guardada.titulo, cuerpo: guardada.cuerpo, boton: guardada.boton } : { asunto: def.asunto, titulo: def.titulo, cuerpo: def.cuerpo, boton: def.boton }}
        diseno={vigentes.diseno}
        personalizada={Boolean(guardada)}
        actualizado={actualizadoTexto(guardada)}
        urlEfectiva={urlEfectiva}
        correoPrueba={correoPrueba}
        opcionesPrueba={usos.map((c) => ({ clave: c, etiqueta: `Datos de prueba: ${etiquetaClave(c)}` }))}
      />
    </div>
  );
}

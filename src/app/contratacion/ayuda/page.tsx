import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Users,
  FileCheck2,
  PenLine,
  ShieldCheck,
  UserSquare2,
  Link2,
  Search,
  Scale,
} from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederContratacion, puedeEditarSinTrazaDocumentoContrato } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { ETIQUETA_ROL_CONTRATACION, ETIQUETA_ETAPA } from "@/lib/contratacion";
import { BotonImprimir } from "@/components/BotonImprimir";
import { AyudaTabs } from "@/components/sgdea/AyudaTabs";

const TONO: Record<string, string> = {
  cdmb: "border-cdmb-200 bg-cdmb-50 text-cdmb-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  stone: "border-stone-200 bg-stone-100 text-stone-500",
  red: "border-red-200 bg-red-50 text-red-700",
};

function Chip({ tono, children }: { tono: keyof typeof TONO; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-medium ${TONO[tono]}`}>
      {children}
    </span>
  );
}

function Seccion({
  n,
  id,
  icono: Icono,
  titulo,
  admin,
  children,
}: {
  n: number;
  id: string;
  icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  titulo: string;
  admin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-xl border border-stone-200 bg-white shadow-soft p-5 print:break-inside-avoid print:border-stone-200">
      <div className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-stone-100 pb-3">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-cdmb-600 text-[11px] font-bold text-white">{n}</span>
        <Icono className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
        <h3 className="text-sm font-semibold text-stone-900">{titulo}</h3>
        {admin && <Chip tono="stone">Administrador / Jefe de Contratación</Chip>}
      </div>
      <div className="space-y-3 text-sm text-stone-600">{children}</div>
    </section>
  );
}

function Tabla({ encabezados, children }: { encabezados: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-100">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
            {encabezados.map((h) => (
              <th key={h} className="py-1.5 px-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  );
}

export default async function ContratacionAyudaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [permisos, config] = await Promise.all([obtenerPermisosUsuario(session.userId), getConfiguracionSitio()]);
  if (!puedeAccederContratacion(permisos)) redirect("/contratacion");
  const esAdministrador = puedeEditarSinTrazaDocumentoContrato(permisos);

  const grupoGeneral = (
    <>
      <Seccion n={1} id="alcance" icono={Briefcase} titulo="Qué es SIGEC y qué no es">
        <p>
          SIGEC (Sistema Integrado de Gestión de Expedientes de Contratación) es un <strong>manejador de
          expedientes digitales</strong> para el ciclo de un contrato, conforme al Manual de Contratación y de
          Supervisión o Interventoría A-BS-MA01 de la CDMB. Organiza documentos, etapas, firmas y contratistas
          en un solo expediente por contrato.
        </p>
        <p>
          <strong>No reemplaza SECOP II</strong> (donde se publica y adjudica el proceso), <strong>no valida
          cuantías</strong> ni reglas jurídicas de cada modalidad de selección, y no calcula ni genera CDP ni
          modificaciones al PAA — esos documentos se suben aquí como evidencia, pero se producen en otras
          plataformas.
        </p>
      </Seccion>

      <Seccion n={2} id="roles" icono={Users} titulo="Roles y qué puede hacer cada uno">
        <Tabla encabezados={["Rol", "Puede", "No puede"]}>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.ADMINISTRADOR_CONTRATACION}</strong></td>
            <td className="px-2.5 py-1.5">El encargado de sistemas. Todo lo del módulo, sin excepción — permisos totales.</td>
            <td className="px-2.5 py-1.5">—</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.JEFE_CONTRATACION}</strong></td>
            <td className="px-2.5 py-1.5">Mismo nivel que el Administrador: crea expedientes, vincula contratista/supervisores, aprueba/retrocede etapas, edita o elimina documentos sin dejar traza, elimina un expediente completo, gestiona el registro de Contratistas — de TODA la entidad.</td>
            <td className="px-2.5 py-1.5">—</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.FUNCIONARIO_CONTRATACION}</strong></td>
            <td className="px-2.5 py-1.5">Ve TODA la contratación; sube documentos (queda registrado); asigna quién debe firmar cada documento en cualquier expediente.</td>
            <td className="px-2.5 py-1.5">Aprobar/retroceder etapas, editar o eliminar sin traza, eliminar un expediente, gestionar contratistas.</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.JEFE_DEPENDENCIA}</strong></td>
            <td className="px-2.5 py-1.5">Ve y asigna firmantes solo en los expedientes de SU PROPIA dependencia solicitante.</td>
            <td className="px-2.5 py-1.5">Ver expedientes de otras dependencias, subir documentos, gestionar etapas.</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.SUPERVISOR_INTERVENTOR}</strong></td>
            <td className="px-2.5 py-1.5">Ver, subir, asignar firmantes (incluido enviar un documento a firma del propio contratista), y editar o eliminar documentos — CON traza — solo en los expedientes donde está asignado.</td>
            <td className="px-2.5 py-1.5">Ver expedientes ajenos, editar/eliminar sin dejar traza, aprobar el paso de etapa, eliminar el expediente completo.</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.CONTRATISTA}</strong></td>
            <td className="px-2.5 py-1.5">Ver y subir documentos de su(s) propio(s) expediente(s), solo en etapa Contractual y Postcontractual; firmar lo que le asignen.</td>
            <td className="px-2.5 py-1.5">Subir nada en Precontractual (ahí solo sube personal de la CDMB), ver expedientes de otros contratistas, asignar firmantes a nadie.</td>
          </tr>
        </Tabla>
        <p className="text-xs text-stone-400">
          El acceso de Contratista/Supervisor se da por Directorio Activo de la CDMB (misma cuenta de dominio) —
          se asigna desde la ficha del usuario en <em>Usuarios y roles</em>, no aquí.
        </p>
      </Seccion>
    </>
  );

  const grupoExpediente = (
    <>
      <Seccion n={3} id="etapas" icono={FileCheck2} titulo="Etapas del expediente">
        <p>
          Un contrato es <strong>un solo expediente</strong> de principio a fin — nunca se crea uno nuevo por
          etapa. Las tres etapas ({ETIQUETA_ETAPA.PRECONTRACTUAL} → {ETIQUETA_ETAPA.CONTRACTUAL} →{" "}
          {ETIQUETA_ETAPA.POSTCONTRACTUAL}) son secuenciales: solo se puede subir documentos en la etapa ACTUAL;
          las futuras se ven bloqueadas (candado) y las completadas quedan en solo lectura.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>No se puede pasar de Precontractual a Contractual sin un contratista vinculado (persona natural o jurídica) — bloqueo duro, sin excepción.</li>
          <li>Si faltan documentos obligatorios del catálogo, aprobar la etapa avisa la lista y permite continuar de todas formas (el catálogo es una guía, no un motor de validación jurídica).</li>
          <li>Retroceder una etapa corrige un avance por error — reabre la anterior y, si el expediente estaba cerrado, lo reabre.</li>
        </ul>
      </Seccion>

      <Seccion n={4} id="checklist" icono={FileCheck2} titulo="Checklist de documentos">
        <p>
          Cada etapa muestra el catálogo de documentos exigidos por el Manual A-BS-MA01 (obligatorios y
          opcionales), cruzado con lo ya subido. Un documento marcado <Chip tono="cdmb">Se gestiona en SECOP II</Chip>{" "}
          igual admite subir la evidencia aquí, aunque el trámite ocurra en otra plataforma. También se pueden
          subir documentos libres, fuera del catálogo.
        </p>
      </Seccion>

      <Seccion n={5} id="editar-sin-traza" icono={Scale} titulo="Editar y eliminar documentos, sin dejar traza" admin>
        <p>
          Decisión explícita e informada: Administrador y Jefe de Contratación pueden editar el nombre,
          <strong> reemplazar el archivo real</strong> o eliminar un documento sin que quede ninguna fila en la
          bitácora del expediente — a diferencia del SGDEA de Correspondencia, que nunca borra nada. Motivo:
          alta rotación de contratistas y errores de captura frecuentes; exigir siempre trazabilidad sería
          inviable operativamente.
        </p>
        <p className="text-xs text-stone-400">
          Reemplazar el archivo borra el anterior del almacenamiento e invalida cualquier firma o solicitud de
          firma ya registrada sobre ese documento — quedaban sobre un contenido que ya no existe.
        </p>
      </Seccion>
    </>
  );

  const grupoFirma = (
    <>
      <Seccion n={6} id="firma" icono={PenLine} titulo="Firma electrónica asignada">
        <p>
          &quot;Requiere firma&quot; ya no es solo una casilla: hay que <strong>designar explícitamente</strong>{" "}
          quién debe firmar, dar visto bueno, o tener solo acceso de lectura sobre cada documento, con el botón
          <strong> Asignar firmantes</strong> del detalle del expediente.
        </p>
        <Tabla encabezados={["Rol asignado", "Qué implica"]}>
          <tr><td className="px-2.5 py-1.5"><strong>Debe firmar</strong></td><td className="px-2.5 py-1.5">Firma electrónica con hash SHA-256, IP, agente de usuario y sello de tiempo — puede haber varios firmantes en un mismo documento.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Debe dar visto bueno</strong></td><td className="px-2.5 py-1.5">Confirma que lo revisó, sin firmar legalmente.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Solo lectura</strong></td><td className="px-2.5 py-1.5">Puede ver el documento aunque no tenga rol normal sobre ese expediente — no hay ninguna acción pendiente.</td></tr>
        </Tabla>
        <p>
          Si hay varios firmantes con <strong>turnos</strong> (número de orden): los del mismo número actúan en
          cualquier momento; uno con número mayor espera a que todos los de número menor ya hayan firmado.
        </p>
        <p>
          Lo pendiente de cada persona aparece en su{" "}
          <Link href="/contratacion/buzon" className="font-medium text-cdmb-700 hover:underline">Buzón de firmas</Link>
          . Firmar o dar visto bueno siempre muestra el documento real antes de confirmar. Un firmante puede
          rechazar (con motivo) en vez de firmar — eso marca el documento como rechazado.
        </p>
      </Seccion>

      <Seccion n={7} id="ficha-tecnica" icono={ShieldCheck} titulo="Ficha técnica y verificación por QR">
        <p>
          El rótulo/QR de cada expediente (<em>Rótulo / QR</em> en el detalle) enlaza a una página pública de
          verificación que confirma que el expediente existe, sin exponer datos personales (Ley 1712/2014). Los
          datos técnicos completos de cada firma — hash, IP, agente de usuario, identificador, sello de
          tiempo — están en <em>Ficha técnica de firmas</em>, que exige haber iniciado sesión (protección de
          datos personales, Ley 1581/2012).
        </p>
      </Seccion>
    </>
  );

  const grupoDatos = (
    <>
      <Seccion n={8} id="contratistas" icono={UserSquare2} titulo="Registro de Contratistas">
        <p>
          Es una base <strong>propia de este módulo</strong>, separada del registro de Solicitantes de Trámites
          ambientales 2.0 — no comparten identificación aunque ambos se busquen por NIT/cédula. Se administra
          desde <Link href="/contratacion/contratistas" className="font-medium text-cdmb-700 hover:underline">Contratistas</Link>.
          Al vincular un contratista a un expediente que aún no lo tiene, si la búsqueda no encuentra a nadie
          con esa identificación, se puede crear ahí mismo y queda vinculado de una vez.
        </p>
      </Seccion>

      <Seccion n={9} id="relacionados" icono={Link2} titulo="Expedientes relacionados">
        <p>
          Un mismo contratista puede tener varios contratos en distintos periodos del año — cada uno sigue
          siendo su propio expediente, nunca se fusionan. Cuando uno es una prórroga o continuación de otro, se
          puede marcar como <em>relacionado</em> desde el detalle del expediente (solo si ya tiene contratista
          vinculado, para poder elegir entre sus otros contratos).
        </p>
      </Seccion>

      <Seccion n={10} id="filtros" icono={Search} titulo="Filtros y búsqueda">
        <p>
          El listado de <Link href="/contratacion/expedientes" className="font-medium text-cdmb-700 hover:underline">Expedientes</Link>{" "}
          filtra por texto (número, objeto o contratista), etapa y dependencia solicitante.
        </p>
      </Seccion>
    </>
  );

  const grupos = [
    { id: "general", label: "Qué es y roles", contenido: grupoGeneral },
    { id: "expediente", label: "Expediente y documentos", contenido: grupoExpediente },
    { id: "firma", label: "Firma y verificación", contenido: grupoFirma },
    { id: "datos", label: "Contratistas y filtros", contenido: grupoDatos },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/contratacion" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver al panel
        </Link>
        <BotonImprimir variante="secundario">Imprimir</BotonImprimir>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6 print:border-0 print:p-0">
        <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="CDMB" className="h-12 w-auto" />
          ) : (
            <span className="text-lg font-bold text-cdmb-700">CDMB</span>
          )}
          <div>
            <p className="text-sm font-semibold text-stone-900">Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga</p>
            <p className="text-xs text-stone-500">SIGEC — Sistema Integrado de Gestión de Expedientes de Contratación — Guía de referencia</p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-stone-500">
          Describe roles, el ciclo del expediente, el mecanismo de firma electrónica asignada y los datos
          maestros del módulo. Base: Manual de Contratación y de Supervisión o Interventoría A-BS-MA01 de la
          CDMB, Ley 527/1999 y Decreto 1074/2015. No sustituye ese marco, lo referencia. Se muestra por
          pestañas; al imprimir se expande completo.
        </p>
      </div>

      <AyudaTabs grupos={grupos} />

      {esAdministrador && (
        <p className="text-center text-xs text-stone-400 print:hidden">
          Como Administrador/Jefe de Contratación, también puede consultar la excepción de auditoría en la
          sección 5 de esta guía.
        </p>
      )}
    </div>
  );
}

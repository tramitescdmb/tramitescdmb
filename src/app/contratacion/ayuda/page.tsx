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
  LayoutDashboard,
  Settings2,
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
            <td className="px-2.5 py-1.5">Mismo nivel que el Administrador: crea expedientes, vincula/cambia contratista y supervisores, aprueba/retrocede etapas, edita o elimina documentos sin dejar traza, elimina un expediente completo, gestiona el registro de Contratistas — de TODA la entidad.</td>
            <td className="px-2.5 py-1.5">—</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.FUNCIONARIO_CONTRATACION}</strong></td>
            <td className="px-2.5 py-1.5">Ve y edita TODA la contratación, en cualquier etapa (incluso una que el expediente aún no alcanza, o ya cerrada — no solo la etapa actual); sube documentos (queda registrado); edita los datos generales del expediente (modalidad, valor, dependencia, número de contrato, contratista); asigna quién debe firmar cada documento en cualquier expediente.</td>
            <td className="px-2.5 py-1.5">Aprobar/retroceder etapas, editar o eliminar sin traza, eliminar un expediente, gestionar el registro de Contratistas o los supervisores.</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.JEFE_DEPENDENCIA}</strong></td>
            <td className="px-2.5 py-1.5">Ve, asigna firmantes y puede firmar (si es asignado) solo en los expedientes de SU PROPIA dependencia solicitante.</td>
            <td className="px-2.5 py-1.5">Ver expedientes de otras dependencias, subir documentos, gestionar etapas.</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.SUPERVISOR_INTERVENTOR}</strong></td>
            <td className="px-2.5 py-1.5">Ver TODAS las etapas y archivos de los expedientes donde está asignado (incluida una que aún no se alcanza); subir, asignar firmantes (incluido enviar un documento a firma del propio contratista), y editar o eliminar documentos — CON traza — en esos mismos expedientes.</td>
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
          {ETIQUETA_ETAPA.POSTCONTRACTUAL}) son secuenciales para el flujo normal: solo se puede subir documentos en
          la etapa ACTUAL; las futuras se ven bloqueadas (candado, solo los nombres del catálogo) y las completadas
          quedan en solo lectura.
        </p>
        <p>
          Excepción (pedido explícito del usuario, 2026-09-23): Administrador, Jefe y Funcionario de Contratación
          ven y pueden adelantar documentos en <strong>cualquier</strong> etapa de <strong>cualquier</strong> expediente,
          esté alcanzada o no, e incluso una ya completada — la etapa aparece marcada &quot;(aún no alcanzada)&quot;
          para que quede claro que el expediente formalmente sigue en la etapa anterior. El supervisor/interventor
          designado también ve (no necesariamente edita) todas las etapas de los expedientes que le fueron asignados,
          aunque el expediente todavía no llegue ahí.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>No se puede pasar de Precontractual a Contractual sin un contratista vinculado (persona natural o jurídica) — bloqueo duro, sin excepción.</li>
          <li>Si faltan documentos obligatorios del catálogo, aprobar la etapa avisa la lista y permite continuar de todas formas (el catálogo es una guía, no un motor de validación jurídica).</li>
          <li>Retroceder una etapa corrige un avance por error — reabre la anterior y, si el expediente estaba cerrado, lo reabre.</li>
        </ul>
      </Seccion>

      <Seccion n={4} id="checklist" icono={FileCheck2} titulo="Checklist de documentos">
        <p>
          Cada etapa muestra el catálogo de documentos exigidos por el Manual A-BS-MA01, cruzado con lo ya subido —
          siempre con los <strong>obligatorios primero y los opcionales a continuación</strong>, sin importar el
          orden interno del catálogo. Un documento marcado <Chip tono="cdmb">Se gestiona en SECOP II</Chip>{" "}
          igual admite subir la evidencia aquí, aunque el trámite ocurra en otra plataforma. También se pueden
          subir documentos libres, fuera del catálogo.
        </p>
        <p>
          Precontractual exige la <strong>Hoja de vida SIGEP</strong> (se certifica en el SIGEP II de Función
          Pública, no en esta plataforma — aquí solo se sube la evidencia) — se resalta con una flecha en el
          checklist para que no pase desapercibida. Cualquier documento del checklist puede además{" "}
          <strong>validarse manualmente</strong> con el botón &quot;Validar&quot; — lo puede hacer
          Administrador, Jefe o Funcionario de Contratación (no Supervisor ni Jefe de dependencia). Confirma que
          alguien de Contratación ya lo revisó, aparte de la aprobación automática que ya ocurre al firmar un
          documento o al cerrar la etapa. Administrador/Jefe validan sin dejar traza (ver más abajo); Funcionario
          de Contratación sí queda registrado.
        </p>
        <p>
          Subir, editar, eliminar o validar un documento (salvo la excepción de Administrador/Jefe) deja un
          eslabón en una <strong>cadena de hash inalterable</strong> — el mismo mecanismo que ya usa el SGDEA
          (cada eslabón encadena su hash con el del anterior; alterar o borrar uno se puede detectar). Se ve al
          final del detalle de cada expediente, en &quot;Trazabilidad de los documentos&quot;.
        </p>
        <p>
          Cuatro requisitos se entregan <strong>por periodos</strong>, no como un único archivo, porque van al ritmo de la
          cuenta de cobro mensual del contratista: el <strong>Informe de supervisión</strong> (A-BS-FO116), el{" "}
          <strong>Formato único de informe de cumplimiento</strong> (A-BS-FO132), el <strong>Acta de recibo — pago
          parcial</strong> (A-BS-FO127) y el <strong>Informe de supervisión para obra pública</strong> (A-BS-FO117, solo
          en contratos de obra). Cada uno genera su propio espacio de carga numerado (Informe de supervisión 1,
          2, 3… — igual para los otros tres) por cada mes del contrato, a partir de sus fechas de inicio y de fin
          (ajustables en «Editar datos generales», ver la sección de Datos del expediente más abajo). Por ejemplo, un
          contrato del 25 de septiembre al 24 de diciembre tiene cuatro periodos: 25 sep – 30 sep, 01 oct – 31 oct,
          01 nov – 30 nov y 01 dic – 24 dic. Cada periodo se radica desde el día siguiente a su cierre. Si cambian las
          fechas del contrato, los periodos se recalculan y los informes ya cargados en meses que dejan de existir se
          conservan en un listado aparte. La lista de periodos está colapsada por defecto (se ve el avance sin
          abrirla) para no hacerse enorme cuando son muchos meses.
        </p>
        <p>
          Además de los periodos mensuales se pueden crear <strong>espacios eventuales</strong> con un nombre propio (por
          ejemplo, «Informe extraordinario por suspensión») para una eventualidad que no corresponde a un mes — cada uno
          de los cuatro requisitos por periodos tiene los suyos propios, no se comparten entre sí. Los crea
          quien lleva el expediente (Administrador, Jefe, Funcionario de Contratación o el Supervisor asignado); el
          contratista solo carga su documento en ellos. Un espacio con documento no se puede quitar hasta eliminar el
          documento.
        </p>
        <p>
          <strong>Datos del expediente</strong> (modalidad, valor, dependencia solicitante, número de contrato,
          fechas de inicio/fin, contratista): editables en cualquier momento por Administrador, Jefe o Funcionario
          de Contratación con el botón &quot;Editar datos generales&quot; del detalle del expediente — antes solo se
          fijaban al crearlo (salvo número de contrato y fechas, que ya eran editables solo por Administrador/Jefe).
          Cambiar el contratista de uno ya vinculado pide confirmación: el anterior deja de tener acceso al
          expediente. Supervisor(es)/interventor(es) y el expediente relacionado siguen siendo exclusivos de
          Administrador/Jefe.
        </p>
      </Seccion>

      <Seccion n={5} id="editar-sin-traza" icono={Scale} titulo="Editar y eliminar documentos, sin dejar traza" admin>
        <p>
          Decisión explícita e informada: Administrador y Jefe de Contratación pueden editar el nombre,
          <strong> reemplazar el archivo real</strong> o eliminar un documento sin que quede ninguna fila en la
          bitácora del expediente. Motivo: alta rotación de contratistas y errores de captura frecuentes;
          exigir siempre trazabilidad sería inviable operativamente.
        </p>
        <p className="text-xs text-stone-400">
          Reemplazar el archivo borra el anterior del almacenamiento e invalida cualquier firma o solicitud de
          firma ya registrada sobre ese documento — quedaban sobre un contenido que ya no existe.
        </p>
        <p>
          La misma excepción aplica a <strong>validar</strong> un documento y a la <strong>cadena de hash</strong>{" "}
          del expediente (ver la sección de Checklist): lo que hace Administrador o Jefe de Contratación no deja
          fila en ninguna de las dos. Funcionario de Contratación y Supervisor/Interventor SÍ quedan registrados
          en ambas — es la misma regla, no una excepción aparte.
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
        <p>
          La cantidad de documentos pendientes se indica con una <strong>insignia en la pestaña «Buzón»</strong> y con un
          aviso en el Panel (en rojo cuando ya puede firmar alguno; en gris si todos esperan el turno de otro firmante).
          En{" "}
          <Link href="/contratacion/mis-firmas" className="font-medium text-cdmb-700 hover:underline">Mis firmas</Link>{" "}
          queda el historial de lo firmado: <strong>Ver documento</strong> abre siempre el archivo firmado (el PDF con su
          sello y QR) y <strong>Ver ficha técnica</strong> muestra los datos de la firma de ese documento, sin necesidad de
          tener acceso al resto del expediente.
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
        <p>
          Vincular un expediente a un contratista <strong>no es solo para firmas</strong>: el contratista con cuenta de
          acceso consulta su expediente —incluidas las etapas Contractual y Postcontractual— y carga en él sus documentos.
          La norma general es <strong>un contratista por expediente</strong>: el vínculo se hace una sola vez y puede
          hacerse <strong>en cualquier etapa</strong>, desde el detalle del expediente («Vincular un contratista») o desde la
          ficha del contratista («Vincular un expediente», que solo ofrece expedientes sin contratista); queda en la
          bitácora. Para que el contratista pueda ingresar, su cuenta debe tener el rol Contratista (se asigna desde Usuarios).
        </p>
        <p>
          Un contratista puede además vincularse a su <strong>usuario de red (Directorio Activo)</strong> — al
          crearlo o después, desde su ficha. Es opcional y no depende de que la persona ya haya iniciado sesión:
          si esa cuenta no existe todavía, se crea (sin permisos hasta que un administrador se los asigne); el
          día que la persona entre de verdad con ese mismo usuario, cae en la misma cuenta. Así el expediente
          queda relacionado también con la identidad de dominio del contratista, no solo con su registro.
        </p>
        <p>
          Un contratista <strong>que no pertenece a ningún expediente</strong> puede eliminarse desde su ficha
          (Administrador o Jefe de Contratación); queda constancia en el registro de auditoría. Si tiene expedientes, primero
          deben reasignarse a otro contratista o eliminarse.
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

  const grupoAdministracion = (
    <>
      <Seccion n={11} id="tablero" icono={LayoutDashboard} titulo="Tablero (Panel)">
        <p>
          El <Link href="/contratacion/panel" className="font-medium text-cdmb-700 hover:underline">Panel</Link> reúne cuatro
          vistas unidas por un ciclo de anillos. <strong>Mi trabajo pendiente</strong>: documentos por firmar o revisar e
          informes de supervisión cuyo periodo ya cerró y siguen sin cargarse, de los expedientes que usted ve.{" "}
          <strong>Expedientes</strong>: cuántos hay en cada etapa y los más recientes. <strong>Indicadores</strong>: tiempos
          por etapa, firmas y distribución por dependencia y modalidad. <strong>Sistema</strong>: volumen del módulo y
          actividad reciente (solo Administrador o Jefe de Contratación).
        </p>
      </Seccion>

      <Seccion n={12} id="menu-administracion" icono={Settings2} titulo="Menú, configuración y administración" admin>
        <p>
          Todas las opciones del menú se muestran a todos los usuarios, para que el módulo se vea completo. Las que el usuario
          no puede usar aparecen <strong>atenuadas, con un candado y la leyenda de quién sí puede</strong>; no abren nada. Esto
          es solo la vitrina: el acceso real lo controla cada pantalla y cada operación del servidor.
        </p>
        <Tabla encabezados={["Opción", "Quién la usa", "Para qué"]}>
          <tr><td className="px-2.5 py-1.5"><strong>Expedientes → Nuevo expediente</strong></td><td className="px-2.5 py-1.5">Administrador o Jefe de Contratación</td><td className="px-2.5 py-1.5">Abrir un expediente contractual.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Configuración → Catálogo de requisitos</strong></td><td className="px-2.5 py-1.5">Administrador de Contratación</td><td className="px-2.5 py-1.5">Agregar, ordenar, activar o desactivar los documentos exigidos por etapa y modalidad.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Administración → Bitácora del SIGEC</strong></td><td className="px-2.5 py-1.5">Administrador o Jefe de Contratación</td><td className="px-2.5 py-1.5">Registro cronológico de la gestión de todos los expedientes, con filtros.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Administración → Usuarios y roles</strong></td><td className="px-2.5 py-1.5">Administrador del sistema</td><td className="px-2.5 py-1.5">Asignar el rol de contratación, cargos y accesos de cada persona.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Administración → Auditoría de cuentas</strong></td><td className="px-2.5 py-1.5">Administrador o Jefe de Contratación</td><td className="px-2.5 py-1.5">Inicios de sesión, gestión de usuarios y cambios de configuración.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Administración → Seguridad</strong></td><td className="px-2.5 py-1.5">Administrador o Jefe de Contratación</td><td className="px-2.5 py-1.5">Intentos de acceso, política de contraseñas, formatos de archivo permitidos y sello de tiempo de las firmas.</td></tr>
        </Tabla>
        <p className="text-xs text-stone-400">
          Seguridad y Auditoría de cuentas son las mismas de toda la aplicación: un cambio aquí rige para todos los usuarios.
        </p>
      </Seccion>
    </>
  );

  const grupos = [
    { id: "general", label: "Qué es y roles", contenido: grupoGeneral },
    { id: "expediente", label: "Expediente y documentos", contenido: grupoExpediente },
    { id: "firma", label: "Firma y verificación", contenido: grupoFirma },
    { id: "datos", label: "Contratistas y filtros", contenido: grupoDatos },
    { id: "administracion", label: "Tablero y administración", contenido: grupoAdministracion },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/contratacion/panel" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
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

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
import { obtenerPermisosUsuario, puedeAccederContratacion } from "@/lib/permisos";
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

  const grupoGeneral = (
    <>
      <Seccion n={1} id="alcance" icono={Briefcase} titulo="Alcance del módulo">
        <p>
          GECON (Gestión de Expedientes de Contratación) administra el expediente digital de cada contrato: documentos, etapas,
          firmas y contratista, conforme al Manual de Contratación y de Supervisión o Interventoría A-BS-MA01.
        </p>
        <p>
          El proceso se publica y adjudica en SECOP II. Los CDP, las modificaciones al PAA y la validación jurídica de cuantías y
          modalidades se gestionan en sus plataformas; en GECON se cargan como soporte.
        </p>
      </Seccion>

      <Seccion n={2} id="roles" icono={Users} titulo="Roles">
        <Tabla encabezados={["Rol", "Puede", "No puede"]}>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.ADMINISTRADOR_CONTRATACION}</strong></td>
            <td className="px-2.5 py-1.5">Todas las funciones del módulo.</td>
            <td className="px-2.5 py-1.5" />
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.JEFE_CONTRATACION}</strong></td>
            <td className="px-2.5 py-1.5">Crear expedientes; vincular contratista y supervisores; aprobar y retroceder etapas; editar o eliminar documentos sin registro en la bitácora; eliminar expedientes; administrar contratistas e importarlos por CSV.</td>
            <td className="px-2.5 py-1.5" />
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.FUNCIONARIO_CONTRATACION}</strong></td>
            <td className="px-2.5 py-1.5">Gestionar los expedientes que le asignan, en cualquier etapa: cargar documentos, editar datos generales y asignar firmantes. Registrar contratistas y consultar los de sus expedientes.</td>
            <td className="px-2.5 py-1.5">Ver expedientes no asignados, aprobar etapas, editar sin registro en la bitácora, eliminar expedientes o importar contratistas.</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.JEFE_DEPENDENCIA}</strong></td>
            <td className="px-2.5 py-1.5">Ver los expedientes de su dependencia, asignar firmantes y firmar lo que le asignen.</td>
            <td className="px-2.5 py-1.5">Ver expedientes de otras dependencias, cargar documentos o gestionar etapas.</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.SUPERVISOR_INTERVENTOR}</strong></td>
            <td className="px-2.5 py-1.5">En los expedientes que supervisa: ver todas las etapas, cargar, editar o eliminar documentos (con registro) y asignar firmantes.</td>
            <td className="px-2.5 py-1.5">Ver otros expedientes, aprobar etapas o eliminar el expediente.</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>{ETIQUETA_ROL_CONTRATACION.CONTRATISTA}</strong></td>
            <td className="px-2.5 py-1.5">Ver sus expedientes desde la etapa Contractual, cargar sus documentos y firmar lo asignado.</td>
            <td className="px-2.5 py-1.5">Cargar en Precontractual, ver contratos de otros o asignar firmantes.</td>
          </tr>
        </Tabla>
        <p className="text-xs text-stone-400">
          Para ingresar a GECON la persona necesita el módulo activo en su ficha de <em>Usuarios</em> y un rol de contratación.
          Quien queda registrado como contratista recibe ambos de forma automática.
        </p>
      </Seccion>
    </>
  );

  const grupoExpediente = (
    <>
      <Seccion n={3} id="etapas" icono={FileCheck2} titulo="Etapas del expediente">
        <p>
          Un contrato es un solo expediente en las tres etapas ({ETIQUETA_ETAPA.PRECONTRACTUAL} → {ETIQUETA_ETAPA.CONTRACTUAL} →{" "}
          {ETIQUETA_ETAPA.POSTCONTRACTUAL}). Los documentos se cargan en la etapa actual; las siguientes se ven bloqueadas y las
          completadas quedan en solo lectura.
        </p>
        <p>
          Administrador, Jefe y Personal de Contratación pueden adelantar documentos en cualquier etapa de los expedientes a su
          cargo; la etapa aparece marcada «(aún no alcanzada)». El supervisor ve todas las etapas de los expedientes que supervisa.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Para pasar a Contractual el contratista debe estar vinculado a su usuario.</li>
          <li>Si faltan documentos obligatorios, el sistema los lista y permite continuar.</li>
          <li>Retroceder una etapa reabre la anterior y, si el expediente estaba cerrado, lo reabre.</li>
        </ul>
      </Seccion>

      <Seccion n={4} id="checklist" icono={FileCheck2} titulo="Checklist de documentos">
        <p>
          Cada etapa muestra el catálogo de documentos del Manual A-BS-MA01 cruzado con lo cargado: primero los obligatorios, luego
          los opcionales. Los marcados <Chip tono="cdmb">Se gestiona en SECOP II</Chip> admiten cargar el soporte. También se
          pueden cargar documentos fuera del catálogo.
        </p>
        <p>
          La Hoja de vida SIGEP, exigida en Precontractual, aparece resaltada. Administrador, Jefe y Personal de Contratación
          pueden marcar cualquier documento como <strong>validado</strong>.
        </p>
        <p>
          Cada carga, edición, eliminación o validación queda en una cadena de hash, visible al final del expediente en
          «Trazabilidad de los documentos». Las acciones de Administrador y Jefe de Contratación no se registran en ella (sección 5).
        </p>
        <p>
          <strong>Requisitos por periodo.</strong> El informe de supervisión (A-BS-FO116), el informe de cumplimiento (A-BS-FO132),
          el acta de recibo de pago parcial (A-BS-FO127) y el informe de supervisión de obra (A-BS-FO117) se cargan por cada mes del
          contrato, según sus fechas de inicio y fin. Cada periodo se radica desde el día siguiente a su cierre. Ejemplo: un contrato
          del 25 de septiembre al 24 de diciembre tiene cuatro periodos (25–30 sep, octubre, noviembre y 1–24 dic). Si cambian las
          fechas, los periodos se recalculan y los informes de meses que desaparecen se conservan aparte.
        </p>
        <p>
          Para situaciones fuera del calendario mensual (por ejemplo, una suspensión) se crea un <strong>espacio eventual</strong>{" "}
          con nombre propio. Lo crea quien gestiona el expediente; el contratista carga en él su documento.
        </p>
        <p>
          <strong>Modificaciones.</strong> Se registran en el bloque «Modificaciones del contrato» del expediente: se elige el tipo
          (prórroga, adición en valor, ambas, suspensión, vigencias futuras o aclaración), se indica su fecha de suscripción, se
          diligencian sus datos y se carga una sola acta. Solo proceden durante la ejecución: entre el inicio y la terminación vigente
          (Manual, num. 7.5). Las adiciones no superan el 50 % del valor inicial expresado en SMMLV: el valor inicial se convierte con el
          salario mínimo del año de suscripción y cada adición con el de su año (Ley 80, art. 40; Manual, num. 7.5.3); los contratos de
          interventoría están exentos (Ley 1474, art. 85). Una terminación que pasa a la vigencia siguiente exige la autorización
          de vigencias futuras con el periodo cubierto en esa vigencia (meses y días, desde el 1 de enero) y su valor. Cada adición en valor
          exige su CDP y su RP; una prórroga o vigencia futura sin recursos nuevos solo exige el RP, porque la vigencia siguiente se
          respalda con el acto de autorización y no con CDP. La fecha de terminación, el valor y los informes mensuales se
          actualizan.
        </p>
        <p>
          <strong>Datos generales</strong> (modalidad, valor, dependencia, número de contrato, fechas y contratista): se corrigen con
          «Editar datos generales». Cambiar un contratista ya vinculado pide confirmación; el anterior pierde el acceso.
        </p>
      </Seccion>

      <Seccion n={5} id="editar-sin-traza" icono={Scale} titulo="Edición sin registro en la bitácora" admin>
        <p>
          Administrador y Jefe de Contratación pueden editar el nombre, reemplazar el archivo o eliminar un documento sin registro en
          la bitácora ni en la cadena de hash. Lo mismo aplica a la validación de documentos.
        </p>
        <p className="text-xs text-stone-400">
          Reemplazar el archivo invalida las firmas y solicitudes de firma registradas sobre el anterior.
        </p>
        <p>Personal de Contratación y Supervisor / Interventor sí quedan registrados.</p>
      </Seccion>
    </>
  );

  const grupoFirma = (
    <>
      <Seccion n={6} id="firma" icono={PenLine} titulo="Firma electrónica asignada">
        <p>
          En cada documento, <strong>Asignar firmantes</strong> define quién firma, quién da visto bueno y quién solo consulta.
        </p>
        <Tabla encabezados={["Calidad", "Efecto"]}>
          <tr><td className="px-2.5 py-1.5"><strong>Debe firmar</strong></td><td className="px-2.5 py-1.5">Firma electrónica con hash SHA-256, IP, agente de usuario y sello de tiempo. Admite varios firmantes.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Visto bueno</strong></td><td className="px-2.5 py-1.5">Constancia de revisión, sin firma.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Solo lectura</strong></td><td className="px-2.5 py-1.5">Acceso al documento sin acción pendiente.</td></tr>
        </Tabla>
        <p>
          El número de turno ordena las firmas: los del mismo número firman en cualquier orden; un número mayor espera a los
          anteriores.
        </p>
        <p>
          Los pendientes llegan al <Link href="/contratacion/buzon" className="font-medium text-cdmb-700 hover:underline">Buzón de firmas</Link>,
          con insignia en el menú y aviso en el Panel. El firmante revisa el documento y firma o rechaza con motivo. El rechazo genera
          un aviso para quien cargó el archivo y se cierra al reemplazarlo; el historial está en «Rechazos al firmar».
        </p>
        <p>
          <Link href="/contratacion/mis-firmas" className="font-medium text-cdmb-700 hover:underline">Mis firmas</Link> reúne lo
          firmado, con el PDF estampado y su ficha técnica. El sello lleva el nombre y el documento de cada firmante; ese mismo
          archivo es el que se descarga en el ZIP del expediente.
        </p>
      </Seccion>

      <Seccion n={7} id="ficha-tecnica" icono={ShieldCheck} titulo="Ficha técnica y verificación por QR">
        <p>
          El QR del rótulo y de los documentos firmados abre una verificación pública que confirma su existencia sin mostrar datos
          personales (Ley 1712 de 2014). La ficha técnica de firmas (hash, IP, agente de usuario y sello de tiempo) exige iniciar
          sesión (Ley 1581 de 2012).
        </p>
        <p className="text-xs text-stone-400">
          El documento y el correo del firmante se toman de su usuario y, si faltan, del registro de contratista vinculado.
        </p>
      </Seccion>
    </>
  );

  const grupoDatos = (
    <>
      <Seccion n={8} id="contratistas" icono={UserSquare2} titulo="Registro de contratistas">
        <p>
          El contratista es un usuario de la plataforma. Sus datos (documento, nombre o razón social, contacto, dirección,
          departamento, ciudad e información tributaria) se registran en Usuarios y GECON los toma de allí. Para iniciar el contrato
          deben estar completos; los completa el administrador del sistema.
        </p>
        <p>
          <strong>Registro.</strong> En «Registrar contratista» se indica primero el usuario de red. Si ya existe en la plataforma,
          se muestra la persona y se vincula directamente. Si no existe, se registra un perfil mínimo (documento, nombre y contacto)
          que queda asociado a ese usuario de red y se vincula cuando la persona ingresa por primera vez; en ese momento sus datos
          se trasladan a su usuario. Sin usuario de red, la vinculación se hace por número de documento.
        </p>
        <p>
          <strong>Carga masiva.</strong> Administrador y Jefe de Contratación pueden importar perfiles mínimos desde un archivo CSV
          en Contratistas. La pantalla ofrece la plantilla y la descripción de cada columna, revisa el archivo fila por fila y omite
          los documentos ya registrados.
        </p>
        <p>
          En <Link href="/contratacion/contratistas" className="font-medium text-cdmb-700 hover:underline">Contratistas</Link> se
          consulta quién tiene contrato activo y sus contratos por vigencia. Un contratista se vincula a un expediente una sola vez,
          en cualquier etapa, desde el expediente o desde su ficha («Vincular otro expediente»). Al vincularlo recibe el rol
          Contratista y el acceso a GECON.
        </p>
        <p>
          Un contratista sin expedientes puede eliminarse desde su ficha (Administrador o Jefe de Contratación); queda registro en la
          auditoría.
        </p>
      </Seccion>

      <Seccion n={9} id="relacionados" icono={Link2} titulo="Expedientes relacionados">
        <p>
          Cada contrato es un expediente independiente. Una prórroga o continuación se marca como <em>relacionada</em> desde el
          detalle del expediente, entre los demás contratos del mismo contratista.
        </p>
      </Seccion>

      <Seccion n={10} id="filtros" icono={Search} titulo="Filtros y búsqueda">
        <p>
          <Link href="/contratacion/expedientes" className="font-medium text-cdmb-700 hover:underline">Expedientes</Link> filtra
          por número, objeto o contratista, etapa y dependencia solicitante.
        </p>
      </Seccion>
    </>
  );

  const grupoAdministracion = (
    <>
      <Seccion n={11} id="tablero" icono={LayoutDashboard} titulo="Panel">
        <p>
          El <Link href="/contratacion/panel" className="font-medium text-cdmb-700 hover:underline">Panel</Link> tiene cuatro
          vistas: <strong>Mi trabajo pendiente</strong> (firmas, revisiones e informes de periodos cerrados sin cargar),{" "}
          <strong>Expedientes</strong> (cantidad por etapa y recientes), <strong>Indicadores</strong> (tiempos por etapa, firmas,
          dependencias y modalidades) y <strong>Sistema</strong> (volumen y actividad; Administrador o Jefe de Contratación).
        </p>
      </Seccion>

      <Seccion n={12} id="menu-administracion" icono={Settings2} titulo="Menú y administración" admin>
        <p>
          El menú muestra todas las opciones. Las que el usuario no puede usar aparecen atenuadas, con candado y la indicación de
          quién puede usarlas.
        </p>
        <Tabla encabezados={["Opción", "Quién la usa", "Para qué"]}>
          <tr><td className="px-2.5 py-1.5"><strong>Expedientes → Nuevo expediente</strong></td><td className="px-2.5 py-1.5">Administrador o Jefe de Contratación</td><td className="px-2.5 py-1.5">Abrir un expediente contractual.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Administración → Catálogo de requisitos</strong></td><td className="px-2.5 py-1.5">Administrador de Contratación</td><td className="px-2.5 py-1.5">Documentos exigidos por etapa y modalidad.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Administración → Bitácora del GECON</strong></td><td className="px-2.5 py-1.5">Administrador o Jefe de Contratación</td><td className="px-2.5 py-1.5">Registro cronológico de la gestión de los expedientes.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Administración → Usuarios y roles</strong></td><td className="px-2.5 py-1.5">Administrador del sistema</td><td className="px-2.5 py-1.5">Acceso a módulos, roles de contratación y datos personales.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Administración → Auditoría de cuentas</strong></td><td className="px-2.5 py-1.5">Administrador o Jefe de Contratación</td><td className="px-2.5 py-1.5">Inicios de sesión, gestión de usuarios, importaciones y configuración.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Administración → Seguridad</strong></td><td className="px-2.5 py-1.5">Administrador o Jefe de Contratación</td><td className="px-2.5 py-1.5">Política de contraseñas, formatos permitidos y sello de tiempo.</td></tr>
          <tr><td className="px-2.5 py-1.5"><strong>Administración → Manual de demostración</strong></td><td className="px-2.5 py-1.5">Todos; edición: Administrador o Jefe de Contratación</td><td className="px-2.5 py-1.5">Recorrido del módulo con un contrato de ejemplo.</td></tr>
        </Tabla>
        <p className="text-xs text-stone-400">Seguridad y Auditoría de cuentas aplican a toda la aplicación.</p>
      </Seccion>
    </>
  );

  const grupos = [
    { id: "general", label: "Alcance y roles", contenido: grupoGeneral },
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
        <div className="flex items-center gap-2">
          <Link href="/contratacion/manual-demostracion" className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-cdmb-300 hover:text-cdmb-700">
            Manual de demostración
          </Link>
          <BotonImprimir variante="secundario">Imprimir</BotonImprimir>
        </div>
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
            <p className="text-xs text-stone-500">GECON · Gestión de Expedientes de Contratación · Guía de referencia</p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-stone-500">
          Roles, ciclo del expediente, firma electrónica asignada y registro de contratistas. Marco: Manual A-BS-MA01 de la CDMB,
          Ley 527 de 1999 y Decreto 1074 de 2015.
        </p>
      </div>

      <AyudaTabs grupos={grupos} />

    </div>
  );
}

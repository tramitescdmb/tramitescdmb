import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  FileBadge,
  Users,
  KeyRound,
  LibraryBig,
  FolderOpen,
  Footprints,
  FileCheck2,
  CalendarDays,
  ClipboardCheck,
  Users2,
  FileSignature,
  PenLine,
  ShieldCheck,
  Bell,
  Map,
  Archive,
  Settings2,
  WifiOff,
} from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { BotonImprimir } from "@/components/BotonImprimir";
import { AyudaTabs } from "@/components/sgdea/AyudaTabs";
import { ETIQUETA_ROL_PARTICIPANTE } from "@/lib/participantes-visita";
import { MAX_FOTOS_VISITA, TAMANO_MAXIMO_FOTO_VISITA_MB } from "@/lib/visita-tecnica-fotos";

const TONO: Record<string, string> = {
  cdmb: "border-cdmb-200 bg-cdmb-50 text-cdmb-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  stone: "border-stone-200 bg-stone-100 text-stone-500",
  red: "border-red-200 bg-red-50 text-red-700",
};

function Chip({ tono, children }: { tono: keyof typeof TONO; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 font-mono text-[10.5px] font-medium ${TONO[tono]}`}>
      {children}
    </span>
  );
}

function Seccion({
  n,
  id,
  icono: Icono,
  titulo,
  quien,
  children,
}: {
  n: number;
  id: string;
  icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  titulo: string;
  quien?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft print:break-inside-avoid print:border-stone-200">
      <div className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-stone-100 pb-3">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-cdmb-600 text-[11px] font-bold text-white">{n}</span>
        <Icono className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
        <h3 className="text-sm font-semibold text-stone-900">{titulo}</h3>
        {quien && <Chip tono="stone">{quien}</Chip>}
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
              <th key={h} className="px-2.5 py-1.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  );
}

function Fila({ celdas }: { celdas: React.ReactNode[] }) {
  return (
    <tr>
      {celdas.map((c, i) => (
        <td key={i} className="px-2.5 py-1.5 align-top">
          {i === 0 ? <strong>{c}</strong> : c}
        </td>
      ))}
    </tr>
  );
}

export default async function TramitesAyudaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [permisos, config] = await Promise.all([obtenerPermisosUsuario(session.userId), getConfiguracionSitio()]);
  if (!permisos.modulos.has("TRAMITES")) redirect("/");

  const grupoGeneral = (
    <>
      <Seccion n={1} id="alcance" icono={FileBadge} titulo="Alcance del módulo">
        <p>
          Trámites ambientales 2.0 administra el expediente digital de cada solicitud ambiental que se radica ante la CDMB: radicación,
          avance por los pasos del procedimiento, documentos, visitas técnicas con su concepto, firma electrónica y archivo en el SGDEA.
        </p>
        <p>
          Cada trámite del catálogo sigue el procedimiento documentado (código <Chip tono="cdmb">M-DA-PRxx</Chip>): sus pasos, responsables,
          requisitos documentales y tiempos. Las consultas de VITAL y SINCA 1.0 son de solo lectura y se gestionan en sus propios módulos.
        </p>
      </Seccion>

      <Seccion n={2} id="acceso" icono={KeyRound} titulo="Cómo se concede el acceso" quien="Administrador del sistema">
        <p>El acceso se compone de cuatro capas, todas configuradas desde la ficha del usuario:</p>
        <Tabla encabezados={["Capa", "Qué define", "Dónde se configura"]}>
          <Fila celdas={["Módulo", "Si el usuario ve Trámites ambientales 2.0 en el menú.", "Ficha del usuario → Roles"]} />
          <Fila celdas={["Roles", "Las acciones que puede ejecutar (consultar, radicar, avanzar, validar, firmar, planear visitas, editar formatos).", "Ficha del usuario → Roles"]} />
          <Fila celdas={["Alcance por trámite", "Qué tipos de trámite ve y si los consulta (Ver) o los gestiona (Editar). Sin alcance configurado no ve ningún trámite.", "Ficha del usuario → Trámites 2.0"]} />
          <Fila celdas={["Cargo(s)", "Qué pasos del procedimiento puede avanzar, según el responsable que indica cada paso.", "Ficha del usuario → Trámites 2.0"]} />
        </Tabla>
        <p>
          Además, quien queda en el <strong>personal asignado</strong> de un expediente o en el <strong>equipo de una visita técnica</strong> puede
          consultar ese expediente completo aunque no tenga alcance sobre su tipo de trámite. Así un contratista conoce el expediente antes de la
          visita sin acceder a los demás.
        </p>
      </Seccion>

      <Seccion n={3} id="cargos" icono={Users} titulo="Cargos y lo que hacen en el módulo">
        <Tabla encabezados={["Cargo", "Funciones principales"]}>
          <Fila celdas={["Subdirector(a) SEYCA", "Planea visitas, define el equipo y los firmantes, da por terminado el concepto, edita los formatos de visita y firma como aprobador."]} />
          <Fila celdas={["Coordinador(a) de Evaluación / de Seguimiento", "Planea visitas, asigna el personal del trámite, da el visto bueno y avanza los pasos que le corresponden."]} />
          <Fila celdas={["Profesional o Técnico de Evaluación", "Realiza la visita, diligencia la hoja y el formato, corrige el concepto antes del cierre y firma lo que elabora."]} />
          <Fila celdas={["Profesional en Derecho / Jurídico", "Revisa los aspectos jurídicos del concepto y de los actos administrativos."]} />
          <Fila celdas={["Contratista de apoyo técnico o jurídico", "Realiza visitas y elabora o revisa el concepto cuando se le incluye en el equipo. No puede firmar como aprobador (firma principal)."]} />
          <Fila celdas={["Servidores de ventanilla, correspondencia, notificaciones y gestión documental", "Radican, cargan documentos y avanzan los pasos administrativos que el procedimiento les asigna."]} />
          <Fila celdas={["Administrador del sistema", "Todas las funciones, incluidos los cambios manuales de estado, la clasificación TRD y los consecutivos."]} />
        </Tabla>
        <p className="text-xs text-stone-400">
          Los roles de la visita (elabora, revisa, visto bueno, aprueba) no dependen del cargo: cualquier persona puede tener cualquier rol, salvo
          «Aprueba», que no admite contratistas.
        </p>
      </Seccion>
    </>
  );

  const grupoExpediente = (
    <>
      <Seccion n={4} id="radicacion" icono={LibraryBig} titulo="Catálogo y radicación">
        <p>
          En <strong>Catálogo de trámites</strong> se consulta cada procedimiento: pasos, requisitos y tiempos. Quien tiene alcance «Editar» sobre el
          trámite ve el botón para radicar; con «Ver» solo consulta.
        </p>
        <p>
          Al radicar se diligencian el solicitante (persona natural o jurídica), el predio y su ubicación, y se cargan los documentos que exige el
          procedimiento. El expediente recibe un número con la forma <Chip tono="cdmb">M-DA-PR39-2026-0001</Chip>: código del procedimiento, vigencia y
          consecutivo propio de ese trámite.
        </p>
      </Seccion>

      <Seccion n={5} id="expediente" icono={FolderOpen} titulo="El expediente">
        <Tabla encabezados={["Pestaña", "Contenido"]}>
          <Fila celdas={["Paso actual", "Lo que pide el paso en que está el trámite, el responsable y el botón para avanzarlo."]} />
          <Fila celdas={["Planeador", "Personal asignado al trámite y visitas técnicas programadas o realizadas."]} />
          <Fila celdas={["Solicitante y predio", "Datos del solicitante, del predio y su localización."]} />
          <Fila celdas={["Documentos", "Documentos cargados con su estado de validación y de firma."]} />
          <Fila celdas={["Flujo", "Todos los pasos del procedimiento y en cuál va el expediente."]} />
          <Fila celdas={["Historia", "Bitácora de todo lo ocurrido: radicación, avances, documentos, visitas, firmas y asignaciones."]} />
          <Fila celdas={["Administración", "Ficha del expediente en el archivo del SGDEA y cierre del expediente."]} />
        </Tabla>
        <p>
          En <strong>Expedientes</strong> se filtra por vigencia, estado, trámite, municipio y texto (número, solicitante, NIT o cédula). «Asignados a
          mí» reúne los expedientes donde la persona está en el personal asignado o en el equipo de una visita.
        </p>
      </Seccion>

      <Seccion n={6} id="pasos" icono={Footprints} titulo="Avance de los pasos">
        <p>
          Solo puede avanzar un paso quien tiene el cargo que el procedimiento indica como responsable. Si el paso no nombra un cargo reconocible, lo
          puede avanzar cualquier persona con alcance «Editar». Los estados <Chip tono="emerald">Aprobado</Chip> y <Chip tono="red">Negado</Chip> solo se
          registran desde el paso de decisión del procedimiento.
        </p>
        <p>
          El cambio manual de estado está reservado al administrador del sistema y queda en la historia del expediente. El administrador
          también puede <strong>devolver el expediente a un paso anterior</strong> (pestaña «Paso actual» → «Devolver a un paso anterior»),
          indicando el motivo; no aplica si el expediente ya tiene un estado final.
        </p>
      </Seccion>

      <Seccion n={7} id="documentos" icono={FileCheck2} titulo="Documentos y validación">
        <p>
          Los documentos se cargan en el paso que corresponda. Los que requieren firma pasan al circuito de firma electrónica; los demás se
          validan (aprobado o rechazado con observación). Eliminar un documento requiere la resolución de la Subdirección y queda registrado.
        </p>
      </Seccion>
    </>
  );

  const grupoVisitas = (
    <>
      <Seccion n={8} id="planeador" icono={CalendarDays} titulo="Planeador de visitas" quien="Coordinador(a) o Subdirector(a)">
        <p>
          El calendario muestra las visitas por día, semana, mes o agenda, con un color por profesional. Quien planea ve todas; los demás ven las
          suyas y aquellas en cuyo equipo participan.
        </p>
        <p>
          Una visita solo se programa cuando el expediente está en un paso del procedimiento que la contempla, y el profesional debe hacer parte del
          personal asignado al trámite. El sistema avisa si el profesional ya tiene otra visita a la misma hora.
        </p>
      </Seccion>

      <Seccion n={9} id="equipo" icono={Users2} titulo="Equipo de la visita y firmantes" quien="Coordinador(a) o Subdirector(a)">
        <p>En la hoja de visita, «Editar equipo» define quiénes participan y con qué rol. Esas mismas personas firman el concepto:</p>
        <Tabla encabezados={["Rol en la visita", "Cómo firma el concepto"]}>
          <Fila celdas={[ETIQUETA_ROL_PARTICIPANTE.ELABORA, "Firma como «Proyectó» (o como firma principal si no hay aprobador y no es contratista). Puede haber varias personas."]} />
          <Fila celdas={[ETIQUETA_ROL_PARTICIPANTE.REVISA_TECNICO, "Firma como «Revisó»."]} />
          <Fila celdas={[ETIQUETA_ROL_PARTICIPANTE.REVISA_JURIDICO, "Firma como «Revisó»."]} />
          <Fila celdas={[ETIQUETA_ROL_PARTICIPANTE.VISTO_BUENO, "Da visto bueno."]} />
          <Fila celdas={[ETIQUETA_ROL_PARTICIPANTE.APRUEBA, "Firma principal. Solo una persona y nunca un contratista."]} />
        </Tabla>
        <p className="text-xs text-stone-400">Máximo cuatro firmas por concepto, sin contar los vistos buenos. Quien entra al equipo recibe un aviso.</p>
      </Seccion>

      <Seccion n={10} id="hoja" icono={ClipboardCheck} titulo="Hoja de visita y formato técnico">
        <p>
          La hoja se habilita el día programado. Se captura el punto con el GPS del dispositivo (o se digita), el horario real y el formato técnico que
          corresponde al trámite: forestal, aguas, vertimientos, recurso hídrico, flora o el genérico. Los datos del expediente vienen precargados, la
          vereda, la subzona hidrográfica y las determinantes ambientales se llenan solas a partir de las coordenadas, y los cálculos se hacen en el
          formulario.
        </p>
        <p>
          Los campos marcados con «Agregar» admiten varios valores (por ejemplo, varias matrículas inmobiliarias). El registro fotográfico admite hasta{" "}
          {MAX_FOTOS_VISITA} fotos de máximo {TAMANO_MAXIMO_FOTO_VISITA_MB} MB cada una, con su pie de foto; se comprimen automáticamente.
        </p>
      </Seccion>

      <Seccion n={11} id="sin-conexion" icono={WifiOff} titulo="Trabajo sin conexión">
        <p>
          Si el profesional abre la hoja con señal el día de la visita, puede diligenciarla y registrarla sin conexión: el borrador y las fotos quedan
          guardados en el dispositivo y se envían solos al recuperar la señal. No debe cerrar la sesión ni borrar los datos del navegador mientras haya
          hojas pendientes de envío.
        </p>
      </Seccion>

      <Seccion n={12} id="concepto" icono={FileSignature} titulo="Concepto técnico: número, corrección, cierre y reapertura">
        <Tabla encabezados={["Acción", "Quién", "Efecto"]}>
          <Fila celdas={["Asignar número de concepto", "Profesional de la visita o quien planea", "Toma el siguiente consecutivo EV de la vigencia (EV-0001-2026) con la fecha del día."]} />
          <Fila celdas={["Corregir concepto", "Quien elabora o quien planea", "Permite ajustar el formato, el resultado y las fotos mientras el concepto no se haya dado por terminado."]} />
          <Fila celdas={["Enviar a revisión", "Quien elabora", "El concepto queda «En revisión» y quien planea recibe el aviso. Mientras tanto, quien elabora no puede editarlo."]} />
          <Fila celdas={["Devolver con observaciones", "Coordinador(a), Subdirector(a) o administrador", "El concepto vuelve a quien elabora con las observaciones, que quedan en el historial de revisión."]} />
          <Fila celdas={["Aprobar y enviar a firma", "Coordinador(a), Subdirector(a) o administrador", "Genera el PDF del concepto, lo guarda en los documentos del expediente, lo bloquea y envía la solicitud de firma a cada miembro del equipo según su rol."]} />
          <Fila celdas={["Reabrir para corrección", "Coordinador(a), Subdirector(a) o administrador", "Retira las firmas pendientes y conserva el PDF anterior como versión reemplazada. Se corrige y se vuelve a enviar. No aplica cuando todos ya firmaron."]} />
        </Tabla>
        <p>
          El documento muestra la tabla de responsables (rol, nombre y cargo). Las firmas no se estampan sobre ese bloque: constan en la hoja de firmas
          electrónicas que se agrega al PDF, con su código de verificación.
        </p>
      </Seccion>

      <Seccion n={13} id="formatos" icono={Settings2} titulo="Formatos de visita" quien="Subdirector(a) SEYCA o administrador">
        <p>
          En Planeador → Formatos de visita se diseñan los formatos: secciones, campos, tablas con cálculos, listas de chequeo y textos tipo que se
          completan con los datos de la visita. Cada cambio se guarda como borrador y se publica como una versión nueva; las visitas ya registradas
          conservan la versión con la que se diligenciaron.
        </p>
        <p>
          Un formato se vincula a uno o varios trámites que aún no tengan formato propio. El formato genérico cubre los trámites con visita que no
          tienen uno propio, incluidos los procedimientos que se creen después.
        </p>
        <p>
          En Planeador → Actividades por paso se define qué actividad corresponde a cada paso de un trámite (visita técnica, programar visita, concepto
          técnico, notificación, firma, decisión u otra) y, en los pasos de visita, el formato que se debe diligenciar; ese formato prima sobre el del
          trámite. Los pasos sin definir se clasifican por su título. Cuando un expediente llega a un paso de visita, el planificador recibe el aviso
          para programarla; cuando llega a un paso de concepto técnico, el personal asignado recibe el aviso para elaborarlo.
        </p>
      </Seccion>
    </>
  );

  const grupoFirma = (
    <>
      <Seccion n={14} id="firma" icono={PenLine} titulo="Firma electrónica">
        <p>
          Las solicitudes de firma llegan al <strong>Buzón de firmas</strong>. El orden lo fija el cargo de cada firmante: quien tiene un turno
          anterior debe firmar primero, y el buzón indica a quién se espera. Los vistos buenos no bloquean a los demás.
        </p>
        <p>
          Al firmar se confirma la identidad y se registra un sello de texto con nombre, cargo, fecha y hora, huella del documento y código QR. No se
          usa imagen de rúbrica. Quien rechaza debe indicar el motivo; el rechazo llega a quien cargó o envió el documento.
        </p>
        <p>
          En la página del concepto técnico, <strong>Estado de las firmas</strong> indica cuántas faltan y de quién, en qué orden y a quién le
          corresponde el turno. El equipo de la visita y quien planea pueden pulsar «Recordar a quien tiene el turno»; la persona recibe el aviso
          en la campana y en su buzón (máximo un recordatorio cada 4 horas).
        </p>
      </Seccion>

      <Seccion n={15} id="verificacion" icono={ShieldCheck} titulo="Verificación de firmas">
        <p>
          Cualquier persona puede comprobar un documento firmado en <strong>Validador de firmas</strong> (enlace superior), con el código del sello o
          el QR. «Mis firmas» lista los documentos firmados por el usuario y «Rechazos al firmar» los rechazos por atender.
        </p>
      </Seccion>
    </>
  );

  const grupoAvisos = (
    <>
      <Seccion n={16} id="avisos" icono={Bell} titulo="Avisos y contadores">
        <p>Los pendientes se ven en tres lugares, con la misma información:</p>
        <Tabla encabezados={["Lugar", "Qué muestra"]}>
          <Fila celdas={["Campana del encabezado", "Lista de pendientes de todos los módulos: firmas, rechazos, visitas por realizar o registrar y avisos sin leer."]} />
          <Fila celdas={["Menú principal", "Un número rojo junto a cada módulo con sus pendientes."]} />
          <Fila celdas={["Menú del módulo", "El número en cada opción: Firmas, Rechazos al firmar, Calendario y Buzón de visitas."]} />
        </Tabla>
        <p>
          El <strong>Buzón de visitas</strong> reúne los avisos del planeador: visita programada, reprogramada o cancelada, inclusión en el equipo,
          visitas sin programar o sin registrar, y concepto firmado o rechazado.
        </p>
      </Seccion>

      <Seccion n={17} id="visor" icono={Map} titulo="Visor de trámites">
        <p>
          Mapa de los expedientes con capas de la jurisdicción (municipios, veredas, subzonas hidrográficas, áreas protegidas, páramos y bosque seco),
          filtros por trámite y estado, medición de distancias y búsqueda de expedientes cercanos a un punto. Permite descargar la imagen y el reporte.
        </p>
      </Seccion>

      <Seccion n={18} id="archivo" icono={Archive} titulo="Archivo y disposición final">
        <p>
          Al cerrar un expediente queda su ficha de solo lectura en el archivo del SGDEA, clasificada según la TRD. «Disposición final (TRD)» muestra
          los expedientes que cumplieron su tiempo de retención.
        </p>
      </Seccion>

      <Seccion n={19} id="menu" icono={Settings2} titulo="Menú y administración">
        <Tabla encabezados={["Opción", "Quién la usa", "Para qué"]}>
          <Fila celdas={["Expedientes → Clasificación TRD", "Administrador del sistema", "Asignar la subserie documental de cada trámite."]} />
          <Fila celdas={["Planeador → Formatos de visita", "Subdirector(a) SEYCA o administrador", "Diseñar y publicar los formatos técnicos."]} />
          <Fila celdas={["Planeador → Actividades por paso", "Subdirector(a) SEYCA o administrador", "Definir la actividad de cada paso y el formato de visita que aplica."]} />
          <Fila celdas={["Expedientes → Flujos de trabajo", "Subdirector(a) SEYCA o administrador", "Tareas internas por pasos sobre un expediente con responsable (por cargo o personal asignado) y término; se aplican desde la pestaña «Flujo de trabajo» del expediente, o solas al radicar si el flujo es automático, y no cambian los pasos del procedimiento. Plantillas: auto de inicio, información adicional, concepto técnico, resolución, notificación, reposición, cobro y seguimiento. Al cerrar y archivar el expediente, el flujo en curso termina; la decisión de fondo no lo termina."]} />
          <Fila celdas={["Administración → Consecutivos", "Administrador del sistema", "Fijar el siguiente número de expedientes, conceptos EV y demás series por vigencia."]} />
          <Fila celdas={["Administración → Usuarios y Roles", "Administrador del sistema", "Módulos, roles, cargos y alcance por trámite de cada usuario."]} />
          <Fila celdas={["Ayuda → Manual de demostración", "Todos; edición: Subdirector(a) SEYCA o administrador", "Recorrido del módulo con un expediente de ejemplo."]} />
        </Tabla>
      </Seccion>
    </>
  );

  const grupos = [
    { id: "general", label: "Alcance y acceso", contenido: grupoGeneral },
    { id: "expediente", label: "Radicación y expediente", contenido: grupoExpediente },
    { id: "visitas", label: "Visitas y concepto", contenido: grupoVisitas },
    { id: "firma", label: "Firma y verificación", contenido: grupoFirma },
    { id: "avisos", label: "Avisos y administración", contenido: grupoAvisos },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/tramites-ambientales" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver al panel
        </Link>
        <div className="flex items-center gap-2">
          {permisos.esAdmin && <Link
            href="/tramites-ambientales/manual-demostracion"
            className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-cdmb-300 hover:text-cdmb-700"
          >
            Manual de demostración
          </Link>}
          <BotonImprimir variante="secundario">Imprimir</BotonImprimir>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 print:border-0 print:p-0">
        <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="CDMB" className="h-12 w-auto" />
          ) : (
            <span className="text-lg font-bold text-cdmb-700">CDMB</span>
          )}
          <div>
            <p className="text-sm font-semibold text-stone-900">Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga</p>
            <p className="text-xs text-stone-500">Trámites ambientales 2.0 · Guía de referencia</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-stone-500">
          Acceso, radicación, avance del procedimiento, visitas técnicas con su concepto, firma electrónica y avisos. Marco: Decreto 1076 de 2015,
          Ley 1437 de 2011, Ley 527 de 1999 y los procedimientos del Sistema de Gestión de la CDMB.
        </p>
      </div>

      <AyudaTabs grupos={grupos} />
    </div>
  );
}

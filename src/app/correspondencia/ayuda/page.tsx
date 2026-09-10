import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Inbox,
  Send,
  FolderOpen,
  Users,
  Settings2,
  Archive,
  ScrollText,
  LayoutDashboard,
  Tags,
  Workflow,
  CalendarDays,
} from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeAdministrarArchivo } from "@/lib/permisos";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { ETIQUETA_NIVEL_ACCESO, CLASE_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import { ETIQUETA_DISPOSICION } from "@/lib/trd";
import { ACCIONES_BITACORA, ETIQUETA_ACCION_BITACORA } from "@/lib/correspondencia-bitacora";
import { ETIQUETA_TIPO_PASO, ETIQUETA_ASIGNACION } from "@/lib/flujos";
import { ETIQUETA_TIPO_CAMPO } from "@/lib/metadatos";
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
    <section id={id} className="scroll-mt-4 rounded-xl border border-stone-200 bg-white p-5 print:break-inside-avoid print:border-stone-300">
      <div className="mb-3 flex flex-wrap items-center gap-2.5 border-b border-stone-100 pb-3">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-cdmb-600 text-[11px] font-bold text-white">{n}</span>
        <Icono className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
        <h3 className="text-sm font-semibold text-stone-900">{titulo}</h3>
        {admin && <Chip tono="stone">Solo administración</Chip>}
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

const DESCRIPCION_ACCION_BITACORA: Record<string, string> = {
  CREA: "Se creó un registro (comunicación, expediente, serie, dependencia, etc.).",
  LEE: "Se consultó el detalle de un registro. Incluida la sola lectura queda trazada.",
  MODIFICA: "Se modificó un campo de un registro existente.",
  EXPORTA: "Se exportó un conjunto de datos a un archivo descargable (CSV/XML).",
  ELIMINA: "Se eliminó un registro. Uso restringido: la bitácora misma nunca se elimina.",
  DISTRIBUYE: "Se repartió una comunicación a una dependencia o a uno o varios funcionarios.",
  DESPACHA: "La ventanilla de salida registró el envío efectivo de un oficio de salida (correo/físico) — cierra el ciclo.",
  FIRMA: "Se firmó electrónicamente un oficio de salida o memorando (hash SHA-256 del contenido). Incluye la firma en lote.",
  CLASIFICA: "Se asignó o cambió la serie/subserie documental (TRD) de un registro.",
  ARCHIVA: "Se archivó una comunicación dentro de un expediente.",
  ANULA: "Se anuló una comunicación, con justificación registrada.",
  SUSPENDE: "Se suspendió el término de ley de una PQRSD (Art. 17 CPACA/Ley 1437).",
  REACTIVA: "Se reactivó un término de ley previamente suspendido.",
  TRANSFIERE: "Se transfirió un expediente del archivo de gestión al archivo central.",
  DISPONE: "Se ejecutó la disposición final de una subserie vencida.",
  ACCESO_DENEGADO: "Un usuario sin permiso intentó entrar a una sección restringida del módulo.",
  APLAZA: "Se aplazó una disposición final ya vencida (ej. proceso judicial en curso) — distinto de suspender un término de ley.",
  RESPONDE: "El funcionario asignado guardó o editó el borrador de respuesta de una comunicación recibida.",
  PRESTA: "Se prestó un expediente documental a un funcionario.",
  DEVUELVE: "Se registró la devolución de un expediente prestado.",
  REABRE: "Se reabrió un expediente documental cerrado, con motivo obligatorio (Art. 4.3.2.4 Acuerdo 001/2024 AGN).",
  CARGA_FALLIDA: "Se rechazó un intento de agregar un documento a un expediente (validación de tipo, cierre, u otra regla).",
  ERROR_EJECUCION: "Falla registrada por el propio sistema durante una operación automática (cálculo de términos, cargue, etc.). Alimenta el aviso de incidencias del Panel.",
  FLUJO: "Se aplicó un flujo de trabajo a una comunicación, se completó un paso o se canceló el flujo.",
};

/**
 * Documento de referencia técnica del módulo (MoReq 8.13: ayuda contextual). Fichas técnicas por función —
 * estado, acción disponible y rol requerido — trazables 1:1 contra los enums de dominio
 * (prisma/schema.prisma) y las funciones de permisos (src/lib/permisos.ts), para que el contenido no
 * pueda quedar desactualizado en silencio frente al código. Agrupado en pestañas (AyudaTabs) para lectura;
 * al imprimir se expande completo.
 */
export default async function CorrespondenciaAyudaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [permisos, config] = await Promise.all([obtenerPermisosUsuario(session.userId), getConfiguracionSitio()]);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/correspondencia");
  const esAdministrador = puedeAdministrarArchivo(permisos);

  const grupoCiclo = (
    <>
      <Seccion n={1} id="organizacion" icono={LayoutDashboard} titulo="Cómo se organiza el módulo">
        <p>
          El SGDEA se recorre desde tres elementos siempre visibles en la parte superior. Todo lo relacionado
          con el sistema — incluidos usuarios y roles, auditoría de cuentas, seguridad de contraseñas y el
          calendario laboral de la Corporación — es alcanzable desde aquí sin salir del módulo (MoReq cap. 6).
        </p>
        <Tabla encabezados={["Elemento", "Qué es", "Para quién"]}>
          <tr>
            <td className="px-2.5 py-1.5"><strong>Panel</strong></td>
            <td className="px-2.5 py-1.5">
              Tablero de cuatro vistas encadenadas — <em>Mi trabajo pendiente</em> → <em>Correspondencia</em> →{" "}
              <em>Expedientes y archivo</em> → <em>Sistema</em>. Reúne indicadores, pendientes propios y las
              métricas de tiempo que antes estaban en «Reportes».
            </td>
            <td className="px-2.5 py-1.5">Todos; la vista «Sistema» solo el administrador de archivo</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>Pestañas con submenú</strong></td>
            <td className="px-2.5 py-1.5">
              La barra agrupa las pantallas por función: Correspondencia, Expedientes y archivo, Plantillas y —
              para el administrador — Configuración y Administración. Cada grupo abre su menú de pantallas.
            </td>
            <td className="px-2.5 py-1.5">Según el rol; los grupos sin permiso no aparecen</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>Ruta de ubicación</strong></td>
            <td className="px-2.5 py-1.5">
              Bajo la barra, una línea del tipo «SGDEA › Configuración › Flujos de trabajo › Editar flujo»
              indica en todo momento en qué pantalla se está y permite volver a cualquier nivel.
            </td>
            <td className="px-2.5 py-1.5">Todos</td>
          </tr>
        </Tabla>
      </Seccion>

      <Seccion n={2} id="radicacion" icono={Inbox} titulo="Radicación unificada">
        <p>
          Todo documento que entra o sale de la entidad por este módulo recibe un <strong>radicado</strong> —
          consecutivo atómico, inalterable, asignado dentro de una transacción de base de datos para excluir
          números repetidos bajo concurrencia. El formato es <span className="font-mono text-xs">CDMB-{"{"}R|E|I{"}"}-AAAA-NNNNNN</span>,
          donde la letra identifica el tipo y la numeración reinicia cada año.
        </p>
        <Tabla encabezados={["Tipo", "Letra", "Origen", "Firma", "Ciclo posterior"]}>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="cdmb">RECIBIDA</Chip></td>
            <td className="px-2.5 py-1.5 font-mono">R</td>
            <td className="px-2.5 py-1.5">Un tercero (petición, PQRSD, oficio externo)</td>
            <td className="px-2.5 py-1.5">No aplica al radicar</td>
            <td className="px-2.5 py-1.5">Multietapa — ver «Ciclo de la comunicación recibida»</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="emerald">ENVIADA</Chip></td>
            <td className="px-2.5 py-1.5 font-mono">E</td>
            <td className="px-2.5 py-1.5">La entidad, hacia un tercero</td>
            <td className="px-2.5 py-1.5">Electrónica con hash, en el acto de radicar</td>
            <td className="px-2.5 py-1.5">Ninguno — queda definitiva</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="emerald">INTERNA</Chip></td>
            <td className="px-2.5 py-1.5 font-mono">I</td>
            <td className="px-2.5 py-1.5">Una dependencia, hacia otra</td>
            <td className="px-2.5 py-1.5">Electrónica con hash, en el acto de radicar</td>
            <td className="px-2.5 py-1.5">Ninguno — queda definitiva</td>
          </tr>
        </Tabla>

        <p className="pt-1 text-xs font-medium uppercase tracking-wide text-stone-400">Rótulo y verificación (Acuerdo 060/2001 AGN)</p>
        <p>
          Cada radicado tiene un <strong>rótulo imprimible</strong> (detalle → «Rótulo con código de barras»):
          el número, la fecha, un <strong>código de barras Code 128</strong> generado automáticamente del
          radicado, y un <strong>QR</strong>. Se adhiere al documento físico. Para un documento electrónico
          (PDF), el botón «Con rótulo» descarga una copia con ese rótulo y — si la comunicación está firmada —
          el sello de firma estampados en la primera página; el archivo original nunca se modifica.
        </p>
        <p>
          El QR abre una <strong>página pública de verificación</strong> (<span className="font-mono text-xs">/verificar/&lt;radicado&gt;</span>):
          confirma que el número existe y muestra su tipo, fecha y estado, <strong>sin revelar el contenido</strong>.
        </p>
      </Seccion>

      <Seccion n={3} id="recibida" icono={Inbox} titulo="Ciclo de la comunicación recibida">
        <p>
          Es el único tipo con un ciclo de varios estados — entra desde fuera de la entidad y por eso
          requiere reparto y trámite antes de cerrarse. El detalle de cada comunicación calcula y muestra
          cuál de estas transiciones aplica a continuación.
        </p>
        <p className="rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-600">
          <strong>Quién hace qué:</strong> la <strong>ventanilla</strong> radica de entrada y, al final, registra el
          despacho de salida. El <strong>administrador o el rol de archivo</strong> (gestión documental) reparte el
          trámite — a una o varias personas. El <strong>funcionario asignado</strong> solo redacta el borrador de
          respuesta. La <strong>ventanilla de salida</strong> lo radica como oficio de salida (consecutivo + firma) y
          después registra el envío efectivo al peticionario, que es lo que cierra el ciclo.
        </p>
        <Tabla encabezados={["Estado", "Descripción técnica", "Acción disponible", "Quién"]}>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="cdmb">RADICADA</Chip></td>
            <td className="px-2.5 py-1.5">Ingresó por ventanilla; consecutivo, fecha y hora quedan inalterables.</td>
            <td className="px-2.5 py-1.5">Repartir a dependencia o funcionario(s)</td>
            <td className="px-2.5 py-1.5">ADMIN_ARCHIVO / admin</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="cdmb">EN_REPARTO</Chip></td>
            <td className="px-2.5 py-1.5">Pendiente de asignarse a una dependencia o funcionario.</td>
            <td className="px-2.5 py-1.5">Repartir (admite varios destinatarios a la vez)</td>
            <td className="px-2.5 py-1.5">ADMIN_ARCHIVO / admin</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="cdmb">ASIGNADA</Chip></td>
            <td className="px-2.5 py-1.5">Repartida a una dependencia o a funcionario(s) específicos.</td>
            <td className="px-2.5 py-1.5">Redactar el borrador de respuesta</td>
            <td className="px-2.5 py-1.5">Solo el/los funcionario(s) del reparto vigente</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="cdmb">EN_TRAMITE</Chip></td>
            <td className="px-2.5 py-1.5">Hay un borrador de respuesta en curso (aún no es oficio firmado).</td>
            <td className="px-2.5 py-1.5">Radicar el borrador como oficio de salida</td>
            <td className="px-2.5 py-1.5">Ventanilla de salida (OPERADOR_VENTANILLA / ADMIN_ARCHIVO)</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="amber">INFORMACION_ADICIONAL_REQUERIDA</Chip></td>
            <td className="px-2.5 py-1.5">Término de ley suspendido (Art. 17 CPACA) hasta que el peticionario responda.</td>
            <td className="px-2.5 py-1.5">Reactivar el término al recibir la información</td>
            <td className="px-2.5 py-1.5">ADMIN_ARCHIVO / admin</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="emerald">RESPONDIDA</Chip></td>
            <td className="px-2.5 py-1.5">Se radicó el oficio de respuesta (ENVIADA). Falta despacharlo.</td>
            <td className="px-2.5 py-1.5">Registrar el despacho efectivo (correo/físico) — cierra el ciclo</td>
            <td className="px-2.5 py-1.5">Ventanilla de salida</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="emerald">ARCHIVADA</Chip></td>
            <td className="px-2.5 py-1.5">Quedó archivada dentro de un expediente documental o de trámite.</td>
            <td className="px-2.5 py-1.5">Consulta; disposición final futura de la subserie</td>
            <td className="px-2.5 py-1.5">ADMIN_ARCHIVO (para disposición)</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="stone">ANULADA</Chip></td>
            <td className="px-2.5 py-1.5">Anulada con justificación registrada; no se elimina, queda trazada.</td>
            <td className="px-2.5 py-1.5">Consulta</td>
            <td className="px-2.5 py-1.5">—</td>
          </tr>
        </Tabla>
        <p className="text-xs text-stone-500">
          Sobre una comunicación en trámite se puede aplicar además un <strong>flujo de trabajo</strong>: una
          ruta de pasos con responsable y término propios, en paralelo al estado del radicado.
        </p>
      </Seccion>

      <Seccion n={4} id="enviada" icono={Send} titulo="Comunicación enviada, memorando y firma">
        <p>
          A diferencia de una recibida, un oficio de salida (ENVIADA) o un memorando (INTERNA) se redactan y
          se firman <strong>en el mismo acto</strong> de radicarse — no existe un estado de borrador
          posterior. La firma electrónica captura identidad del funcionario, marca de tiempo, intención y el
          hash SHA-256 del contenido (Ley 527/1999, Decreto 1074/2015); a partir de ahí el documento es
          definitivo y no editable.
        </p>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">El sello de firma</p>
        <p>
          Al pie del documento aparece un sello con el <strong>nombre</strong> del firmante, su{" "}
          <strong>denominación del empleo</strong> (con la forma femenina o masculina según el sexo
          registrado) y su <strong>oficina</strong>, la fecha‑hora, los primeros dígitos del hash SHA‑256 y la
          cita legal (Ley 527/1999 · Decreto 1074/2015). La denominación se administra en la ficha de cada
          usuario y es distinta del cargo de trámites.
        </p>
        <p>
          <strong>Estampado cronológico.</strong> Cada firma lleva un sello de tiempo. Por defecto es la propia
          bitácora encadenada por hash del SGDEA (orden verificable e inmutable). Si el administrador configura
          la URL de una <strong>autoridad de sello de tiempo RFC‑3161</strong> en Administración → Seguridad,
          cada firma además pide un token verificable por un tercero.
        </p>
        <p>
          <strong>Quién puede firmar.</strong> Cualquier funcionario del módulo cuya ficha tenga marcado
          «puede firmar electrónicamente» (por defecto, sí). Un administrador puede retirar ese acceso por
          persona; no afecta las firmas ya registradas.
        </p>
        <Tabla encabezados={["Tipo", "Al radicarse", "Barra de estado", "Paso siguiente"]}>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="emerald">ENVIADA</Chip></td>
            <td className="px-2.5 py-1.5">Firma electrónica + hash SHA-256</td>
            <td className="px-2.5 py-1.5">Radicado y firmado</td>
            <td className="px-2.5 py-1.5">Registrar el despacho efectivo (ventanilla de salida)</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="emerald">INTERNA</Chip></td>
            <td className="px-2.5 py-1.5">Firma electrónica + hash SHA-256</td>
            <td className="px-2.5 py-1.5">100% — &quot;Memorando firmado&quot;</td>
            <td className="px-2.5 py-1.5">Ninguno; queda definitivo. Distribuir es opcional, solo seguimiento interno</td>
          </tr>
        </Tabla>
        <p>
          <strong>Firma en lote.</strong> Desde la bandeja, quien tiene permiso para radicar puede marcar
          varios oficios de salida o memorandos que aún no llevan su firma y firmarlos en una sola acción. El
          sistema omite los que no apliquen (ya firmados por esa persona, anulados) sin abortar el lote; cada
          documento firmado conserva su propio hash SHA-256 y su registro en la bitácora.
        </p>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Despacho — cierre del ciclo</p>
        <p>
          Radicar y firmar un oficio de salida <strong>no significa que ya salió</strong>. Cuando el oficio se
          envía de verdad al destinatario, la <strong>ventanilla de salida / gestión documental</strong> registra
          el <strong>despacho efectivo</strong> en el detalle del oficio: medio (correo electrónico, físico,
          mensajería, entrega personal), destino y fecha. Ese paso — no la radicación — es el que cierra el ciclo
          de la comunicación recibida a la que responde. Ni el funcionario que redactó ni quien firmó despachan.
        </p>
        <p>
          Al despachar, si el oficio tiene clasificación TRD, una casilla (marcada por defecto) archiva la
          recibida y la respuesta en un <strong>expediente documental de la subserie</strong>, creándolo si no
          existe. La bandeja muestra el vínculo entre el radicado de entrada y el de salida, con un indicador de
          si ya se despachó.
        </p>
      </Seccion>
    </>
  );

  const grupoExpedientes = (
    <>
      <Seccion n={5} id="expediente" icono={FolderOpen} titulo="Expediente documental">
        <p>
          Unidad documental que agrupa varios documentos y/o comunicaciones de un mismo asunto o
          procedimiento de una dependencia (Art. 4.3.2 Acuerdo 001/2024 AGN). Se abre directamente en{" "}
          <Link href="/correspondencia/expedientes" className="text-cdmb-700 underline hover:no-underline">Expedientes</Link>,
          sin necesidad de que el contenido llegue por correspondencia.
        </p>
        <Tabla encabezados={["Estado", "Descripción técnica", "Acción disponible"]}>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="cdmb">ABIERTO</Chip></td>
            <td className="px-2.5 py-1.5">Recibe documentos propios y comunicaciones ya radicadas que se le archiven.</td>
            <td className="px-2.5 py-1.5">Subir documentos, archivar comunicaciones, prestar</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><Chip tono="emerald">CERRADO</Chip></td>
            <td className="px-2.5 py-1.5">Índice electrónico firmado (hash SHA-256 del índice de documentos).</td>
            <td className="px-2.5 py-1.5">Solo consulta. Integridad verificable comparando el hash almacenado contra el recálculo del índice actual. Reabrir (motivo obligatorio, auditado) exige ADMIN_ARCHIVO.</td>
          </tr>
        </Tabla>
        <p className="pt-1 text-xs font-medium uppercase tracking-wide text-stone-400">Nivel de acceso a la información (Ley 1712/2014, arts. 6, 18 y 19)</p>
        <Tabla encabezados={["Nivel", "Quién puede verlo"]}>
          {(["PUBLICA", "CLASIFICADA", "RESERVADA"] as const).map((n) => (
            <tr key={n}>
              <td className="px-2.5 py-1.5">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10.5px] font-medium ${CLASE_NIVEL_ACCESO[n]}`}>
                  {ETIQUETA_NIVEL_ACCESO[n]}
                </span>
              </td>
              <td className="px-2.5 py-1.5">
                {n === "PUBLICA" ? "Cualquier usuario con acceso al módulo" : "Solo la dependencia responsable del expediente, o ADMIN_ARCHIVO"}
              </td>
            </tr>
          ))}
        </Tabla>
        <p>
          <strong>Préstamo:</strong> un expediente admite un único préstamo activo a la vez (motivo, fecha de
          préstamo, fecha de devolución esperada); registrar la devolución lo deja disponible de nuevo.{" "}
          <strong>Documentos:</strong> cada uno admite una fecha propia (si es distinta de la de carga) y un
          tipo documental, restringido a los definidos en la subserie del expediente.
        </p>
        <p className="pt-1 text-xs font-medium uppercase tracking-wide text-stone-400">Índice electrónico y foliación</p>
        <p>
          Cada expediente lleva un <strong>índice electrónico</strong>: la lista de sus documentos en el orden
          real de incorporación, con el número de folios (hojas) de cada uno y el <strong>rango de folios
          acumulado</strong> (MoReq 1.19/1.51). El índice se exporta a CSV y a XML. Al cerrar, ese índice se
          firma con hash SHA-256; desde entonces el sistema lo recalcula en cada consulta y avisa si el orden,
          el nombre o la huella de algún documento cambió después del cierre (cotejo de integridad, MoReq 1.26).
        </p>
        <p>
          La <strong>serie</strong> del expediente fija dos parámetros que se aplican a todos sus expedientes:
          desde cuándo cuenta la retención — la radicación de cada documento (por defecto) o el cierre del
          expediente (MoReq 2.6) — y el máximo de folios por tomo, con el que el FUID calcula en cuántos tomos
          se divide cada expediente (MoReq 1.43).
        </p>
      </Seccion>

      <Seccion n={6} id="metadatos" icono={Tags} titulo="Metadatos de una comunicación">
        <p>
          Además del radicado, la fecha y la clasificación TRD, una comunicación admite dos tipos de metadato
          adicionales que se llenan y modifican en cualquier momento desde su detalle (MoReq cap. 5), con
          constancia en la bitácora.
        </p>
        <Tabla encabezados={["Tipo", "Qué es", "Quién lo edita"]}>
          <tr>
            <td className="px-2.5 py-1.5"><strong>Palabras clave</strong></td>
            <td className="px-2.5 py-1.5">
              Términos tomados del <strong>vocabulario controlado</strong> de la entidad — una lista cerrada
              que administra el archivo — para búsqueda y recuperación homogénea.
            </td>
            <td className="px-2.5 py-1.5">Quien puede distribuir</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5"><strong>Campos de metadato adicionales</strong></td>
            <td className="px-2.5 py-1.5">
              Campos que define el administrador de archivo ({Object.values(ETIQUETA_TIPO_CAMPO).join(", ").toLowerCase()}),
              con ámbito (comunicaciones, expedientes o ambos) y, opcionalmente, ligados a una serie. Un campo
              ligado a una serie aporta su valor por defecto como valor inicial heredado.
            </td>
            <td className="px-2.5 py-1.5">Quien puede distribuir</td>
          </tr>
        </Tabla>
        <p>
          Los valores se validan por tipo y por obligatoriedad. Desactivar o eliminar un campo no borra los
          valores ya capturados.
        </p>
      </Seccion>
    </>
  );

  const grupoFlujos = (
    <>
      <Seccion n={7} id="flujos" icono={Workflow} titulo="Flujos de trabajo configurables">
        <p>
          Un flujo define los <strong>pasos</strong> por los que pasa una comunicación, quién responde por
          cada uno y a dónde va después. No está fijo en el código: lo arma el administrador de archivo en{" "}
          <span className="font-mono text-xs">Configuración → Flujos de trabajo</span> (MoReq cap. 7). Hay
          cuatro plantillas precargables (PQRSD con visto bueno, oficio con revisión y firma, memorando
          interno, ruta genérica) que se editan y activan.
        </p>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Cómo se arma</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Editor visual (lienzo).</strong> Los pasos y los conectores se arrastran; también se
            editan como lista. El paso 1 es siempre el inicial y cada paso — salvo los de tipo «Fin» —
            necesita al menos una salida. El flujo solo se activa cuando la estructura no tiene errores (sin
            pasos inalcanzables, con un «Fin» alcanzable).
          </li>
          <li><strong>Tipo de paso:</strong> {Object.values(ETIQUETA_TIPO_PASO).join(", ")}.</li>
          <li>
            <strong>Responsable de cada paso:</strong> {Object.values(ETIQUETA_ASIGNACION).join(", ").toLowerCase()}.
            Un paso puede llevar un <strong>término sugerido</strong> en días hábiles.
          </li>
          <li>
            <strong>Simulador.</strong> Recorre el flujo desde el paso inicial eligiendo la salida en cada
            bifurcación y muestra el camino resultante, sin tocar ninguna comunicación real.
          </li>
          <li>
            <strong>Duplicar</strong> crea una copia inactiva y editable para trabajar una versión nueva sin
            tocar la que está en uso. <strong>Descargar BPMN</strong> genera un XML BPMN 2.0 del flujo, que
            abre en cualquier herramienta de modelado (MoReq 7.13).
          </li>
          <li>
            <strong>Quién opera el flujo:</strong> sin restricción, el administrador de archivo y los jefes de
            dependencia; si se marcan dependencias, solo quienes pertenecen a una de ellas (más el administrador
            de archivo) — MoReq 7.8.
          </li>
        </ul>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Cómo se usa</p>
        <p>
          Desde el detalle de una comunicación, quien puede operar aplica un flujo activo compatible con el
          tipo de comunicación. A partir de ahí el detalle muestra el diagrama con el paso actual, el{" "}
          <strong>responsable resuelto</strong>, el <strong>término del paso</strong> (verde; ámbar si vence
          en un día hábil o menos; rojo si ya venció) y las opciones para avanzar. Cada paso completado y la
          cancelación quedan en la bitácora como acción «Flujo de trabajo». Aplicar un flujo <strong>no</strong>{" "}
          cambia el estado del radicado ni el documento firmado — es una capa de seguimiento.
        </p>
      </Seccion>

      <Seccion n={8} id="roles" icono={Users} titulo="Roles y permisos del módulo">
        <p>
          Acceso denegado por defecto: sin uno de estos cuatro roles asignado (o ser administrador de la
          plataforma, que siempre tiene acceso completo) no se entra al módulo. Un rol puede tener{" "}
          <strong>vigencia</strong> — al vencer, se retira automáticamente sin intervención manual.
        </p>
        <Tabla encabezados={["Rol", "Radica", "Despacha salida", "Reparte", "Administra TRD/dependencias", "Alcance de expedientes"]}>
          <tr>
            <td className="px-2.5 py-1.5 font-mono text-[11px]">OPERADOR_VENTANILLA</td>
            <td className="px-2.5 py-1.5">Sí</td>
            <td className="px-2.5 py-1.5">Sí</td>
            <td className="px-2.5 py-1.5">No</td>
            <td className="px-2.5 py-1.5">No</td>
            <td className="px-2.5 py-1.5">Todas las dependencias (ventanilla única)</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5 font-mono text-[11px]">FUNCIONARIO_DEPENDENCIA</td>
            <td className="px-2.5 py-1.5">No</td>
            <td className="px-2.5 py-1.5">No</td>
            <td className="px-2.5 py-1.5">No</td>
            <td className="px-2.5 py-1.5">No</td>
            <td className="px-2.5 py-1.5">Su propia dependencia. Solo responde lo que le repartan</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5 font-mono text-[11px]">JEFE_DEPENDENCIA</td>
            <td className="px-2.5 py-1.5">No</td>
            <td className="px-2.5 py-1.5">No</td>
            <td className="px-2.5 py-1.5">No</td>
            <td className="px-2.5 py-1.5">No</td>
            <td className="px-2.5 py-1.5">Su propia dependencia. Opera flujos de trabajo de su área</td>
          </tr>
          <tr>
            <td className="px-2.5 py-1.5 font-mono text-[11px]">ADMIN_ARCHIVO</td>
            <td className="px-2.5 py-1.5">Sí</td>
            <td className="px-2.5 py-1.5">Sí</td>
            <td className="px-2.5 py-1.5">Sí</td>
            <td className="px-2.5 py-1.5">Sí</td>
            <td className="px-2.5 py-1.5">Todas las dependencias</td>
          </tr>
        </Tabla>
        <p>
          El <strong>reparto</strong> del trámite (a una o varias personas) y las acciones archivísticas sobre un
          radicado — clasificación TRD, palabras clave, metadatos, nivel de acceso, detener/reanudar el término —
          son exclusivas del administrador y de <span className="font-mono text-[11px]">ADMIN_ARCHIVO</span>. La
          ventanilla radica de entrada y despacha de salida; el funcionario asignado solo redacta su borrador.
        </p>
        <p>
          <strong>Flujos de trabajo:</strong> crearlos y editarlos es exclusivo de{" "}
          <span className="font-mono text-[11px]">ADMIN_ARCHIVO</span>; aplicarlos y avanzarlos, de{" "}
          <span className="font-mono text-[11px]">ADMIN_ARCHIVO</span> y{" "}
          <span className="font-mono text-[11px]">JEFE_DEPENDENCIA</span>, con la restricción por dependencia que
          tenga cada flujo.
        </p>
        <p>
          <strong>Firma electrónica:</strong> puede firmar cualquier funcionario del módulo con «puede firmar»
          marcado en su ficha (por defecto, sí) — el administrador de la plataforma lo retira por persona.
          Además, un administrador puede <strong>ocultar todo el módulo SGDEA</strong> a los funcionarios
          (Administración → Seguridad) mientras se despliega.
        </p>
        <p>
          El rol se asigna desde <Link href="/usuarios" className="text-cdmb-700 underline hover:no-underline">Usuarios</Link>,
          en la ficha de cada persona.
        </p>
      </Seccion>
    </>
  );

  const grupoAdmin = (
    <>
      <Seccion n={9} id="administracion" icono={Settings2} titulo="Administración — TRD/CCD, dependencias y configuración" admin>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Dependencias</strong>: organigrama jerárquico (código, nombre, dependencia padre).
            Desactivar una no borra su historial de comunicaciones ni expedientes, solo deja de estar
            disponible para nuevas asignaciones. Se administra en{" "}
            <Link href="/correspondencia/admin" className="text-cdmb-700 underline hover:no-underline">Administración</Link>.
          </li>
          <li>
            <strong>TRD/CCD</strong>: cada serie y subserie define clasificación, retención (gestión y
            central) y disposición final. Admite <strong>versión</strong> con vigencia (desde/hasta), para
            tener TRD anterior y nueva a la vez. Se carga de a una desde el formulario, o completa por
            CSV/XML — reimportar un archivo con el mismo código actualiza la serie existente en vez de
            duplicarla.
          </li>
          <li>
            <strong>Flujos de trabajo</strong>: ver la pestaña «Flujos y roles». Se administran en{" "}
            <Link href="/correspondencia/admin/flujos" className="text-cdmb-700 underline hover:no-underline">Configuración → Flujos de trabajo</Link>.
          </li>
          <li>
            <strong>Campos de metadato</strong>: crear, editar (nombre, ayuda, opciones, obligatoriedad,
            ámbito, serie, valor por defecto), activar/desactivar y eliminar los campos adicionales. Desactivar
            o borrar no toca los valores ya capturados.
          </li>
          <li>
            <strong>Vocabulario controlado</strong>: la lista cerrada de palabras clave de la entidad. Se
            exporta a CSV y XML.
          </li>
          <li>
            <strong>Calendario laboral</strong>: jornada de la Corporación y días no laborados — ver la
            sección siguiente.
          </li>
          <li>
            <strong>Vigencia del rol</strong>: al asignar un rol de correspondencia se puede fijar una
            fecha de vencimiento; al vencer, el acceso se retira sin necesidad de una acción manual
            posterior.
          </li>
          <li>
            <strong>Disponibilidad del módulo</strong> y <strong>sello de tiempo</strong> (Administración →
            Seguridad): ocultar el SGDEA a los funcionarios mientras se despliega, y — opcional — la URL de
            una autoridad de sello de tiempo RFC‑3161 para el estampado cronológico de las firmas. Sin ella,
            el sello es la bitácora encadenada por hash.
          </li>
          <li>
            <strong>Intercambio XML</strong> (MoReq 3.27): además de la TRD, se exportan con esquema propio
            el organigrama de dependencias, el vocabulario controlado, el índice electrónico de cada
            expediente y la bitácora de auditoría.
          </li>
        </ul>
      </Seccion>

      <Seccion n={10} id="calendario" icono={CalendarDays} titulo="Calendario laboral y términos de ley" admin>
        <p>
          En <span className="font-mono text-xs">Configuración → Calendario laboral</span> se define la{" "}
          <strong>jornada</strong> de la Corporación: qué días de la semana cuentan como hábiles y el
          horario — <strong>continuo</strong> (un solo bloque) o <strong>partido</strong> (mañana y tarde,
          p. ej. 8–12 y 2–6). De ahí sale el número de horas hábiles por día.
        </p>
        <p>
          Los <strong>festivos de ley de Colombia</strong> (Ley 51/1983) se descuentan solos. Aparte se
          registran los <strong>días no laborados</strong> propios de la entidad — compensados, puentes
          internos, cierres — con motivo. Todo esto alimenta el cálculo de los términos de ley de las PQRSD
          y de los términos de los pasos de un flujo. Un cambio de jornada o de calendario afecta los
          cálculos <strong>hacia adelante</strong>; los términos ya calculados no cambian solos.
        </p>
      </Seccion>

      <Seccion n={11} id="disposicion" icono={Archive} titulo="Disposición final y conservación" admin>
        <p>
          Cada comunicación clasificada recorre, según los años de retención de su subserie, tres fases:{" "}
          <strong>gestión</strong> (en la dependencia que la produjo) → <strong>archivo central</strong>{" "}
          (transferida, con retención adicional) → <strong>disposición final</strong>, ejecutada en{" "}
          <Link href="/correspondencia/disposicion" className="text-cdmb-700 underline hover:no-underline">Disposición final</Link>.
        </p>
        <Tabla encabezados={["Disposición final", "Significado"]}>
          {(["CONSERVACION_TOTAL", "ELIMINACION", "SELECCION", "MICROFILMACION_DIGITALIZACION"] as const).map((d) => (
            <tr key={d}>
              <td className="px-2.5 py-1.5 font-mono text-[11px]">{ETIQUETA_DISPOSICION[d]}</td>
              <td className="px-2.5 py-1.5">
                {d === "CONSERVACION_TOTAL" && "Se conserva permanentemente, por su valor histórico o cultural."}
                {d === "ELIMINACION" && "Se destruye, con acta. No se ejecuta si la comunicación sigue archivada en un expediente aún abierto."}
                {d === "SELECCION" && "Se conserva una muestra representativa; el resto se elimina."}
                {d === "MICROFILMACION_DIGITALIZACION" && "Se reproduce en otro soporte antes de decidir su destino final."}
              </td>
            </tr>
          ))}
        </Tabla>
        <p>
          Los pendientes se pueden agrupar por serie o subserie, ejecutar de a uno o por lotes
          (compartiendo una sola acta cuando la disposición exige eliminar o seleccionar), y{" "}
          <strong>aplazar</strong> una disposición ya vencida cuando haga falta — distinto de{" "}
          <strong>suspender</strong> un término de ley: el aplazamiento afecta la disposición final de un
          expediente, la suspensión afecta el plazo de respuesta de una PQRSD.
        </p>
      </Seccion>

      <Seccion n={12} id="bitacora" icono={ScrollText} titulo="Trazabilidad — bitácora de auditoría" admin>
        <p>
          Cada fila de la{" "}
          <Link href="/correspondencia/bitacora" className="text-cdmb-700 underline hover:no-underline">bitácora</Link>{" "}
          queda encadenada por hash SHA-256 sobre la fila anterior — alterar o borrar una rompe la cadena y
          queda detectable. Registra también lecturas y exportaciones, no solo cambios. Es exportable a CSV y
          a XML con los mismos filtros de la pantalla, y tiene vista de impresión.
        </p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-stone-100 pt-3 sm:grid-cols-2">
          {ACCIONES_BITACORA.map((a) => (
            <div key={a} className="flex items-baseline gap-2">
              <dt className="flex-none">
                <Chip tono="cdmb">{ETIQUETA_ACCION_BITACORA[a]}</Chip>
              </dt>
              <dd className="text-xs text-stone-500">{DESCRIPCION_ACCION_BITACORA[a]}</dd>
            </div>
          ))}
        </dl>
      </Seccion>
    </>
  );

  const grupos = [
    { id: "ciclo", label: "Radicación y ciclo", contenido: grupoCiclo },
    { id: "expedientes", label: "Expedientes y datos", contenido: grupoExpedientes },
    { id: "flujos", label: "Flujos y roles", contenido: grupoFlujos },
    ...(esAdministrador ? [{ id: "admin", label: "Administración", contenido: grupoAdmin }] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/correspondencia" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a la bandeja
        </Link>
        <BotonImprimir variante="secundario">Imprimir</BotonImprimir>
      </div>

      <div className="rounded-xl border border-stone-300 bg-white p-6 print:border-0 print:p-0">
        <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="CDMB" className="h-12 w-auto" />
          ) : (
            <span className="text-lg font-bold text-cdmb-700">CDMB</span>
          )}
          <div>
            <p className="text-sm font-semibold text-stone-900">Corporación Autónoma Regional para la Defensa de la Meseta de Bucaramanga</p>
            <p className="text-xs text-stone-500">Sistema de Gestión de Documentos Electrónicos de Archivo (SGDEA) — Documento de referencia técnica</p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-stone-500">
          Describe, por tipo de radicado y por función del módulo, el estado técnico, la acción disponible y
          el rol mínimo requerido. Base normativa: Ley 594/2000, Ley 1437/2011 (CPACA), Ley 1712/2014, Ley
          527/1999 y Decreto 1074/2015, Acuerdo 060/2001 AGN y Acuerdo Único de la Función Archivística
          (Acuerdo 001/2024 AGN). No sustituye ese marco normativo, lo referencia. Se muestra por pestañas;
          al imprimir se expande completo.
        </p>
      </div>

      <AyudaTabs grupos={grupos} />
    </div>
  );
}

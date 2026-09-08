import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Inbox, Send, FileEdit, FolderOpen, ArrowRight, CheckCircle2 } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-700">{n}</span>
      <div className="pb-4">
        <p className="text-sm font-medium text-stone-800">{titulo}</p>
        <p className="mt-0.5 text-sm text-stone-600">{children}</p>
      </div>
    </li>
  );
}

export default async function CorrespondenciaAyudaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/correspondencia");

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/correspondencia" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a la bandeja
      </Link>

      <div>
        <h2 className="text-lg font-semibold text-stone-900">Cómo funciona el ciclo de correspondencia</h2>
        <p className="mt-1 text-sm text-stone-500">
          El módulo maneja tres tipos de radicado — recibida, enviada y memorando interno — bajo un mismo
          consecutivo por tipo y año (<span className="font-mono text-xs">CDMB-R-2026-000123</span>, etc.).
          Cada uno se comporta distinto una vez radicado.
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
          <Inbox className="h-4 w-4 text-cdmb-600" aria-hidden />
          Comunicación recibida — el único tipo con varios pasos
        </h3>
        <p className="mb-4 text-sm text-stone-600">
          Es lo único que entra por fuera (una petición, PQRSD u oficio de un tercero) y por eso es lo único
          que tiene un ciclo real que avanzar y cerrar. La barra de progreso de estas cinco etapas es la que
          se ve en cada comunicación recibida.
        </p>
        <ol className="space-y-0">
          <Paso n={1} titulo="Se radica en Ventanilla">
            Queda con número de radicado, fecha y hora inalterables. Estado: <strong>Radicada</strong>.
          </Paso>
          <Paso n={2} titulo="Se distribuye">
            Quien radica (o un jefe/administrador) la asigna a la dependencia o al funcionario que debe
            atenderla, en la tarjeta &quot;Distribución / reparto&quot; del detalle. Estado:{" "}
            <strong>Asignada</strong>.
          </Paso>
          <Paso n={3} titulo="El funcionario asignado escribe una respuesta">
            En la tarjeta &quot;Respuesta del funcionario&quot; deja un borrador (texto y, si hace falta,
            documentos adjuntos). Todavía no es un oficio firmado — es solo la base. Estado:{" "}
            <strong>En trámite</strong>.
          </Paso>
          <Paso n={4} titulo="Se radica esa respuesta como comunicación enviada">
            Quien tiene permiso de radicar usa el botón &quot;Radicar como oficio de salida&quot; (aparece
            junto al borrador). Ahí se firma electrónicamente con hash — a partir de ese momento el oficio de
            salida es definitivo y no se puede editar.
          </Paso>
          <Paso n={5} titulo="La recibida queda Respondida">
            Al radicarse la respuesta, la recibida original pasa sola a <strong>Respondida</strong> — ahí
            termina su ciclo, sin ninguna acción más pendiente.
          </Paso>
        </ol>
        <div className="mt-2 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" aria-hidden />
          Cada comunicación recibida muestra en su propio detalle, arriba del asunto, cuál de estos pasos le
          falta — no hace falta memorizar el ciclo para saber qué sigue.
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
          <Send className="h-4 w-4 text-cdmb-600" aria-hidden />
          <FileEdit className="h-4 w-4 text-cdmb-600" aria-hidden />
          Comunicación enviada y memorando interno — ya quedan definitivos al radicarse
        </h3>
        <p className="text-sm text-stone-600">
          A diferencia de una recibida, un oficio de salida o un memorando se redactan y se firman{" "}
          <strong>en el mismo paso</strong> de radicarlos — no hay un &quot;borrador&quot; posterior que
          completar. Por eso, aunque su detalle usa la misma barra de progreso, para estos dos tipos no hay
          nada pendiente una vez radicados.
        </p>
        <p className="mt-2 text-sm text-stone-600">
          La tarjeta &quot;Distribución / reparto&quot; también aparece ahí, pero para estos dos tipos es{" "}
          <strong>opcional</strong>: sirve solo para anotar que alguien le hace seguimiento internamente (por
          ejemplo, verificar que el destinatario cumpla lo que dice el oficio). No bloquea nada, no cambia el
          documento firmado y no es un paso que haya que completar para &quot;cerrar&quot; la comunicación —
          ya quedó cerrada al firmarse.
        </p>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
          <FolderOpen className="h-4 w-4 text-cdmb-600" aria-hidden />
          Expediente documental — una carpeta aparte, no un cuarto tipo de radicado
        </h3>
        <p className="text-sm text-stone-600">
          Un expediente agrupa varios documentos y/o comunicaciones de un mismo asunto o procedimiento (Art.
          4.3.2 Acuerdo 001/2024 AGN) — por ejemplo, todo lo relacionado con la hoja de vida de un contrato.
          Se abre aparte, en la pestaña <Link href="/correspondencia/expedientes" className="text-cdmb-700 underline hover:no-underline">Expedientes</Link>, y cualquier comunicación ya radicada se
          le puede archivar después desde su propio detalle. Se puede prestar (registrar quién lo tiene) y se
          cierra cuando el asunto termina, firmando su índice electrónico — eso sí es un paso definitivo,
          distinto del ciclo de una comunicación recibida.
        </p>
      </section>

      <div className="flex items-center justify-center gap-2 text-xs text-stone-400">
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        <span>Esta guía también está enlazada desde el encabezado del módulo, en cualquier pantalla.</span>
      </div>
    </div>
  );
}

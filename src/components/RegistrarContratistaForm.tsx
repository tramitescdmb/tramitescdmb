"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Search, UserCheck, UserPlus } from "lucide-react";
import { CamposPersona, CLASE_CAMPO_PERSONA } from "@/components/CamposPersona";
import { personaVacia, TIPOS_IDENTIFICACION_USUARIO, type DatosPersona } from "@/lib/datos-persona";

export type RepresentanteLegalForm = {
  nombres: string;
  apellidos: string;
  identificacion: string;
  direccion: string;
  telefono: string;
  celular: string;
};

type ConsultaUsuarioRed =
  | { usuarioRed: string; existe: false; pendiente: { id: string; nombreORazonSocial: string } | null }
  | {
      usuarioRed: string;
      existe: true;
      usuarioId: string;
      nombre: string;
      documento: string | null;
      contratistaId: string | null;
      motivo: string | null;
      faltan: string[];
    };

function representanteVacio(): RepresentanteLegalForm {
  return { nombres: "", apellidos: "", identificacion: "", direccion: "", telefono: "", celular: "" };
}

export function RegistrarContratistaForm({
  expedienteId,
  consultaInicial,
  editando,
  onRegistrado,
  onCancelar,
}: {
  expedienteId?: string;
  consultaInicial?: string;
  /** Si se indica, el formulario edita ese contratista (PATCH) en vez de crear uno nuevo (POST). */
  editando?: { contratistaId: string; persona: DatosPersona; representanteLegal?: RepresentanteLegalForm };
  onRegistrado: (c: { contratistaId: string; nombre: string; identificacion: string }) => void;
  onCancelar: () => void;
}) {
  const [persona, setPersona] = useState<DatosPersona>(() => editando?.persona ?? personaVacia({ identificacion: consultaInicial ?? "" }));
  const [representante, setRepresentante] = useState<RepresentanteLegalForm>(() => editando?.representanteLegal ?? representanteVacio());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usuarioRed, setUsuarioRed] = useState("");
  const [consulta, setConsulta] = useState<ConsultaUsuarioRed | null>(null);
  const [consultando, setConsultando] = useState(false);

  async function consultar() {
    const valor = usuarioRed.trim();
    if (!valor || consulta?.usuarioRed === valor.toLowerCase()) return;
    setConsultando(true);
    setError(null);
    try {
      const res = await fetch(`/api/contratacion/contratistas/usuario-red?u=${encodeURIComponent(valor)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo consultar el usuario de red.");
      setConsulta(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setConsultando(false);
    }
  }

  async function vincularExistente() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/contratacion/contratistas/usuario-red", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioRed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo vincular.");
      onRegistrado({ contratistaId: body.id, nombre: body.nombre, identificacion: body.identificacion });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  const existente = consulta?.existe ? consulta : null;
  const pendienteAjeno = Boolean(consulta && !consulta.existe && consulta.pendiente);
  const mostrarFormulario = Boolean(editando) || !existente;

  const esJuridica = persona.tipoPersona === "JURIDICA";

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(editando ? `/api/contratacion/contratistas/${editando.contratistaId}` : "/api/contratacion/contratistas", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expedienteId, persona, representanteLegal: esJuridica ? representante : undefined, usuarioRed: editando ? undefined : usuarioRed.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo guardar el contratista.");
      onRegistrado({ contratistaId: editando?.contratistaId ?? body.id, nombre: body.nombre ?? persona.razonSocial ?? "", identificacion: persona.identificacion });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-cdmb-200 bg-cdmb-50/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-cdmb-800">
        <UserPlus className="h-3.5 w-3.5" aria-hidden />
        {editando ? "Editar datos del contratista" : "Registrar contratista"}
      </p>
      {!editando && (
        <div className="space-y-2">
          <div>
            <label htmlFor="usuario-red-contratista" className="block text-xs font-medium text-stone-700">
              Usuario de red (dominio CDMB) <span className="font-normal text-stone-400">· opcional</span>
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="usuario-red-contratista"
                value={usuarioRed}
                onChange={(e) => {
                  setUsuarioRed(e.target.value);
                  setConsulta(null);
                }}
                onBlur={consultar}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    consultar();
                  }
                }}
                placeholder="Ej. walhal01"
                className={`${CLASE_CAMPO_PERSONA} max-w-xs`}
              />
              <button
                type="button"
                onClick={consultar}
                disabled={!usuarioRed.trim() || consultando}
                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                {consultando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Search className="h-3.5 w-3.5" aria-hidden />}
                Consultar
              </button>
            </div>
          </div>

          {existente && (
            <div className="rounded-lg border border-emerald-200 bg-white p-3 text-xs">
              <p className="flex flex-wrap items-center gap-1.5 font-medium text-stone-900">
                <UserCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                {existente.nombre}
                {existente.documento && <span className="font-normal text-stone-500">· Documento {existente.documento}</span>}
              </p>
              {existente.contratistaId ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-stone-600">Ya está registrado como contratista.</span>
                  <Link href={`/contratacion/contratistas/${existente.contratistaId}`} className="font-medium text-cdmb-700 hover:underline">
                    Ver ficha
                  </Link>
                  <button
                    type="button"
                    onClick={() => onRegistrado({ contratistaId: existente.contratistaId!, nombre: existente.nombre, identificacion: existente.documento ?? "" })}
                    className="rounded-lg bg-cdmb-600 px-3 py-1 font-medium text-white hover:bg-cdmb-700"
                  >
                    Usar este contratista
                  </button>
                </div>
              ) : existente.motivo ? (
                <p className="mt-1 text-red-700">No puede ser contratista: {existente.motivo}.</p>
              ) : existente.faltan.length > 0 ? (
                <p className="mt-1 text-amber-800">
                  Faltan datos en su usuario: {existente.faltan.join(", ")}. Los completa el administrador del sistema en Usuarios.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={vincularExistente}
                  disabled={guardando}
                  className="mt-2 rounded-lg bg-cdmb-600 px-3 py-1 font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
                >
                  {guardando ? "Vinculando…" : "Vincular como contratista"}
                </button>
              )}
            </div>
          )}

          {consulta && !consulta.existe && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {consulta.pendiente ? (
                <>
                  El usuario de red {consulta.usuarioRed} ya está asignado a{" "}
                  <Link href={`/contratacion/contratistas/${consulta.pendiente.id}`} className="font-medium underline">
                    {consulta.pendiente.nombreORazonSocial}
                  </Link>
                  .
                </>
              ) : (
                <>
                  El usuario de red <strong>{consulta.usuarioRed}</strong> no existe en la plataforma. Se registra el perfil mínimo y se vincula
                  cuando la persona ingrese con ese usuario.
                </>
              )}
            </p>
          )}
        </div>
      )}
      {mostrarFormulario && (
        <>
          <p className="text-[11px] text-stone-500">
            Perfil mínimo: {esJuridica ? "NIT, razón social y datos del representante legal." : "documento, nombres, apellidos, teléfono y celular."}
          </p>
      <CamposPersona
        valor={persona}
        onChange={setPersona}
        tiposIdentificacion={TIPOS_IDENTIFICACION_USUARIO}
        requeridos={{ identificacion: true, nombre: true }}
        claseCampo={CLASE_CAMPO_PERSONA}
      />
      {esJuridica && (
        <div className="space-y-2 border-t border-cdmb-100 pt-3">
          <p className="text-xs font-medium text-stone-700">
            Representante legal <span className="text-red-500">*</span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={representante.nombres}
              onChange={(e) => setRepresentante((r) => ({ ...r, nombres: e.target.value }))}
              placeholder="Nombres"
              className={CLASE_CAMPO_PERSONA}
            />
            <input
              value={representante.apellidos}
              onChange={(e) => setRepresentante((r) => ({ ...r, apellidos: e.target.value }))}
              placeholder="Apellidos"
              className={CLASE_CAMPO_PERSONA}
            />
            <input
              value={representante.identificacion}
              onChange={(e) => setRepresentante((r) => ({ ...r, identificacion: e.target.value }))}
              placeholder="Cédula"
              className={CLASE_CAMPO_PERSONA}
            />
            <input
              value={representante.direccion}
              onChange={(e) => setRepresentante((r) => ({ ...r, direccion: e.target.value }))}
              placeholder="Dirección"
              className={CLASE_CAMPO_PERSONA}
            />
            <input
              value={representante.telefono}
              onChange={(e) => setRepresentante((r) => ({ ...r, telefono: e.target.value }))}
              placeholder="Teléfono"
              className={CLASE_CAMPO_PERSONA}
            />
            <input
              value={representante.celular}
              onChange={(e) => setRepresentante((r) => ({ ...r, celular: e.target.value }))}
              placeholder="Celular (opcional)"
              className={CLASE_CAMPO_PERSONA}
            />
          </div>
        </div>
      )}
        </>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        {mostrarFormulario && (
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || pendienteAjeno}
          className="rounded-lg bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Registrar contratista"}
        </button>
        )}
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
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

  const esJuridica = persona.tipoPersona === "JURIDICA";

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(editando ? `/api/contratacion/contratistas/${editando.contratistaId}` : "/api/contratacion/contratistas", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expedienteId, persona, representanteLegal: esJuridica ? representante : undefined }),
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
        {editando ? "Editar datos del contratista" : "Registrar un contratista nuevo (todavía no existe en el sistema)"}
      </p>
      <p className="text-[11px] text-stone-500">
        Perfil mínimo para esta etapa precontractual:{" "}
        {esJuridica ? "NIT, razón social y los datos del representante legal." : "documento, nombres, apellidos, teléfono y celular."} Al pasar a la
        etapa contractual, el sistema intenta vincularlo automáticamente con un usuario del sistema que tenga el mismo documento.
      </p>
      <CamposPersona
        valor={persona}
        onChange={setPersona}
        tiposIdentificacion={TIPOS_IDENTIFICACION_USUARIO}
        requeridos={esJuridica ? { identificacion: true, nombre: true } : { identificacion: true, nombre: true, telefono: true, celular: true }}
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
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-lg bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Registrar contratista"}
        </button>
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

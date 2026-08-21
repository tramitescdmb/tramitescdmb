"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Field } from "@/components/Field";
import { subirArchivoDirecto } from "@/lib/uploads-client";
import { MUNICIPIOS_JURISDICCION_CDMB } from "@/lib/municipios";
import { MapaUbicacion } from "@/components/MapaUbicacion";

type DocumentoRequerido = {
  id: string;
  nombre: string;
  obligatorio: boolean;
  notas: string | null;
};

type FlujoOpcion = { id: string; nombre: string };

export function NuevoExpedienteForm({
  tramiteId,
  tramiteSlug,
  documentosRequeridos,
  flujos,
  flujoInicialId,
}: {
  tramiteId: string;
  tramiteSlug: string;
  documentosRequeridos: DocumentoRequerido[];
  flujos: FlujoOpcion[];
  flujoInicialId: string;
}) {
  const router = useRouter();
  const expedienteIdRef = useRef<string>(crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [municipio, setMunicipio] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const solicitanteNombre = String(fd.get("solicitanteNombre") || "").trim();
    const solicitanteIdentificacion = String(fd.get("solicitanteIdentificacion") || "").trim();

    if (!solicitanteNombre || !solicitanteIdentificacion) {
      setError("Completa al menos el nombre y la identificación del solicitante.");
      return;
    }
    if (!municipio) {
      setError("Selecciona el municipio donde queda el predio o proyecto — la CDMB solo tiene competencia dentro de su jurisdicción.");
      return;
    }

    setSubmitting(true);
    try {
      const expedienteId = expedienteIdRef.current;
      const documentos: Array<{
        path: string;
        nombre: string;
        descripcion?: string | null;
        mimeType: string;
        tamanoBytes: number;
      }> = [];

      for (const doc of documentosRequeridos) {
        const input = form.elements.namedItem(`doc_${doc.id}`) as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (file) {
          setProgreso(`Subiendo "${doc.nombre}"…`);
          const subido = await subirArchivoDirecto(expedienteId, file);
          documentos.push({ ...subido, descripcion: doc.notas });
        }
      }

      const extraInput = form.elements.namedItem("documentos_extra") as HTMLInputElement | null;
      const extraFiles = extraInput?.files ? Array.from(extraInput.files) : [];
      for (const file of extraFiles) {
        setProgreso(`Subiendo "${file.name}"…`);
        const subido = await subirArchivoDirecto(expedienteId, file);
        documentos.push({ ...subido, descripcion: "Documento adicional aportado por el solicitante." });
      }

      setProgreso("Guardando expediente…");
      const res = await fetch("/api/expedientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: expedienteId,
          tramiteTipoId: tramiteId,
          flujoId: String(fd.get("flujoId") || flujoInicialId),
          solicitante: {
            tipo: String(fd.get("solicitanteTipo") || "NATURAL"),
            nombre: solicitanteNombre,
            identificacion: solicitanteIdentificacion,
            email: String(fd.get("solicitanteEmail") || ""),
            telefono: String(fd.get("solicitanteTelefono") || ""),
            direccion: String(fd.get("solicitanteDireccion") || ""),
          },
          municipio,
          ubicacion: {
            lat: fd.get("ubicacionLat") ? Number(fd.get("ubicacionLat")) : null,
            lon: fd.get("ubicacionLon") ? Number(fd.get("ubicacionLon")) : null,
            planaX: fd.get("ubicacionPlanaX") ? Number(fd.get("ubicacionPlanaX")) : null,
            planaY: fd.get("ubicacionPlanaY") ? Number(fd.get("ubicacionPlanaY")) : null,
          },
          documentos,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "No se pudo crear el expediente.");
      }

      const { id } = await res.json();
      router.push(`/expedientes/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado. Intenta de nuevo.");
      setSubmitting(false);
      setProgreso(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">1. Datos del solicitante</h2>

        {flujos.length > 1 && (
          <Field
            label="Tipo de solicitud"
            required
            help="Elige qué está pidiendo el solicitante — cada trámite puede tener más de una modalidad (por ejemplo, una solicitud nueva o la renovación de un permiso vigente)."
          >
            <div className="space-y-2">
              {flujos.map((f) => (
                <label key={f.id} className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="flujoId"
                    value={f.id}
                    defaultChecked={f.id === flujoInicialId}
                    required
                    className="mt-0.5"
                  />
                  {f.nombre}
                </label>
              ))}
            </div>
          </Field>
        )}
        {flujos.length === 1 && <input type="hidden" name="flujoId" value={flujos[0].id} />}

        <Field label="Tipo de solicitante" required help="¿A nombre de quién queda el expediente?">
          <select
            name="solicitanteTipo"
            required
            defaultValue="NATURAL"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          >
            <option value="NATURAL">Persona natural</option>
            <option value="JURIDICA">Persona jurídica (empresa, entidad)</option>
          </select>
        </Field>

        <Field
          label="Nombre o razón social"
          required
          help="Nombre completo de la persona, o razón social si es una empresa/entidad."
        >
          <input
            name="solicitanteNombre"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            placeholder="Ej: Juan Pérez Gómez / Industrias ABC S.A.S."
          />
        </Field>

        <Field
          label="Identificación"
          required
          help="Cédula de ciudadanía (persona natural) o NIT (persona jurídica)."
        >
          <input
            name="solicitanteIdentificacion"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            placeholder="Ej: 91234567 o 900123456-1"
          />
        </Field>

        <Field
          label="Municipio del predio o proyecto"
          required
          help="La CDMB solo tiene competencia dentro de su jurisdicción (13 municipios). Si el predio o proyecto queda en otro municipio, este trámite no aplica aquí."
        >
          <select
            name="municipio"
            required
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          >
            <option value="" disabled>
              Selecciona un municipio…
            </option>
            {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Ubicación exacta en campo (opcional)"
          help="Si ya tienes el punto exacto del predio o proyecto — por GPS, visita técnica o una dirección — márcalo aquí. Se guarda en latitud/longitud y también se calcula en coordenadas planas (el sistema oficial de Colombia)."
        >
          {municipio ? (
            <MapaUbicacion municipio={municipio} />
          ) : (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-400">
              Selecciona primero el municipio para poder marcar la ubicación en el mapa.
            </p>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Correo electrónico" help="Para notificaciones, si el solicitante autoriza este medio.">
            <input
              type="email"
              name="solicitanteEmail"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder="correo@ejemplo.com"
            />
          </Field>
          <Field label="Teléfono" help="Número de contacto del solicitante.">
            <input
              name="solicitanteTelefono"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder="Ej: 3001234567"
            />
          </Field>
        </div>

        <Field label="Dirección" help="Dirección del predio, proyecto o del solicitante, según aplique.">
          <input
            name="solicitanteDireccion"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">2. Documentos</h2>
          <p className="text-xs text-gray-500">
            Sube lo que el solicitante ya trajo — sin importar el tamaño del archivo, se sube directo a
            nuestro almacenamiento. Si te falta algo, puedes crear el expediente igual y subirlo después.
          </p>
        </div>

        {documentosRequeridos.length === 0 && (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
            Este trámite no tiene una lista fija de documentos en el procedimiento oficial — usa el campo
            de &quot;otros documentos&quot; más abajo para adjuntar lo que corresponda.
          </p>
        )}

        {documentosRequeridos.map((doc) => (
          <Field
            key={doc.id}
            label={doc.nombre}
            required={doc.obligatorio}
            help={doc.notas ?? (doc.obligatorio ? "Documento obligatorio." : "Documento opcional / aplica solo en algunos casos.")}
          >
            <input
              type="file"
              name={`doc_${doc.id}`}
              disabled={submitting}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-cdmb-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-cdmb-700 hover:file:bg-cdmb-100"
            />
          </Field>
        ))}

        <Field
          label="Otros documentos"
          help="Cualquier otro soporte que no esté en la lista de arriba (puedes seleccionar varios archivos)."
        >
          <input
            type="file"
            name="documentos_extra"
            multiple
            disabled={submitting}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
        </Field>
      </section>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {progreso && (
        <div className="flex items-center gap-2 rounded-md bg-cdmb-50 px-3 py-2 text-sm text-cdmb-800">
          <span className="h-3 w-3 flex-none animate-spin rounded-full border-2 border-cdmb-600 border-t-transparent" />
          {progreso}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <Link href={`/tramites/${tramiteSlug}`} className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-cdmb-600 px-5 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Radicando…" : "Radicar expediente"}
        </button>
      </div>
    </form>
  );
}

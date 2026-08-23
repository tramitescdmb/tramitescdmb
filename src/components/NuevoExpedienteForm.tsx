"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Field } from "@/components/Field";
import { Spinner } from "@/components/Spinner";
import { subirArchivoDirecto } from "@/lib/uploads-client";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION } from "@/lib/municipios";
import { REGIMENES_TRIBUTARIOS } from "@/lib/regimen-tributario";
import { MapaUbicacion, type MapaUbicacionHandle } from "@/components/MapaUbicacion";
import {
  IconLayers,
  IconUser,
  IconIdCard,
  IconMapPin,
  IconMail,
  IconPhone,
  IconDocument,
  IconUpload,
  IconX,
  IconSearch,
  IconBriefcase,
  IconBuilding,
} from "@/components/icons";

function numeroONulo(valor: string): number | null {
  const limpio = valor.trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

const iconSm = "h-4 w-4";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type DocumentoRequerido = {
  id: string;
  nombre: string;
  obligatorio: boolean;
  notas: string | null;
  aplicaA: "NATURAL" | "JURIDICA" | null;
};

type FlujoOpcion = { id: string; nombre: string };

export function NuevoExpedienteForm({
  tramiteId,
  tramiteSlug,
  documentosRequeridos,
  flujos,
  flujoInicialId,
  mostrarDatosPredio,
}: {
  tramiteId: string;
  tramiteSlug: string;
  documentosRequeridos: DocumentoRequerido[];
  flujos: FlujoOpcion[];
  flujoInicialId: string;
  mostrarDatosPredio: boolean;
}) {
  const router = useRouter();
  const expedienteIdRef = useRef<string>(crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [municipio, setMunicipio] = useState("");
  const [municipioSolicitante, setMunicipioSolicitante] = useState("");
  const [solicitanteDireccion, setSolicitanteDireccion] = useState("");
  const [predioDireccion, setPredioDireccion] = useState("");
  const mapaSolicitanteRef = useRef<MapaUbicacionHandle>(null);
  const mapaPredioRef = useRef<MapaUbicacionHandle>(null);
  const [tipoSolicitante, setTipoSolicitante] = useState<"NATURAL" | "JURIDICA">("NATURAL");
  const esJuridica = tipoSolicitante === "JURIDICA";
  const [solicitanteIdentificacion, setSolicitanteIdentificacion] = useState("");
  const [solicitanteNombres, setSolicitanteNombres] = useState("");
  const [solicitanteApellidos, setSolicitanteApellidos] = useState("");
  const [solicitanteRazonSocial, setSolicitanteRazonSocial] = useState("");
  const [solicitanteEmail, setSolicitanteEmail] = useState("");
  const [solicitanteTelefono, setSolicitanteTelefono] = useState("");
  const [regimenTributario, setRegimenTributario] = useState("");
  const [granContribuyente, setGranContribuyente] = useState(false);
  const [buscandoSolicitante, setBuscandoSolicitante] = useState(false);
  const [mensajeBusqueda, setMensajeBusqueda] = useState<{ tipo: "ok" | "info" | "error"; texto: string } | null>(null);

  const [claseSolicitud, setClaseSolicitud] = useState("");
  const [predioNombre, setPredioNombre] = useState("");
  const [predioCatastral, setPredioCatastral] = useState("");
  const [predioMatricula, setPredioMatricula] = useState("");
  const [predioAreaM2, setPredioAreaM2] = useState("");
  const [predioAreaCultivosM2, setPredioAreaCultivosM2] = useState("");
  const [predioAreaBosqueM2, setPredioAreaBosqueM2] = useState("");
  const [predioViviendas, setPredioViviendas] = useState("");

  async function buscarSolicitante() {
    const id = solicitanteIdentificacion.trim();
    if (!id) {
      setMensajeBusqueda({ tipo: "error", texto: "Debe ingresarse primero el número de identificación." });
      return;
    }
    setBuscandoSolicitante(true);
    setMensajeBusqueda(null);
    try {
      const res = await fetch(`/api/solicitantes/buscar?identificacion=${encodeURIComponent(id)}`);
      if (res.ok) {
        const s = await res.json();
        setTipoSolicitante(s.tipo === "JURIDICA" ? "JURIDICA" : "NATURAL");
        setSolicitanteNombres(s.nombres ?? "");
        setSolicitanteApellidos(s.apellidos ?? "");
        setSolicitanteRazonSocial(s.razonSocial ?? "");
        setSolicitanteEmail(s.email ?? "");
        setSolicitanteTelefono(s.telefono ?? "");
        setSolicitanteDireccion(s.direccion ?? "");
        setMunicipioSolicitante(s.municipio ?? "");
        setRegimenTributario(s.regimenTributario ?? "");
        setGranContribuyente(Boolean(s.granContribuyente));
        const nombreEncontrado = s.tipo === "JURIDICA" ? s.razonSocial : [s.nombres, s.apellidos].filter(Boolean).join(" ");
        setMensajeBusqueda({
          tipo: "ok",
          texto: `Registro existente: se completaron los datos de "${nombreEncontrado}". Verifique la información y actualice lo que corresponda.`,
        });
      } else if (res.status === 404) {
        setMensajeBusqueda({ tipo: "info", texto: "No se encontró un solicitante registrado con este número. Se creará un nuevo registro al radicar el expediente." });
      } else {
        setMensajeBusqueda({ tipo: "error", texto: "No fue posible completar la búsqueda. Intente nuevamente." });
      }
    } catch {
      setMensajeBusqueda({ tipo: "error", texto: "No fue posible completar la búsqueda. Verifique la conexión e intente nuevamente." });
    } finally {
      setBuscandoSolicitante(false);
    }
  }

  const [archivosPorDoc, setArchivosPorDoc] = useState<Record<string, File | null>>({});
  const [archivosExtra, setArchivosExtra] = useState<File[]>([]);
  const docInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const extraInputRef = useRef<HTMLInputElement | null>(null);

  function quitarArchivoDoc(docId: string) {
    setArchivosPorDoc((prev) => ({ ...prev, [docId]: null }));
    const input = docInputRefs.current[docId];
    if (input) input.value = "";
  }

  function quitarArchivoExtra(index: number) {
    setArchivosExtra((prev) => prev.filter((_, i) => i !== index));
  }

  /** ¿Este documento aplica al tipo de solicitante actual? (null = aplica a cualquiera) */
  function documentoRequerido(doc: DocumentoRequerido) {
    return doc.obligatorio && (doc.aplicaA === null || (doc.aplicaA === "JURIDICA") === esJuridica);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const identificacionTrim = solicitanteIdentificacion.trim();
    const nombresTrim = solicitanteNombres.trim();
    const apellidosTrim = solicitanteApellidos.trim();
    const razonSocialTrim = solicitanteRazonSocial.trim();

    if (!identificacionTrim) {
      setError("Debe indicarse la identificación del solicitante.");
      return;
    }
    if (esJuridica ? !razonSocialTrim : !nombresTrim || !apellidosTrim) {
      setError(esJuridica ? "Debe indicarse la razón social del solicitante." : "Deben indicarse los nombres y apellidos del solicitante.");
      return;
    }
    if (!municipioSolicitante) {
      setError('Debe seleccionarse el municipio del solicitante (o la opción "Fuera de la jurisdicción" si no aplica).');
      return;
    }
    if (!predioDireccion.trim()) {
      setError("Debe indicarse la dirección del predio o proyecto.");
      return;
    }
    if (!municipio) {
      setError("Debe seleccionarse el municipio donde queda el predio o proyecto. La CDMB solo tiene competencia dentro de su jurisdicción.");
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
        const file = archivosPorDoc[doc.id];
        if (file) {
          setProgreso(`Subiendo "${doc.nombre}"…`);
          const subido = await subirArchivoDirecto(expedienteId, file);
          documentos.push({ ...subido, descripcion: doc.notas });
        }
      }

      for (const file of archivosExtra) {
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
            tipo: tipoSolicitante,
            nombres: nombresTrim,
            apellidos: apellidosTrim,
            razonSocial: razonSocialTrim,
            identificacion: identificacionTrim,
            email: solicitanteEmail,
            telefono: solicitanteTelefono,
            direccion: solicitanteDireccion,
            municipio: municipioSolicitante,
            regimenTributario: regimenTributario || null,
            granContribuyente,
          },
          municipio,
          predioDireccion,
          predio: {
            nombre: predioNombre,
            catastral: predioCatastral,
            matricula: predioMatricula,
            areaM2: numeroONulo(predioAreaM2),
            areaCultivosM2: numeroONulo(predioAreaCultivosM2),
            areaBosqueM2: numeroONulo(predioAreaBosqueM2),
            viviendas: numeroONulo(predioViviendas),
          },
          claseSolicitud: claseSolicitud || null,
          ubicacion: {
            lat: fd.get("ubicacionLat") ? Number(fd.get("ubicacionLat")) : null,
            lon: fd.get("ubicacionLon") ? Number(fd.get("ubicacionLon")) : null,
          },
          solicitanteUbicacion: {
            lat: fd.get("solicitanteUbicacionLat") ? Number(fd.get("solicitanteUbicacionLat")) : null,
            lon: fd.get("solicitanteUbicacionLon") ? Number(fd.get("solicitanteUbicacionLon")) : null,
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
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado. Intente nuevamente.");
      setSubmitting(false);
      setProgreso(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-stone-900">1. Datos del solicitante</h2>

        {flujos.length > 1 && (
          <Field
            label="Tipo de solicitud"
            required
            icon={<IconLayers className={iconSm} />}
            help="Seleccione qué está solicitando el interesado. Cada trámite puede tener más de una modalidad — por ejemplo, una solicitud nueva o la renovación de un permiso vigente."
          >
            <div className="space-y-2">
              {flujos.map((f) => (
                <label key={f.id} className="flex items-start gap-2 text-sm text-stone-700">
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

        <Field label="Tipo de solicitante" required icon={<IconUser className={iconSm} />} help="Defina a nombre de quién queda el expediente. Esta selección determina si se solicita cédula o NIT en los campos siguientes.">
          <select
            name="solicitanteTipo"
            required
            value={tipoSolicitante}
            onChange={(e) => setTipoSolicitante(e.target.value as "NATURAL" | "JURIDICA")}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          >
            <option value="NATURAL">Persona natural</option>
            <option value="JURIDICA">Persona jurídica (empresa, entidad)</option>
          </select>
        </Field>

        <Field
          label={esJuridica ? "NIT" : "Cédula de ciudadanía"}
          required
          icon={<IconIdCard className={iconSm} />}
          help={
            (esJuridica
              ? "Número de Identificación Tributaria (NIT) de la empresa o entidad, con dígito de verificación si está disponible."
              : "Número de cédula de ciudadanía o cédula de extranjería de la persona natural.") +
            " Si el solicitante ya cuenta con expedientes registrados, verifique su número antes de continuar para evitar duplicar la información."
          }
        >
          <div className="flex flex-wrap gap-2">
            <input
              name="solicitanteIdentificacion"
              required
              value={solicitanteIdentificacion}
              onChange={(e) => setSolicitanteIdentificacion(e.target.value)}
              className="min-w-[160px] flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder={esJuridica ? "Ej: 900123456-1" : "Ej: 91234567"}
            />
            <button
              type="button"
              onClick={buscarSolicitante}
              disabled={buscandoSolicitante}
              className="flex items-center gap-1.5 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
            >
              {buscandoSolicitante ? <Spinner /> : <IconSearch className="h-3.5 w-3.5" />}
              {buscandoSolicitante ? "Buscando…" : "Buscar"}
            </button>
          </div>
          {mensajeBusqueda && (
            <p
              className={`mt-1.5 rounded-md px-2.5 py-1.5 text-xs ${
                mensajeBusqueda.tipo === "ok"
                  ? "bg-cdmb-50 text-cdmb-800"
                  : mensajeBusqueda.tipo === "info"
                    ? "bg-stone-100 text-stone-600"
                    : "bg-red-50 text-red-700"
              }`}
            >
              {mensajeBusqueda.texto}
            </p>
          )}
        </Field>

        {esJuridica ? (
          <Field label="Razón social" required icon={<IconUser className={iconSm} />} help="Nombre legal de la empresa o entidad.">
            <input
              required
              value={solicitanteRazonSocial}
              onChange={(e) => setSolicitanteRazonSocial(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder="Ej: Industrias ABC S.A.S."
            />
          </Field>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombres" required icon={<IconUser className={iconSm} />} help="">
              <input
                required
                value={solicitanteNombres}
                onChange={(e) => setSolicitanteNombres(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
                placeholder="Ej: Juan Pérez"
              />
            </Field>
            <Field label="Apellidos" required icon={<IconUser className={iconSm} />} help="">
              <input
                required
                value={solicitanteApellidos}
                onChange={(e) => setSolicitanteApellidos(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
                placeholder="Ej: Gómez Rodríguez"
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Correo electrónico" icon={<IconMail className={iconSm} />} help="Para notificaciones, si el solicitante autoriza este medio.">
            <input
              type="email"
              name="solicitanteEmail"
              value={solicitanteEmail}
              onChange={(e) => setSolicitanteEmail(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder="correo@ejemplo.com"
            />
          </Field>
          <Field label="Teléfono" icon={<IconPhone className={iconSm} />} help="Número de contacto del solicitante.">
            <input
              name="solicitanteTelefono"
              value={solicitanteTelefono}
              onChange={(e) => setSolicitanteTelefono(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              placeholder="Ej: 3001234567"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Régimen tributario (opcional)"
            icon={<IconBriefcase className={iconSm} />}
            help="Para aplicar correctamente retenciones, beneficios o estampillas si la CDMB llega a pagarle a este solicitante."
          >
            <select
              value={regimenTributario}
              onChange={(e) => setRegimenTributario(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            >
              <option value="">Sin especificar</option>
              {REGIMENES_TRIBUTARIOS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={granContribuyente}
                onChange={(e) => setGranContribuyente(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-cdmb-600 focus:ring-cdmb-500"
              />
              Gran contribuyente
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-stone-100 bg-stone-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Dirección del solicitante
          </p>

          <Field
            label="Municipio"
            required
            icon={<IconMapPin className={iconSm} />}
            help="Municipio donde reside o tiene su sede el solicitante. Si no corresponde a la jurisdicción de la CDMB, debe seleccionarse esa opción. Permite centrar el mapa y, en el futuro, ubicar los trámites geográficamente."
          >
            <select
              required
              value={municipioSolicitante}
              onChange={(e) => setMunicipioSolicitante(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            >
              <option value="" disabled>
                Seleccione un municipio…
              </option>
              <option value={FUERA_DE_JURISDICCION}>Fuera de la jurisdicción / no aplica</option>
              {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Dirección"
            icon={<IconMapPin className={iconSm} />}
            help="Dirección de domicilio o sede del solicitante — no necesariamente la del predio o proyecto (por ejemplo, una empresa con sede en otra ciudad). El botón ubica esta misma dirección en el mapa."
          >
            <div className="flex flex-wrap gap-2">
              <input
                name="solicitanteDireccion"
                value={solicitanteDireccion}
                onChange={(e) => setSolicitanteDireccion(e.target.value)}
                className="min-w-[200px] flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
              <button
                type="button"
                onClick={() => mapaSolicitanteRef.current?.buscarDireccion(solicitanteDireccion)}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95"
              >
                Buscar en el mapa
              </button>
            </div>
          </Field>

          <Field
            label="Ubicación en el mapa (opcional)"
            icon={<IconMapPin className={iconSm} />}
            help="El botón anterior ubica la dirección en el mapa. Este campo no es obligatorio."
          >
            <MapaUbicacion ref={mapaSolicitanteRef} municipio={municipioSolicitante} prefijo="solicitanteUbicacion" />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-stone-900">2. Predio o proyecto</h2>

        <Field
          label="Municipio del predio o proyecto"
          required
          icon={<IconMapPin className={iconSm} />}
          help="La CDMB solo tiene competencia dentro de su jurisdicción (13 municipios). Si el predio o proyecto se encuentra en otro municipio, este trámite no aplica."
        >
          <select
            name="municipio"
            required
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          >
            <option value="" disabled>
              Seleccione un municipio…
            </option>
            {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Dirección del predio o proyecto"
          required
          icon={<IconMapPin className={iconSm} />}
          help="Dirección del predio o del lugar donde se desarrolla el proyecto — distinta de la dirección del solicitante. Es un campo obligatorio, requerido para poder ubicar los trámites en un mapa en el futuro. El botón ubica esta misma dirección en el mapa."
        >
          <div className="flex flex-wrap gap-2">
            <input
              name="predioDireccion"
              required
              value={predioDireccion}
              onChange={(e) => setPredioDireccion(e.target.value)}
              className="min-w-[200px] flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
            <button
              type="button"
              onClick={() => mapaPredioRef.current?.buscarDireccion(predioDireccion)}
              disabled={!municipio}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
            >
              Buscar en el mapa
            </button>
          </div>
        </Field>

        <Field
          label="Ubicación exacta del predio (opcional)"
          icon={<IconMapPin className={iconSm} />}
          help="El botón anterior ubica la dirección en el mapa. También puede seleccionarse el punto directamente en el mapa, o registrarse coordenadas de otra fuente (GPS, levantamiento topográfico, plano). Se almacena en latitud/longitud y se calcula automáticamente en coordenadas planas, el sistema oficial de Colombia."
        >
          {municipio ? (
            <MapaUbicacion ref={mapaPredioRef} municipio={municipio} prefijo="ubicacion" />
          ) : (
            <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-400">
              Debe seleccionarse primero el municipio para poder ubicar el punto en el mapa.
            </p>
          )}
        </Field>

        {mostrarDatosPredio && (
        <div className="space-y-3 rounded-lg border border-stone-100 bg-stone-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Datos adicionales del predio (opcional)
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre del predio" icon={<IconMapPin className={iconSm} />} help="Como aparece en la escritura o como lo conoce el solicitante.">
              <input
                value={predioNombre}
                onChange={(e) => setPredioNombre(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
            <Field label="Clase de solicitud" icon={<IconLayers className={iconSm} />} help="Para fines estadísticos. Si el trámite ya distingue esta información en el tipo de solicitud, puede registrarse el mismo valor aquí.">
              <select
                value={claseSolicitud}
                onChange={(e) => setClaseSolicitud(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              >
                <option value="">Sin especificar</option>
                <option value="NUEVA">Nueva</option>
                <option value="RENOVACION">Renovación</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nro. Catastral" icon={<IconDocument className={iconSm} />} help="Número de identificación catastral del predio, si se conoce.">
              <input
                value={predioCatastral}
                onChange={(e) => setPredioCatastral(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
            <Field label="Matrícula inmobiliaria" icon={<IconDocument className={iconSm} />} help="Número de matrícula ante la Oficina de Registro de Instrumentos Públicos, si se conoce.">
              <input
                value={predioMatricula}
                onChange={(e) => setPredioMatricula(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Área predial (m²)">
              <input
                type="number"
                min="0"
                step="any"
                value={predioAreaM2}
                onChange={(e) => setPredioAreaM2(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
            <Field label="Área en cultivos (m²)">
              <input
                type="number"
                min="0"
                step="any"
                value={predioAreaCultivosM2}
                onChange={(e) => setPredioAreaCultivosM2(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
            <Field label="Área en bosque (m²)">
              <input
                type="number"
                min="0"
                step="any"
                value={predioAreaBosqueM2}
                onChange={(e) => setPredioAreaBosqueM2(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
            <Field label="Nro. de viviendas" icon={<IconBuilding className={iconSm} />}>
              <input
                type="number"
                min="0"
                step="1"
                value={predioViviendas}
                onChange={(e) => setPredioViviendas(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
          </div>
        </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">3. Documentos</h2>
          <p className="text-xs text-stone-500">
            Cargue los documentos aportados por el solicitante — sin importar el tamaño del archivo, se
            almacena directamente en el sistema. Si falta algún documento, el expediente puede crearse de
            igual forma y completarse posteriormente.
          </p>
        </div>

        {documentosRequeridos.length === 0 && (
          <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-500">
            Este trámite no cuenta con una lista fija de documentos en el procedimiento oficial. Utilice el
            campo &quot;Otros documentos&quot; para adjuntar la información correspondiente.
          </p>
        )}

        {documentosRequeridos.map((doc) => {
          const requerido = documentoRequerido(doc);
          const noAplicaAlTipo = doc.aplicaA !== null && (doc.aplicaA === "JURIDICA") !== esJuridica;
          const archivo = archivosPorDoc[doc.id] ?? null;
          return (
            <Field
              key={doc.id}
              label={doc.nombre}
              required={requerido}
              icon={<IconDocument className={iconSm} />}
              help={
                (doc.notas ?? (requerido ? "Documento obligatorio." : "Documento opcional. Aplica solo en algunos casos.")) +
                (noAplicaAlTipo
                  ? ` No es obligatorio para ${esJuridica ? "persona jurídica" : "persona natural"}, pero puede adjuntarse si corresponde.`
                  : "") +
                " Formatos aceptados: PDF, Word, Excel o imagen (JPG/PNG)."
              }
            >
              <input
                ref={(el) => {
                  docInputRefs.current[doc.id] = el;
                }}
                type="file"
                disabled={submitting}
                onChange={(e) => setArchivosPorDoc((prev) => ({ ...prev, [doc.id]: e.target.files?.[0] ?? null }))}
                className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-cdmb-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-cdmb-700 hover:file:bg-cdmb-100"
              />
              {archivo && (
                <div className="mt-1.5 flex items-center gap-2 rounded-md bg-cdmb-50 px-2.5 py-1.5 text-xs text-cdmb-800">
                  <span className="min-w-0 flex-1 truncate">
                    📄 {archivo.name} <span className="text-cdmb-500">({formatBytes(archivo.size)})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => quitarArchivoDoc(doc.id)}
                    disabled={submitting}
                    title="Quitar este archivo"
                    className="flex-none rounded p-0.5 text-cdmb-500 hover:bg-cdmb-100 hover:text-red-600"
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </Field>
          );
        })}

        <Field
          label="Otros documentos"
          icon={<IconUpload className={iconSm} />}
          help="Cualquier otro soporte que no esté incluido en la lista anterior. Pueden seleccionarse varios archivos, incluso en distintos momentos."
        >
          <input
            ref={extraInputRef}
            type="file"
            multiple
            disabled={submitting}
            onChange={(e) => {
              const nuevos = e.target.files ? Array.from(e.target.files) : [];
              if (nuevos.length > 0) setArchivosExtra((prev) => [...prev, ...nuevos]);
              if (extraInputRef.current) extraInputRef.current.value = "";
            }}
            className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
          />
          {archivosExtra.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {archivosExtra.map((archivo, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md bg-stone-100 px-2.5 py-1.5 text-xs text-stone-700">
                  <span className="min-w-0 flex-1 truncate">
                    📄 {archivo.name} <span className="text-stone-400">({formatBytes(archivo.size)})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => quitarArchivoExtra(i)}
                    disabled={submitting}
                    title="Quitar este archivo"
                    className="flex-none rounded p-0.5 text-stone-400 hover:bg-stone-200 hover:text-red-600"
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
        <Link href={`/tramites/${tramiteSlug}`} className="text-sm text-stone-500 hover:text-stone-700">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 rounded-md bg-cdmb-600 px-5 py-2 text-sm font-medium text-white transition-transform hover:bg-cdmb-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        >
          {submitting && <span className="h-3.5 w-3.5 flex-none animate-spin rounded-full border-2 border-white border-t-transparent" />}
          {submitting ? "Radicando…" : "Radicar expediente"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, X, AlertTriangle, Edit3, Plus, Check, MapPin, ChevronDown } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { MapaSoloLectura } from "@/components/MapaSoloLectura";
import { puntoDentroDeFeatures, cargarJurisdiccionCdmb } from "@/lib/jurisdiccion-cdmb";
import { comprimirFotoVisitaTecnica } from "@/lib/compresion-cliente";
import { leerExifFoto } from "@/lib/exif-foto";
import { subirArchivoDirecto } from "@/lib/uploads-client";
import { filtrarLoteFotosVisita, MAX_FOTOS_VISITA } from "@/lib/visita-tecnica-fotos";
import { ETIQUETA_RESULTADO_VISITA } from "@/lib/temas-visita";

type Punto = { lat: number; lon: number; precisionM: number | null; manual: boolean; capturadoEn: string };
type Tema = { id: string; nombre: string };
type Borrador = {
  punto: Punto | null;
  fechaReal: string;
  horaInicioReal: string;
  horaFinReal: string;
  temaIds: string[];
  temasNuevos: string[];
  atendidoPor: string;
  hallazgos: string;
  recomendaciones: string;
  resultado: string;
};

function leer(clave: string): Borrador | null {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? (JSON.parse(raw) as Borrador) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, b: Borrador) {
  try {
    localStorage.setItem(clave, JSON.stringify(b));
  } catch {}
}

function borrar(clave: string) {
  try {
    localStorage.removeItem(clave);
  } catch {}
}

const RESULTADOS = ["VIABLE", "REQUIERE_INFORMACION", "NO_VIABLE", "EN_ANALISIS"] as const;
const campo = "w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500";

export function RegistrarVisitaForm({
  visitaId,
  expedienteId,
  sugeridos,
  otros,
  iniciales,
}: {
  visitaId: string;
  expedienteId: string;
  sugeridos: Tema[];
  otros: Tema[];
  iniciales: { fechaReal: string; horaInicioReal: string; horaFinReal: string };
}) {
  const router = useRouter();
  const clave = `hoja-visita:${visitaId}`;
  const [b, setB] = useState<Borrador>({
    punto: null,
    ...iniciales,
    temaIds: [],
    temasNuevos: [],
    atendidoPor: "",
    hallazgos: "",
    recomendaciones: "",
    resultado: "",
  });
  const [restaurado, setRestaurado] = useState(false);
  const cargado = useRef(false);
  const [capturando, setCapturando] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  const [latManual, setLatManual] = useState("");
  const [lonManual, setLonManual] = useState("");
  const [fuera, setFuera] = useState<boolean | null>(null);
  const [verOtros, setVerOtros] = useState(false);
  const [temaNuevo, setTemaNuevo] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [previas, setPrevias] = useState<string[]>([]);
  const [errorFotos, setErrorFotos] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cargado.current) return;
    cargado.current = true;
    const previo = leer(clave);
    if (previo) {
      setB(previo);
      setRestaurado(true);
    }
  }, [clave]);

  useEffect(() => {
    if (cargado.current) escribir(clave, b);
  }, [clave, b]);

  useEffect(() => {
    const p = b.punto;
    if (!p) return;
    let cancelado = false;
    cargarJurisdiccionCdmb()
      .then((g) => !cancelado && setFuera(!puntoDentroDeFeatures(p.lat, p.lon, g)))
      .catch(() => !cancelado && setFuera(null));
    return () => {
      cancelado = true;
    };
  }, [b.punto]);

  const fijar = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((prev) => ({ ...prev, [k]: v }));

  function capturar() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Este dispositivo no permite capturar la ubicación. Use «Ingresar manualmente».");
      return;
    }
    setCapturando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fijar("punto", { lat: pos.coords.latitude, lon: pos.coords.longitude, precisionM: pos.coords.accuracy ?? null, manual: false, capturadoEn: new Date().toISOString() });
        setCapturando(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "No se concedió permiso de ubicación. Habilítelo en el navegador o ingrese el punto manualmente."
            : "No fue posible obtener la ubicación. Intente nuevamente o ingrésela manualmente."
        );
        setCapturando(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  function usarManual() {
    const lat = Number(latManual.replace(",", "."));
    const lon = Number(lonManual.replace(",", "."));
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      setError("Ingrese una latitud (-90 a 90) y una longitud (-180 a 180) válidas.");
      return;
    }
    setError(null);
    fijar("punto", { lat, lon, precisionM: null, manual: true, capturadoEn: new Date().toISOString() });
    setModoManual(false);
  }

  function alternarTema(id: string) {
    fijar("temaIds", b.temaIds.includes(id) ? b.temaIds.filter((x) => x !== id) : [...b.temaIds, id]);
  }

  function agregarTemaNuevo() {
    const nombre = temaNuevo.trim().replace(/\s+/g, " ");
    if (nombre.length < 3) return;
    const existente = [...sugeridos, ...otros].find((t) => t.nombre.toLowerCase() === nombre.toLowerCase());
    if (existente) {
      if (!b.temaIds.includes(existente.id)) fijar("temaIds", [...b.temaIds, existente.id]);
    } else if (!b.temasNuevos.some((t) => t.toLowerCase() === nombre.toLowerCase())) {
      fijar("temasNuevos", [...b.temasNuevos, nombre]);
    }
    setTemaNuevo("");
  }

  function agregarFotos(lista: FileList | null) {
    if (!lista) return;
    const { validas, error: e } = filtrarLoteFotosVisita(Array.from(lista), fotos.length);
    setErrorFotos(e);
    if (!validas.length) return;
    setFotos((f) => [...f, ...validas]);
    setPrevias((p) => [...p, ...validas.map((f) => URL.createObjectURL(f))]);
  }

  function quitarFoto(i: number) {
    URL.revokeObjectURL(previas[i]!);
    setFotos((f) => f.filter((_, idx) => idx !== i));
    setPrevias((p) => p.filter((_, idx) => idx !== i));
  }

  async function guardar() {
    setError(null);
    if (!b.punto) return setError("Capture el punto de la visita.");
    if (b.temaIds.length + b.temasNuevos.length === 0) return setError("Seleccione al menos un tema de la visita.");
    if (!b.hallazgos.trim()) return setError("Describa lo observado en la visita.");
    if (!b.resultado) return setError("Seleccione el resultado de la visita.");
    setGuardando(true);
    try {
      const res = await fetch(`/api/visitas-programadas/${visitaId}/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...b, ...b.punto, capturaManual: b.punto.manual }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo registrar la visita.");
      for (let i = 0; i < fotos.length; i++) {
        const original = fotos[i]!;
        setProgreso(`Subiendo foto ${i + 1} de ${fotos.length}…`);
        const exif = await leerExifFoto(original);
        const comprimida = await comprimirFotoVisitaTecnica(original);
        const subida = await subirArchivoDirecto(expedienteId, comprimida);
        await fetch(`/api/expedientes/${expedienteId}/visitas/${data.id}/fotos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath: subida.path,
            mimeType: subida.mimeType,
            tamanoBytes: subida.tamanoBytes,
            nombre: subida.nombre,
            tomadaEn: exif.tomadaEn?.toISOString() ?? null,
            latExif: exif.lat,
            lonExif: exif.lon,
          }),
        });
      }
      borrar(clave);
      for (const url of previas) URL.revokeObjectURL(url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
      setProgreso(null);
    }
  }

  const chip = (t: { id: string; nombre: string }) => {
    const activo = b.temaIds.includes(t.id);
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => alternarTema(t.id)}
        aria-pressed={activo}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-left text-xs ${
          activo ? "border-cdmb-600 bg-cdmb-600 text-white" : "border-stone-200 bg-white text-stone-700 hover:border-cdmb-300 hover:bg-cdmb-50"
        }`}
      >
        {activo && <Check className="h-3 w-3 flex-none" aria-hidden />}
        {t.nombre}
      </button>
    );
  };

  const seccion = (n: number, titulo: string, hijos: React.ReactNode, opcional?: boolean) => (
    <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-900">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cdmb-100 text-[11px] font-bold text-cdmb-800">{n}</span>
        {titulo}
        {opcional && <span className="text-xs font-normal text-stone-400">(opcional)</span>}
      </h3>
      {hijos}
    </section>
  );

  return (
    <div className="space-y-3">
      {restaurado && (
        <p className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Se recuperó el borrador guardado en este dispositivo. Las fotos no se conservan en el borrador.
        </p>
      )}

      {seccion(
        1,
        "Punto de la visita",
        !b.punto ? (
          modoManual ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={latManual} onChange={(e) => setLatManual(e.target.value)} placeholder="Latitud, ej. 7.119349" inputMode="decimal" className={campo} />
                <input value={lonManual} onChange={(e) => setLonManual(e.target.value)} placeholder="Longitud, ej. -73.122742" inputMode="decimal" className={campo} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={usarManual} className="rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-acento-600">
                  Usar este punto
                </button>
                <button type="button" onClick={() => setModoManual(false)} className="rounded-md border border-stone-200 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={capturar}
                disabled={capturando}
                className="inline-flex items-center gap-2 rounded-md bg-acento-500 px-3 py-2 text-sm font-medium text-white hover:bg-acento-600 disabled:opacity-60"
              >
                {capturando ? <Spinner claro /> : <MapPin className="h-4 w-4" aria-hidden />}
                {capturando ? "Obteniendo ubicación…" : "Capturar ubicación actual"}
              </button>
              <button type="button" onClick={() => setModoManual(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700">
                <Edit3 className="h-3.5 w-3.5" aria-hidden />
                Ingresar manualmente
              </button>
            </div>
          )
        ) : (
          <div className="space-y-2">
            <MapaSoloLectura lat={b.punto.lat} lon={b.punto.lon} />
            <p className="text-xs text-stone-600">
              {b.punto.lat.toFixed(6)}, {b.punto.lon.toFixed(6)}
              {b.punto.manual ? " · Ingresado manualmente" : b.punto.precisionM != null && ` · Precisión ±${Math.round(b.punto.precisionM)} m`}
            </p>
            {fuera && (
              <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
                El punto cae fuera de la jurisdicción de la CDMB. Verifíquelo antes de guardar.
              </p>
            )}
            <button type="button" onClick={() => fijar("punto", null)} className="text-xs font-medium text-cdmb-700 hover:underline">
              Capturar de nuevo
            </button>
          </div>
        )
      )}

      {seccion(
        2,
        "Fecha y horario real",
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-stone-600">
            Fecha
            <input type="date" value={b.fechaReal} onChange={(e) => fijar("fechaReal", e.target.value)} className={`mt-0.5 ${campo}`} />
          </label>
          <label className="text-xs text-stone-600">
            Desde
            <input type="time" value={b.horaInicioReal} onChange={(e) => fijar("horaInicioReal", e.target.value)} className={`mt-0.5 ${campo}`} />
          </label>
          <label className="text-xs text-stone-600">
            Hasta
            <input type="time" value={b.horaFinReal} onChange={(e) => fijar("horaFinReal", e.target.value)} className={`mt-0.5 ${campo}`} />
          </label>
        </div>
      )}

      {seccion(
        3,
        "Temas de la visita",
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {sugeridos.map(chip)}
            {b.temasNuevos.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-violet-600 bg-violet-600 px-2.5 py-1 text-xs text-white">
                <Plus className="h-3 w-3" aria-hidden />
                {t}
                <button type="button" onClick={() => fijar("temasNuevos", b.temasNuevos.filter((x) => x !== t))} aria-label={`Quitar ${t}`} className="rounded-full hover:bg-white/20">
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
          {otros.length > 0 && (
            <div>
              <button type="button" onClick={() => setVerOtros((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-cdmb-700">
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verOtros ? "rotate-180" : ""}`} aria-hidden />
                {verOtros ? "Ocultar temas de otros trámites" : `Ver temas de otros trámites (${otros.length})`}
              </button>
              {verOtros && <div className="mt-1.5 flex flex-wrap gap-1.5">{otros.map(chip)}</div>}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={temaNuevo}
              onChange={(e) => setTemaNuevo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  agregarTemaNuevo();
                }
              }}
              maxLength={150}
              placeholder="Agregar un tema que no está en la lista…"
              className={campo}
            />
            <button type="button" onClick={agregarTemaNuevo} className="flex-none rounded-md border border-stone-200 px-3 text-sm font-medium text-stone-700 hover:bg-stone-50">
              Agregar
            </button>
          </div>
          <p className="text-[11px] text-stone-400">Los temas nuevos quedan disponibles para las próximas visitas.</p>
        </div>
      )}

      {seccion(
        4,
        "Bitácora",
        <div className="space-y-2">
          <label className="block text-xs text-stone-600">
            Persona que atendió la visita (nombre y calidad)
            <input value={b.atendidoPor} onChange={(e) => fijar("atendidoPor", e.target.value)} maxLength={200} placeholder="Ej. Juan Pérez, propietario" className={`mt-0.5 ${campo}`} />
          </label>
          <label className="block text-xs text-stone-600">
            Hallazgos y observaciones <span className="text-red-600">*</span>
            <textarea value={b.hallazgos} onChange={(e) => fijar("hallazgos", e.target.value)} rows={5} className={`mt-0.5 ${campo}`} />
          </label>
          <label className="block text-xs text-stone-600">
            Recomendaciones o requerimientos
            <textarea value={b.recomendaciones} onChange={(e) => fijar("recomendaciones", e.target.value)} rows={3} className={`mt-0.5 ${campo}`} />
          </label>
        </div>
      )}

      {seccion(
        5,
        "Resultado de la visita",
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {RESULTADOS.map((r) => (
            <label
              key={r}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                b.resultado === r ? "border-cdmb-600 bg-cdmb-50 text-cdmb-900" : "border-stone-200 text-stone-700 hover:bg-stone-50"
              }`}
            >
              <input type="radio" name="resultado" value={r} checked={b.resultado === r} onChange={() => fijar("resultado", r)} className="text-cdmb-600" />
              {ETIQUETA_RESULTADO_VISITA[r]}
            </label>
          ))}
        </div>
      )}

      {seccion(
        6,
        `Registro fotográfico (${fotos.length}/${MAX_FOTOS_VISITA})`,
        <div className="space-y-2">
          {previas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {previas.map((url, i) => (
                <div key={url} className="relative h-20 w-20 overflow-hidden rounded-md border border-stone-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => quitarFoto(i)} aria-label={`Quitar foto ${i + 1}`} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white">
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
          {fotos.length < MAX_FOTOS_VISITA && (
            <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
              <Camera className="h-4 w-4" aria-hidden />
              Tomar o agregar fotos
              <input type="file" accept="image/jpeg,image/png" capture="environment" multiple className="hidden" onChange={(e) => agregarFotos(e.target.files)} />
            </label>
          )}
          {errorFotos && <p className="text-xs text-red-600">{errorFotos}</p>}
        </div>,
        true
      )}

      {error && (
        <p className="flex items-start gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-acento-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-acento-600 disabled:opacity-60"
      >
        {guardando && <Spinner claro />}
        {guardando ? progreso ?? "Guardando…" : "Registrar visita"}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Field";
import { Spinner } from "@/components/Spinner";
import { MapaSoloLectura } from "@/components/MapaSoloLectura";
import { IconMapPin } from "@/components/icons";
import { Camera, X, AlertTriangle, Edit3 } from "lucide-react";
import { puntoDentroDeFeatures, cargarJurisdiccionCdmb } from "@/lib/jurisdiccion-cdmb";
import { comprimirFotoVisitaTecnica } from "@/lib/compresion-cliente";
import { leerExifFoto } from "@/lib/exif-foto";
import { subirArchivoDirecto } from "@/lib/uploads-client";
import { filtrarLoteFotosVisita, MAX_FOTOS_VISITA } from "@/lib/visita-tecnica-fotos";

type Punto = { lat: number; lon: number; precisionM: number | null; manual: boolean; capturadoEn: string };
type Borrador = { punto: Punto; nota: string };

function claveBorrador(expedienteId: string, pasoNumero: number) {
  return `visita-draft:${expedienteId}:${pasoNumero}`;
}

function leerBorrador(clave: string): Borrador | null {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? (JSON.parse(raw) as Borrador) : null;
  } catch {
    return null;
  }
}

function guardarBorrador(clave: string, borrador: Borrador) {
  try {
    localStorage.setItem(clave, JSON.stringify(borrador));
  } catch {
    // localStorage puede fallar (privado, cuota, bloqueado) — el borrador es una conveniencia, no algo crítico.
  }
}

function borrarBorrador(clave: string) {
  try {
    localStorage.removeItem(clave);
  } catch {
    // ver arriba
  }
}

function mensajeErrorGeolocalizacion(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "No se concedió permiso para acceder a la ubicación del dispositivo. Debe habilitarse el permiso de ubicación en el navegador.";
    case err.POSITION_UNAVAILABLE:
      return "No fue posible determinar la ubicación actual del dispositivo.";
    case err.TIMEOUT:
      return "Se agotó el tiempo de espera al intentar obtener la ubicación. Intente nuevamente.";
    default:
      return "No fue posible obtener la ubicación del dispositivo.";
  }
}

export function CapturarVisitaTecnica({ expedienteId, pasoNumero }: { expedienteId: string; pasoNumero: number }) {
  const router = useRouter();
  const clave = claveBorrador(expedienteId, pasoNumero);

  const [capturando, setCapturando] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  const [latManual, setLatManual] = useState("");
  const [lonManual, setLonManual] = useState("");
  const [punto, setPunto] = useState<Punto | null>(null);
  const [fueraJurisdiccion, setFueraJurisdiccion] = useState<boolean | null>(null);
  const [nota, setNota] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPrevias] = useState<string[]>([]);
  const [errorFotos, setErrorFotos] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const restaurado = useRef(false);

  // Restaurar un borrador (punto + nota) si se perdió la conexión o se recargó la página a medias.
  useEffect(() => {
    if (restaurado.current) return;
    restaurado.current = true;
    const b = leerBorrador(clave);
    if (b) {
      setPunto(b.punto);
      setNota(b.nota);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (punto) guardarBorrador(clave, { punto, nota });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [punto, nota]);

  useEffect(() => {
    if (!punto) {
      setFueraJurisdiccion(null);
      return;
    }
    let cancelado = false;
    cargarJurisdiccionCdmb()
      .then((geojson) => {
        if (!cancelado) setFueraJurisdiccion(!puntoDentroDeFeatures(punto.lat, punto.lon, geojson));
      })
      .catch(() => {
        if (!cancelado) setFueraJurisdiccion(null);
      });
    return () => {
      cancelado = true;
    };
  }, [punto]);

  useEffect(() => {
    return () => {
      for (const url of previews) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capturarUbicacion() {
    setError(null);
    setGuardado(false);
    setModoManual(false);
    if (!navigator.geolocation) {
      setError("Este dispositivo o navegador no admite la captura de ubicación. Use «Ingresar manualmente».");
      return;
    }
    setCapturando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPunto({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          precisionM: pos.coords.accuracy ?? null,
          manual: false,
          capturadoEn: new Date().toISOString(),
        });
        setCapturando(false);
      },
      (err) => {
        setError(mensajeErrorGeolocalizacion(err));
        setCapturando(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  function usarPuntoManual() {
    const lat = Number(latManual.replace(",", "."));
    const lon = Number(lonManual.replace(",", "."));
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      setError("Ingrese una latitud (-90 a 90) y una longitud (-180 a 180) válidas.");
      return;
    }
    setError(null);
    setGuardado(false);
    setPunto({ lat, lon, precisionM: null, manual: true, capturadoEn: new Date().toISOString() });
    setModoManual(false);
  }

  function agregarFotos(lista: FileList | null) {
    if (!lista) return;
    const { validas, error: e } = filtrarLoteFotosVisita(Array.from(lista), fotos.length);
    setErrorFotos(e);
    if (validas.length === 0) return;
    setFotos((f) => [...f, ...validas]);
    setPrevias((p) => [...p, ...validas.map((f) => URL.createObjectURL(f))]);
  }

  function quitarFoto(i: number) {
    URL.revokeObjectURL(previews[i]!);
    setFotos((f) => f.filter((_, idx) => idx !== i));
    setPrevias((p) => p.filter((_, idx) => idx !== i));
  }

  async function guardarPunto() {
    if (!punto) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/visitas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pasoNumero,
          lat: punto.lat,
          lon: punto.lon,
          precisionM: punto.precisionM,
          nota,
          capturaManual: punto.manual,
          capturadoEn: punto.capturadoEn,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar la geoposición.");
      }
      const { id: visitaId } = await res.json();

      for (let i = 0; i < fotos.length; i++) {
        const original = fotos[i]!;
        setProgreso(`Subiendo foto ${i + 1} de ${fotos.length}…`);
        const exif = await leerExifFoto(original);
        const comprimida = await comprimirFotoVisitaTecnica(original);
        const subida = await subirArchivoDirecto(expedienteId, comprimida);
        await fetch(`/api/expedientes/${expedienteId}/visitas/${visitaId}/fotos`, {
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

      borrarBorrador(clave);
      for (const url of previews) URL.revokeObjectURL(url);
      setPunto(null);
      setNota("");
      setFotos([]);
      setPrevias([]);
      setProgreso(null);
      setGuardado(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado. Intente nuevamente.");
      setProgreso(null);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      {!punto && !modoManual && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={capturarUbicacion}
            disabled={capturando}
            className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          >
            {capturando ? <Spinner /> : <IconMapPin className="h-3.5 w-3.5" />}
            {capturando ? "Obteniendo ubicación…" : "Capturar ubicación actual"}
          </button>
          <button
            type="button"
            onClick={() => {
              setModoManual(true);
              setError(null);
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden />
            Ingresar manualmente
          </button>
        </div>
      )}

      {!punto && modoManual && (
        <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Latitud">
              <input
                value={latManual}
                onChange={(e) => setLatManual(e.target.value)}
                placeholder="Ej. 7.119349"
                inputMode="decimal"
                className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
              />
            </Field>
            <Field label="Longitud">
              <input
                value={lonManual}
                onChange={(e) => setLonManual(e.target.value)}
                placeholder="Ej. -73.122742"
                inputMode="decimal"
                className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={usarPuntoManual}
              className="rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white transition-transform hover:bg-acento-600 active:scale-95"
            >
              Usar este punto
            </button>
            <button
              type="button"
              onClick={() => setModoManual(false)}
              className="rounded-md border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {punto && (
        <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
          <MapaSoloLectura lat={punto.lat} lon={punto.lon} />
          <p className="text-xs text-stone-600">
            Latitud/longitud: {punto.lat.toFixed(6)}, {punto.lon.toFixed(6)}
            {punto.manual
              ? " · Ingresada manualmente"
              : punto.precisionM != null && <> · Precisión reportada: ±{Math.round(punto.precisionM)} m</>}
          </p>
          {fueraJurisdiccion && (
            <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
              Este punto cae fuera del área de jurisdicción de la CDMB. Verifique la ubicación antes de guardar —
              aun así puede guardarla si corresponde (predios en el límite de la jurisdicción, imprecisión del GPS).
            </p>
          )}
          <Field label="Nota (opcional)" help="Observación sobre el punto capturado.">
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-600">Fotos ({fotos.length}/{MAX_FOTOS_VISITA})</p>
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previews.map((url, i) => (
                  <div key={url} className="relative h-16 w-16 overflow-hidden rounded-md border border-stone-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => quitarFoto(i)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                      aria-label={`Quitar foto ${i + 1}`}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {fotos.length < MAX_FOTOS_VISITA && (
              <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
                <Camera className="h-3.5 w-3.5" aria-hidden />
                Agregar fotos
                <input type="file" accept="image/jpeg,image/png" capture="environment" multiple className="hidden" onChange={(e) => agregarFotos(e.target.files)} />
              </label>
            )}
            {errorFotos && <p className="text-xs text-red-600">{errorFotos}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={guardarPunto}
              disabled={guardando}
              className="flex items-center gap-2 rounded-md bg-acento-500 px-3 py-1.5 text-sm font-medium text-white transition-transform hover:bg-acento-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
            >
              {guardando && <Spinner claro />}
              {guardando ? progreso ?? "Guardando…" : "Guardar visita"}
            </button>
            <button
              type="button"
              onClick={() => {
                borrarBorrador(clave);
                setPunto(null);
              }}
              disabled={guardando}
              className="rounded-md border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Descartar y capturar de nuevo
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {guardado && <p className="text-xs text-cdmb-700">La visita técnica quedó registrada en el expediente.</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Field";
import { Spinner } from "@/components/Spinner";
import { MapaSoloLectura } from "@/components/MapaSoloLectura";
import { IconMapPin } from "@/components/icons";

type Punto = { lat: number; lon: number; precisionM: number | null };

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
  const [capturando, setCapturando] = useState(false);
  const [punto, setPunto] = useState<Punto | null>(null);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  function capturarUbicacion() {
    setError(null);
    setGuardado(false);
    if (!navigator.geolocation) {
      setError("Este dispositivo o navegador no admite la captura de ubicación.");
      return;
    }
    setCapturando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPunto({ lat: pos.coords.latitude, lon: pos.coords.longitude, precisionM: pos.coords.accuracy ?? null });
        setCapturando(false);
      },
      (err) => {
        setError(mensajeErrorGeolocalizacion(err));
        setCapturando(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  async function guardarPunto() {
    if (!punto) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/expedientes/${expedienteId}/visitas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasoNumero, lat: punto.lat, lon: punto.lon, precisionM: punto.precisionM, nota }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar la geoposición.");
      }
      setPunto(null);
      setNota("");
      setGuardado(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado. Intente nuevamente.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      {!punto ? (
        <button
          type="button"
          onClick={capturarUbicacion}
          disabled={capturando}
          className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
        >
          {capturando ? <Spinner /> : <IconMapPin className="h-3.5 w-3.5" />}
          {capturando ? "Obteniendo ubicación…" : "Capturar ubicación actual"}
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
          <MapaSoloLectura lat={punto.lat} lon={punto.lon} />
          <p className="text-xs text-stone-600">
            Latitud/longitud: {punto.lat.toFixed(6)}, {punto.lon.toFixed(6)}
            {punto.precisionM != null && <> · Precisión reportada: ±{Math.round(punto.precisionM)} m</>}
          </p>
          <Field label="Nota (opcional)" help="Observación sobre el punto capturado.">
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={guardarPunto}
              disabled={guardando}
              className="flex items-center gap-2 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white transition-transform hover:bg-cdmb-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
            >
              {guardando && <Spinner claro />}
              {guardando ? "Guardando…" : "Guardar punto"}
            </button>
            <button
              type="button"
              onClick={() => setPunto(null)}
              disabled={guardando}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Descartar y capturar de nuevo
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {guardado && <p className="text-xs text-cdmb-700">La geoposición quedó registrada en el expediente.</p>}
    </div>
  );
}

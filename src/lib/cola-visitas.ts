"use client";

import { comprimirFotoVisitaTecnica } from "@/lib/compresion-cliente";
import { leerExifFoto } from "@/lib/exif-foto";
import { subirArchivoDirecto } from "@/lib/uploads-client";

export type RegistroPendiente = {
  visitaId: string;
  expedienteId: string;
  etiqueta: string;
  cuerpo: Record<string, unknown>;
  fotos: File[];
  visitaTecnicaId?: string;
  creadoEn: string;
  ultimoError?: string;
};

const BD = "trabajo-campo";
const PENDIENTES = "pendientes";
const FOTOS = "fotos-borrador";
export const EVENTO_COLA = "cola-visitas-cambio";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PENDIENTES)) db.createObjectStore(PENDIENTES, { keyPath: "visitaId" });
      if (!db.objectStoreNames.contains(FOTOS)) db.createObjectStore(FOTOS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function operar<T>(almacen: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(almacen, modo);
      const req = fn(tx.objectStore(almacen));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function avisar() {
  window.dispatchEvent(new Event(EVENTO_COLA));
}

export async function guardarFotosBorrador(visitaId: string, fotos: File[]): Promise<void> {
  try {
    await operar<unknown>(FOTOS, "readwrite", (s) => (fotos.length ? (s.put(fotos, visitaId) as IDBRequest<unknown>) : (s.delete(visitaId) as IDBRequest<unknown>)));
  } catch {}
}

export async function leerFotosBorrador(visitaId: string): Promise<File[]> {
  try {
    const r = await operar<File[] | undefined>(FOTOS, "readonly", (s) => s.get(visitaId));
    return Array.isArray(r) ? r : [];
  } catch {
    return [];
  }
}

export async function encolarRegistro(item: RegistroPendiente): Promise<void> {
  await operar(PENDIENTES, "readwrite", (s) => s.put(item));
  avisar();
}

export async function listarPendientes(): Promise<RegistroPendiente[]> {
  try {
    return await operar<RegistroPendiente[]>(PENDIENTES, "readonly", (s) => s.getAll());
  } catch {
    return [];
  }
}

async function quitarPendiente(visitaId: string): Promise<void> {
  await operar(PENDIENTES, "readwrite", (s) => s.delete(visitaId));
  await guardarFotosBorrador(visitaId, []);
  avisar();
}

export type ResultadoEnvio = { estado: "enviado"; visitaTecnicaId: string } | { estado: "sin_red" } | { estado: "rechazado"; mensaje: string; sesion?: boolean };

function esErrorDeRed(e: unknown): boolean {
  return e instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
}

export async function enviarRegistro(item: RegistroPendiente, onProgreso?: (texto: string) => void): Promise<ResultadoEnvio> {
  let visitaTecnicaId = item.visitaTecnicaId;
  try {
    if (!visitaTecnicaId) {
      const res = await fetch(`/api/visitas-programadas/${item.visitaId}/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.cuerpo),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { estado: "rechazado", mensaje: data.error || "No se pudo registrar la visita.", sesion: res.status === 401 };
      visitaTecnicaId = String(data.id);
      item.visitaTecnicaId = visitaTecnicaId;
    }
    while (item.fotos.length > 0) {
      const original = item.fotos[0]!;
      onProgreso?.(`Subiendo foto (${item.fotos.length} pendiente${item.fotos.length === 1 ? "" : "s"})…`);
      const exif = await leerExifFoto(original);
      const comprimida = await comprimirFotoVisitaTecnica(original);
      const subida = await subirArchivoDirecto(item.expedienteId, comprimida);
      const r = await fetch(`/api/expedientes/${item.expedienteId}/visitas/${visitaTecnicaId}/fotos`, {
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
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw Object.assign(new Error(d.error || "No se pudo guardar una foto."), { status: r.status });
      }
      item.fotos = item.fotos.slice(1);
    }
    return { estado: "enviado", visitaTecnicaId };
  } catch (e) {
    if (esErrorDeRed(e)) return { estado: "sin_red" };
    const status = (e as { status?: number }).status;
    return { estado: "rechazado", mensaje: e instanceof Error ? e.message : "Error inesperado.", sesion: status === 401 };
  }
}

let enCurso: Promise<{ enviados: number; pendientes: number }> | null = null;

export function sincronizarPendientes(): Promise<{ enviados: number; pendientes: number }> {
  enCurso ??= (async () => {
    let enviados = 0;
    const lista = await listarPendientes();
    for (const item of lista) {
      if (!navigator.onLine) break;
      const r = await enviarRegistro(item);
      if (r.estado === "enviado") {
        await quitarPendiente(item.visitaId);
        enviados++;
      } else {
        await operar(PENDIENTES, "readwrite", (s) => s.put({ ...item, ultimoError: r.estado === "rechazado" ? r.mensaje : undefined }));
        avisar();
        if (r.estado === "sin_red" || r.sesion) break;
      }
    }
    return { enviados, pendientes: (await listarPendientes()).length };
  })().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

export async function descartarPendiente(visitaId: string): Promise<void> {
  await quitarPendiente(visitaId);
}

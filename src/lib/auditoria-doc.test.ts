import { describe, expect, it } from "vitest";
import { calcularHashAuditoria, verificarCadenaFilas, type FilaHasheable } from "./auditoria-doc";
import type { AccionAuditoriaDoc } from "@prisma/client";

// Construye una cadena de N eslabones en memoria, igual que lo haría
// registrarAuditoriaDoc(), para probar la verificación sin tocar la base.
type Fila = {
  secuencia: number;
  entidad: string;
  entidadId: string;
  accion: AccionAuditoriaDoc;
  usuarioId: string | null;
  ip: string | null;
  detalle: string | null;
  createdAt: Date;
  hashAnterior: string | null;
  hash: string;
};

function construirCadena(n: number): Fila[] {
  const filas: Fila[] = [];
  let hashPrevio: string | null = null;
  for (let i = 0; i < n; i++) {
    const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, i));
    const datos: FilaHasheable = {
      entidad: "Comunicacion",
      entidadId: `com-${i}`,
      accion: (i % 2 === 0 ? "CREA" : "LEE") as AccionAuditoriaDoc,
      usuarioId: `user-${i % 3}`,
      ip: "10.0.0.1",
      detalle: `evento ${i}`,
      createdAtIso: createdAt.toISOString(),
      hashAnterior: hashPrevio,
    };
    const hash = calcularHashAuditoria(datos);
    filas.push({
      secuencia: i + 1,
      entidad: datos.entidad,
      entidadId: datos.entidadId,
      accion: datos.accion,
      usuarioId: datos.usuarioId ?? null,
      ip: datos.ip ?? null,
      detalle: datos.detalle ?? null,
      createdAt,
      hashAnterior: hashPrevio,
      hash,
    });
    hashPrevio = hash;
  }
  return filas;
}

describe("cadena de hash de auditoría inalterable", () => {
  it("una cadena íntegra verifica OK", () => {
    const r = verificarCadenaFilas(construirCadena(5));
    expect(r.ok).toBe(true);
    expect(r.totalRevisadas).toBe(5);
  });

  it("detecta la alteración del contenido de una fila (cambia el detalle)", () => {
    const filas = construirCadena(5);
    filas[2] = { ...filas[2], detalle: "MANIPULADO" }; // se altera sin recalcular el hash
    const r = verificarCadenaFilas(filas);
    expect(r.ok).toBe(false);
    expect(r.secuenciaRota).toBe(3);
  });

  it("detecta la eliminación de una fila intermedia (rompe el encadenamiento)", () => {
    const filas = construirCadena(5);
    filas.splice(2, 1); // se borra la fila de secuencia 3
    const r = verificarCadenaFilas(filas);
    expect(r.ok).toBe(false);
    // la siguiente fila (secuencia 4) queda con un hashAnterior que ya no coincide
    expect(r.secuenciaRota).toBe(4);
  });

  it("un mismo contenido produce siempre el mismo hash (determinista)", () => {
    const base: FilaHasheable = {
      entidad: "Comunicacion",
      entidadId: "com-1",
      accion: "CREA",
      usuarioId: "u1",
      ip: null,
      detalle: "x",
      createdAtIso: "2026-01-01T00:00:00.000Z",
      hashAnterior: null,
    };
    expect(calcularHashAuditoria(base)).toBe(calcularHashAuditoria({ ...base }));
  });
});

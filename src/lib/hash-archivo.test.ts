import { describe, expect, it, vi } from "vitest";

const bytes = Buffer.from("contenido real");
vi.mock("@/lib/storage", () => ({ descargarDocumento: vi.fn(async () => bytes) }));

import { huellaVerificada, sha256, MENSAJE_ARCHIVO_CAMBIO } from "./hash-archivo";

describe("huellaVerificada", () => {
  const real = sha256(bytes);

  it("acepta la huella registrada cuando coincide con el archivo guardado", async () => {
    const corregir = vi.fn();
    await expect(huellaVerificada({ storagePath: "x", hashSha256: real }, 2, corregir)).resolves.toBe(real);
    expect(corregir).not.toHaveBeenCalled();
  });

  it("sin firmas previas corrige una huella falsa o ausente", async () => {
    const corregir = vi.fn(async () => undefined);
    await expect(huellaVerificada({ storagePath: "x", hashSha256: "f".repeat(64) }, 0, corregir)).resolves.toBe(real);
    await expect(huellaVerificada({ storagePath: "x", hashSha256: null }, 0, corregir)).resolves.toBe(real);
    expect(corregir).toHaveBeenCalledWith(real);
  });

  it("con firmas previas rechaza si el archivo ya no es el que se firmó", async () => {
    await expect(huellaVerificada({ storagePath: "x", hashSha256: "f".repeat(64) }, 1, vi.fn())).rejects.toThrow(MENSAJE_ARCHIVO_CAMBIO);
  });
});

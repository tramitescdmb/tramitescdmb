import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FORMATO_SIGLA, formatearNumeroSigla, normalizarSigla, serieSigla, SIGLA_POR_PROCEDIMIENTO, siglaDeTramite } from "@/lib/siglas-tramite";
import { numeroFinal } from "@/lib/consecutivos";

describe("siglas de expediente por trámite", () => {
  it("usa el formato de SINCA: SIGLA-0000-año", () => {
    expect(formatearNumeroSigla("LA", 2026, 3)).toBe("LA-0003-2026");
    expect(formatearNumeroSigla("CA", 2026, 82)).toBe("CA-0082-2026");
    expect(numeroFinal("CA-0081-2026", "CA-", "-2026")).toBe(81);
    expect(numeroFinal("CA-0081-2025", "CA-", "-2026")).toBeNull();
    expect(serieSigla("AF")).toBe("TRAMITE-SIGLA-AF");
  });

  it("toma las siglas aprobadas, con prioridad para la guardada", () => {
    expect(siglaDeTramite({ codigo: "M-DA-PR22" })).toBe("LA");
    expect(siglaDeTramite({ codigo: "M-DA-PR65" })).toBe("LA");
    expect(siglaDeTramite({ codigo: "M-DA-PR48" })).toBe("AF");
    expect(siglaDeTramite({ codigo: "M-DA-PR21", sigla: "cs" })).toBe("CS");
    expect(siglaDeTramite({ codigo: "M-DA-PR21", sigla: "" })).toBe("CA");
    expect(siglaDeTramite({ codigo: "IE-01" })).toBeNull();
  });

  it("valida la sigla", () => {
    expect(normalizarSigla(" la ")).toBe("LA");
    expect(normalizarSigla("L")).toBeNull();
    expect(normalizarSigla("LA1")).toBeNull();
    expect(normalizarSigla("ÁB")).toBeNull();
    for (const s of Object.values(SIGLA_POR_PROCEDIMIENTO)) expect(s).toMatch(FORMATO_SIGLA);
  });

  it("no usa SA (Sancionatorio en SINCA) y cubre todos los procedimientos menos los instrumentos económicos", () => {
    expect(Object.values(SIGLA_POR_PROCEDIMIENTO)).not.toContain("SA");
    const codigos = readdirSync("data/tramites")
      .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
      .map((f) => f.replace(/\.json$/, ""))
      .filter((c) => !c.startsWith("IE-"));
    for (const c of codigos) expect(SIGLA_POR_PROCEDIMIENTO[c], c).toBeTruthy();
  });
});

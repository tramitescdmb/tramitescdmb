import { describe, expect, it } from "vitest";
import { FUNCIONALIDADES, FUNCIONALIDAD_POR_CLAVE, matricesIguales, normalizarMatriz } from "@/lib/perfiles-catalogo";
import { PERFILES_SEMILLA, matrizDesdeReglas, matrizSemilla, permisosDeReferencia } from "@/lib/perfiles-equivalencia";

const semilla = (clave: string) => matrizSemilla(PERFILES_SEMILLA.find((s) => s.claveOrigen === clave)!);

describe("catálogo de funcionalidades", () => {
  it("no repite claves", () => {
    expect(new Set(FUNCIONALIDADES.map((f) => f.clave)).size).toBe(FUNCIONALIDADES.length);
  });

  it("cada regla actual cae en una funcionalidad y una acción del catálogo", () => {
    for (const s of PERFILES_SEMILLA) {
      for (const [clave, acciones] of Object.entries(matrizSemilla(s))) {
        const f = FUNCIONALIDAD_POR_CLAVE.get(clave);
        expect(f, clave).toBeDefined();
        for (const a of acciones) expect(f!.acciones, `${clave}:${a}`).toContain(a);
      }
    }
  });

  it("normalizar descarta claves y acciones que no existen", () => {
    expect(normalizarMatriz({ "sgdea.bandeja": ["LEER", "ELIMINAR"], inventada: ["LEER"] })).toEqual({ "sgdea.bandeja": ["LEER"] });
  });
});

describe("perfiles iniciales equivalentes a los roles actuales", () => {
  it("el administrador del sistema tiene todas las acciones del catálogo", () => {
    const m = semilla("ADMIN");
    for (const f of FUNCIONALIDADES) expect(m[f.clave] ?? [], f.clave).toEqual([...f.acciones]);
  });

  it("la ventanilla radica y reparte, pero no administra el archivo", () => {
    const m = semilla("SGDEA:OPERADOR_VENTANILLA");
    expect(m["sgdea.radicacion"]).toEqual(["CREAR", "ACTUALIZAR"]);
    expect(m["sgdea.reparto"]).toEqual(["ACTUALIZAR"]);
    expect(m["sgdea.archivo"]).toBeUndefined();
  });

  it("el jefe de dependencia redistribuye en su oficina pero no reparte desde la ventanilla", () => {
    const m = semilla("SGDEA:JEFE_DEPENDENCIA");
    expect(m["sgdea.reparto-interno"]).toEqual(["ACTUALIZAR"]);
    expect(m["sgdea.reparto"]).toBeUndefined();
    expect(m["sgdea.radicacion"]).toBeUndefined();
  });

  it("el contratista no ve la etapa precontractual ni gestiona contratistas", () => {
    const m = semilla("GECON:CONTRATISTA");
    expect(m["gecon.precontractual"]).toBeUndefined();
    expect(m["gecon.contratistas"]).toBeUndefined();
    expect(m["gecon.documentos"]).toEqual(["CREAR"]);
  });

  it("solo el jefe y el administrador de contratación aprueban etapas", () => {
    const aprueban = PERFILES_SEMILLA.filter((s) => s.modulo === "GECON" && semilla(s.claveOrigen)["gecon.etapas"]).map((s) => s.claveOrigen);
    expect(aprueban.sort()).toEqual(["GECON:ADMINISTRADOR_CONTRATACION", "GECON:JEFE_CONTRATACION"]);
  });

  it("trámites en consulta no puede gestionar; en gestión sí", () => {
    expect(semilla("TRAMITES:VER")["tramites.expedientes"]).toEqual(["LEER"]);
    expect(semilla("TRAMITES:EDITAR")["tramites.expedientes"]).toEqual(["LEER", "ACTUALIZAR"]);
  });

  it("un rol de un módulo no concede nada en los demás", () => {
    for (const s of PERFILES_SEMILLA.filter((x) => x.modulo !== "GENERAL")) {
      for (const clave of Object.keys(matrizSemilla(s))) expect(FUNCIONALIDAD_POR_CLAVE.get(clave)!.modulo, `${s.nombre} → ${clave}`).toBe(s.modulo);
    }
  });

  it("la matriz derivada es estable", () => {
    for (const s of PERFILES_SEMILLA) expect(matricesIguales(matrizSemilla(s), matrizDesdeReglas(permisosDeReferencia(s.rol)))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  actualizarTextosTipo,
  camposObligatoriosFaltantes,
  completarPrecarga,
  evaluarCumplimiento,
  evaluarFormula,
  numeroDesdeTexto,
  resolverPlantilla,
  respuestasIniciales,
  resumenAgrupado,
  sanearRespuestas,
  totalColumna,
  validarEstructura,
  valorColumnaFila,
  valorNumericoCampo,
  type Campo,
  type Respuestas,
} from "@/lib/formato-visita";
import { FORMATO_AGUAS, FORMATO_FORESTAL, FORMATO_VERTIMIENTOS, FORMATOS_BASE } from "@/lib/formatos-visita-base";
import { planasOrigenBogota } from "@/lib/coordenadas";

const campo = (estructura: { secciones: { campos: Campo[] }[] }, id: string) => estructura.secciones.flatMap((s) => s.campos).find((c) => c.id === id)!;

describe("evaluarFormula", () => {
  it("respeta precedencia, potencias, funciones y constantes", () => {
    expect(evaluarFormula("2 + 3 * 4", () => null)).toBe(14);
    expect(evaluarFormula("2^3^2", () => null)).toBe(512);
    expect(evaluarFormula("-(2 + 3)", () => null)).toBe(-5);
    expect(evaluarFormula("redondear(pi, 4)", () => null)).toBe(3.1416);
    expect(evaluarFormula("raiz(9) + max(1; 7; 3)", () => null)).toBe(10);
  });

  it("devuelve null si falta un valor y lanza error con sintaxis inválida", () => {
    expect(evaluarFormula("a * 2", () => null)).toBeNull();
    expect(() => evaluarFormula("2 +", () => 1)).toThrow();
    expect(() => evaluarFormula("2 $ 3", () => 1)).toThrow();
    expect(() => evaluarFormula("desconocida(2)", () => 1)).toThrow();
  });
});

describe("numeroDesdeTexto", () => {
  it("entiende coma decimal, miles con punto y prefijos de menor que", () => {
    expect(numeroDesdeTexto("0,5")).toBe(0.5);
    expect(numeroDesdeTexto("1.267.971")).toBe(1267971);
    expect(numeroDesdeTexto("< 0,0100")).toBe(0.01);
    expect(numeroDesdeTexto("2 400")).toBe(2400);
    expect(numeroDesdeTexto("abc")).toBeNull();
  });
});

describe("formato forestal (concepto EV-0039)", () => {
  const inventario = campo(FORMATO_FORESTAL.estructura, "inventario");
  const fila = { nombre_comun: "Nauno", nombre_cientifico: "Albizia guachapele", cap1: "155", cap2: "150", cap3: "155", altura_comercial: "3", altura_total: "10" };

  it("calcula CAP total, DAP y volúmenes como en el concepto", () => {
    expect(Math.round(valorColumnaFila(inventario, fila, "cap_total")!)).toBe(266);
    expect(valorColumnaFila(inventario, fila, "dap")!.toFixed(2)).toBe("0.85");
    expect(valorColumnaFila(inventario, fila, "vol_total")!.toFixed(2)).toBe("3.37");
    expect(valorColumnaFila(inventario, fila, "vol_comercial")!.toFixed(2)).toBe("1.01");
  });

  it("acepta un solo fuste dejando CAP 2 y CAP 3 vacíos", () => {
    expect(valorColumnaFila(inventario, { cap1: "100", altura_total: "5" }, "cap_total")).toBe(100);
  });

  it("totaliza, cuenta árboles y agrupa por especie", () => {
    const r: Respuestas = { inventario: [fila, { ...fila }, {}], relacion_compensacion: "5" };
    expect(valorNumericoCampo(FORMATO_FORESTAL.estructura, r, "cantidad_arboles")).toBe(2);
    expect(valorNumericoCampo(FORMATO_FORESTAL.estructura, r, "volumen_total")!.toFixed(2)).toBe("6.74");
    expect(valorNumericoCampo(FORMATO_FORESTAL.estructura, r, "individuos_compensacion")).toBe(10);
    const grupos = resumenAgrupado(inventario, r.inventario);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.conteo).toBe(2);
  });
});

describe("formato de concesión de aguas (concepto EV-0144)", () => {
  const consumo = campo(FORMATO_AGUAS.estructura, "consumo");
  const filas = [
    { uso: "Doméstico permanentes", dotacion: "150", cantidad: "12" },
    { uso: "Doméstico transitorias", dotacion: "50", cantidad: "8" },
    { uso: "Riego", dotacion: "0,5", cantidad: "24.000" },
  ];

  it("reproduce los caudales del cuadro de consumo", () => {
    expect(valorColumnaFila(consumo, filas[0]!, "ls")).toBe(0.0208);
    expect(valorColumnaFila(consumo, filas[0]!, "ld")!.toFixed(2)).toBe("1797.12");
    expect(valorColumnaFila(consumo, filas[2]!, "ls")).toBe(0.1389);
    expect(totalColumna(consumo, filas, "ls")!.toFixed(4)).toBe("0.1643");
    expect(totalColumna(consumo, filas, "ld")!.toFixed(2)).toBe("14195.52");
  });

  it("calcula caudal y porcentaje a autorizar con el caudal mínimo digitado", () => {
    const r: Respuestas = { consumo: filas, caudal_minimo: "0,7143" };
    expect(valorNumericoCampo(FORMATO_AGUAS.estructura, r, "caudal_autorizar")!.toFixed(4)).toBe("0.1643");
    expect(Math.round(valorNumericoCampo(FORMATO_AGUAS.estructura, r, "porcentaje_autorizar")!)).toBe(23);
  });
});

describe("cumplimiento Resolución 699", () => {
  it("evalúa máximos, rangos, menores que y análisis y reporte", () => {
    expect(evaluarCumplimiento("20,0", "29,8")).toBe("NO CUMPLE");
    expect(evaluarCumplimiento("200,0", "13,1")).toBe("CUMPLE");
    expect(evaluarCumplimiento("6,5 a 8,5", "7,51 a 7,02")).toBe("CUMPLE");
    expect(evaluarCumplimiento("700,0", "1197 a 1097")).toBe("NO CUMPLE");
    expect(evaluarCumplimiento("0,01", "< 0,0100")).toBe("CUMPLE");
    expect(evaluarCumplimiento("Análisis y Reporte", "2 400")).toBe("CUMPLE");
    expect(evaluarCumplimiento("±5 temperatura media anual multianual", "22,8 a 20,4")).toBeNull();
    expect(evaluarCumplimiento("2,0", "")).toBeNull();
  });
});

describe("estructura y respuestas", () => {
  it("los tres formatos base son válidos", () => {
    for (const f of FORMATOS_BASE) {
      const r = validarEstructura(JSON.parse(JSON.stringify(f.estructura)));
      expect("error" in r ? r.error : null).toBeNull();
    }
  });

  it("rechaza fórmulas con campos inexistentes e identificadores repetidos", () => {
    const mala = { secciones: [{ id: "s", titulo: "S", campos: [{ id: "x", etiqueta: "X", tipo: "calculado", formula: "y * 2" }] }] };
    expect(validarEstructura(mala)).toEqual({ error: expect.stringContaining("y") });
    const repetida = { secciones: [{ id: "s", titulo: "S", campos: [{ id: "a", etiqueta: "A", tipo: "texto" }, { id: "a", etiqueta: "B", tipo: "texto" }] }] };
    expect(validarEstructura(repetida)).toEqual({ error: expect.stringContaining("repetido") });
  });

  it("precarga datos del expediente y resuelve los textos tipo", () => {
    const r = respuestasIniciales(FORMATO_VERTIMIENTOS.estructura, { solicitante: "CORSANT", identificacion: "NIT 804.017.696-7" });
    expect(r.solicitante).toBe("CORSANT");
    expect(r.obligaciones_permisionario).toContain("CORSANT, identificado(a) con NIT 804.017.696-7");
    expect(Array.isArray(r.parametros) && r.parametros.length).toBe(26);
    const texto = resolverPlantilla("Caudal {caudal_autorizar} para {solicitante}", FORMATO_AGUAS.estructura, { consumo: [{ dotacion: "150", cantidad: "12" }] }, { solicitante: "Elida" });
    expect(texto).toBe("Caudal 0,0208 l/s para Elida");
  });

  it("actualiza los textos tipo solo si el técnico no los editó", () => {
    const precarga = { solicitante: "Erwin" };
    const ini = respuestasIniciales(FORMATO_FORESTAL.estructura, precarga);
    expect(ini.estado_descripcion).toContain("[Estado fitosanitario]");
    const r1 = actualizarTextosTipo(FORMATO_FORESTAL.estructura, ini, { ...ini, estado_fitosanitario: "Bueno" }, precarga);
    expect(r1.estado_descripcion).toContain("presentan Bueno estado");
    const editado = { ...r1, estado_descripcion: "Texto propio" };
    const r2 = actualizarTextosTipo(FORMATO_FORESTAL.estructura, editado, { ...editado, estado_fitosanitario: "Malo" }, precarga);
    expect(r2.estado_descripcion).toBe("Texto propio");
  });

  it("detecta obligatorios vacíos y descarta valores fuera de la estructura", () => {
    const faltantes = camposObligatoriosFaltantes(FORMATO_AGUAS.estructura, {});
    expect(faltantes).toContain("Fuente hídrica");
    const limpio = sanearRespuestas(FORMATO_AGUAS.estructura, { fuente_hidrica: "Innominada", intruso: "x", tipo_fuente: "Mar", caudal_autorizar: "9" });
    expect(limpio).toEqual({ fuente_hidrica: "Innominada" });
  });

  it("precarga por identificador, selecciones y coordenadas, y omite campos de persona jurídica para persona natural", () => {
    const estructura = {
      secciones: [
        {
          id: "s",
          titulo: "S",
          campos: [
            { id: "tipo_persona", etiqueta: "Tipo", tipo: "seleccion", opciones: ["Persona natural", "Persona jurídica"] },
            { id: "coord_predio", etiqueta: "Coordenadas", tipo: "coordenadas" },
            { id: "email", etiqueta: "Correo", tipo: "texto" },
            { id: "nit", etiqueta: "NIT", tipo: "texto", obligatorio: true },
          ],
        },
      ],
    } as Parameters<typeof respuestasIniciales>[0];
    const natural = { tipo_solicitante: "Persona natural", correo: "a@b.co", coordenadas: "7.1,-73.1" };
    const r = respuestasIniciales(estructura, natural);
    expect(r.tipo_persona).toBe("Persona natural");
    expect(r.coord_predio).toEqual({ lat: 7.1, lon: -73.1, cota: "" });
    expect(r.email).toBe("a@b.co");
    expect(camposObligatoriosFaltantes(estructura, r, natural)).toEqual([]);
    expect(camposObligatoriosFaltantes(estructura, r, { tipo_solicitante: "Persona jurídica" })).toEqual(["NIT"]);
    expect(completarPrecarga(estructura, { email: "" }, { correo: "x@y.co" }).email).toBe("x@y.co");
  });
});

describe("coordenadas planas origen Bogotá", () => {
  it("coincide con el punto de captación del concepto EV-0144", () => {
    const lat = 7 + 1 / 60 + 5.55 / 3600;
    const lon = -(73 + 1 / 60 + 5.22 / 3600);
    const { norte, este } = planasOrigenBogota(lat, lon);
    expect(Math.abs(norte - 1_267_971)).toBeLessThan(15);
    expect(Math.abs(este - 1_117_059)).toBeLessThan(15);
  });
});

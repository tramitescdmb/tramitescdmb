import { describe, expect, it } from "vitest";
import { causalDesdeSecop, contratoDesdeFila, modalidadDesdeSecop, tipoDesdeSecop } from "@/lib/secop-datos";
import { errorCombinacionContrato } from "@/lib/compatibilidad-modalidad";

describe("mapeo de SECOP II a GECON", () => {
  it("traduce modalidades, causales y tipos reales de la CDMB", () => {
    expect(modalidadDesdeSecop("Contratación directa", "Servicios profesionales y apoyo a la gestión")).toBe("CONTRATACION_DIRECTA");
    expect(modalidadDesdeSecop("Contratación Directa (con ofertas)", "Contratos o convenios Interadministrativos (con valor)")).toBe("CONTRATACION_DIRECTA");
    expect(modalidadDesdeSecop("Selección abreviada subasta inversa", "x")).toBe("SELECCION_ABREVIADA_SUBASTA_INVERSA");
    expect(modalidadDesdeSecop("Seleccion Abreviada Menor Cuantia Sin Manifestacion Interes", "Proceso de licitación pública declarado desierto")).toBe(
      "SELECCION_ABREVIADA_LICITACION_DESIERTA"
    );
    expect(modalidadDesdeSecop("Licitación pública Obra Publica", "Article30_1993")).toBe("LICITACION_PUBLICA");
    expect(modalidadDesdeSecop("Concurso de méritos abierto", "Ley 1150 de 2007")).toBe("CONCURSO_MERITOS");
    expect(modalidadDesdeSecop("Contratación régimen especial", "Decreto 092 de 2017")).toBe("CONVENIO_ASOCIACION");
    expect(causalDesdeSecop("Prestamo de uso")).toBe("COMODATO");
    expect(causalDesdeSecop("Arrendamiento de inmuebles")).toBe("ARRENDAMIENTO_INMUEBLES");
    expect(tipoDesdeSecop("Suministros", null)).toBe("SUMINISTRO");
    expect(tipoDesdeSecop("Venta inmuebles", null)).toBe("COMPRAVENTA");
    expect(tipoDesdeSecop("Otro", "ADQUISICION_INMUEBLES")).toBe("COMPRAVENTA");
  });

  it("produce combinaciones válidas para los casos más frecuentes", () => {
    const casos: [string, string, string][] = [
      ["Contratación directa", "Servicios profesionales y apoyo a la gestión", "Prestación de servicios"],
      ["Selección abreviada subasta inversa", "Suministro de bienes y servicios de características técnicas uniformes y común utilización", "Arrendamiento de muebles"],
      ["Contratación directa", "Arrendamiento de inmuebles", "Arrendamiento de inmuebles"],
      ["Contratación directa", "Prestamo de uso", "Comodato"],
      ["Concurso de méritos abierto", "Ley 1150 de 2007", "Interventoría"],
      ["Contratación directa", "Adquisición de inmuebles", "Otro"],
    ];
    for (const [modalidad, justificacion, tipo] of casos) {
      const c = contratoDesdeFila({ modalidad_de_contratacion: modalidad, justificacion_modalidad_de: justificacion, tipo_de_contrato: tipo });
      expect(errorCombinacionContrato(c.modalidad, c.tipoContrato, c.causal)).toBeNull();
    }
  });

  it("toma fechas, valor y contratista", () => {
    const c = contratoDesdeFila({
      referencia_del_contrato: "210-17708-8",
      proceso_de_compra: "CO1.BDOS.11003238",
      valor_del_contrato: "6250000",
      fecha_de_firma: "2026-10-09T00:00:00.000",
      documento_proveedor: "1015474673",
      proveedor_adjudicado: "JUAN SEBASTIAN GUERRERO DUARTE",
      nombre_supervisor: "No definido",
      urlproceso: { url: "https://community.secop.gov.co/x" },
    });
    expect(c).toMatchObject({ numeroContrato: "210-17708-8", valor: 6_250_000, fechaSuscripcion: "2026-10-09", supervisor: null, url: "https://community.secop.gov.co/x" });
    expect(c.contratista.documento).toBe("1015474673");
  });
});

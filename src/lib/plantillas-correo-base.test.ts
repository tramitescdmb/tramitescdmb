import { describe, expect, it } from "vitest";
import { CLAVES_MATRIZ, partirClave } from "@/lib/avisos-correo";
import {
  CLAVES_PLANTILLA,
  componerMensaje,
  definicionPlantilla,
  limpiarHtml,
  plantillaDeEvento,
  renderizarPlantilla,
  renderizarTexto,
  validarDiseno,
  validarPlantilla,
  variablesDe,
} from "@/lib/plantillas-correo-base";

describe("renderizarTexto", () => {
  it("reemplaza y escapa en HTML, deja las variables HTML sin escapar", () => {
    const html = new Set(["LISTA"]);
    expect(renderizarTexto("<p>[NOMBRE]</p>[LISTA]", { NOMBRE: "A & <b>", LISTA: "<ul><li>x</li></ul>" }, "html", html)).toBe("<p>A &amp; &lt;b&gt;</p><ul><li>x</li></ul>");
    expect(renderizarTexto("[NOMBRE] · [LISTA]", { NOMBRE: "A & B", LISTA: "<ul><li>x</li></ul>" }, "texto", html)).toBe("A & B · x");
  });

  it("muestra u oculta los bloques [SI:…] y [NO:…]", () => {
    const t = "[SI:NOMBRE]Hola [NOMBRE].[/SI:NOMBRE][NO:NOMBRE]Hola.[/NO:NOMBRE]";
    expect(renderizarTexto(t, { NOMBRE: "Ana" }, "html")).toBe("Hola Ana.");
    expect(renderizarTexto(t, { NOMBRE: "" }, "html")).toBe("Hola.");
    expect(renderizarTexto(t, {}, "html")).toBe("Hola.");
  });

  it("deja tal cual las palabras que no tienen valor definido", () => {
    expect(renderizarTexto("[OTRA]", { NOMBRE: "x" }, "html")).toBe("[OTRA]");
  });
});

describe("plantillas predeterminadas", () => {
  it("cada notificación de la matriz tiene su plantilla", () => {
    for (const c of CLAVES_MATRIZ) expect(plantillaDeEvento(partirClave(c).evento, partirClave(c).modulo), c).toBeDefined();
  });

  it("las firmas tienen una plantilla propia por módulo", () => {
    expect(plantillaDeEvento("FIRMA_SOLICITADA", "GECON")).toBe("FIRMA_SOLICITADA_GECON");
    expect(plantillaDeEvento("FIRMA_RECORDADA", "SGDEA")).toBe("FIRMA_RECORDADA_SGDEA");
    expect(plantillaDeEvento("FIRMA_RECHAZADA", "TRAMITES")).toBe("FIRMA_RECHAZADA_TRAMITES");
    expect(variablesDe("FIRMA_SOLICITADA_GECON").find((v) => v.clave === "REFERENCIA")?.ejemplo).toBe("CDMB-CTO-2026-000006");
    expect(plantillaDeEvento("PQRSD_POR_VENCER", "SGDEA")).toBe("RESUMEN_VENCIMIENTOS");
  });

  it("son válidas y solo usan palabras reservadas declaradas", () => {
    for (const clave of CLAVES_PLANTILLA) {
      const r = validarPlantilla(clave, definicionPlantilla(clave));
      expect(r.errores, clave).toEqual([]);
    }
  });

  it("los ejemplos de cada plantilla no dejan palabras sin reemplazar", () => {
    for (const clave of CLAVES_PLANTILLA) {
      const valores = Object.fromEntries(variablesDe(clave).map((v) => [v.clave, v.ejemplo]));
      const r = renderizarPlantilla(clave, definicionPlantilla(clave), valores);
      expect(`${r.asunto} ${r.titulo} ${r.cuerpoHtml} ${r.boton}`, clave).not.toMatch(/\[[A-Z_]+\]/);
    }
  });

  it("componerMensaje guarda la plantilla y omite el botón sin enlace", () => {
    const m = componerMensaje("TRAMITE_RADICADO", { EXPEDIENTE: "X-1", NOMBRE: "Ana", TRAMITE: "Concesión", FECHA_RADICACION: "hoy" });
    expect(m.asunto).toBe("Expediente X-1 · CDMB");
    expect(m.enlace).toBeUndefined();
    expect(m.plantilla?.clave).toBe("TRAMITE_RADICADO");
    const f = componerMensaje("FIRMA_SOLICITADA_GECON", { ACCION_CORTA: "firmar", REFERENCIA: "R", DOCUMENTO: "D" }, "/f/1");
    expect(f.enlace).toEqual({ texto: "Abrir para firmar", ruta: "/f/1" });
  });
});

describe("validarPlantilla", () => {
  const base = definicionPlantilla("PQRSD_RADICADO");

  it("exige las palabras obligatorias en el cuerpo", () => {
    const r = validarPlantilla("PQRSD_RADICADO", { ...base, cuerpo: "<p>Gracias</p>" });
    expect(r.ok).toBe(false);
    expect(r.faltantes).toEqual(["RADICADO"]);
  });

  it("acepta la palabra obligatoria dentro de un bloque condicional", () => {
    const r = validarPlantilla("PQRSD_RADICADO", { ...base, cuerpo: "[SI:NOMBRE]Hola [NOMBRE][/SI:NOMBRE] Radicado [RADICADO]" });
    expect(r.ok).toBe(true);
  });

  it("rechaza palabras desconocidas, bloques sin cerrar e imágenes incrustadas", () => {
    expect(validarPlantilla("PQRSD_RADICADO", { ...base, cuerpo: "[RADICADO] [RADICAD0]" }).desconocidas).toEqual(["RADICAD0"]);
    expect(validarPlantilla("PQRSD_RADICADO", { ...base, cuerpo: "[RADICADO] [SI:NOMBRE]x" }).ok).toBe(false);
    expect(validarPlantilla("PQRSD_RADICADO", { ...base, cuerpo: '[RADICADO] <img src="data:image/png;base64,AAA">' }).ok).toBe(false);
  });

  it("el diseño general solo admite palabras globales", () => {
    expect(validarDiseno({ antetitulo: "CDMB", encabezado: '<img src="https://x/logo.png">', pie: "[FECHA_HOY]" }).ok).toBe(true);
    expect(validarDiseno({ antetitulo: "CDMB", encabezado: "", pie: "[RADICADO]" }).ok).toBe(false);
  });
});

describe("limpiarHtml", () => {
  it("quita scripts, eventos y javascript:, y da margen a los párrafos", () => {
    const sucio = '<p>Hola</p><script>alert(1)</script><img src="https://x/a.png" onerror="alert(1)"><a href="javascript:alert(1)">x</a>';
    expect(limpiarHtml(sucio)).toBe('<p style="margin:0 0 10px">Hola</p><img src="https://x/a.png"><a href="#">x</a>');
  });
});

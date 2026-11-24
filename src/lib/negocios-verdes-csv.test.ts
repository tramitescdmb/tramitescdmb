import { describe, expect, it } from "vitest";
import { construirCsvNV, interpretarCsvNV, ENCABEZADOS_CSV_NV, type NegocioParaCsv } from "@/lib/negocios-verdes-csv";
import { validarPersona, validarTaxon } from "@/lib/negocios-verdes-catalogo";

const UUID_CAT = "11111111-1111-4111-8111-111111111111";
const UUID_SUB = "22222222-2222-4222-8222-222222222222";
const catalogo = {
  categorias: [{ id: UUID_CAT, nombre: "Bienes y servicios sostenibles" }],
  subcategorias: [{ id: UUID_SUB, nombre: "Agroecología" }],
  actividades: [],
};

const negocio: NegocioParaCsv = {
  id: "33333333-3333-4333-8333-333333333333",
  slug: "cafe-la-mesa",
  nombre: "Café La Mesa",
  municipio: "Girón",
  direccion: "=HYPERLINK(\"x\")",
  latitud: 7.07,
  longitud: -73.17,
  descripcionCorta: "Café especial; tostado local",
  descripcion: null,
  telefono: "3001234567",
  whatsapp: null,
  email: "cafe@ejemplo.co",
  sitioWeb: null,
  facebookUrl: null,
  instagramUrl: null,
  avalado: true,
  selloMarca: false,
  emprendimientoVerde: true,
  destacado: false,
  activo: true,
  categorias: ["Bienes y servicios sostenibles"],
  subcategorias: ["Agroecología"],
  actividades: [],
};

describe("CSV de Negocios Verdes", () => {
  it("exporta con BOM, punto y coma y los encabezados de la plataforma anterior", () => {
    const csv = construirCsvNV([negocio]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split(/\r?\n/)[0]).toBe(ENCABEZADOS_CSV_NV.join(";"));
  });

  it("neutraliza fórmulas pero deja los números negativos", () => {
    const csv = construirCsvNV([negocio]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain(";-73.17;");
  });

  it("lo exportado se vuelve a importar sin errores y conserva el id", () => {
    const { filas, errorGeneral } = interpretarCsvNV(construirCsvNV([negocio]), catalogo);
    expect(errorGeneral).toBeNull();
    expect(filas).toHaveLength(1);
    expect(filas[0]!.errores).toEqual([]);
    expect(filas[0]!.id).toBe(negocio.id);
    expect(filas[0]!.datos?.categoriaIds).toEqual([UUID_CAT]);
    expect(filas[0]!.datos?.subcategoriaIds).toEqual([UUID_SUB]);
    expect(filas[0]!.datos?.direccion).toBe(negocio.direccion);
  });

  it("acepta coma, encabezados con tildes, municipio sin tilde y nombres sin tilde", () => {
    const texto = "Nombre,Municipio,Categorías,Subcategorías,Activo\nTienda,GIRON,bienes y servicios sostenibles,agroecologia,sí\n";
    const { filas } = interpretarCsvNV(texto, catalogo);
    expect(filas[0]!.errores).toEqual([]);
    expect(filas[0]!.datos?.municipio).toBe("Girón");
    expect(filas[0]!.datos?.activo).toBe(true);
  });

  it("informa categorías que no existen con su número de fila", () => {
    const { filas } = interpretarCsvNV("nombre;municipio;categorias\nTienda;Bucaramanga;Inventada\n", catalogo);
    expect(filas[0]!.fila).toBe(2);
    expect(filas[0]!.datos).toBeNull();
    expect(filas[0]!.errores.join(" ")).toContain("«Inventada» no existe");
  });

  it("rechaza archivos sin las columnas mínimas", () => {
    expect(interpretarCsvNV("a;b\n1;2\n", catalogo).errorGeneral).toMatch(/nombre/);
  });

  it("ignora un id que no es UUID", () => {
    const { filas } = interpretarCsvNV("nombre;municipio;categorias;id\nTienda;Bucaramanga;Bienes y servicios sostenibles;123\n", catalogo);
    expect(filas[0]!.id).toBeNull();
  });
});

describe("Clasificación y personas", () => {
  it("una subcategoría exige su categoría y arma la dirección con el nombre", () => {
    expect(validarTaxon({ nivel: "subcategoria", nombre: "Ecoturismo" }).datos).toBeNull();
    const ok = validarTaxon({ nivel: "subcategoria", nombre: "Ecoturismo Rural", padreId: UUID_CAT, orden: 5000 });
    expect(ok.datos?.slug).toBe("ecoturismo-rural");
    expect(ok.datos?.orden).toBe(999);
  });

  it("rechaza un nivel desconocido", () => {
    expect(validarTaxon({ nivel: "otro", nombre: "x" }).errores).toContain("Nivel no válido.");
  });

  it("valida tipo, nombres, correo y naturaleza jurídica de una persona", () => {
    expect(validarPersona({ tipo: "REPRESENTANTE", nombres: "Ana", correo: "ana@" }).errores.join(" ")).toMatch(/dominio/);
    expect(validarPersona({ tipo: "JEFE", nombres: "Ana" }).datos).toBeNull();
    expect(validarPersona({ tipo: "DELEGADO", nombres: "Ana", naturalezaJuridica: "Inventada" }).datos).toBeNull();
    expect(validarPersona({ tipo: "DELEGADO", nombres: " Ana " }).datos?.nombres).toBe("Ana");
  });
});

import { readFileSync } from "node:fs";
import { municipioDelPunto, problemaCorreo, verificarUbicacion } from "@/lib/negocios-verdes-verificacion";
import geoCopia from "@/lib/geo/municipios-cdmb.json";

describe("Verificador de datos", () => {
  it("la copia de límites es idéntica a la capa pública del geovisor", () => {
    expect(geoCopia).toEqual(JSON.parse(readFileSync("public/geo/municipios_cdmb.geojson", "utf8")));
  });

  it("ubica puntos conocidos en su municipio", () => {
    expect(municipioDelPunto(7.1193, -73.1227)).toBe("Bucaramanga"); // parque Santander
    expect(municipioDelPunto(7.0647, -73.0868)).toBe("Floridablanca");
    expect(municipioDelPunto(4.711, -74.0721)).toBeNull(); // Bogotá
  });

  it("rechaza puntos fuera de la jurisdicción y sugiere la causa", () => {
    expect(verificarUbicacion(-73.1227, 7.1193).errores[0]).toMatch(/invertidas/);
    expect(verificarUbicacion(7.1193, 73.1227).errores[0]).toMatch(/signo menos/);
    expect(verificarUbicacion(4.711, -74.0721).errores[0]).toMatch(/fuera de la jurisdicción/);
    expect(verificarUbicacion(7.1193, null).errores[0]).toMatch(/juntas/);
    expect(verificarUbicacion(null, null).errores).toEqual([]);
  });

  it("avisa sin bloquear cuando el punto cae en otro municipio", () => {
    const r = verificarUbicacion(7.1193, -73.1227, "Girón");
    expect(r.errores).toEqual([]);
    expect(r.avisos[0]).toMatch(/Bucaramanga/);
  });

  it("detecta correos mal escritos de la plataforma anterior", () => {
    expect(problemaCorreo("a@gmail.com")).toBeNull();
    expect(problemaCorreo("info@empresa.com.co")).toBeNull();
    expect(problemaCorreo("punoardilagmail.com")).toMatch(/@/);
    expect(problemaCorreo("gcarvajal@gmailcom")).toMatch(/gmail\.com/);
    expect(problemaCorreo("x@gmaill.com")).toMatch(/gmail\.com/);
    expect(problemaCorreo("rosmaria1.@hotmail.es")).toMatch(/punto/);
    expect(problemaCorreo("a@x.com, b@y.com")).toMatch(/más de un correo/);
    expect(problemaCorreo("a@x.com / b@y.com")).toMatch(/más de un correo/);
  });
});

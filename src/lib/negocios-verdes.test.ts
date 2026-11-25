import { describe, expect, it, vi } from "vitest";
import {
  aNegocioPublico,
  enlaceWhatsapp,
  esSitioPublicoNV,
  filtrarNegociosNV,
  leerFiltroNV,
  normalizarTexto,
  paginar,
  slugNV,
  urlExternaSegura,
  urlImagenNV,
  type FilaNegocioPublico,
} from "@/lib/negocios-verdes";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/config-sitio", () => ({ getConfiguracionSitio: async () => ({}) }));
const { accedePanelNV, puedeConfigurarNV, puedeGestionarNV } = await import("@/lib/negocios-verdes-permisos");

const cat = (slug: string, nombre: string, activo = true) => ({ id: `id-${slug}`, nombre, slug, icono: null, iconoRuta: null, activo, orden: 0 });

function fila(extra: Partial<FilaNegocioPublico> = {}): FilaNegocioPublico {
  return {
    id: "n1",
    nombre: "Café de Girón",
    slug: "cafe-de-giron",
    municipio: "Girón",
    direccion: "Vereda Acapulco",
    latitud: 7.07,
    longitud: -73.17,
    descripcionCorta: "Café especial",
    descripcion: "Cultivo bajo sombra",
    producto: "Café tostado",
    telefono: "6076000000",
    telefonoSecundario: null,
    whatsapp: "300 123 4567",
    email: "cafe@example.com",
    emailSecundario: "ventas@example.com",
    sitioWeb: "cafe.example.com",
    facebookUrl: "javascript:alert(1)",
    instagramUrl: null,
    fotoPortadaRuta: "negocios-fotos/n1/portada.jpg",
    representanteLegal: "Ana Pérez",
    emprendimientoVerde: false,
    selloMarca: true,
    avalado: true,
    destacado: false,
    activo: true,
    vereda: { nombre: "Acapulco" },
    categoria: cat("agro", "Agrosistemas sostenibles"),
    categorias: [{ categoria: cat("agro", "Agrosistemas sostenibles") }, { categoria: cat("oculta", "Pendiente", false) }],
    subcategorias: [{ subcategoria: cat("cafe", "Café") }],
    actividades: [],
    productos: [{ orden: 0, nombre: "Café 500 g", descripcion: null, fotoRuta: "negocios-fotos/n1/p0.jpg" }, { orden: 1, nombre: null, descripcion: null, fotoRuta: null }],
    fotos: [{ ruta: "negocios-fotos/n1/g1.jpg", orden: 0 }],
    ...extra,
  };
}

describe("sitio público: solo datos públicos", () => {
  it("no deja pasar ficha técnica, NIT, puntajes ni personas aunque la fila los traiga", () => {
    const conInternos = { ...fila(), fichaTecnica: { nit: "900123456" }, nit: "900123456", puntajes: [{ anio: 2025, puntaje: 80 }], personas: [{ id: "p" }] };
    const publico = aNegocioPublico(conInternos as FilaNegocioPublico);
    const json = JSON.stringify(publico);
    expect(json).not.toContain("900123456");
    expect(publico).not.toHaveProperty("fichaTecnica");
    expect(publico).not.toHaveProperty("nit");
    expect(publico).not.toHaveProperty("puntajes");
    expect(publico).not.toHaveProperty("personas");
    expect(publico).not.toHaveProperty("activo");
  });

  it("arma las URL de imágenes del almacén público, descarta enlaces peligrosos y categorías inactivas", () => {
    const p = aNegocioPublico(fila());
    expect(p.fotoPortadaUrl).toBe("/api/almacen/negocios-verdes/negocios-fotos/n1/portada.jpg");
    expect(p.fotos).toEqual(["/api/almacen/negocios-verdes/negocios-fotos/n1/g1.jpg"]);
    expect(p.facebookUrl).toBeNull();
    expect(p.sitioWeb).toBe("https://cafe.example.com/");
    expect(p.categorias.map((c) => c.slug)).toEqual(["agro"]);
    expect(p.productos).toHaveLength(1);
    expect(p.vereda).toBe("Acapulco");
  });
});

describe("rutas públicas y panel interno", () => {
  it("todo /negocios-verdes es público salvo /negocios-verdes/admin", () => {
    expect(esSitioPublicoNV("/negocios-verdes")).toBe(true);
    expect(esSitioPublicoNV("/negocios-verdes/negocio/cafe")).toBe(true);
    expect(esSitioPublicoNV("/negocios-verdes/admin")).toBe(false);
    expect(esSitioPublicoNV("/negocios-verdes/admin/negocios")).toBe(false);
    expect(esSitioPublicoNV("/negocios-verdes-admin")).toBe(false);
    expect(esSitioPublicoNV("/tramites")).toBe(false);
  });

  it("urlImagenNV rechaza rutas que salen del almacén", () => {
    expect(urlImagenNV("../documentos/x.pdf")).toBeNull();
    expect(urlImagenNV("a/./b.jpg")).toBeNull();
    expect(urlImagenNV(null)).toBeNull();
    expect(urlImagenNV("sitio-assets/logo nuevo.png")).toBe("/api/almacen/negocios-verdes/sitio-assets/logo%20nuevo.png");
  });
});

describe("búsqueda", () => {
  const a = aNegocioPublico(fila());
  const b = aNegocioPublico(fila({ id: "n2", nombre: "Miel de Tona", slug: "miel-de-tona", municipio: "Tona", destacado: true, avalado: false, selloMarca: false, subcategorias: [], categorias: [{ categoria: cat("apicola", "Apicultura") }], productos: [], vereda: null }));

  it("busca sin tildes ni mayúsculas y por varias palabras", () => {
    expect(filtrarNegociosNV([a, b], { q: "CAFE giron" }).map((n) => n.id)).toEqual(["n1"]);
    expect(filtrarNegociosNV([a, b], { q: "miel" }).map((n) => n.id)).toEqual(["n2"]);
    expect(filtrarNegociosNV([a, b], { q: "galletas tona" })).toHaveLength(0);
  });

  it("filtra por municipio, categoría y reconocimiento; destacados primero", () => {
    expect(filtrarNegociosNV([a, b], {}).map((n) => n.id)).toEqual(["n2", "n1"]);
    expect(filtrarNegociosNV([a, b], { municipio: "Tona" }).map((n) => n.id)).toEqual(["n2"]);
    expect(filtrarNegociosNV([a, b], { categoria: "agro" }).map((n) => n.id)).toEqual(["n1"]);
    expect(filtrarNegociosNV([a, b], { reconocimiento: "avalado" }).map((n) => n.id)).toEqual(["n1"]);
  });

  it("descarta valores de filtro no válidos de la dirección", () => {
    expect(leerFiltroNV({ municipio: "Bogotá", reconocimiento: "otro", q: "  café " })).toEqual({ q: "café", municipio: undefined, categoria: undefined, subcategoria: undefined, actividad: undefined, reconocimiento: undefined });
    expect(leerFiltroNV({ municipio: "El Playón" }).municipio).toBe("El Playón");
  });

  it("pagina sin salirse del rango", () => {
    const lista = Array.from({ length: 50 }, (_, i) => i);
    expect(paginar(lista, 3, 24)).toMatchObject({ pagina: 3, paginas: 3, total: 50, items: [48, 49] });
    expect(paginar(lista, 99, 24).pagina).toBe(3);
    expect(paginar([], 1).paginas).toBe(1);
  });
});

describe("utilidades", () => {
  it("normaliza y arma slug", () => {
    expect(normalizarTexto("  Ñame  de Girón ")).toBe("name de giron");
    expect(slugNV("Café La Montaña S.A.S.")).toBe("cafe-la-montana-s-a-s");
  });

  it("WhatsApp: agrega el indicativo 57 a celulares de 10 dígitos", () => {
    expect(enlaceWhatsapp("300 123 4567")).toBe("https://wa.me/573001234567");
    expect(enlaceWhatsapp("+57 300 123 4567")).toBe("https://wa.me/573001234567");
    expect(enlaceWhatsapp("123")).toBeNull();
  });

  it("solo enlaza http(s)", () => {
    expect(urlExternaSegura("data:text/html,x")).toBeNull();
    expect(urlExternaSegura("https://facebook.com/x")).toBe("https://facebook.com/x");
  });
});

describe("permisos del panel", () => {
  const base = (extra: Record<string, unknown> = {}) => ({ esAdmin: false, modulos: new Set(["NEGOCIOS_VERDES"]), matriz: new Map(), ...extra }) as never;
  const conMatriz = (m: Record<string, string[]>, extra: Record<string, unknown> = {}) => base({ matriz: new Map(Object.entries(m).map(([k, v]) => [k, new Set(v)])), ...extra });

  it("entra con el perfil del módulo; sin el módulo habilitado o visible no", () => {
    expect(accedePanelNV(conMatriz({ "negociosVerdes.gestion": ["LEER"] }))).toBe(true);
    expect(accedePanelNV(conMatriz({ "negociosVerdes.gestion": ["LEER"] }, { modulos: new Set() }))).toBe(false);
    expect(accedePanelNV(base())).toBe(false);
    expect(accedePanelNV(base({ esAdmin: true, modulos: new Set() }))).toBe(true);
  });

  it("gestión y configuración van por separado", () => {
    const gestion = conMatriz({ "negociosVerdes.gestion": ["LEER", "CREAR", "ACTUALIZAR", "ELIMINAR"] });
    expect(puedeGestionarNV(gestion, "ELIMINAR")).toBe(true);
    expect(puedeConfigurarNV(gestion)).toBe(false);
    const config = conMatriz({ "negociosVerdes.gestion": ["LEER"], "negociosVerdes.configuracion": ["ACTUALIZAR"] });
    expect(puedeConfigurarNV(config)).toBe(true);
    expect(puedeGestionarNV(config, "CREAR")).toBe(false);
    expect(puedeConfigurarNV(conMatriz({ "negociosVerdes.configuracion": ["ACTUALIZAR"] }))).toBe(false);
  });
});

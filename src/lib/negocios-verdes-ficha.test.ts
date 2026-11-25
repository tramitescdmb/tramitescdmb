import { describe, expect, it } from "vitest";
import { limpiarFicha, rutaImagenValida, validarNegocio, validarPuntajes } from "@/lib/negocios-verdes-ficha";
import { tipoImagenPorFirma } from "@/lib/negocios-verdes-imagen";

const CAT = "11111111-1111-4111-8111-111111111111";
const N = "22222222-2222-4222-8222-222222222222";

describe("validarNegocio", () => {
  it("exige nombre, municipio de la jurisdicción y categoría", () => {
    const r = validarNegocio({ nombre: " ", municipio: "Bogotá" }, { negocioId: null });
    expect(r.datos).toBeNull();
    expect(r.errores.join(" ")).toMatch(/nombre/);
    expect(r.errores.join(" ")).toMatch(/municipios/);
    expect(r.errores.join(" ")).toMatch(/categoría/);
  });

  it("arma el slug, incluye la categoría principal y descarta ids no válidos", () => {
    const r = validarNegocio({ nombre: "Café La Montaña", municipio: "Tona", categoriaId: CAT, categoriaIds: ["x"], subcategoriaIds: [CAT, "nope"] }, { negocioId: null });
    expect(r.errores).toEqual([]);
    expect(r.datos).toMatchObject({ slug: "cafe-la-montana", categoriaIds: [CAT], subcategoriaIds: [CAT], activo: false });
  });

  it("latitud y longitud van juntas y dentro de la jurisdicción", () => {
    expect(validarNegocio({ nombre: "A", municipio: "Tona", categoriaId: CAT, latitud: "7,1" }, { negocioId: null }).errores.join(" ")).toMatch(/juntas/);
    expect(validarNegocio({ nombre: "A", municipio: "Tona", categoriaId: CAT, latitud: "70", longitud: "-73" }, { negocioId: null }).errores.join(" ")).toMatch(/jurisdicción/);
    expect(validarNegocio({ nombre: "A", municipio: "Tona", categoriaId: CAT, latitud: "7,12", longitud: "-73.1" }, { negocioId: null }).datos).toMatchObject({ latitud: 7.12, longitud: -73.1 });
    expect(validarNegocio({ nombre: "A", municipio: "Tona", categoriaId: CAT, latitud: "siete", longitud: "-73" }, { negocioId: null }).errores.join(" ")).toMatch(/no es un número/);
  });

  it("un segundo correo en el campo principal pasa al correo secundario", () => {
    expect(validarNegocio({ nombre: "A", municipio: "Tona", categoriaId: CAT, email: "a@x.com / b@y.com" }, { negocioId: null }).datos).toMatchObject({ email: "a@x.com", emailSecundario: "b@y.com" });
    expect(validarNegocio({ nombre: "A", municipio: "Tona", categoriaId: CAT, email: "a@x.com", emailSecundario: "b@y" }, { negocioId: null }).errores.join(" ")).toMatch(/Correo secundario/);
  });

  it("solo acepta imágenes de la carpeta del negocio o las que ya tenía", () => {
    const propias = new Set(["negocios-fotos/viejo/portada.jpg"]);
    expect(rutaImagenValida(`negocios-fotos/${N}/1-a.jpg`, N, new Set())).toBe(`negocios-fotos/${N}/1-a.jpg`);
    expect(rutaImagenValida("negocios-fotos/otro/1-a.jpg", N, new Set())).toBeNull();
    expect(rutaImagenValida(`negocios-fotos/${N}/../../documentos/x.pdf`, N, new Set())).toBeNull();
    expect(rutaImagenValida("negocios-fotos/viejo/portada.jpg", N, propias)).toBe("negocios-fotos/viejo/portada.jpg");
    expect(rutaImagenValida(`negocios-fotos/${N}/a.jpg`, null, new Set())).toBeNull();
  });

  it("productos: máximo tres, sin vacíos y reordenados", () => {
    const r = validarNegocio(
      { nombre: "A", municipio: "Tona", categoriaId: CAT, productos: [{ nombre: "" }, { nombre: "Miel" }, { descripcion: "Polen" }, { nombre: "Cuarto" }] },
      { negocioId: N }
    );
    expect(r.datos?.productos).toEqual([
      { orden: 0, nombre: "Miel", descripcion: null, fotoRuta: null },
      { orden: 1, nombre: null, descripcion: "Polen", fotoRuta: null },
    ]);
  });
});

describe("ficha técnica", () => {
  it("valida tipos, descarta claves desconocidas y conserva las traídas que no se editan", () => {
    const r = limpiarFicha({ nit: " 900 ", anio_registro: "2024", ica_vencimiento: "2026-02-30x", novedad: "OTRO", inventada: "x" }, { campo_viejo: "v", nit: "viejo" });
    expect(r.ficha).toEqual({ campo_viejo: "v", nit: "900", anio_registro: 2024 });
    expect(r.errores).toHaveLength(2);
  });
});

describe("puntajes", () => {
  it("0 a 100, un valor por año", () => {
    const r = validarPuntajes([{ anio: "2024", puntaje: "80,5" }, { anio: 2024, puntaje: 90 }, { anio: 1990, puntaje: 1 }, { anio: 2025, puntaje: 101 }]);
    expect(r.puntajes).toEqual([{ anio: 2024, puntaje: 90 }]);
    expect(r.errores).toHaveLength(2);
  });
});

describe("tipo de imagen por contenido", () => {
  it("reconoce JPG, PNG y WebP; rechaza lo demás", () => {
    expect(tipoImagenPorFirma(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.extension).toBe("jpg");
    expect(tipoImagenPorFirma(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.extension).toBe("png");
    expect(tipoImagenPorFirma(new TextEncoder().encode("RIFF0000WEBPVP8 "))?.extension).toBe("webp");
    expect(tipoImagenPorFirma(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(tipoImagenPorFirma(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });
});

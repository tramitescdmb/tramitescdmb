/** Contenido fijo del sitio público de Negocios Verdes (traído de la plataforma anterior). */

/** Canales institucionales de la CDMB (los mismos de la plataforma anterior, tomados de la Sede Electrónica). */
export const CONTACTO_CDMB = {
  direccion: "Carrera 23 # 37 - 63, Bucaramanga, Santander, Colombia",
  horario: "Lunes a viernes de 7:30 a.m. a 11:45 a.m. y 2 p.m. a 5:45 p.m.",
  conmutador: "+57 (607) 6970241",
  celular: "+57 318 706 9866",
  lineaGratuita: "01 8000 180 527",
  correo: "info@cdmb.gov.co",
  web: "https://www.cdmb.gov.co",
  redes: {
    facebook: "https://www.facebook.com/profile.php?id=100075845605762",
    instagram: "https://www.instagram.com/carcdmb",
    youtube: "https://www.youtube.com/channel/UCiYntF63C_9-m5jr7t6b69w",
    x: "https://twitter.com/CARCDMB",
  },
} as const;

export const CATEGORIAS_OFICIALES = [
  {
    icono: "🌱",
    nombre: "Bioproductos y Servicios Sostenibles",
    prefijo: "bioproductos",
    texto:
      "Incorporan buenas prácticas ambientales en el aprovechamiento, producción, transformación o comercialización de recursos biológicos, desde la materia prima hasta el producto final. Agrupa la agricultura sostenible, el biocomercio, la biotecnología y el turismo sostenible.",
  },
  {
    icono: "♻️",
    nombre: "Ecoproductos Industriales",
    prefijo: "ecoproductos",
    texto:
      "Bienes y servicios que, frente a otros de su mismo segmento, resultan menos contaminantes: aprovechan ciclos extendidos de los materiales y reducen la generación de residuos, con impacto directo en la economía circular.",
  },
  {
    icono: "🌍",
    nombre: "Productos por la Calidad Ambiental",
    prefijo: "calidad-ambiental",
    texto:
      "Negocios que reducen la contaminación del aire, el agua y el suelo, y que mitigan o se adaptan al cambio climático mediante tecnologías verdes, con impacto en energía, transporte sostenible y restauración de ecosistemas.",
  },
] as const;

export const RECONOCIMIENTOS_NV = [
  { nombre: "Emprendimiento Verde", texto: "La puerta de entrada al programa: negocios y emprendimientos que ya iniciaron su proceso con la Ventanilla de Negocios Verdes de la CDMB, en camino hacia el Sello Marca o el Aval." },
  { nombre: "Negocio Verde Avalado", texto: "Negocio avalado por la CDMB: cumple los criterios del programa y fue reconocido directamente por la Ventanilla de Negocios Verdes." },
  {
    nombre: "Sello Marca",
    texto:
      "Certificación oficial que reconoce a las empresas y emprendimientos que generan un impacto ambiental positivo, garantizan buenas prácticas sociales y económicas, y protegen los recursos naturales. Se otorga a los negocios que superan el 71 % de cumplimiento en la evaluación de criterios.",
  },
] as const;

/** Logo de la CDMB que usaba la plataforma anterior cuando no se ha subido uno en «Apariencia». */
export const LOGO_CDMB_NV = "/negocios-verdes/iconografia/logo_cdmb.png";
/** Imagen genérica del programa (para negocios y productos sin foto). */
export const LOGO_PROGRAMA_NV = "/negocios-verdes/iconografia/logo_negocios_verdes.png";

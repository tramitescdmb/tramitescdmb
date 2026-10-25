export const ACCIONES = ["LEER", "CREAR", "ACTUALIZAR", "ELIMINAR"] as const;
export type Accion = (typeof ACCIONES)[number];

export const ETIQUETA_ACCION: Record<Accion, string> = {
  LEER: "Ver",
  CREAR: "Crear",
  ACTUALIZAR: "Editar",
  ELIMINAR: "Eliminar",
};

export const MODULOS_PERFIL = ["GENERAL", "TRAMITES", "SGDEA", "GECON", "VITAL", "SINCA"] as const;
export type ModuloPerfil = (typeof MODULOS_PERFIL)[number];

export const ETIQUETA_MODULO_PERFIL: Record<ModuloPerfil, string> = {
  GENERAL: "Administración",
  TRAMITES: "Trámites ambientales 2.0",
  SGDEA: "SGDEA CDMB",
  GECON: "GECON",
  VITAL: "VITAL",
  SINCA: "SINCA 1.0",
};

export type Funcionalidad = {
  clave: string;
  modulo: ModuloPerfil;
  nombre: string;
  acciones: readonly Accion[];
  etiquetas?: Partial<Record<Accion, string>>;
  alcance?: string;
  porCargo?: string;
};

export const FUNCIONALIDADES: readonly Funcionalidad[] = [
  { clave: "admin.usuarios", modulo: "GENERAL", nombre: "Usuarios", acciones: ["LEER", "CREAR", "ACTUALIZAR"] },
  { clave: "admin.perfiles", modulo: "GENERAL", nombre: "Perfiles y permisos", acciones: ["LEER", "ACTUALIZAR"] },
  { clave: "admin.auditoria", modulo: "GENERAL", nombre: "Auditoría de cuentas", acciones: ["LEER"] },
  { clave: "admin.seguridad", modulo: "GENERAL", nombre: "Seguridad (contraseñas, accesos)", acciones: ["ACTUALIZAR"] },
  { clave: "admin.apariencia", modulo: "GENERAL", nombre: "Apariencia", acciones: ["ACTUALIZAR"] },
  { clave: "admin.modulos", modulo: "GENERAL", nombre: "Disponibilidad de módulos", acciones: ["ACTUALIZAR"] },
  { clave: "admin.trd", modulo: "GENERAL", nombre: "Clasificación TRD de los módulos", acciones: ["ACTUALIZAR"] },

  {
    clave: "tramites.expedientes",
    modulo: "TRAMITES",
    nombre: "Expedientes de trámite",
    acciones: ["LEER", "ACTUALIZAR"],
    etiquetas: { ACTUALIZAR: "Gestionar" },
    alcance: "Solo en los tipos de trámite habilitados para el usuario.",
  },
  { clave: "tramites.solicitantes", modulo: "TRAMITES", nombre: "Solicitantes", acciones: ["LEER"] },
  { clave: "tramites.firmas", modulo: "TRAMITES", nombre: "Buzón de firmas de Trámites", acciones: ["LEER"] },
  {
    clave: "tramites.firmantes",
    modulo: "TRAMITES",
    nombre: "Asignar firmantes y validar documentos",
    acciones: ["ACTUALIZAR"],
    porCargo: "Lo determina el cargo del procedimiento asignado al usuario.",
  },
  {
    clave: "tramites.planeador",
    modulo: "TRAMITES",
    nombre: "Programar visitas en el Planeador",
    acciones: ["ACTUALIZAR"],
    porCargo: "Coordinador(a) de Evaluación y Subdirector(a) SEYCA.",
  },
  {
    clave: "tramites.formatos-visita",
    modulo: "TRAMITES",
    nombre: "Diseñar los formatos de visita técnica",
    acciones: ["ACTUALIZAR"],
    porCargo: "Subdirector(a) SEYCA.",
  },

  { clave: "sgdea.bandeja", modulo: "SGDEA", nombre: "Bandeja de radicados", acciones: ["LEER"] },
  {
    clave: "sgdea.radicacion",
    modulo: "SGDEA",
    nombre: "Radicación y despacho",
    acciones: ["CREAR", "ACTUALIZAR"],
    etiquetas: { CREAR: "Radicar", ACTUALIZAR: "Despachar" },
  },
  { clave: "sgdea.reparto", modulo: "SGDEA", nombre: "Distribución y reparto", acciones: ["ACTUALIZAR"] },
  {
    clave: "sgdea.reparto-interno",
    modulo: "SGDEA",
    nombre: "Redistribuir dentro de la dependencia",
    acciones: ["ACTUALIZAR"],
    alcance: "Solo comunicaciones dirigidas a su dependencia.",
  },
  {
    clave: "sgdea.respuesta",
    modulo: "SGDEA",
    nombre: "Proyectar respuesta",
    acciones: ["CREAR"],
    alcance: "Solo comunicaciones asignadas a él o a su dependencia.",
  },
  { clave: "sgdea.firma", modulo: "SGDEA", nombre: "Firmar documentos", acciones: ["ACTUALIZAR"], etiquetas: { ACTUALIZAR: "Firmar" } },
  {
    clave: "sgdea.memorandos",
    modulo: "SGDEA",
    nombre: "Memorandos",
    acciones: ["LEER", "CREAR"],
    etiquetas: { CREAR: "Firmar y enviar" },
    porCargo: "Además se concede por cargo de firma: Dirección, Secretaría General, subdirecciones, jefaturas, asesoría y revisoría fiscal.",
  },
  {
    clave: "sgdea.expedientes",
    modulo: "SGDEA",
    nombre: "Expedientes documentales",
    acciones: ["LEER", "CREAR", "ACTUALIZAR"],
    alcance: "Los de su dependencia, salvo administración del archivo.",
  },
  {
    clave: "sgdea.archivo",
    modulo: "SGDEA",
    nombre: "Cierre, transferencias y disposición final",
    acciones: ["ACTUALIZAR"],
  },
  {
    clave: "sgdea.configuracion",
    modulo: "SGDEA",
    nombre: "Dependencias, TRD, flujos, metadatos y calendario",
    acciones: ["ACTUALIZAR"],
  },

  { clave: "gecon.acceso", modulo: "GECON", nombre: "Entrar al módulo", acciones: ["LEER"] },
  {
    clave: "gecon.todos",
    modulo: "GECON",
    nombre: "Alcance: todos los expedientes contractuales",
    acciones: ["LEER"],
    alcance: "Sin esta casilla, solo los expedientes asignados, supervisados, propios o de su dependencia.",
  },
  {
    clave: "gecon.dependencia",
    modulo: "GECON",
    nombre: "Alcance: expedientes de su dependencia",
    acciones: ["LEER"],
  },
  {
    clave: "gecon.expedientes",
    modulo: "GECON",
    nombre: "Expedientes contractuales",
    acciones: ["LEER", "CREAR", "ACTUALIZAR", "ELIMINAR"],
    alcance: "Ver y editar: todos, o solo los asignados, supervisados, de su dependencia o propios según el perfil.",
  },
  {
    clave: "gecon.precontractual",
    modulo: "GECON",
    nombre: "Etapa precontractual",
    acciones: ["LEER"],
  },
  { clave: "gecon.etapas", modulo: "GECON", nombre: "Aprobar y retroceder etapas", acciones: ["ACTUALIZAR"], etiquetas: { ACTUALIZAR: "Aprobar" } },
  {
    clave: "gecon.documentos",
    modulo: "GECON",
    nombre: "Documentos del expediente",
    acciones: ["CREAR", "ACTUALIZAR"],
    etiquetas: { CREAR: "Subir", ACTUALIZAR: "Editar" },
  },
  { clave: "gecon.validacion", modulo: "GECON", nombre: "Validar documentos precontractuales", acciones: ["ACTUALIZAR"], etiquetas: { ACTUALIZAR: "Validar" } },
  { clave: "gecon.firmantes", modulo: "GECON", nombre: "Asignar firmantes", acciones: ["ACTUALIZAR"] },
  { clave: "gecon.informes", modulo: "GECON", nombre: "Periodos de informe y novedades", acciones: ["ACTUALIZAR"] },
  {
    clave: "gecon.contratistas",
    modulo: "GECON",
    nombre: "Registro de contratistas",
    acciones: ["LEER", "CREAR", "ACTUALIZAR"],
  },
  { clave: "gecon.personal", modulo: "GECON", nombre: "Asignar personal de contratación", acciones: ["ACTUALIZAR"] },
  { clave: "gecon.tablero", modulo: "GECON", nombre: "Tablero de contratos y recursos", acciones: ["LEER"] },
  { clave: "gecon.catalogo", modulo: "GECON", nombre: "Catálogo de requisitos", acciones: ["ACTUALIZAR"] },
  { clave: "gecon.administracion", modulo: "GECON", nombre: "Cuantías, bitácora y seguridad del módulo", acciones: ["ACTUALIZAR"] },
  { clave: "gecon.disposicion", modulo: "GECON", nombre: "Disposición final y administración plena del módulo", acciones: ["ACTUALIZAR"] },

  { clave: "vital.solicitudes", modulo: "VITAL", nombre: "Solicitudes VITAL", acciones: ["LEER"] },
  { clave: "vital.tablero", modulo: "VITAL", nombre: "Tablero VITAL", acciones: ["LEER"] },

  { clave: "sinca.solicitudes", modulo: "SINCA", nombre: "Solicitudes y NIT de SINCA 1.0", acciones: ["LEER"] },
  { clave: "sinca.tablero", modulo: "SINCA", nombre: "Tablero de SINCA 1.0", acciones: ["LEER"] },
  { clave: "sinca.mineria", modulo: "SINCA", nombre: "Minería de datos", acciones: ["LEER"] },
];

export const FUNCIONALIDAD_POR_CLAVE = new Map(FUNCIONALIDADES.map((f) => [f.clave, f]));

export type Matriz = Record<string, Accion[]>;

export function normalizarMatriz(entrada: Record<string, readonly string[]>): Matriz {
  const salida: Matriz = {};
  for (const f of FUNCIONALIDADES) {
    const pedidas = new Set(entrada[f.clave] ?? []);
    const acciones = f.acciones.filter((a) => pedidas.has(a));
    if (acciones.length > 0) salida[f.clave] = acciones;
  }
  return salida;
}

export function matricesIguales(a: Matriz, b: Matriz): boolean {
  return FUNCIONALIDADES.every((f) => {
    const x = new Set(a[f.clave] ?? []);
    const y = new Set(b[f.clave] ?? []);
    return x.size === y.size && [...x].every((v) => y.has(v));
  });
}

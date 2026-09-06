import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export type PoliticaPassword = {
  passwordLongitudMinima: number;
  passwordLongitudMaxima: number;
  passwordRequiereMayuscula: boolean;
  passwordRequiereNumero: boolean;
  passwordRequiereEspecial: boolean;
  passwordHistorialCantidad: number;
  passwordVigenciaDias: number | null;
  passwordVigenciaMinimaDias: number;
};

/**
 * Contraseñas triviales que se rechazan sin importar la configuración
 * (MoReq 6.31: "diccionario de contraseñas no válidas"). Cubre lo más común
 * en español/inglés, secuencias de teclado y variantes obvias de "CDMB" —
 * no pretende ser exhaustivo, solo bloquear lo evidente.
 */
const DICCIONARIO_DEBILES = new Set([
  "12345678", "123456789", "1234567890", "87654321", "11111111", "00000000",
  "password", "password1", "passw0rd", "qwertyui", "qwerty123", "asdfghjk",
  "contrasena", "contrasena1", "contraseña", "contraseña1", "clave123", "clave1234",
  "admin123", "administrador", "bienvenido", "bienvenido1", "cambiame", "cambiar123",
  "cdmb1234", "cdmb12345", "cdmb2024", "cdmb2025", "cdmb2026", "cdmbadmin",
  "usuario123", "funcionario", "colombia1", "santander1", "bucaramanga",
  "12345678a", "a12345678", "abcd1234", "1234abcd", "letmein12", "trustno1",
]);

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, ""); // quita tildes/diéresis para comparar
}

function esPasswordDebil(password: string): boolean {
  const norm = normalizar(password);
  if (DICCIONARIO_DEBILES.has(norm)) return true;
  if (/^(\d)\1+$/.test(password)) return true; // "11111111", "99999999"...
  if (/^[a-z]+$/i.test(password) && new Set(norm).size <= 2) return true; // "aaaaaaaa", "abababab"
  return false;
}

/** Valida una contraseña NUEVA contra la política vigente. `null` = válida. */
export function validarPoliticaPassword(password: string, politica: PoliticaPassword): string | null {
  if (password.length < politica.passwordLongitudMinima) {
    return `La contraseña debe tener al menos ${politica.passwordLongitudMinima} caracteres.`;
  }
  if (password.length > politica.passwordLongitudMaxima) {
    return `La contraseña no puede tener más de ${politica.passwordLongitudMaxima} caracteres.`;
  }
  if (politica.passwordRequiereMayuscula && !/[A-ZÁÉÍÓÚÑ]/.test(password)) {
    return "La contraseña debe incluir al menos una letra mayúscula.";
  }
  if (politica.passwordRequiereNumero && !/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }
  if (politica.passwordRequiereEspecial && !/[^A-Za-z0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un carácter especial (ej. ! @ # $ %).";
  }
  if (esPasswordDebil(password)) {
    return "Esa contraseña es demasiado común o predecible. Elija una menos obvia.";
  }
  return null;
}

/**
 * true si `nuevaPassword` coincide con la contraseña actual del usuario o con
 * alguna de sus últimas `cantidad - 1` contraseñas anteriores (MoReq 6.30).
 * `cantidad <= 0` desactiva la revisión.
 */
export async function passwordEnHistorial(
  usuarioId: string,
  hashActual: string,
  nuevaPassword: string,
  cantidad: number
): Promise<boolean> {
  if (cantidad <= 0) return false;
  if (await verifyPassword(nuevaPassword, hashActual)) return true;

  const anteriores = await db.historialPassword.findMany({
    where: { usuarioId },
    orderBy: { createdAt: "desc" },
    take: Math.max(0, cantidad - 1),
  });
  for (const fila of anteriores) {
    if (await verifyPassword(nuevaPassword, fila.hash)) return true;
  }
  return false;
}

/**
 * Registra el hash que se está reemplazando y recorta el histórico del
 * usuario a `cantidad` filas. Llamar ANTES de sobrescribir Usuario.passwordHash.
 */
export async function registrarHistorialPassword(usuarioId: string, hashReemplazado: string, cantidad: number) {
  if (cantidad <= 0) return;
  await db.historialPassword.create({ data: { usuarioId, hash: hashReemplazado } });
  const excedentes = await db.historialPassword.findMany({
    where: { usuarioId },
    orderBy: { createdAt: "desc" },
    skip: cantidad,
    select: { id: true },
  });
  if (excedentes.length > 0) {
    await db.historialPassword.deleteMany({ where: { id: { in: excedentes.map((f) => f.id) } } });
  }
}

/** Para mostrar un aviso de vencimiento (MoReq 6.35). `vigenciaDias` null = nunca vence. */
export function estadoVigenciaPassword(
  passwordCambiadaEn: Date | null,
  vigenciaDias: number | null
): { vencida: boolean; diasRestantes: number | null } {
  if (!vigenciaDias || !passwordCambiadaEn) return { vencida: false, diasRestantes: null };
  const vencePorMs = passwordCambiadaEn.getTime() + vigenciaDias * 24 * 60 * 60 * 1000;
  const diasRestantes = Math.ceil((vencePorMs - Date.now()) / (24 * 60 * 60 * 1000));
  return { vencida: diasRestantes <= 0, diasRestantes };
}

/**
 * Vigencia MÍNIMA (MoReq 6.35): evita que el propio usuario cicle contraseñas
 * de un tirón para saltarse el histórico (6.30). Solo aplica al cambio que
 * hace el propio usuario sobre SU cuenta — un ADMIN que restablece la
 * contraseña de otro (p. ej. porque la olvidó) nunca debe quedar bloqueado
 * por esto. `vigenciaMinimaDias <= 0` desactiva la revisión.
 */
export function puedeCambiarPorVigenciaMinima(
  passwordCambiadaEn: Date | null,
  vigenciaMinimaDias: number
): { puede: boolean; diasFaltantes: number } {
  if (vigenciaMinimaDias <= 0 || !passwordCambiadaEn) return { puede: true, diasFaltantes: 0 };
  const puedeDesdeMs = passwordCambiadaEn.getTime() + vigenciaMinimaDias * 24 * 60 * 60 * 1000;
  const diasFaltantes = Math.ceil((puedeDesdeMs - Date.now()) / (24 * 60 * 60 * 1000));
  return { puede: diasFaltantes <= 0, diasFaltantes: Math.max(0, diasFaltantes) };
}

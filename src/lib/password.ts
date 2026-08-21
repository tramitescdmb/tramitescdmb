import bcrypt from "bcryptjs";

/** Aparte de auth.ts a propósito — ver la nota en ese archivo (Edge Runtime no soporta bcryptjs). */

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("una contraseña correcta verifica contra su propio hash", async () => {
    const hash = await hashPassword("Cdmb-2026-segura");
    await expect(verifyPassword("Cdmb-2026-segura", hash)).resolves.toBe(true);
  });

  it("una contraseña incorrecta no verifica", async () => {
    const hash = await hashPassword("Cdmb-2026-segura");
    await expect(verifyPassword("otra-contraseña", hash)).resolves.toBe(false);
  });

  it("el hash nunca es la contraseña en texto plano", async () => {
    const hash = await hashPassword("Cdmb-2026-segura");
    expect(hash).not.toBe("Cdmb-2026-segura");
  });
});

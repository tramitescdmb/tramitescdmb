import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { esFirmaDuplicada } from "@/lib/solicitudes-firma";

describe("esFirmaDuplicada", () => {
  it("reconoce la violación del índice único de firmas (P2002)", () => {
    const e = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
    expect(esFirmaDuplicada(e)).toBe(true);
  });
  it("no confunde otros errores", () => {
    const e = new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" });
    expect(esFirmaDuplicada(e)).toBe(false);
    expect(esFirmaDuplicada(new Error("x"))).toBe(false);
  });
});

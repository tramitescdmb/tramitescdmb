import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
const passwordHash = await bcrypt.hash("VisualTest123!", 10);
const a = await db.usuario.upsert({
  where: { email: "_b9.admin@test.local" },
  update: { rol: "ADMIN", activo: true, estadoCuenta: "HABILITADA", passwordHash },
  create: { email: "_b9.admin@test.local", nombre: "B9 Admin", passwordHash, rol: "ADMIN" },
});
console.log("admin", a.id);
await db.$disconnect();

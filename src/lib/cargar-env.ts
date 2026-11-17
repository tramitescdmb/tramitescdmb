// Para scripts sueltos (tsx): Prisma 7 ya no carga .env por su cuenta. Se importa PRIMERO en el
// script, antes que @/lib/db. Next.js no lo necesita (carga .env solo). No pisa variables ya puestas.
import { config } from "dotenv";

config({ quiet: true });

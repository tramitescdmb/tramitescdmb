/**
 * Separa los correos dobles de Negocios Verdes: si el correo de un negocio (o de una persona) trae
 * exactamente dos direcciones y el correo secundario está vacío, la segunda pasa al campo
 * «correo secundario». Se puede repetir sin riesgo: lo ya separado no se vuelve a tocar.
 *
 *   npm run nv:separar-correos -- --ensayo     (muestra lo que cambiaría; no guarda nada)
 *   npm run nv:separar-correos                  (aplica los cambios)
 */
import "../src/lib/cargar-env";
import { db } from "../src/lib/db";
import { registrarAuditoria } from "../src/lib/auditoria";
import { problemaCorreo, repartirCorreos } from "../src/lib/negocios-verdes-verificacion";

const ENSAYO = process.argv.includes("--ensayo");

type Cambio = { id: string; nombre: string; antes: string; principal: string | null; secundario: string | null };

async function main() {
  const negocios = await db.nvNegocio.findMany({ where: { email: { contains: "@" }, emailSecundario: null }, select: { id: true, nombre: true, email: true, emailSecundario: true } });
  const personas = await db.nvPersona.findMany({ where: { correo: { contains: "@" }, correoSecundario: null }, select: { id: true, nombres: true, apellidos: true, correo: true, correoSecundario: true } });

  const cambiosN: Cambio[] = [];
  for (const n of negocios) {
    const r = repartirCorreos(n.email, n.emailSecundario);
    if (r.secundario) cambiosN.push({ id: n.id, nombre: n.nombre, antes: n.email!, ...r });
  }
  const cambiosP: Cambio[] = [];
  for (const p of personas) {
    const r = repartirCorreos(p.correo, p.correoSecundario);
    if (r.secundario) cambiosP.push({ id: p.id, nombre: `${p.nombres} ${p.apellidos ?? ""}`.trim(), antes: p.correo!, ...r });
  }

  const linea = (c: Cambio) => {
    const avisos = [problemaCorreo(c.principal), problemaCorreo(c.secundario)].filter(Boolean);
    return `  - ${c.nombre}: «${c.antes}» → «${c.principal}» + «${c.secundario}»${avisos.length ? `  (queda por revisar: ${avisos.join(" ")})` : ""}`;
  };
  console.log(`Negocios con dos correos: ${cambiosN.length}`);
  cambiosN.forEach((c) => console.log(linea(c)));
  console.log(`Personas con dos correos: ${cambiosP.length}`);
  cambiosP.forEach((c) => console.log(linea(c)));

  if (ENSAYO) {
    console.log("\nEnsayo: no se guardó nada.");
    return;
  }
  if (cambiosN.length + cambiosP.length === 0) {
    console.log("\nNo hay correos por separar.");
    return;
  }
  await db.$transaction(async (tx) => {
    for (const c of cambiosN) await tx.nvNegocio.update({ where: { id: c.id }, data: { email: c.principal, emailSecundario: c.secundario } });
    for (const c of cambiosP) await tx.nvPersona.update({ where: { id: c.id }, data: { correo: c.principal, correoSecundario: c.secundario } });
  });
  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `Negocios Verdes: se separaron los correos dobles en correo y correo secundario (${cambiosN.length} negocios, ${cambiosP.length} personas).`,
  });
  console.log(`\nLISTO: ${cambiosN.length} negocios y ${cambiosP.length} personas actualizados.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await db.$disconnect().catch(() => {});
    process.exit(1);
  });

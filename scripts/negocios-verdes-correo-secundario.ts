/**
 * Negocios Verdes: pasa el segundo correo del campo «Correo» al campo «Correo secundario» en los
 * negocios que traen dos correos juntos (aviso «Tiene más de un correo» de «Revisión de datos»).
 * La regla está en src/lib/negocios-verdes-correos.ts. Ver docs/NEGOCIOS-VERDES.md.
 *
 *   npm run nv:correo-secundario -- --ensayo     (muestra qué cambiaría; no guarda nada)
 *   npm run nv:correo-secundario                  (aplica los cambios)
 *
 * Solo toca «Correo» y «Correo secundario». Si un negocio cambió mientras corre el script, se salta.
 * Lo que no se puede separar sin perder datos (tres correos, texto adicional, correos pegados, ya
 * tiene otro secundario) se lista para corregirlo a mano en el panel. Cada cambio queda en la
 * auditoría documental del negocio.
 */
import "../src/lib/cargar-env";
import { db } from "../src/lib/db";
import { registrarAuditoriaDoc } from "../src/lib/auditoria-doc";
import { proponerSeparacion } from "../src/lib/negocios-verdes-correos";

const ENSAYO = process.argv.slice(2).includes("--ensayo");

async function main() {
  const negocios = await db.nvNegocio.findMany({
    where: { email: { contains: "@" } },
    select: { id: true, nombre: true, municipio: true, email: true, emailSecundario: true },
    orderBy: { nombre: "asc" },
  });
  const conDos = negocios.filter((n) => (n.email?.match(/@/g) ?? []).length > 1);
  console.log(`${ENSAYO ? "ENSAYO (no se guarda nada). " : ""}Negocios con más de un correo: ${conDos.length}\n`);

  let separados = 0;
  const aMano: string[] = [];
  const conAvisos: string[] = [];
  for (const n of conDos) {
    const p = proponerSeparacion(n.email, n.emailSecundario);
    if (p.accion === "omitir") {
      aMano.push(`- ${n.nombre} (${n.municipio}): «${n.email}». ${p.motivo}`);
      continue;
    }
    console.log(`${n.nombre} (${n.municipio})\n  antes:   correo «${n.email}»${n.emailSecundario ? ` · secundario «${n.emailSecundario}»` : ""}\n  después: correo «${p.email}»${p.emailSecundario ? ` · secundario «${p.emailSecundario}»` : ""}`);
    if (p.avisos.length) conAvisos.push(`- ${n.nombre}: ${p.avisos.join(" ")}`);
    if (ENSAYO) {
      separados++;
      continue;
    }
    // Solo si nadie lo cambió desde que se leyó.
    const r = await db.nvNegocio.updateMany({
      where: { id: n.id, email: n.email, emailSecundario: n.emailSecundario },
      data: { email: p.email, emailSecundario: p.emailSecundario },
    });
    if (r.count === 0) {
      aMano.push(`- ${n.nombre} (${n.municipio}): cambió mientras corría el script; vuelva a correrlo.`);
      continue;
    }
    await registrarAuditoriaDoc({
      entidad: "NvNegocio",
      entidadId: n.id,
      accion: "MODIFICA",
      usuarioId: null,
      detalle: `Script nv:correo-secundario: el correo «${n.email}» del negocio verde «${n.nombre}» se separó en correo «${p.email}»${p.emailSecundario ? ` y correo secundario «${p.emailSecundario}»` : ""}`,
    });
    separados++;
  }

  console.log(`\n${ENSAYO ? "Se separarían" : "Separados"}: ${separados}`);
  if (conAvisos.length) console.log(`\nSeparados, pero con un correo mal escrito (siguen en «Revisión de datos»):\n${conAvisos.join("\n")}`);
  if (aMano.length) console.log(`\nPara corregir a mano en el panel:\n${aMano.join("\n")}`);
  if (ENSAYO && separados) console.log("\nPara aplicar: npm run nv:correo-secundario");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

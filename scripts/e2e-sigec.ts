/**
 * Prueba de punta a punta del módulo SIGEC (Contratación) contra un servidor Next en marcha
 * (por defecto http://localhost:3100) y la base configurada en .env.
 *
 *   npx next dev --turbopack -p 3100      (en otra terminal)
 *   npx tsx scripts/e2e-sigec.ts
 *
 * Crea usuarios con correo `e2e-sigec-*@prueba.invalid`, un contratista y un expediente de
 * prueba, recorre el ciclo completo (contratista → expediente → documentos → firma → tres
 * etapas → cierre → ZIP) por las rutas HTTP reales, y al final elimina el expediente (con sus
 * archivos de storage), el contratista y el requisito temporal, y DESACTIVA los usuarios de
 * prueba (no se borran: ya figuran en la bitácora de auditoría).
 */
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { createHash } from "node:crypto";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PASSWORD = "E2e-Sigec-2026!";
const SUFIJO = Date.now().toString(36);
const ETAPAS = ["PRECONTRACTUAL", "CONTRACTUAL", "POSTCONTRACTUAL"] as const;

type Rol = "ADMINISTRADOR_CONTRATACION" | "JEFE_CONTRATACION" | "FUNCIONARIO_CONTRATACION" | "SUPERVISOR_INTERVENTOR" | "CONTRATISTA";
const USUARIOS: Record<string, { rol: Rol | null; terminos: boolean; cedula?: string }> = {
  admin: { rol: "ADMINISTRADOR_CONTRATACION", terminos: true },
  jefe: { rol: "JEFE_CONTRATACION", terminos: true },
  sup: { rol: "SUPERVISOR_INTERVENTOR", terminos: true, cedula: "900123456" },
  contratista: { rol: "CONTRATISTA", terminos: true },
  apoyo: { rol: "FUNCIONARIO_CONTRATACION", terminos: false },
  sinrol: { rol: null, terminos: true },
};

const resultados: { paso: string; ok: boolean; detalle?: string }[] = [];
async function paso(nombre: string, fn: () => Promise<string | void>) {
  try {
    const detalle = await fn();
    resultados.push({ paso: nombre, ok: true, detalle: detalle || undefined });
    console.log(`  ✔ ${nombre}${detalle ? `  — ${detalle}` : ""}`);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    resultados.push({ paso: nombre, ok: false, detalle });
    console.log(`  ✘ ${nombre}\n      ${detalle}`);
  }
}
function esperar(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

class Cliente {
  cookie = "";
  constructor(readonly nombre: string) {}
  async req(ruta: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    return fetch(BASE + ruta, { ...init, headers, redirect: "manual" });
  }
  async json(ruta: string, metodo: string, cuerpo?: unknown) {
    const res = await this.req(ruta, {
      method: metodo,
      headers: { "content-type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data: data as Record<string, any> };
  }
  async pagina(ruta: string) {
    const res = await this.req(ruta);
    const html = res.status === 200 ? await res.text() : "";
    return { status: res.status, html, location: res.headers.get("location") };
  }
  async login(email: string) {
    const form = new FormData();
    form.set("email", email);
    form.set("password", PASSWORD);
    form.set("modo", "institucional");
    const res = await fetch(BASE + "/api/auth/login", { method: "POST", body: form, redirect: "manual" });
    const setCookie = res.headers.getSetCookie().find((c) => c.startsWith("sinca_session="));
    esperar(setCookie, `Login de ${email} falló (HTTP ${res.status}, → ${res.headers.get("location")})`);
    this.cookie = setCookie.split(";")[0]!;
  }
}

async function pdfPrueba(titulo: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]).drawText(`E2E SIGEC — ${titulo}`, { x: 50, y: 780, size: 14 });
  return pdf.save();
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

/** Sube un PDF por la misma vía que el navegador (firma → storage → confirmación de metadatos). */
async function subirDocumento(c: Cliente, expedienteId: string, etapa: string, nombre: string, extra: Record<string, unknown> = {}) {
  const bytes = await pdfPrueba(nombre);
  const firma = await c.json(`/api/contratacion/expedientes/${expedienteId}/upload-sign`, "POST", { fileName: `${nombre}.pdf`, etapa });
  if (firma.status !== 200) return { status: firma.status, data: firma.data };
  const { error } = await supabase.storage.from("documentos").uploadToSignedUrl(firma.data.path, firma.data.token, new Blob([bytes as BlobPart], { type: "application/pdf" }));
  esperar(!error, `Storage rechazó la subida: ${error?.message}`);
  return c.json(`/api/contratacion/expedientes/${expedienteId}/documentos`, "POST", {
    etapa,
    nombre,
    storagePath: firma.data.path,
    mimeType: "application/pdf",
    tamanoBytes: bytes.length,
    hashSha256: createHash("sha256").update(bytes).digest("hex"),
    ...extra,
  });
}

async function main() {
  console.log(`\nE2E SIGEC contra ${BASE}\n`);
  const dependencia = await db.dependencia.findFirst({ where: { activo: true }, orderBy: { orden: "asc" }, select: { id: true, nombre: true } });
  esperar(dependencia, "No hay dependencias activas en la base.");

  const ids: Record<string, string> = {};
  const c: Record<string, Cliente> = {};
  let identificacion = "-no-creada-";
  const ctx: { contratistaId?: string; expedienteId?: string; requisitoTmpId?: string; expedienteIds: string[] } = { expedienteIds: [] };

  try {
    console.log("1. Preparación");
    await paso("Servidor local responde", async () => {
      const r = await fetch(BASE + "/login", { redirect: "manual" });
      esperar(r.status === 200, `GET /login → ${r.status}`);
    });
    await paso("Crea usuarios de prueba (uno por rol)", async () => {
      const hash = await hashPassword(PASSWORD);
      for (const [clave, u] of Object.entries(USUARIOS)) {
        const email = `e2e-sigec-${clave}-${SUFIJO}@prueba.invalid`;
        const usuario = await db.usuario.create({
          data: {
            email,
            nombre: `E2E SIGEC ${clave} ${SUFIJO}`,
            passwordHash: hash,
            rol: "FUNCIONARIO",
            activo: true,
            rolContratacion: u.rol,
            cedulaONit: u.cedula ?? null,
            correoNotificacion: u.cedula ? `notif-${clave}-${SUFIJO}@prueba.invalid` : null,
            terminosAceptadosEn: u.terminos ? new Date() : null,
            dependenciaId: dependencia.id,
          },
        });
        ids[clave] = usuario.id;
        c[clave] = new Cliente(email);
      }
      return `${Object.keys(ids).length} usuarios`;
    });
    await paso("Inicio de sesión de todos los roles", async () => {
      for (const clave of Object.keys(USUARIOS)) await c[clave]!.login(c[clave]!.nombre);
    });
    await paso("Sin sesión, la API no ejecuta la acción (401 o redirección al login)", async () => {
      // El middleware redirige al login las rutas protegidas; la propia ruta responde 401 si llegara a ejecutarse.
      const res = await new Cliente("anon").req("/api/contratacion/expedientes", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const destino = res.headers.get("location") ?? "";
      esperar(res.status === 401 || (res.status === 307 && destino.includes("/login")), `HTTP ${res.status} → ${destino}`);
      return `HTTP ${res.status}${destino ? ` → ${destino}` : ""}`;
    });

    console.log("\n2. Control de acceso (denegado por defecto)");
    await paso("Usuario sin rol de contratación no entra al módulo", async () => {
      const r = await c.sinrol!.pagina("/contratacion");
      esperar(r.status !== 200, `esperaba redirección, obtuvo 200`);
      return `HTTP ${r.status} → ${r.location}`;
    });
    await paso("Supervisor no puede crear contratistas ni expedientes (403)", async () => {
      const a = await c.sup!.json("/api/contratacion/contratistas", "POST", { identificacion: "1", nombreORazonSocial: "x" });
      const b = await c.sup!.json("/api/contratacion/expedientes", "POST", { objeto: "x", modalidadSeleccion: "OTRA", dependenciaSolicitanteId: dependencia.id });
      esperar(a.status === 403 && b.status === 403, `contratistas ${a.status}, expedientes ${b.status}`);
    });

    console.log("\n3. Contratista");
    identificacion = `9${Date.now().toString().slice(-9)}`;
    await paso("Jefe crea contratista persona natural con los campos nuevos", async () => {
      const r = await c.jefe!.json("/api/contratacion/contratistas", "POST", {
        identificacion,
        tipoPersona: "NATURAL",
        nombres: "Prueba",
        apellidos: `E2E ${SUFIJO}`,
        nombreORazonSocial: `Prueba E2E ${SUFIJO}`,
        regimenTributario: "RESPONSABLE_IVA",
        granContribuyente: true,
        contactoEmail: `contratista-${SUFIJO}@prueba.invalid`,
        departamento: "Santander",
        ciudad: "Bucaramanga",
      });
      esperar(r.status === 201, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
      ctx.contratistaId = r.data.id;
      const fila = await db.contratista.findUnique({ where: { id: r.data.id } });
      esperar(fila?.nombres === "Prueba" && fila.granContribuyente && fila.departamento === "Santander", "campos nuevos no se guardaron");
    });
    await paso("Régimen tributario inválido → 400 (no 500)", async () => {
      const r = await c.jefe!.json("/api/contratacion/contratistas", "POST", { identificacion: `${identificacion}9`, nombreORazonSocial: "x", regimenTributario: "NO_EXISTE" });
      esperar(r.status === 400, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    });
    await paso("Identificación duplicada → 409", async () => {
      const r = await c.jefe!.json("/api/contratacion/contratistas", "POST", { identificacion, nombreORazonSocial: "dup" });
      esperar(r.status === 409, `HTTP ${r.status}`);
    });
    await paso("Exportación CSV incluye al contratista", async () => {
      const res = await c.jefe!.req(`/api/contratacion/contratistas/exportar?q=${identificacion}`);
      const texto = await res.text();
      esperar(res.status === 200 && texto.includes(identificacion), `HTTP ${res.status}`);
      esperar(texto.split("\n")[0]!.includes("Régimen tributario"), "encabezados nuevos ausentes");
    });
    await paso("Contratista sin permiso no exporta (403)", async () => {
      const res = await c.contratista!.req("/api/contratacion/contratistas/exportar");
      esperar(res.status === 403, `HTTP ${res.status}`);
    });
    await paso("Edita contratista (PATCH)", async () => {
      const r = await c.jefe!.json(`/api/contratacion/contratistas/${ctx.contratistaId}`, "PATCH", {
        identificacion, tipoPersona: "NATURAL", nombres: "Prueba", apellidos: `E2E ${SUFIJO}`, nombreORazonSocial: `Prueba E2E ${SUFIJO}`,
        contactoTelefono: "3000000000", departamento: "Santander", ciudad: "Floridablanca",
      });
      esperar(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
      const fila = await db.contratista.findUnique({ where: { id: ctx.contratistaId } });
      esperar(fila?.ciudad === "Floridablanca", "el cambio no se guardó");
    });
    // El usuario con rol Contratista queda vinculado a este registro (lo hace el flujo de asignación de rol).
    await db.contratista.update({ where: { id: ctx.contratistaId! }, data: { usuarioId: ids.contratista } });

    console.log("\n4. Expediente");
    await paso("Jefe crea expediente con supervisor y contratista", async () => {
      const r = await c.jefe!.json("/api/contratacion/expedientes", "POST", {
        objeto: `E2E SIGEC ${SUFIJO} — expediente de prueba automatizada`,
        modalidadSeleccion: "CONTRATACION_DIRECTA",
        valor: 1500000,
        numeroContrato: `E2E-${SUFIJO}`,
        dependenciaSolicitanteId: dependencia.id,
        contratistaId: ctx.contratistaId,
        supervisorUsuarioIds: [ids.sup],
      });
      esperar(r.status === 201, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
      ctx.expedienteId = r.data.id;
      ctx.expedienteIds.push(r.data.id);
      return r.data.numero;
    });
    const exp = ctx.expedienteId;
    esperar(exp, "sin expediente no se puede continuar");

    console.log("\n5. Pantallas (HTML renderizado por el servidor)");
    const paginasJefe = [
      "/contratacion", "/contratacion/dashboard", "/contratacion/expedientes", "/contratacion/expedientes/nuevo",
      `/contratacion/expedientes/${exp}`, `/contratacion/expedientes/${exp}/rotulo`, "/contratacion/contratistas",
      "/contratacion/contratistas/nuevo", `/contratacion/contratistas/${ctx.contratistaId}`, "/contratacion/buzon",
      "/contratacion/mis-firmas", "/contratacion/ayuda",
    ];
    for (const ruta of paginasJefe) {
      await paso(`Jefe · GET ${ruta.replace(exp, "{exp}").replace(ctx.contratistaId!, "{contratista}")}`, async () => {
        const r = await c.jefe!.pagina(ruta);
        esperar(r.status === 200, `HTTP ${r.status}${r.location ? ` → ${r.location}` : ""}`);
        esperar(!/Application error|Internal Server Error/i.test(r.html), "la página muestra un error de aplicación");
      });
    }
    await paso("Admin · GET /contratacion/catalogo", async () => {
      const r = await c.admin!.pagina("/contratacion/catalogo");
      esperar(r.status === 200, `HTTP ${r.status}`);
    });
    await paso("Detalle del expediente muestra número y objeto", async () => {
      const r = await c.jefe!.pagina(`/contratacion/expedientes/${exp}`);
      esperar(r.html.includes(`E2E SIGEC ${SUFIJO}`), "no aparece el objeto");
      esperar(r.html.includes("Precontractual"), "no aparece la etapa");
    });
    await paso("Aviso de datos personales: aparece al primer ingreso y deja de aparecer al aceptar", async () => {
      const antes = await c.apoyo!.pagina("/contratacion");
      esperar(antes.status === 200 && antes.html.includes("Tratamiento de datos personales"), "no se mostró el aviso");
      const ok = await c.apoyo!.json("/api/mi-cuenta/aceptar-terminos", "POST");
      esperar(ok.status === 200, `POST → ${ok.status}`);
      const despues = await c.apoyo!.pagina("/contratacion");
      esperar(!despues.html.includes("Tratamiento de datos personales"), "el aviso siguió apareciendo");
    });

    console.log("\n6. Catálogo de requisitos y bloqueo duro de etapa");
    let faltantesBase = 0;
    await paso("Aprobar etapa sin documentos → 409 con la lista de faltantes", async () => {
      const r = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/aprobar-etapa`, "POST", {});
      esperar(r.status === 409 && Array.isArray(r.data.faltantes), `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
      faltantesBase = r.data.faltantes.length;
      return `${faltantesBase} requisito(s) obligatorio(s) pendientes`;
    });
    await paso("Supervisor no puede aprobar etapa (403)", async () => {
      const r = await c.sup!.json(`/api/contratacion/expedientes/${exp}/aprobar-etapa`, "POST", {});
      esperar(r.status === 403, `HTTP ${r.status}`);
    });
    await paso("Apoyo de contratación no puede aprobar etapa (403)", async () => {
      const r = await c.apoyo!.json(`/api/contratacion/expedientes/${exp}/aprobar-etapa`, "POST", {});
      esperar(r.status === 403, `HTTP ${r.status}`);
    });
    await paso("Jefe no puede modificar el catálogo (solo Administrador) → 403", async () => {
      const r = await c.jefe!.json("/api/contratacion/catalogo", "POST", { etapa: "PRECONTRACTUAL", nombre: "x", obligatorio: true });
      esperar(r.status === 403, `HTTP ${r.status}`);
    });
    await paso("Un requisito nuevo del catálogo se refleja de inmediato (invalidación de caché)", async () => {
      const nombre = `E2E requisito temporal ${SUFIJO}`;
      const crea = await c.admin!.json("/api/contratacion/catalogo", "POST", { etapa: "PRECONTRACTUAL", modalidadSeleccion: "CONTRATACION_DIRECTA", nombre, obligatorio: true });
      esperar(crea.status === 201, `POST catálogo → ${crea.status}: ${JSON.stringify(crea.data)}`);
      ctx.requisitoTmpId = crea.data.id;
      const r = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/aprobar-etapa`, "POST", {});
      esperar(r.status === 409 && r.data.faltantes.includes(nombre), "el requisito nuevo no aparece entre los faltantes (caché no invalidada)");
      const borra = await c.admin!.json(`/api/contratacion/catalogo/${ctx.requisitoTmpId}`, "DELETE");
      esperar(borra.status === 200, `DELETE catálogo → ${borra.status}`);
      ctx.requisitoTmpId = undefined;
      const r2 = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/aprobar-etapa`, "POST", {});
      esperar(r2.status === 409 && r2.data.faltantes.length === faltantesBase && !r2.data.faltantes.includes(nombre), "el requisito borrado sigue apareciendo");
    });

    console.log("\n7. Documentos, firma y ciclo de etapas");
    const requisitosDe = (etapa: string) =>
      db.requisitoDocumentoContratacion.findMany({
        where: { etapa: etapa as any, activo: true, OR: [{ modalidadSeleccion: null }, { modalidadSeleccion: "CONTRATACION_DIRECTA" }] },
        orderBy: { orden: "asc" },
      });
    let docFirmaId: string | undefined;
    const docsSubidos: Record<string, string[]> = {};

    for (const [i, etapa] of ETAPAS.entries()) {
      const reqs = await requisitosDe(etapa);
      const obligatorios = reqs.filter((r) => r.obligatorio);
      docsSubidos[etapa] = [];

      if (etapa === "PRECONTRACTUAL") {
        await paso("Contratista no puede subir en Precontractual (403)", async () => {
          const r = await subirDocumento(c.contratista!, exp, etapa, "no-deberia");
          esperar(r.status === 403, `HTTP ${r.status}`);
        });
      }
      await paso(`${etapa}: sube ${obligatorios.length} documento(s) obligatorio(s) del catálogo`, async () => {
        for (const [j, req] of obligatorios.entries()) {
          // El primero lo sube el supervisor (asignado al expediente), el resto el jefe; en las etapas
          // posteriores el contratista sube uno propio.
          const quien = j === 0 ? c.sup! : c.jefe!;
          const r = await subirDocumento(quien, exp, etapa, `${req.nombre}`.slice(0, 60), {
            requisitoId: req.id,
          });
          esperar(r.status === 201, `"${req.nombre}" → HTTP ${r.status}: ${JSON.stringify(r.data)}`);
          docsSubidos[etapa]!.push(r.data.id);
        }
        return `${obligatorios.length} subidos`;
      });
      if (etapa === "CONTRACTUAL") {
        await paso("Contratista sí puede subir en Contractual, en su propio expediente", async () => {
          const r = await subirDocumento(c.contratista!, exp, etapa, "informe-contratista");
          esperar(r.status === 201, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
          docsSubidos[etapa]!.push(r.data.id);
        });
      }

      if (etapa === "PRECONTRACTUAL") {
        // Documento libre (no anticipado por el catálogo) marcado como «requiere firma» — así el ciclo
        // de firma se prueba aunque el catálogo cambie.
        await paso("Firma · sube un documento libre que requiere firma", async () => {
          const r = await subirDocumento(c.jefe!, exp, etapa, "acta-para-firma", { requiereFirma: true });
          esperar(r.status === 201, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
          docFirmaId = r.data.id;
          docsSubidos[etapa]!.push(r.data.id);
        });
        if (docFirmaId) await flujoFirma(c, ids, exp, docFirmaId);
      }

      await paso(`${etapa}: Jefe aprueba el paso de etapa`, async () => {
        const r = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/aprobar-etapa`, "POST", { comentario: "E2E" });
        esperar(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
        const fila = await db.expedienteContractual.findUnique({ where: { id: exp }, select: { etapaActual: true, cerrado: true } });
        if (etapa === "POSTCONTRACTUAL") {
          esperar(fila?.cerrado, "el expediente no quedó cerrado");
          return "expediente cerrado";
        }
        esperar(fila?.etapaActual === ETAPAS[i + 1], `etapa actual ${fila?.etapaActual}`);
        return `→ ${fila?.etapaActual}`;
      });
      await paso(`${etapa}: los documentos de la etapa cerrada quedan APROBADOS (fix de esta entrega)`, async () => {
        const docs = await db.documentoContrato.findMany({ where: { expedienteId: exp, etapa }, select: { nombre: true, estadoValidacion: true } });
        const pendientes = docs.filter((d) => d.estadoValidacion !== "APROBADO");
        esperar(pendientes.length === 0, `${pendientes.length} sin aprobar: ${pendientes.map((d) => d.nombre).join(", ")}`);
        return `${docs.length} documento(s) aprobados`;
      });

      if (etapa === "PRECONTRACTUAL") {
        await paso("Retroceder etapa (corrección) y volver a aprobar", async () => {
          const sup = await c.sup!.json(`/api/contratacion/expedientes/${exp}/retroceder-etapa`, "POST", { motivo: "x" });
          esperar(sup.status === 403, `el supervisor pudo retroceder (HTTP ${sup.status})`);
          const r = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/retroceder-etapa`, "POST", { motivo: "Prueba E2E de corrección" });
          esperar(r.status === 200, `retroceder → HTTP ${r.status}: ${JSON.stringify(r.data)}`);
          let fila = await db.expedienteContractual.findUnique({ where: { id: exp }, select: { etapaActual: true } });
          esperar(fila?.etapaActual === "PRECONTRACTUAL", `tras retroceder: ${fila?.etapaActual}`);
          const ap = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/aprobar-etapa`, "POST", { comentario: "E2E reapertura" });
          esperar(ap.status === 200, `re-aprobar → HTTP ${ap.status}: ${JSON.stringify(ap.data)}`);
          fila = await db.expedienteContractual.findUnique({ where: { id: exp }, select: { etapaActual: true } });
          esperar(fila?.etapaActual === "CONTRACTUAL", `tras re-aprobar: ${fila?.etapaActual}`);
        });
      }
    }

    console.log("\n8. Expediente cerrado, descarga y trazabilidad");
    await paso("Expediente cerrado rechaza nuevas cargas (409)", async () => {
      const r = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/upload-sign`, "POST", { fileName: "tarde.pdf" });
      esperar(r.status === 409, `HTTP ${r.status}`);
    });
    await paso("Descarga ZIP del expediente completo", async () => {
      const res = await c.jefe!.req(`/api/contratacion/expedientes/${exp}/zip`);
      const buf = Buffer.from(await res.arrayBuffer());
      esperar(res.status === 200 && res.headers.get("content-type") === "application/zip", `HTTP ${res.status} ${res.headers.get("content-type")}`);
      esperar(buf.subarray(0, 2).toString() === "PK", "no es un ZIP válido");
      const entradas = buf.toString("latin1").split("PK\x01\x02").length - 1;
      const total = await db.documentoContrato.count({ where: { expedienteId: exp } });
      esperar(entradas >= total, `${entradas} entradas para ${total} documentos`);
      return `${entradas} archivos, ${(buf.length / 1024).toFixed(0)} KB`;
    });
    await paso("El supervisor asignado ve el expediente; el contratista, el suyo", async () => {
      const s = await c.sup!.pagina(`/contratacion/expedientes/${exp}`);
      const k = await c.contratista!.pagina(`/contratacion/expedientes/${exp}`);
      esperar(s.status === 200 && k.status === 200, `supervisor ${s.status}, contratista ${k.status}`);
    });
    await paso("Un supervisor ajeno no ve el expediente", async () => {
      const otro = await db.usuario.create({
        data: { email: `e2e-sigec-ajeno-${SUFIJO}@prueba.invalid`, nombre: `E2E SIGEC ajeno ${SUFIJO}`, passwordHash: await hashPassword(PASSWORD), rol: "FUNCIONARIO", activo: true, rolContratacion: "SUPERVISOR_INTERVENTOR", terminosAceptadosEn: new Date() },
      });
      ids.ajeno = otro.id;
      const cli = new Cliente(otro.email);
      await cli.login(otro.email);
      const r = await cli.pagina(`/contratacion/expedientes/${exp}`);
      const z = await cli.req(`/api/contratacion/expedientes/${exp}/zip`);
      esperar(r.status !== 200 && z.status === 403, `página ${r.status}, zip ${z.status}`);
    });
    await paso("La bitácora del expediente registró los eventos clave", async () => {
      const eventos = await db.eventoContratacion.findMany({ where: { expedienteId: exp }, select: { tipo: true } });
      const tipos = new Set(eventos.map((e) => e.tipo));
      for (const t of ["CREACION", "DOCUMENTO_FIRMADO"]) esperar(tipos.has(t as any), `falta el evento ${t} (hay: ${[...tipos].join(", ")})`);
      return `${eventos.length} eventos: ${[...tipos].join(", ")}`;
    });
    await paso("Administrador/Jefe elimina un documento sin traza en la bitácora (decisión de diseño)", async () => {
      const id = docsSubidos.CONTRACTUAL![docsSubidos.CONTRACTUAL!.length - 1]!;
      const antes = await db.eventoContratacion.count({ where: { expedienteId: exp } });
      const r = await c.jefe!.json(`/api/contratacion/documentos/${id}`, "DELETE");
      esperar(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
      const despues = await db.eventoContratacion.count({ where: { expedienteId: exp } });
      esperar(despues === antes, `se registraron ${despues - antes} evento(s)`);
    });
    await paso("El supervisor no puede eliminar el expediente (403)", async () => {
      const r = await c.sup!.json(`/api/contratacion/expedientes/${exp}`, "DELETE");
      esperar(r.status === 403, `el supervisor pudo eliminar (HTTP ${r.status})`);
    });
  } finally {
    console.log("\n9. Limpieza");
    await paso("Elimina expediente(s), archivos de storage, requisito y contratista de prueba", async () => {
      if (ctx.requisitoTmpId) await c.admin?.json(`/api/contratacion/catalogo/${ctx.requisitoTmpId}`, "DELETE");
      for (const id of ctx.expedienteIds) {
        const r = await c.admin!.json(`/api/contratacion/expedientes/${id}`, "DELETE");
        esperar(r.status === 200, `DELETE expediente → ${r.status}: ${JSON.stringify(r.data)}`);
      }
      await db.contratista.deleteMany({ where: { OR: [{ id: ctx.contratistaId ?? "-" }, { identificacion: { startsWith: identificacion } }] } });
    });
    await paso("Desactiva los usuarios de prueba (no se borran: quedan en la bitácora de auditoría)", async () => {
      const r = await db.usuario.updateMany({ where: { email: { startsWith: "e2e-sigec-", endsWith: `-${SUFIJO}@prueba.invalid` } }, data: { activo: false, rolContratacion: null } });
      return `${r.count} usuarios`;
    });
    await db.$disconnect();
  }

  const fallos = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - fallos.length}/${resultados.length} pasos correctos.`);
  if (fallos.length) {
    console.log("Fallos:");
    for (const f of fallos) console.log(` - ${f.paso}: ${f.detalle}`);
    process.exit(1);
  }
}

/** Ciclo de firma: asignación → buzón del firmante → firma → sello estampado → ficha técnica. */
async function flujoFirma(c: Record<string, Cliente>, ids: Record<string, string>, exp: string, docId: string) {
  let solicitudId = "";
  await paso("Firma · el Jefe asigna al supervisor como firmante", async () => {
    const r = await c.jefe!.json(`/api/contratacion/documentos/${docId}/solicitudes-firma`, "POST", { firmantes: [{ usuarioId: ids.sup, rol: "FIRMA", orden: 1 }] });
    esperar(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    const s = await db.solicitudFirma.findFirst({ where: { documentoContratoId: docId, usuarioAsignadoId: ids.sup } });
    esperar(s?.estado === "PENDIENTE", "no se creó la solicitud pendiente");
    solicitudId = s.id;
  });
  await paso("Firma · la solicitud aparece en el buzón y en la pantalla de firma del supervisor", async () => {
    const buzon = await c.sup!.pagina("/contratacion/buzon");
    const firmar = await c.sup!.pagina(`/contratacion/firmar/${solicitudId}`);
    const mis = await c.sup!.pagina("/contratacion/mis-firmas");
    esperar(buzon.status === 200 && firmar.status === 200 && mis.status === 200, `buzón ${buzon.status}, firmar ${firmar.status}, mis-firmas ${mis.status}`);
  });
  await paso("Firma · otra persona no puede completar una solicitud ajena", async () => {
    const r = await c.jefe!.json(`/api/contratacion/solicitudes-firma/${solicitudId}/completar`, "POST");
    esperar(r.status === 400 && /no está asignada/i.test(r.data.error), `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
  });
  await paso("Firma · el supervisor firma", async () => {
    const r = await c.sup!.json(`/api/contratacion/solicitudes-firma/${solicitudId}/completar`, "POST");
    esperar(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    const firma = await db.firmaDocumentoContrato.findFirst({ where: { documentoId: docId, usuarioId: ids.sup } });
    esperar(firma?.hashContenido && firma.ip !== undefined, "no quedó FirmaDocumentoContrato");
    const doc = await db.documentoContrato.findUnique({ where: { id: docId }, select: { estadoValidacion: true } });
    esperar(doc?.estadoValidacion === "APROBADO", `estado del documento: ${doc?.estadoValidacion}`);
    return `sello ${firma.formato} · documento APROBADO`;
  });
  await paso("Firma · firmar dos veces la misma solicitud se rechaza", async () => {
    const r = await c.sup!.json(`/api/contratacion/solicitudes-firma/${solicitudId}/completar`, "POST");
    esperar(r.status === 400 && /ya fue resuelta/i.test(r.data.error), `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
  });
  await paso("Firma · descarga del PDF con sello estampado", async () => {
    const original = await db.documentoContrato.findUnique({ where: { id: docId }, select: { tamanoBytes: true } });
    const res = await c.jefe!.req(`/api/contratacion-documentos/${docId}/rotulado`);
    const buf = Buffer.from(await res.arrayBuffer());
    esperar(res.status === 200 && buf.subarray(0, 4).toString() === "%PDF", `HTTP ${res.status}`);
    esperar(buf.length > original!.tamanoBytes, `el PDF estampado (${buf.length} B) no supera al original (${original!.tamanoBytes} B)`);
    const pdf = await PDFDocument.load(buf);
    return `${pdf.getPageCount()} pág., ${buf.length} B (original ${original!.tamanoBytes} B)`;
  });
  await paso("Firma · ficha técnica muestra cédula/NIT y correo de notificación del firmante", async () => {
    const r = await c.jefe!.pagina(`/contratacion/expedientes/${exp}/ficha-firma`);
    esperar(r.status === 200, `HTTP ${r.status}`);
    esperar(r.html.includes("900123456"), "no aparece la cédula/NIT del firmante");
    esperar(r.html.includes("@prueba.invalid"), "no aparece el correo de notificación");
  });
}

main().catch(async (err) => {
  console.error("\nError no controlado:", err);
  await db.$disconnect();
  process.exit(2);
});

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
import { calcularPeriodosInforme, etiquetaRangoPeriodo, esRequisitoPorPeriodos } from "../src/lib/periodos-informe";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PASSWORD = "E2e-Sigec-2026!";
const SUFIJO = Date.now().toString(36);
const ETAPAS = ["PRECONTRACTUAL", "CONTRACTUAL", "POSTCONTRACTUAL"] as const;

// Fechas del contrato relativas a hoy (75 días atrás → 45 adelante): los primeros periodos ya cerraron
// (deben verse «por radicar» en el panel) y los últimos todavía no. Los periodos esperados se calculan con
// la misma función que usa la aplicación.
const DIA_MS = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const INICIO_CONTRATO = iso(Date.now() - 75 * DIA_MS);
const FIN_CONTRATO = iso(Date.now() + 45 * DIA_MS);
const PERIODOS = calcularPeriodosInforme(new Date(`${INICIO_CONTRATO}T00:00:00Z`), new Date(`${FIN_CONTRATO}T00:00:00Z`));
const nombreInforme = (i: number) => `Informe de supervisión ${i + 1} (${etiquetaRangoPeriodo(PERIODOS[i]!)})`;

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
    // React intercala «<!-- -->» entre texto y valores interpolados: se quita para poder buscar frases.
    const html = res.status === 200 ? (await res.text()).replace(/<!-- -->/g, "").replace(/&nbsp;/g, " ") : "";
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

/** Capturas de pantalla opcionales (E2E_CAPTURAS=1): abre las páginas con un navegador real (Edge) usando la
 * sesión de cada usuario de prueba y guarda un PNG en capturas-e2e/ — para revisar el aspecto, no solo el HTML. */
let navegador: any = null;
async function capturar(etiqueta: string, cliente: Cliente, ruta: string, opciones: { menu?: string } = {}) {
  if (!process.env.E2E_CAPTURAS) return;
  try {
    const modulo = "playwright-core";
    const { chromium } = await import(modulo);
    navegador ??= await chromium.launch({ channel: "msedge" });
    const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
    await contexto.addCookies([{ name: "sinca_session", value: cliente.cookie.slice("sinca_session=".length), url: BASE }]);
    const pagina = await contexto.newPage();
    await pagina.goto(BASE + ruta, { waitUntil: "load", timeout: 30000 });
    await pagina.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    if (opciones.menu) {
      await pagina.getByRole("button", { name: opciones.menu }).click({ timeout: 5000 });
      await pagina.waitForTimeout(250);
    }
    await pagina.screenshot({ path: `capturas-e2e/${etiqueta}.png`, fullPage: !opciones.menu });
    await contexto.close();
  } catch (err) {
    console.log(`  (captura «${etiqueta}» omitida: ${err instanceof Error ? err.message.split("\n")[0] : err})`);
  }
}

async function main() {
  console.log(`\nE2E SIGEC contra ${BASE}\n`);
  const dependencia = await db.dependencia.findFirst({ where: { activo: true }, orderBy: { orden: "asc" }, select: { id: true, nombre: true } });
  esperar(dependencia, "No hay dependencias activas en la base.");

  // Valor del consecutivo de expedientes ANTES de la prueba, para devolverlo al terminar (ver limpieza).
  const anioConsecutivo = new Date().getFullYear();
  const consecutivoInicial = (await db.consecutivoRadicado.findUnique({ where: { serie_anio: { serie: "CTO", anio: anioConsecutivo } } }))?.ultimoNumero ?? 0;

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

    await paso("Rutas de entrada: /contratacion y /contratacion/dashboard llevan al tablero", async () => {
      const a = await c.jefe!.pagina("/contratacion");
      const b = await c.jefe!.pagina("/contratacion/dashboard");
      esperar(a.status === 307 && a.location?.endsWith("/contratacion/panel"), `/contratacion → ${a.status} ${a.location}`);
      esperar(b.status === 307 && b.location?.endsWith("/contratacion/panel/indicadores"), `/contratacion/dashboard → ${b.status} ${b.location}`);
    });
    await paso("Administración: cada sección muestra su contenido a quien puede y «Acceso restringido» a quien no", async () => {
      const casos: { ruta: string; ok: string; puede: (keyof typeof c)[]; noPuede: (keyof typeof c)[] }[] = [
        { ruta: "/contratacion/bitacora", ok: "Bitácora del SIGEC", puede: ["jefe", "admin"], noPuede: ["sup", "apoyo", "contratista"] },
        { ruta: "/contratacion/seguridad", ok: "Política de contraseñas", puede: ["jefe", "admin"], noPuede: ["sup", "apoyo", "contratista"] },
        { ruta: "/contratacion/auditoria", ok: "Auditoría de cuentas", puede: ["jefe", "admin"], noPuede: ["sup", "apoyo"] },
        { ruta: "/contratacion/catalogo", ok: "Catálogo de requisitos documentales", puede: ["admin"], noPuede: ["jefe", "sup", "apoyo"] },
        { ruta: "/contratacion/panel/sistema", ok: "Actividad reciente", puede: ["jefe", "admin"], noPuede: ["sup", "contratista"] },
        { ruta: "/contratacion/expedientes/nuevo", ok: "Nuevo expediente", puede: ["jefe", "admin"], noPuede: ["sup", "apoyo", "contratista"] },
        { ruta: "/admin/modulos", ok: "Disponibilidad de módulos", puede: [], noPuede: ["jefe", "admin", "sup"] },
        { ruta: "/usuarios", ok: "Usuarios", puede: [], noPuede: ["jefe", "admin"] },
      ];
      for (const caso of casos) {
        for (const rol of caso.puede) {
          const r = await c[rol]!.pagina(caso.ruta);
          esperar(r.status === 200 && r.html.includes(caso.ok) && !r.html.includes("Acceso restringido"), `${caso.ruta} como ${rol}: HTTP ${r.status}, sin «${caso.ok}»`);
        }
        for (const rol of caso.noPuede) {
          const r = await c[rol]!.pagina(caso.ruta);
          esperar(r.status === 200 && r.html.includes("Acceso restringido"), `${caso.ruta} como ${rol}: debía mostrar «Acceso restringido» (HTTP ${r.status})`);
        }
      }
    });
    await capturar("01-menu-administracion-supervisor", c.sup!, "/contratacion/panel", { menu: "Administración" });
    await capturar("02-menu-administracion-jefe", c.jefe!, "/contratacion/panel", { menu: "Administración" });
    await capturar("03-menu-expedientes-jefe", c.jefe!, "/contratacion/panel", { menu: "Expedientes" });
    await capturar("04-seguridad-restringida-supervisor", c.sup!, "/contratacion/seguridad");
    await capturar("05-seguridad-jefe", c.jefe!, "/contratacion/seguridad");
    await capturar("06-auditoria-jefe", c.jefe!, "/contratacion/auditoria");
    await capturar("07-bitacora-jefe", c.jefe!, "/contratacion/bitacora");
    await capturar("08-panel-sistema-jefe", c.jefe!, "/contratacion/panel/sistema");
    await capturar("09-panel-indicadores-jefe", c.jefe!, "/contratacion/panel/indicadores");
    await paso("La API de seguridad rechaza (sin cambiar nada) a quien no administra", async () => {
      const form = new FormData();
      form.set("volver", "/contratacion/seguridad");
      form.set("loginMaxIntentos", "3");
      const res = await fetch(BASE + "/api/configuracion-seguridad", { method: "POST", body: form, redirect: "manual", headers: { cookie: c.sup!.cookie } });
      esperar(res.status === 303 && /error=/.test(res.headers.get("location") ?? ""), `HTTP ${res.status} → ${res.headers.get("location")}`);
      const mod = new FormData();
      mod.set("sgdeaVisibleFuncionarios", "on");
      const m = await fetch(BASE + "/api/configuracion-modulos", { method: "POST", body: mod, redirect: "manual", headers: { cookie: c.jefe!.cookie } });
      esperar(m.status === 303 && /error=/.test(m.headers.get("location") ?? ""), `módulos como jefe → HTTP ${m.status} → ${m.headers.get("location")}`);
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
        fechaInicio: INICIO_CONTRATO,
        fechaFinEstimada: FIN_CONTRATO,
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
      "/contratacion/panel", "/contratacion/panel/expedientes", "/contratacion/panel/indicadores", "/contratacion/panel/sistema",
      "/contratacion/bitacora", "/contratacion/seguridad", "/contratacion/auditoria",
      "/contratacion/expedientes", "/contratacion/expedientes/nuevo",
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
      const antes = await c.apoyo!.pagina("/contratacion/panel");
      esperar(antes.status === 200 && antes.html.includes("Tratamiento de datos personales"), "no se mostró el aviso");
      const ok = await c.apoyo!.json("/api/mi-cuenta/aceptar-terminos", "POST");
      esperar(ok.status === 200, `POST → ${ok.status}`);
      const despues = await c.apoyo!.pagina("/contratacion/panel");
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
            ...(esRequisitoPorPeriodos(req) ? { periodoMes: PERIODOS[0]!.clave } : {}),
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
        const informe = reqs.find((r) => esRequisitoPorPeriodos(r));
        esperar(informe, "el catálogo no tiene el Informe de supervisión (A-BS-FO116) en la etapa Contractual");
        await flujoPeriodos(c, exp, informe.id, docsSubidos);
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
    await paso("Firmante sin rol sobre el expediente: ve SU documento y su ficha, no la ficha del expediente", async () => {
      esperar(docFirmaId, "sin documento de firma");
      const cli = new Cliente(`e2e-sigec-ajeno-${SUFIJO}@prueba.invalid`);
      await cli.login(cli.nombre);
      const asigna = await c.jefe!.json(`/api/contratacion/documentos/${docFirmaId}/solicitudes-firma`, "POST", { firmantes: [{ usuarioId: ids.ajeno, rol: "FIRMA", orden: 2 }] });
      esperar(asigna.status === 200, `asignar → ${asigna.status}: ${JSON.stringify(asigna.data)}`);
      const s = await db.solicitudFirma.findFirst({ where: { documentoContratoId: docFirmaId, usuarioAsignadoId: ids.ajeno } });
      const firma = await cli.json(`/api/contratacion/solicitudes-firma/${s!.id}/completar`, "POST");
      esperar(firma.status === 200, `firmar → ${firma.status}: ${JSON.stringify(firma.data)}`);

      const mis = await cli.pagina("/contratacion/mis-firmas");
      esperar(mis.html.includes("Ver documento") && mis.html.includes(`/api/contratacion-documentos/${docFirmaId}/rotulado`), "Mis firmas no ofrece «Ver documento»");
      const pdf = await cli.req(`/api/contratacion-documentos/${docFirmaId}/rotulado`);
      const bytes = Buffer.from(await pdf.arrayBuffer());
      esperar(pdf.status === 200 && bytes.subarray(0, 4).toString() === "%PDF", `documento firmado → HTTP ${pdf.status}`);
      const fichaDoc = await cli.pagina(`/contratacion/expedientes/${exp}/ficha-firma?documento=${docFirmaId}`);
      esperar(fichaDoc.status === 200 && fichaDoc.html.includes("acta-para-firma"), `ficha del documento → HTTP ${fichaDoc.status}`);
      const fichaTodo = await cli.pagina(`/contratacion/expedientes/${exp}/ficha-firma`);
      esperar(fichaTodo.status !== 200, "vio la ficha de TODO el expediente sin tener acceso a él");
      const otroDoc = docsSubidos.PRECONTRACTUAL![0]!;
      const fichaAjena = await cli.pagina(`/contratacion/expedientes/${exp}/ficha-firma?documento=${otroDoc}`);
      esperar(fichaAjena.status !== 200, "vio la ficha de un documento que no firmó");
      const zip = await cli.req(`/api/contratacion/expedientes/${exp}/zip`);
      esperar(zip.status === 403, `ZIP del expediente → ${zip.status}`);
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
    console.log("\n8b. Contratistas: vincular en cualquier etapa y eliminar");
    const numeroDe = async (id: string) => (await db.expedienteContractual.findUniqueOrThrow({ where: { id }, select: { numero: true } })).numero;
    const nuevoContratista = async (sufijo: string, nombre: string) => {
      const r = await c.jefe!.json("/api/contratacion/contratistas", "POST", { identificacion: `${identificacion}${sufijo}`, nombreORazonSocial: nombre });
      esperar(r.status === 201, `crear contratista → ${r.status}: ${JSON.stringify(r.data)}`);
      return r.data.id as string;
    };
    let c2 = "";
    await paso("La ficha de un contratista sin expedientes ofrece eliminarlo y vincular expedientes", async () => {
      c2 = await nuevoContratista("2", `Prueba E2E sin expedientes ${SUFIJO}`);
      const r = await c.jefe!.pagina(`/contratacion/contratistas/${c2}`);
      esperar(r.status === 200 && r.html.includes("Eliminar contratista") && r.html.includes("Vincular un expediente"), "faltan los controles");
      const conExp = await c.jefe!.pagina(`/contratacion/contratistas/${ctx.contratistaId}`);
      esperar(conExp.html.includes("No se puede eliminar mientras pertenezca"), "no explica por qué no se puede eliminar");
    });
    await paso("Solo Administrador/Jefe eliminan un contratista (supervisor → 403)", async () => {
      const r = await c.sup!.json(`/api/contratacion/contratistas/${c2}`, "DELETE");
      esperar(r.status === 403, `HTTP ${r.status}`);
    });
    await paso("Un contratista con expedientes NO se puede eliminar (409)", async () => {
      const r = await c.jefe!.json(`/api/contratacion/contratistas/${ctx.contratistaId}`, "DELETE");
      esperar(r.status === 409 && /expediente/i.test(r.data.error), `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    });
    await paso("Un contratista sin expedientes SÍ se elimina y queda en la auditoría", async () => {
      const r = await c.jefe!.json(`/api/contratacion/contratistas/${c2}`, "DELETE");
      esperar(r.status === 200, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
      esperar((await db.contratista.count({ where: { id: c2 } })) === 0, "el registro sigue existiendo");
      const aud = await db.registroAuditoria.findFirst({ where: { tipo: "CONTRATISTA_ELIMINADO", descripcion: { contains: `${identificacion}2` } } });
      esperar(aud, "no quedó registro de auditoría");
      const otra = await c.jefe!.json(`/api/contratacion/contratistas/${c2}`, "DELETE");
      esperar(otra.status === 404, `segundo borrado → ${otra.status}`);
    });
    await paso("Un contratista por expediente: el que ya tiene uno no admite otro (409); uno sin contratista se vincula", async () => {
      const c3 = await nuevoContratista("3", `Prueba E2E vinculo ${SUFIJO}`);
      const sup = await c.sup!.json(`/api/contratacion/expedientes/${exp}`, "PATCH", { contratistaId: c3 });
      esperar(sup.status === 403, `supervisor → ${sup.status}`);
      const otro = await c.jefe!.json(`/api/contratacion/expedientes/${exp}`, "PATCH", { contratistaId: c3 });
      esperar(otro.status === 409 && /un contratista por expediente/i.test(otro.data.error), `reemplazar → ${otro.status}: ${JSON.stringify(otro.data)}`);
      const sigue = await db.expedienteContractual.findUnique({ where: { id: exp }, select: { contratistaId: true } });
      esperar(sigue?.contratistaId === ctx.contratistaId, "el contratista original fue reemplazado");

      // Expediente sin contratista: se vincula desde la ficha del contratista (aparece en su lista) y no admite un segundo.
      const e2 = await c.jefe!.json("/api/contratacion/expedientes", "POST", {
        objeto: `E2E SIGEC ${SUFIJO} — expediente sin contratista`,
        modalidadSeleccion: "CONTRATACION_DIRECTA",
        dependenciaSolicitanteId: dependencia.id,
      });
      esperar(e2.status === 201, `crear expediente 2 → ${e2.status}: ${JSON.stringify(e2.data)}`);
      ctx.expedienteIds.push(e2.data.id);
      const ficha = await c.jefe!.pagina(`/contratacion/contratistas/${c3}`);
      esperar(ficha.html.includes(e2.data.numero) && !ficha.html.includes(await numeroDe(exp)), "la ficha no ofrece solo expedientes sin contratista");
      const ok = await c.jefe!.json(`/api/contratacion/expedientes/${e2.data.id}`, "PATCH", { contratistaId: c3 });
      esperar(ok.status === 200, `vincular → ${ok.status}: ${JSON.stringify(ok.data)}`);
      const otra = await c.jefe!.json(`/api/contratacion/expedientes/${e2.data.id}`, "PATCH", { contratistaId: ctx.contratistaId });
      esperar(otra.status === 409, `segundo contratista → ${otra.status}`);
      const ev = await db.eventoContratacion.findFirst({ where: { expedienteId: e2.data.id, tipo: "CONTRATISTA_VINCULADO" } });
      esperar(ev, "el vínculo no quedó en la bitácora");
      const del = await c.jefe!.json(`/api/contratacion/contratistas/${c3}`, "DELETE");
      esperar(del.status === 409, `borrar un contratista ya vinculado → ${del.status}`);
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
      // Los expedientes de prueba consumen consecutivos CDMB-CTO-AAAA-NNNNNN: al borrarlos quedaría un hueco
      // en la serie oficial. Se devuelve el contador a su valor previo a la prueba, salvo que un expediente
      // real con número mayor haya sido creado mientras tanto (nunca se reutiliza un número ya emitido).
      const restantes = await db.expedienteContractual.findMany({ where: { numero: { startsWith: `CDMB-CTO-${anioConsecutivo}-` } }, select: { numero: true } });
      const mayor = restantes.reduce((m, e) => Math.max(m, Number(e.numero.split("-").pop()) || 0), 0);
      await db.consecutivoRadicado.updateMany({ where: { serie: "CTO", anio: anioConsecutivo }, data: { ultimoNumero: Math.max(consecutivoInicial, mayor) } });
      await db.contratista.deleteMany({ where: { OR: [{ id: ctx.contratistaId ?? "-" }, { identificacion: { startsWith: identificacion } }] } });
    });
    await paso("Desactiva los usuarios de prueba (no se borran: quedan en la bitácora de auditoría)", async () => {
      const r = await db.usuario.updateMany({ where: { email: { startsWith: "e2e-sigec-", endsWith: `-${SUFIJO}@prueba.invalid` } }, data: { activo: false, rolContratacion: null } });
      return `${r.count} usuarios`;
    });
    await navegador?.close();
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

/** Informe de supervisión por periodos: espacios mensuales derivados de las fechas del contrato
 * (25 sep → 24 dic = 4) + espacios eventuales con nombre propio. El primer periodo (sep) ya se cargó
 * al subir los obligatorios del catálogo. */
async function flujoPeriodos(c: Record<string, Cliente>, exp: string, requisitoId: string, docsSubidos: Record<string, string[]>) {
  const meta = { etapa: "CONTRACTUAL", storagePath: "no-existe/x.pdf", mimeType: "application/pdf", tamanoBytes: 10, nombre: "x", requisitoId };
  await paso("Informe · sin indicar periodo se rechaza (no sube nada)", async () => {
    const r = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/documentos`, "POST", meta);
    esperar(r.status === 400 && /por periodos/i.test(r.data.error), `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
  });
  await paso("Informe · un mes fuera de las fechas del contrato se rechaza", async () => {
    const r = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/documentos`, "POST", { ...meta, periodoMes: "2099-01" });
    esperar(r.status === 400 && /no existe para las fechas/i.test(r.data.error), `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
  });
  await paso("Informe · un periodo que ya tiene documento no admite otro", async () => {
    const r = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/documentos`, "POST", { ...meta, periodoMes: PERIODOS[0]!.clave });
    esperar(r.status === 400 && /ya tiene un documento/i.test(r.data.error), `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
  });
  await paso("Informe · el periodo 1 quedó como «Informe de supervisión 1 (rango)»", async () => {
    const d = await db.documentoContrato.findFirst({ where: { expedienteId: exp, requisitoId, periodoMes: PERIODOS[0]!.clave } });
    esperar(d?.nombre === nombreInforme(0), `nombre: ${d?.nombre} (esperado ${nombreInforme(0)})`);
  });
  await paso("Informe · el Jefe carga el informe 3 y el contratista el 4 (el 2 queda pendiente)", async () => {
    const tres = await subirDocumento(c.jefe!, exp, "CONTRACTUAL", "informe-3", { requisitoId, periodoMes: PERIODOS[2]!.clave });
    esperar(tres.status === 201, `informe 3 → ${tres.status}: ${JSON.stringify(tres.data)}`);
    const cuatro = await subirDocumento(c.contratista!, exp, "CONTRACTUAL", "informe-4", { requisitoId, periodoMes: PERIODOS[3]!.clave });
    esperar(cuatro.status === 201, `informe 4 (contratista) → ${cuatro.status}: ${JSON.stringify(cuatro.data)}`);
    docsSubidos.CONTRACTUAL!.push(tres.data.id, cuatro.data.id);
    const d3 = await db.documentoContrato.findUnique({ where: { id: tres.data.id } });
    esperar(d3?.nombre === nombreInforme(2), `nombre: ${d3?.nombre} (esperado ${nombreInforme(2)})`);
  });
  let eventualId = "";
  await paso("Espacio eventual · el contratista no puede crearlo (403); el supervisor asignado sí, con nombre propio", async () => {
    const no = await c.contratista!.json(`/api/contratacion/expedientes/${exp}/periodos-eventuales`, "POST", { nombre: "no debería" });
    esperar(no.status === 403, `contratista → ${no.status}`);
    const vacio = await c.sup!.json(`/api/contratacion/expedientes/${exp}/periodos-eventuales`, "POST", { nombre: "  " });
    esperar(vacio.status === 400, `nombre vacío → ${vacio.status}`);
    const ok = await c.sup!.json(`/api/contratacion/expedientes/${exp}/periodos-eventuales`, "POST", { nombre: "Informe extraordinario por suspensión" });
    esperar(ok.status === 201, `crear → ${ok.status}: ${JSON.stringify(ok.data)}`);
    eventualId = ok.data.id;
    const dup = await c.sup!.json(`/api/contratacion/expedientes/${exp}/periodos-eventuales`, "POST", { nombre: "informe EXTRAORDINARIO por suspensión" });
    esperar(dup.status === 409, `duplicado → ${dup.status}`);
  });
  await paso("Espacio eventual · admite su documento y el nombre queda con la descripción", async () => {
    const r = await subirDocumento(c.jefe!, exp, "CONTRACTUAL", "informe-extra", { requisitoId, periodoEventualId: eventualId });
    esperar(r.status === 201, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    docsSubidos.CONTRACTUAL!.push(r.data.id);
    const d = await db.documentoContrato.findUnique({ where: { id: r.data.id } });
    esperar(d?.nombre.endsWith("— Informe extraordinario por suspensión"), `nombre: ${d?.nombre}`);
    const otra = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/documentos`, "POST", { ...meta, periodoEventualId: eventualId });
    esperar(otra.status === 400, `segundo documento en el mismo espacio → ${otra.status}`);
  });
  await paso("Espacio eventual · con documento no se puede quitar (409); vacío se renombra y se quita", async () => {
    const con = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/periodos-eventuales/${eventualId}`, "DELETE");
    esperar(con.status === 409, `con documento → ${con.status}`);
    const vacio = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/periodos-eventuales`, "POST", { nombre: "Espacio de prueba" });
    esperar(vacio.status === 201, `crear → ${vacio.status}`);
    const ren = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/periodos-eventuales/${vacio.data.id}`, "PATCH", { nombre: "Espacio renombrado" });
    esperar(ren.status === 200, `renombrar → ${ren.status}`);
    const del = await c.jefe!.json(`/api/contratacion/expedientes/${exp}/periodos-eventuales/${vacio.data.id}`, "DELETE");
    esperar(del.status === 200, `quitar → ${del.status}`);
  });
  await paso("Informe · la pantalla del expediente muestra los informes numerados, el avance y los espacios eventuales", async () => {
    const n = PERIODOS.length;
    for (const rol of ["jefe", "contratista"] as const) {
      const r = await c[rol]!.pagina(`/contratacion/expedientes/${exp}`);
      esperar(r.status === 200, `${rol}: HTTP ${r.status}`);
      for (const t of ["Informe de supervisión 1", `Informe de supervisión ${n}`, `Periodo ${etiquetaRangoPeriodo(PERIODOS[0]!)}`, `Periodo ${etiquetaRangoPeriodo(PERIODOS[n - 1]!)}`]) {
        esperar(r.html.includes(t), `${rol}: falta «${t}»`);
      }
      esperar(r.html.includes(`3 de ${n} periodos mensuales`), `${rol}: no muestra el avance «3 de ${n}»`);
      esperar(r.html.includes("Informe extraordinario por suspensión"), `${rol}: falta el espacio eventual`);
    }
    const jefe = await c.jefe!.pagina(`/contratacion/expedientes/${exp}`);
    esperar(jefe.html.includes("Agregar un espacio eventual"), "el Jefe no ve cómo agregar un espacio eventual");
    const cont = await c.contratista!.pagina(`/contratacion/expedientes/${exp}`);
    esperar(!cont.html.includes("Agregar un espacio eventual"), "el contratista puede agregar espacios");
  });
  await capturar("13-expediente-informes-jefe", c.jefe!, `/contratacion/expedientes/${exp}`);
  await capturar("14-expediente-informes-contratista", c.contratista!, `/contratacion/expedientes/${exp}`);
  await capturar("15-panel-trabajo-jefe", c.jefe!, "/contratacion/panel");
  await capturar("16-panel-expedientes-jefe", c.jefe!, "/contratacion/panel/expedientes");
  await paso("Panel · «Mi trabajo pendiente» lista el informe 2 (periodo ya cerrado y sin cargar)", async () => {
    const r = await c.jefe!.pagina("/contratacion/panel");
    esperar(r.status === 200 && r.html.includes("Informes por radicar"), `HTTP ${r.status}`);
    esperar(r.html.includes("Informe de supervisión 2"), "no aparece el informe 2 entre los pendientes por radicar");
    const cont = await c.contratista!.pagina("/contratacion/panel");
    esperar(cont.html.includes("Informe de supervisión 2"), "el contratista no ve su informe pendiente");
    const bit = await c.jefe!.pagina("/contratacion/bitacora?tipo=PERIODO_INFORME_CREADO");
    esperar(bit.html.includes("Informe extraordinario por suspensión"), "la bitácora del SIGEC no lista la creación del espacio eventual");
  });
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
  await paso("Buzón · muestra el conteo de pendientes por firmar (pestaña, panel y buzón)", async () => {
    const buzon = await c.sup!.pagina("/contratacion/buzon");
    esperar(/Tiene 1 documento pendiente por firmar o revisar/.test(buzon.html), "el buzón no dice que tiene 1 pendiente");
    esperar(buzon.html.includes("1 pendientes por firmar"), "la pestaña Buzón no muestra la insignia");
    const panel = await c.sup!.pagina("/contratacion/panel");
    esperar(panel.html.includes("1 pendientes por firmar") && panel.html.includes("Por firmar ahora"), "el panel no muestra los pendientes");
    const sinPendientes = await c.contratista!.pagina("/contratacion/panel");
    esperar(!sinPendientes.html.includes("pendientes por firmar"), "alguien sin pendientes ve la insignia");
  });
  await capturar("10-panel-pendientes-supervisor", c.sup!, "/contratacion/panel");
  await capturar("11-buzon-supervisor", c.sup!, "/contratacion/buzon");
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
  await paso("Buzón · tras firmar, el aviso de pendientes desaparece", async () => {
    const buzon = await c.sup!.pagina("/contratacion/buzon");
    const panel = await c.sup!.pagina("/contratacion/panel");
    esperar(!buzon.html.includes("pendientes por firmar") && !panel.html.includes("pendientes por firmar"), "sigue mostrando pendientes");
  });
  await capturar("12-mis-firmas-supervisor", c.sup!, "/contratacion/mis-firmas");
  await paso("Mis firmas · «Ver documento» abre el PDF firmado y la ficha es solo de ese documento", async () => {
    const mis = await c.sup!.pagina("/contratacion/mis-firmas");
    esperar(mis.html.includes("Ver documento") && mis.html.includes(`/api/contratacion-documentos/${docId}/rotulado`), "no hay enlace al documento");
    esperar(mis.html.includes(`ficha-firma?documento=${docId}`), "la ficha no es por documento");
    const pdf = await c.sup!.req(`/api/contratacion-documentos/${docId}/rotulado`);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    esperar(pdf.status === 200 && bytes.subarray(0, 4).toString() === "%PDF", `HTTP ${pdf.status}`);
    const ficha = await c.sup!.pagina(`/contratacion/expedientes/${exp}/ficha-firma?documento=${docId}`);
    esperar(ficha.status === 200 && ficha.html.includes("acta-para-firma"), `ficha → HTTP ${ficha.status}`);
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

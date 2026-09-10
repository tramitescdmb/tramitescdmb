/**
 * Extractor del Fondo Documental histórico — psdocuments.
 *
 * CORRE DENTRO DE LA RED CDMB (el Oracle 192.168.7.40 no es alcanzable desde
 * Vercel). Lee el catálogo de psdocuments del Oracle 10g (esquema `C`) y lo
 * sube por lotes a la app vía POST /api/fondo-historico/ingest.
 *
 * SOLO LECTURA sobre Oracle. SOLO METADATOS (no toca las imágenes de 1,4 TB).
 *
 * Requisitos: Node 18+ y el paquete `oracledb` (ya está en package.json;
 * node-oracledb v7 usa modo Thin, no necesita Oracle Instant Client).
 *
 * Uso:
 *   FONDO_INGEST_TOKEN=xxxxx \
 *   FONDO_INGEST_URL=https://tramitescdmb.vercel.app/api/fondo-historico/ingest \
 *   node scripts/fondo-historico/extraer-psdocuments.mjs
 *
 * Variables (con sus valores por defecto):
 *   FONDO_ORACLE_HOST      192.168.7.40
 *   FONDO_ORACLE_PORT      1521
 *   FONDO_ORACLE_SID       P
 *   FONDO_ORACLE_USER      psidea1
 *   FONDO_ORACLE_PASSWORD  psidea1
 *   FONDO_ORACLE_SCHEMA    C
 *   FONDO_INGEST_URL       (requerida)
 *   FONDO_INGEST_TOKEN     (requerida)
 *   FONDO_LOTE             500      (filas por POST)
 *   FONDO_SERIES           (opcional) lista de ids de serie separada por comas, para un piloto
 */

import oracledb from "oracledb";

const cfg = {
  host: process.env.FONDO_ORACLE_HOST || "192.168.7.40",
  port: Number(process.env.FONDO_ORACLE_PORT || 1521),
  sid: process.env.FONDO_ORACLE_SID || "P",
  user: process.env.FONDO_ORACLE_USER || "psidea1",
  password: process.env.FONDO_ORACLE_PASSWORD || "psidea1",
  schema: (process.env.FONDO_ORACLE_SCHEMA || "C").toUpperCase(),
  ingestUrl: process.env.FONDO_INGEST_URL,
  ingestToken: process.env.FONDO_INGEST_TOKEN,
  lote: Number(process.env.FONDO_LOTE || 500),
  seriesFiltro: (process.env.FONDO_SERIES || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n)),
};

if (!cfg.ingestUrl || !cfg.ingestToken) {
  console.error("Falta FONDO_INGEST_URL o FONDO_INGEST_TOKEN.");
  process.exit(1);
}

const FONDO = "psdocuments";
const connectString = `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${cfg.host})(PORT=${cfg.port}))(CONNECT_DATA=(SID=${cfg.sid})))`;

// El extractor manda las columnas crudas en `campos`; el servidor
// (src/lib/fondo-historico.ts) deriva fecha/número/asunto/etc. Solo se
// excluyen columnas internas del gestor que no aportan a la ficha.
const COLS_OMITIR = new Set(["DOC_IDFORMA", "DOC_ESTADOC", "N_ARCH", "RUTA"]);

function iso(v) {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  return String(v);
}

async function ingest(payload) {
  const res = await fetch(cfg.ingestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.ingestToken}` },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`ingest ${res.status}: ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : {};
}

async function main() {
  const t0 = Date.now();
  const conn = await oracledb.getConnection({ user: cfg.user, password: cfg.password, connectString });
  conn.callTimeout = 0;
  const S = cfg.schema;
  console.log(`Conectado a ${cfg.host}:${cfg.port}/${cfg.sid} como ${cfg.user}. Esquema ${S}.`);

  // 1. Catálogo de series.
  const cat = await conn.execute(
    `SELECT TIP_IDTIPDO, TIP_NOMBRE FROM ${S}.PSIDEA_TIPODOC ORDER BY TIP_IDTIPDO`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  let series = cat.rows.map((r) => ({ id: Number(r.TIP_IDTIPDO), nombre: String(r.TIP_NOMBRE || "").trim() }));
  if (cfg.seriesFiltro.length) series = series.filter((s) => cfg.seriesFiltro.includes(s.id));
  // La serie 221 "PRUEBA" no entra al espejo.
  series = series.filter((s) => !/^PRUEBA$/i.test(s.nombre));
  console.log(`Series a extraer: ${series.length}`);

  // 2. Mapa de imágenes: una pasada por PSIDEA_VERSION.
  console.log("Cargando índice de PSIDEA_VERSION…");
  const versiones = new Map(); // DOC_IDDOCUM -> { n, ruta }
  {
    const rs = (
      await conn.execute(
        `SELECT VER_IDDOCUM, VER_CAMINO, VER_ARCHIVO
           FROM ${S}.PSIDEA_VERSION
          WHERE NVL(VER_ESTADO,'X') NOT IN ('B','ND')`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT, resultSet: true }
      )
    ).resultSet;
    let row;
    while ((row = await rs.getRow())) {
      const id = Number(row.VER_IDDOCUM);
      const prev = versiones.get(id);
      const ruta = `${row.VER_CAMINO || ""}${row.VER_ARCHIVO || ""}`.trim() || null;
      if (prev) {
        prev.n += 1;
        if (ruta) prev.ruta = ruta;
      } else {
        versiones.set(id, { n: 1, ruta });
      }
    }
    await rs.close();
  }
  console.log(`  ${versiones.size} documentos con imagen.`);

  // 3. Abrir la corrida.
  const { sincronizacionId } = await ingest({
    fondo: FONDO,
    disparadoPor: `script:${process.env.HOSTNAME || process.env.COMPUTERNAME || "cdmb"}`,
  });
  console.log(`Corrida ${sincronizacionId}`);

  let total = 0;
  let lote = [];
  const enviar = async () => {
    if (!lote.length) return;
    const r = await ingest({ fondo: FONDO, sincronizacionId, lote });
    total += r.recibidas || lote.length;
    process.stdout.write(`\r  enviadas ${total}`);
    lote = [];
  };

  for (const serie of series) {
    const tabla = `${S}.PSIDEAW_${serie.id}`;
    let rs;
    try {
      rs = (
        await conn.execute(`SELECT * FROM ${tabla}`, [], {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          resultSet: true,
          fetchArraySize: 500,
        })
      ).resultSet;
    } catch (e) {
      console.log(`\n  (omito ${tabla}: ${e.message})`);
      continue;
    }
    let row;
    let n = 0;
    while ((row = await rs.getRow())) {
      const refId = row.DOC_IDDOCUM;
      if (refId == null) continue;
      const campos = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === "DOC_IDDOCUM" || COLS_OMITIR.has(k)) continue;
        campos[k] = v instanceof Date ? iso(v) : v;
      }
      const img = versiones.get(Number(refId));
      lote.push({
        ref_id: String(refId),
        serie_id: serie.id,
        serie_nombre: serie.nombre,
        tiene_imagen: !!img,
        num_archivos: img ? img.n : 0,
        ruta_original: img ? img.ruta : null,
        campos,
      });
      n += 1;
      if (lote.length >= cfg.lote) await enviar();
    }
    await rs.close();
    console.log(`\n  ${tabla} — ${serie.nombre}: ${n}`);
  }
  await enviar();

  const fin = await ingest({ fondo: FONDO, sincronizacionId, finalizar: true, totalOrigen: total });
  await conn.close();
  console.log(
    `\nListo en ${((Date.now() - t0) / 1000).toFixed(0)} s — ${total} filas enviadas · ` +
      `${fin.creados} nuevas · ${fin.actualizados} revisadas · ${fin.eliminados} retiradas.`
  );
}

main().catch((e) => {
  console.error("\nERROR:", e.message);
  process.exit(1);
});

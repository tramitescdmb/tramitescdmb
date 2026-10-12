import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";
import { crearContratistaMinimo, faltantesContratistaMinimo, faltantesRepresentanteLegal, leerRepresentanteLegal, ContratistaDuplicadoError } from "@/lib/contratacion";
import { leerDatosPersona, nombreCompletoPersona, TIPOS_IDENTIFICACION_USUARIO } from "@/lib/datos-persona";
import { COLUMNAS_IMPORTACION, MAX_FILAS_IMPORTACION, filaACuerpos, normalizarEncabezado, plantillaCsv, type FilaImportacion, type ResultadoFila } from "@/lib/importar-contratistas";
import { registrarAuditoria } from "@/lib/auditoria";

async function autorizar() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeGestionarContratistas(permisos)) {
    return { error: NextResponse.json({ error: "Solo el administrador o el jefe de contratación pueden importar contratistas." }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const { error } = await autorizar();
  if (error) return error;
  return new NextResponse(plantillaCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-contratistas.csv"',
    },
  });
}

export async function POST(req: NextRequest) {
  const { error, session } = await autorizar();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const csv = typeof body?.csv === "string" ? body.csv : "";
  const confirmar = body?.confirmar === true;
  if (!csv.trim()) return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });

  const parseado = Papa.parse<FilaImportacion>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizarEncabezado,
  });
  const encabezados = parseado.meta.fields ?? [];
  const faltan = ["tipo_persona", "numero_documento"].filter((c) => !encabezados.includes(c));
  if (faltan.length > 0) {
    return NextResponse.json({ error: `Faltan las columnas obligatorias: ${faltan.join(", ")}. Descargue la plantilla para ver el formato.` }, { status: 400 });
  }
  const desconocidas = encabezados.filter((h) => h && !COLUMNAS_IMPORTACION.some((c) => c.clave === h));
  if (parseado.data.length > MAX_FILAS_IMPORTACION) {
    return NextResponse.json({ error: `El archivo tiene ${parseado.data.length} filas; el máximo por carga es ${MAX_FILAS_IMPORTACION}.` }, { status: 400 });
  }

  const documentos = parseado.data.map((f) => filaACuerpos(f).persona.identificacion).filter(Boolean);
  const existentes = new Map(
    (await db.contratista.findMany({ where: { identificacion: { in: documentos } }, select: { id: true, identificacion: true, nombreORazonSocial: true } })).map((c) => [c.identificacion, c])
  );
  const vistos = new Set<string>();
  const resultados: ResultadoFila[] = [];

  for (const [i, fila] of parseado.data.entries()) {
    const cuerpos = filaACuerpos(fila);
    const persona = leerDatosPersona(cuerpos.persona, TIPOS_IDENTIFICACION_USUARIO);
    const base = { fila: i + 2, documento: persona.identificacion, nombre: nombreCompletoPersona(persona) };
    const problemas = [
      ...faltantesContratistaMinimo(persona),
      ...(cuerpos.representanteLegal ? faltantesRepresentanteLegal(leerRepresentanteLegal(cuerpos.representanteLegal)) : []),
    ];
    if (problemas.length > 0) {
      resultados.push({ ...base, estado: "error", detalle: `Falta: ${problemas.join(", ")}` });
      continue;
    }
    if (vistos.has(persona.identificacion)) {
      resultados.push({ ...base, estado: "error", detalle: "Documento repetido dentro del archivo" });
      continue;
    }
    vistos.add(persona.identificacion);
    const existente = existentes.get(persona.identificacion);
    if (existente) {
      resultados.push({ ...base, estado: "existente", detalle: `Ya registrado como ${existente.nombreORazonSocial}`, contratistaId: existente.id });
      continue;
    }
    if (!confirmar) {
      resultados.push({ ...base, estado: "listo" });
      continue;
    }
    try {
      const creado = await crearContratistaMinimo(cuerpos.persona, cuerpos.representanteLegal);
      resultados.push({ ...base, estado: "creado", contratistaId: creado.id });
    } catch (err) {
      resultados.push({
        ...base,
        estado: err instanceof ContratistaDuplicadoError ? "existente" : "error",
        detalle: err instanceof Error ? err.message : "No se pudo registrar",
      });
    }
  }

  const creados = resultados.filter((r) => r.estado === "creado").length;
  if (confirmar && creados > 0) {
    await registrarAuditoria({
      tipo: "CONTRATISTA_IMPORTADO",
      descripcion: `${session!.nombre} importó ${creados} contratista(s) desde un archivo CSV.`,
      usuarioId: session!.userId,
    });
  }

  return NextResponse.json({ resultados, columnasIgnoradas: desconocidas });
}

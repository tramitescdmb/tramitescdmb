import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datosPeticion, registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { camposCambiados, origenPermitido, validarPerfilCiudadano } from "@/lib/cuenta-ciudadana";
import { cuentaEnSesion, perfilDeCuenta, vincularAutomaticamente } from "@/lib/cuenta-ciudadana-db";

/**
 * Guarda el perfil del ciudadano (primer ingreso o «Mi perfil»). La identidad (tipo de persona,
 * tipo y número de documento) se fija la primera vez: de ella depende qué solicitudes puede
 * vincular la cuenta, así que después solo la cambia la CDMB. Cada cambio queda en la bitácora de
 * auditoría con los nombres de los campos (no los valores).
 */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req.headers)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 403 });
  const cuenta = await cuentaEnSesion();
  if (!cuenta) return NextResponse.json({ error: "Su sesión terminó. Ingrese de nuevo." }, { status: 401 });
  const antes = await perfilDeCuenta(cuenta.id);
  if (!antes) return NextResponse.json({ error: "Su sesión terminó. Ingrese de nuevo." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const primeraVez = !antes.identificacion;
  const r = validarPerfilCiudadano(body, {
    correoCuenta: antes.correo,
    identidadFija: primeraVez ? null : { tipo: antes.tipo, tipoIdentificacion: antes.tipoIdentificacion, identificacion: antes.identificacion! },
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  if (!antes.aceptaTratamientoEn && body?.aceptaTratamiento !== true) {
    return NextResponse.json({ error: "Debe aceptar la autorización de tratamiento de datos personales." }, { status: 400 });
  }

  const p = r.perfil;
  const ahora = new Date();
  const cambios = primeraVez ? [] : camposCambiados(antes, p);
  await db.cuentaCiudadana.update({
    where: { id: cuenta.id },
    data: {
      ...(primeraVez ? { tipo: p.tipo, tipoIdentificacion: p.tipoIdentificacion, identificacion: p.identificacion } : {}),
      ...(antes.aceptaTratamientoEn ? {} : { aceptaTratamientoEn: ahora }),
      nombres: p.nombres,
      apellidos: p.apellidos,
      razonSocial: p.razonSocial,
      nombre: p.nombre,
      correoAlterno: p.correoAlterno,
      celular: p.celular,
      telefono: p.telefono,
      direccion: p.direccion,
      departamento: p.departamento,
      ciudad: p.ciudad,
      regimenTributario: p.regimenTributario,
      granContribuyente: p.granContribuyente,
      representanteLegal: p.representanteLegal,
      representanteIdentificacion: p.representanteIdentificacion,
      tipoUsuario: p.tipoUsuario,
      autorizaNotificacionElectronica: p.autorizaNotificacionElectronica,
      ...(p.autorizaNotificacionElectronica !== antes.autorizaNotificacionElectronica ? { autorizaNotificacionEn: p.autorizaNotificacionElectronica ? ahora : null } : {}),
      perfilActualizadoEn: ahora,
    },
  });

  if (primeraVez || cambios.length > 0) {
    const { ip, userAgent } = datosPeticion(req.headers);
    try {
      await registrarAuditoriaDoc({
        entidad: "CuentaCiudadana",
        entidadId: cuenta.id,
        accion: primeraVez ? "CREA" : "MODIFICA",
        usuarioId: null,
        ip,
        userAgent,
        detalle: primeraVez ? "El ciudadano completó su perfil." : `El ciudadano actualizó su perfil: ${cambios.join(", ")}.`,
      });
    } catch (err) {
      console.error("No se pudo registrar en auditoría el cambio de perfil ciudadano:", err);
    }
  }
  const vinculadas = primeraVez ? await vincularAutomaticamente(cuenta.id) : 0;
  return NextResponse.json({ ok: true, vinculadas, cambios: cambios.length });
}

export type EntidadFirmante = { razonSocial: string; nit: string; representante: string; documentoRepresentante: string | null };

export const SELECT_CONTRATISTA_ENTIDAD = {
  identificacion: true,
  contactoEmail: true,
  tipoPersona: true,
  nombreORazonSocial: true,
  representanteLegal: { select: { nombres: true, apellidos: true, identificacion: true } },
} as const;

export function entidadFirmante(u: {
  nombre: string;
  cedulaONit?: string | null;
  tipoIdentificacionFirma?: string | null;
  contratista?: {
    identificacion: string;
    tipoPersona?: string | null;
    nombreORazonSocial?: string | null;
    representanteLegal?: { nombres: string; apellidos: string; identificacion: string } | null;
  } | null;
}): EntidadFirmante | null {
  const c = u.contratista;
  if (!c || c.tipoPersona !== "JURIDICA") return null;
  const rep = c.representanteLegal;
  const documentoPropio = u.cedulaONit && u.tipoIdentificacionFirma !== "NIT" && u.cedulaONit !== c.identificacion ? u.cedulaONit : null;
  return {
    razonSocial: c.nombreORazonSocial ?? u.nombre,
    nit: c.identificacion,
    representante: rep ? `${rep.nombres} ${rep.apellidos}`.trim() : u.nombre,
    documentoRepresentante: rep?.identificacion ?? documentoPropio,
  };
}

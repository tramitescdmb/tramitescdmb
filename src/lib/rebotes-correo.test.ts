import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ after: (f: () => void) => f() }));

import { analizarRebote, esInformeNoEntrega } from "./rebotes-correo";

const EXCHANGE = `Your message to nadie@hotmail.com couldn't be delivered.
nadie wasn't found at hotmail.com.

Diagnostic information for administrators:
Generating server: BN8PR12MB3234.namprd12.prod.outlook.com
nadie@hotmail.com
Remote server returned '550 5.5.0 Requested action not taken: mailbox unavailable (S2017062302). [DM6NAM10FT034.eop-nam10.prod.protection.outlook.com 2026-10-31T12:00:00.000Z 08DD]'
Original message headers:
Received: from CO1PR10MB4594.namprd10.prod.outlook.com (10.4.5.6) by BN8PR12MB3234
From: sistemas@cdmb.gov.co
To: nadie@hotmail.com
X-CDMB-Envio: 3f2a9c1e-7b4d-4e7a-9c3f-1a2b3c4d5e6f
`;

const EXCHANGE_ES = `No se pudo entregar el mensaje a usuario.inexistente@cdmb.gov.co.
No se encontró usuario.inexistente en cdmb.gov.co.

Información de diagnóstico para administradores:
Servidor de generación: CO1PR10MB4594.namprd10.prod.outlook.com
usuario.inexistente@cdmb.gov.co
El servidor remoto devolvió '550 5.1.10 RESOLVER.ADR.RecipientNotFound; Recipient not found by SMTP address lookup'
Encabezados del mensaje original:
X-CDMB-Envio: 0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d
`;

const GMAIL = `** Address not found **

Your message wasn't delivered to otro.correo@gmail.com because the address couldn't be found, or is unable to receive mail.

The response from the remote server was:
550 5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address for typos or unnecessary spaces.
`;

const BUZON_LLENO = `Delivery has failed to these recipients or groups:
lleno@empresa.com.co
The recipient's mailbox is full and can't accept messages now.
Remote server returned '552 5.2.2 mailbox full'
`;

describe("analizarRebote", () => {
  it("lee el informe de Exchange en inglés con el encabezado de envío", () => {
    const r = analizarRebote(EXCHANGE, ["sistemas@cdmb.gov.co"]);
    expect(r.envio).toBe("3f2a9c1e-7b4d-4e7a-9c3f-1a2b3c4d5e6f");
    expect(r.codigo).toBe("5.5.0");
    expect(r.destinatarios).toEqual(["nadie@hotmail.com"]);
    expect(r.diagnostico).toContain("Remote server returned");
    expect(r.suprimir).toBe(true);
  });

  it("lee el informe en español y suprime el destinatario inexistente", () => {
    const r = analizarRebote(EXCHANGE_ES, ["sistemas@cdmb.gov.co"]);
    expect(r.envio).toBe("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d");
    expect(r.codigo).toBe("5.1.10");
    expect(r.destinatarios).toEqual(["usuario.inexistente@cdmb.gov.co"]);
    expect(r.suprimir).toBe(true);
  });

  it("lee un rebote de un servidor externo sin encabezados originales", () => {
    const r = analizarRebote(GMAIL);
    expect(r.envio).toBeNull();
    expect(r.codigo).toBe("5.1.1");
    expect(r.destinatarios).toEqual(["otro.correo@gmail.com"]);
    expect(r.suprimir).toBe(true);
  });

  it("no suprime un rechazo temporal", () => {
    const r = analizarRebote("Remote server returned '450 4.2.1 user unknown, try later'");
    expect(r.codigo).toBe("4.2.1");
    expect(r.suprimir).toBe(false);
  });

  it("no suprime un buzón lleno", () => {
    const r = analizarRebote(BUZON_LLENO);
    expect(r.codigo).toBe("5.2.2");
    expect(r.suprimir).toBe(false);
  });

  it("no confunde direcciones IP ni versiones con códigos de estado", () => {
    const r = analizarRebote("Received: from host (10.4.5.6) version 15.20.1234.567\nsin código");
    expect(r.codigo).toBeNull();
  });
});

describe("esInformeNoEntrega", () => {
  it("usa la clase del mensaje cuando está disponible", () => {
    expect(esInformeNoEntrega({ asunto: "Undeliverable: Prueba", clase: "REPORT.IPM.Note.NDR" })).toBe(true);
    expect(esInformeNoEntrega({ asunto: "Undeliverable: Prueba", clase: "IPM.Note" })).toBe(false);
    expect(esInformeNoEntrega({ asunto: "Delivery delayed", clase: "REPORT.IPM.Note.DelayedDSN" })).toBe(false);
  });

  it("reconoce el asunto cuando no hay clase", () => {
    expect(esInformeNoEntrega({ asunto: "No se puede entregar: Radicado CDMB-R-2026-000002", clase: null })).toBe(true);
    expect(esInformeNoEntrega({ asunto: "Delivery Status Notification (Failure)", clase: null })).toBe(true);
    expect(esInformeNoEntrega({ asunto: "Respuesta a su radicado", clase: null })).toBe(false);
  });
});

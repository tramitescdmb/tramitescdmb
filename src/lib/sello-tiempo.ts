import { createHash } from "node:crypto";
import { AsnConvert, OctetString } from "@peculiar/asn1-schema";
import {
  MessageImprint,
  TimeStampReq,
  TimeStampReqVersion,
  TimeStampResp,
  TSTInfo,
} from "@peculiar/asn1-tsp";
import { SignedData } from "@peculiar/asn1-cms";
import { AlgorithmIdentifier } from "@peculiar/asn1-x509";

const SHA256_OID = "2.16.840.1.101.3.4.2.1";

export type SelloTiempo = {
  token: string;
  tiempo: Date;
};

export async function solicitarSelloTiempo(hashHex: string, tsaUrl: string): Promise<SelloTiempo | null> {
  try {
    const hashBytes = Buffer.from(hashHex, "hex");
    if (hashBytes.length !== 32) return null;

    const req = new TimeStampReq({
      version: TimeStampReqVersion.v1,
      messageImprint: new MessageImprint({
        hashAlgorithm: new AlgorithmIdentifier({ algorithm: SHA256_OID }),
        hashedMessage: new OctetString(hashBytes),
      }),
      certReq: true,
    });

    const resp = await fetch(tsaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/timestamp-query" },
      body: new Uint8Array(AsnConvert.serialize(req)),
      signal: AbortSignal.timeout(9000),
    });
    if (!resp.ok) return null;

    const tsResp = AsnConvert.parse(await resp.arrayBuffer(), TimeStampResp);
    if (tsResp.status.status !== 0 && tsResp.status.status !== 1) return null;
    const token = tsResp.timeStampToken;
    if (!token) return null;

    const signedData = AsnConvert.parse(token.content, SignedData);
    const eContent = signedData.encapContentInfo.eContent?.single;
    if (!eContent) return null;
    const tstInfo = AsnConvert.parse(eContent.buffer, TSTInfo);
    const tiempo = tstInfo.genTime instanceof Date ? tstInfo.genTime : new Date(tstInfo.genTime);

    return {
      token: Buffer.from(AsnConvert.serialize(token)).toString("base64"),
      tiempo,
    };
  } catch {
    return null;
  }
}

export function sha256Hex(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

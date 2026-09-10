# Fondo Documental histórico — extractor

Espejo de **solo consulta y solo metadatos** de los sistemas de gestión documental
anteriores de la CDMB. El Oracle origen (`192.168.7.40`, esquema `C`) está en la
intranet y no es alcanzable desde Vercel, así que la extracción **corre dentro de
la red CDMB** y empuja los datos a la app por HTTPS.

Nunca copia imágenes escaneadas (1,4 TB). Nunca escribe en Oracle.

## Requisitos

- Node 18 o superior.
- `npm install` en este repo (usa el paquete `oracledb`, modo Thin — no necesita
  Oracle Instant Client).
- Salida HTTPS hacia `https://tramitescdmb.vercel.app`.
- Acceso TCP a `192.168.7.40:1521`.

## Configuración

En la app (Vercel → Settings → Environment Variables) definir:

| Variable | Valor |
|---|---|
| `FONDO_INGEST_TOKEN` | una cadena larga aleatoria (secreto compartido) |

Redesplegar la app para que la variable quede activa (agregar env vars no afecta a
un build ya hecho).

## Correr la extracción de psdocuments

```bash
export FONDO_INGEST_URL="https://tramitescdmb.vercel.app/api/fondo-historico/ingest"
export FONDO_INGEST_TOKEN="…el mismo valor que en Vercel…"

# opcional — piloto con dos series antes de traerlo todo:
# export FONDO_SERIES="262,264"

node scripts/fondo-historico/extraer-psdocuments.mjs
```

Valores por defecto de Oracle (se pueden sobreescribir con env vars):
`FONDO_ORACLE_HOST=192.168.7.40`, `FONDO_ORACLE_PORT=1521`, `FONDO_ORACLE_SID=P`,
`FONDO_ORACLE_USER=psidea1`, `FONDO_ORACLE_PASSWORD=psidea1`, `FONDO_ORACLE_SCHEMA=C`.

El script:

1. Lee el catálogo de series (`C.PSIDEA_TIPODOC`) y el índice de imágenes
   (`C.PSIDEA_VERSION`, una pasada).
2. Recorre cada `C.PSIDEAW_<serie>` y envía los metadatos en lotes de 500 a
   `/api/fondo-historico/ingest`.
3. En la última llamada marca la corrida como completa; la app borra del espejo
   las filas que ya no están en el origen.

Es idempotente. Si se corta a la mitad, la siguiente corrida completa el espejo
(no borra nada hasta terminar bien).

## Programarlo (sync recurrente)

psdocuments está prácticamente congelado; una corrida manual ocasional basta.

Para «SIC correspondencia» (que sí sigue vivo) habrá un
`extraer-sic.mjs` y conviene un `cron` diario en un equipo de la red CDMB:

```cron
0 2 * * *  cd /ruta/al/repo && FONDO_INGEST_URL=… FONDO_INGEST_TOKEN=… node scripts/fondo-historico/extraer-sic.mjs >> /var/log/fondo-sic.log 2>&1
```

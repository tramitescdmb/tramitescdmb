# Almacén de documentos (NAS)

Los archivos de los usuarios viven en el NAS (`ALMACEN_LOCAL_DIR`, en la VM montado desde
`192.168.7.49:/volume1/TramitesCDMB`). La base de datos guarda la ruta de cada archivo relativa a
`<ALMACEN_LOCAL_DIR>/documentos/`.

## Qué carpeta es para qué

| Carpeta | Contenido |
|---|---|
| `Gecon/<vigencia>/<tipo de contrato>/<contrato>/<etapa>/` | Contratos de GECON. `<contrato>` es `contrato-1520-2026` cuando ya tiene número; antes, `expediente-CDMB-CTO-2026-000003` (al asignarse el número, sus archivos pasan a la carpeta nueva con el siguiente documento que se registre). `<etapa>`: `precontractual`, `contractual`, `poscontractual`. Tipos: `prestacion-de-servicios`, `obra`, `suministro`, `compraventa`, `consultoria`, `interventoria`, `arrendamiento`, `otros`. |
| `Tramites/<año de radicación>/<tipo de trámite>/<número del expediente>/` | Trámites ambientales. Dentro: `radicacion/` (lo aportado al radicar), `paso-03/` (documentos de cada paso), `conceptos/` (PDF del concepto técnico), `visitas/<fecha>/` (fotos de la visita). |
| `Correspondencia/<año>/<recibidas\|enviadas\|internas>/<radicado>/` | Radicados de ventanilla, PQRSD, oficios de salida y memorandos. La respuesta del funcionario va en `respuesta/`. |
| `SGDEA/<año de apertura>/<código-dependencia>/<número del expediente>/` | Documentos de los expedientes documentales del SGDEA. |
| `Vital/<año>/<id VITAL>/` | Documentos descargados de VITAL. |
| `_subidas/<identificador>/` | Llegada temporal: el navegador sube aquí y, al registrar el documento, el sistema lo mueve a su carpeta. Si queda algo, es una subida que no se terminó de registrar. |
| `derivados/` | Caché de PDF con el sello de firma/rótulo. Se regenera solo; se puede borrar. |

Los nombres de carpeta y de archivo se guardan sin tildes ni caracteres especiales
(`Acta de visita (firmada).pdf` → `Acta_de_visita_firmada.pdf`). Si ya existe un archivo con el mismo
nombre se guarda como `Acta_2.pdf`; nunca se pisa uno existente.

## Reglas para el administrador

- **Copiar** archivos a mano se puede siempre.
- **No renombrar, mover ni borrar** archivos a mano: la base apunta a la ruta exacta y el documento
  dejaría de abrirse. La firma electrónica se amarra a la huella SHA-256 del contenido: un archivo
  modificado no se podrá seguir firmando.
- Mover un archivo con el sistema no cambia su contenido: firmas y huellas siguen valiendo.

## Cuándo se mueven los archivos

Al registrar un documento, el sistema mueve lo recién subido de `_subidas/` a su carpeta y, si el
contrato o trámite cambió de carpeta (por ejemplo, se le asignó el número de contrato o cambió la
vigencia), también pasa ahí sus archivos anteriores.

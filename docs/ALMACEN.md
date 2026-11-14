# Almacén de documentos (NAS)

Los archivos de los usuarios viven en el NAS (`ALMACEN_LOCAL_DIR`, en la VM montado desde
`192.168.7.49:/volume1/TramitesCDMB`). La base de datos guarda la ruta de cada archivo relativa a
`<ALMACEN_LOCAL_DIR>/documentos/`.

## Qué carpeta es para qué

| Carpeta | Contenido |
|---|---|
| `Gecon/<vigencia>/<tipo de contrato>/<contrato>/<etapa>/` | Contratos de GECON. `<contrato>` es `contrato-1520-2026` cuando ya tiene número; antes, `expediente-CDMB-CTO-2026-000003`. `<etapa>`: `precontractual`, `contractual`, `poscontractual`. Tipos: `prestacion-de-servicios`, `obra`, `suministro`, `compraventa`, `consultoria`, `interventoria`, `arrendamiento`, `otros`. |
| `Tramites/<año de radicación>/<tipo de trámite>/<número del expediente>/` | Trámites ambientales. Dentro: `radicacion/` (lo aportado al radicar), `paso-03/` (documentos de cada paso), `conceptos/` (PDF del concepto técnico), `visitas/<fecha>/` (fotos de la visita). |
| `Correspondencia/<año>/<recibidas\|enviadas\|internas>/<radicado>/` | Radicados de ventanilla, PQRSD, oficios de salida y memorandos. La respuesta del funcionario va en `respuesta/`. |
| `SGDEA/<año de apertura>/<código-dependencia>/<número del expediente>/` | Documentos de los expedientes documentales del SGDEA. |
| `Vital/<año>/<id VITAL>/` | Documentos descargados de VITAL. |
| `_subidas/<identificador>/` | Llegada temporal: el navegador sube aquí y, al registrar el documento, el sistema lo mueve a su carpeta. Si queda algo, es una subida que no se terminó de registrar. |
| `expedientes/<identificador>/` | Estructura anterior (antes del 14-nov-2026). Lo que siga aquí funciona igual; `scripts/organizar-archivos.ts` lo pasa a la estructura nueva. |
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

## Reordenar lo ya guardado

```bash
# En la carpeta del código en la VM (ver /opt/tramites/LEEME.md), con las mismas variables del
# servicio cargadas (DATABASE_URL y ALMACEN_LOCAL_DIR) y como el usuario dueño de los archivos.
npx tsx scripts/organizar-archivos.ts              # simulación: solo muestra qué movería
npx tsx scripts/organizar-archivos.ts --aplicar    # mueve y actualiza la base
npx tsx scripts/organizar-archivos.ts --modulo=gecon   # uno solo: tramites|gecon|correspondencia|sgdea|vital
```

Hacerlo fuera del horario de trabajo y después de la copia de la base. El script también deja en
`<ALMACEN_LOCAL_DIR>/huerfanos-<fecha>.csv` la lista de archivos que ninguna fila usa. **No borra
nada**: esa lista se revisa antes de decidir.

Cuándo correrlo: una vez para pasar lo anterior a la estructura nueva, y de vez en cuando para que
los contratos que recibieron su número (o cambiaron de vigencia) queden en su carpeta definitiva.

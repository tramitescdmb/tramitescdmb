# Negocios Verdes en el SIC

Módulo que reemplaza la plataforma anterior de Negocios Verdes (aplicación aparte). Tiene dos partes:

| Parte | Dirección | Quién entra |
|---|---|---|
| Sitio público | `/negocios-verdes` y `/negocios-verdes/negocio/<slug>` | Cualquier persona, sin cuenta. Solo negocios publicados y solo sus datos públicos. |
| Panel interno | `/negocios-verdes/admin` | Funcionarios con perfil de Negocios Verdes y el administrador del SIC. |

## Casillas en Administración → Módulos

- **Negocios Verdes — Panel administrativo** (encendida por defecto): muestra u oculta el panel para los funcionarios.
- **Negocios Verdes — Sitio público** (apagada por defecto): mientras esté apagada, la ciudadanía ve
  «Sitio en preparación» y quienes tienen acceso al panel ven el sitio en vista previa.

## Perfiles (Administración → Roles, pestaña Negocios Verdes)

| Perfil | Permisos |
|---|---|
| Negocios Verdes — Administrador | `negociosVerdes.gestion`: negocios, personas, productos, puntajes, importación CSV y tablero. |
| Negocios Verdes — Administrador de configuración | Lo anterior más `negociosVerdes.configuracion`: categorías, subcategorías, actividades y apariencia. |

Al asignar uno de estos perfiles a una persona, el módulo queda habilitado en su ficha. Si es su único
módulo, solo ve Negocios Verdes.

## Qué es público y qué no

El sitio público lee solo los campos de `SELECT_NEGOCIO_PUBLICO` y los arma con `aNegocioPublico`
(`src/lib/negocios-verdes.ts`). Nunca salen: la ficha técnica (`fichaTecnica`: NIT, permisos ambientales,
fortalezas, observaciones…), los puntajes, las personas vinculadas ni los negocios sin publicar. Hay pruebas
automáticas que lo verifican (`src/lib/negocios-verdes.test.ts`).

## Traslado de datos desde la plataforma anterior

Script `scripts/negocios-verdes-migrar.ts` (`npm run nv:migrar`). Lee la base anterior en modo solo
lectura, convierte las 21 tablas a las tablas `Nv*` conservando identificadores y slug, copia las imágenes
al NAS y asocia por correo a los administradores anteriores con su usuario del SIC.

La dirección de la base anterior va solo en la variable `NV_ORIGEN_URL`, escrita en la misma línea del
comando (no se guarda en `.env` ni en el repositorio).

1. Ensayo (no guarda nada): `NV_ORIGEN_URL='…' npm run nv:migrar -- --ensayo`
2. Traslado real: `NV_ORIGEN_URL='…' npm run nv:migrar`
3. Repetir desde cero (borra lo cargado en el módulo): agregar `--reemplazar`.

El script imprime el conteo por tabla (origen y destino), las imágenes copiadas o fallidas y los
administradores asociados, y deja un informe JSON en la carpeta temporal del sistema. Las contraseñas no se
trasladan.

## Exposición a internet (pendiente con TI)

Hoy nginx publica todo el SIC sin distinguir rutas. Antes de abrir el dominio a internet se debe
restringir por rutas: desde fuera solo `/negocios-verdes` (sin `/negocios-verdes/admin`),
`/api/almacen/negocios-verdes/`, `/_next/static` y las demás páginas públicas que decida la CDMB; el resto
solo desde la red interna. Este cambio no está hecho en el repositorio.

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

## Panel administrativo (/negocios-verdes/admin)

| Pestaña | Quién | Qué hace |
|---|---|---|
| Negocios | Administrador | Crear, editar y eliminar negocios: datos públicos, clasificación, portada, galería, productos, ficha técnica interna y puntajes por año. En la ficha del negocio, «Personas vinculadas» asigna responsable CDMB, delegado y representante (un vínculo vigente por tipo; el anterior pasa al historial con su fecha de fin). |
| Personas | Administrador | Directorio de responsables, delegados y representantes. No se elimina una persona con vínculos: se desactiva. |
| Importar / exportar | Cualquiera con panel exporta; importa quien puede crear y editar | CSV con las mismas columnas de la plataforma anterior (punto y coma, abre en Excel). Importar primero revisa sin cambiar nada; actualiza por `id` o `slug` y crea los demás sin publicar. Si hay filas con error se corrigen o se importan solo las válidas. Nunca toca fotos, productos, ficha técnica, puntajes ni el teléfono y el correo secundarios (no están en el CSV). |
| Clasificación | Administrador de configuración | Categorías, subcategorías y actividades productivas. Las que están en uso no se eliminan: se desactivan y dejan de verse en el sitio. |
| Apariencia del sitio | Administrador de configuración | Logos (Negocios Verdes, GOV.CO, Colombia, Potencia de la vida) y banners de inicio. Las imágenes van al NAS en `negocios-verdes/sitio-assets/`; al cambiar o quitar una se borra la anterior. |

Cada cambio queda en la auditoría documental con quién lo hizo.

## Correos del negocio

Cada negocio tiene **Correo** y **Correo secundario** (opcional), en «Datos públicos» de la ficha del panel.
Los dos se validan igual (sin espacios, una sola @, dominio completo) y el secundario no puede repetir el
principal. Si el negocio está publicado, ambos salen en «Información de contacto» de su ficha pública.
«Revisión de datos» también señala los correos secundarios mal escritos.

## Sitio público: páginas

| Ruta | Contenido |
|---|---|
| `/negocios-verdes` | Inicio con buscador (texto sin tildes, municipio, clasificación, reconocimiento). |
| `/negocios-verdes/negocio/<slug>` | Ficha del negocio, con datos estructurados (schema.org LocalBusiness) para buscadores. |
| `/negocios-verdes/geovisor` | Mapa con los negocios (colores por categoría, agrupados), filtros, 8 capas de referencia (`public/geo`: municipios, áreas protegidas, páramos, veredas, hidrografía, AICA, bosque seco, subzonas), mi ubicación, enlace de la vista y descarga CSV/GeoJSON de lo visible. Solo se dibujan coordenadas dentro de la jurisdicción. |
| `/negocios-verdes/geovisor/embed` | El mismo mapa para incrustar con `<iframe>` en páginas de `cdmb.gov.co` (CSP `frame-ancestors` en `next.config.ts`). |
| `/negocios-verdes/nosotros`, `/plan-nacional`, `/contacto` | Páginas fijas de la plataforma anterior. La clasificación de «¿Qué son?» se lee de la base. |
| `/negocios-verdes/sitemap.xml`, `/robots.txt` | Para buscadores; el sitemap queda vacío mientras el sitio esté apagado. |

No se trasladaron del geovisor anterior: medición de distancias y áreas, reporte HTML y descarga del mapa en PNG.

## Dominio anterior

Cuando TI publique `sic.cdmb.gov.co` con certificado, el dominio anterior se redirige con `deploy/nginx/negocios-verdes-dominio-anterior.conf` (no está activo). Las rutas se conservan con el prefijo `/negocios-verdes`, incluidas `/negocio/<slug>` y `/buscar?…` (que pasa el filtro al buscador). `/admin` va al sitio público: el panel no se publica en internet.

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

## Dirección pública (QR y enlaces)

Los QR de las fichas, el botón «Compartir», el enlace de vista y las descargas del geovisor, el
sitemap y robots usan `URL_PUBLICA_NV` (en el `.env` de la VM). Vacía, cada persona recibe la
dirección por la que entró. Mientras no haya certificado se puede poner, por ejemplo,
`URL_PUBLICA_NV="http://sic.cdmb.gov.co"`; cuando exista, `URL_PUBLICA_NV="https://sic.cdmb.gov.co"`.
Ojo: hoy nginx manda toda petición http a https (`deploy/nginx/tramites`), así que una dirección
http solo evita el aviso del navegador si nginx deja de redirigir /negocios-verdes.

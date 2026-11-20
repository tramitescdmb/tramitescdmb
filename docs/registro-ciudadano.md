# Registro liviano del ciudadano y «Mis solicitudes»

Vista pública https://sic.cdmb.gov.co/solicitud-ambiental. Fecha: 20 de noviembre de 2026.

## Objeto

Permitir que el ciudadano entre con su correo, vea todas sus solicitudes ambientales con su estado, etapa e historial, y corrija documentos en el mismo expediente cuando la CDMB los devuelva, sin empezar de cero.

## Decisiones de diseño

| Tema | Decisión |
|---|---|
| Ingreso | Sin contraseña: código de 6 dígitos al correo (vence en 10 minutos, 5 intentos, un solo uso; se guarda solo su HMAC). Registro e ingreso son el mismo paso. |
| Cuenta | Tabla propia `CuentaCiudadana`, separada de los usuarios internos. No da acceso a nada interno. Cookie propia `cdmb_ciudadano` (aleatoria; en la base solo su SHA-256), 4 horas, se cierra con «Salir». |
| Datos de la cuenta | Correo verificado, persona natural o jurídica, cédula o NIT (se fija una vez), nombre, teléfono, aceptación de tratamiento de datos (Ley 1581). |
| Qué ve | Solo expedientes vinculados a su cuenta: los que radica con la sesión abierta, los que ya había radicado en línea con el mismo correo y la misma cédula o NIT (vínculo automático) y los que agrega con el número SL- (exige que la cédula o NIT del expediente sea la de la cuenta). |
| Seguimiento sin cuenta | Se mantiene igual: cédula o NIT + número SL-/SA-. Radicar sin cuenta sigue permitido. |
| Historial | Frases fijas por tipo de evento (radicada, etapa completada, cambio de estado, archivado, reabierto). Nunca la descripción interna; no se muestran notas internas, asignaciones, firmas ni visitas. |
| Documentos | Solo los que radicó el propio solicitante (no conceptos ni actos internos). |

## Anti-spam (sin servicios externos)

- Prueba anti-robots propia: el navegador resuelve una prueba de trabajo (SHA-256, 15 bits, menos de un segundo) firmada por el servidor con vigencia de 10 minutos.
- Campo trampa y tiempo mínimo de llenado (ya existían en radicación).
- Límites por IP (código 10/hora, verificar 20/hora, vincular 10/hora) y por correo (3 códigos cada 15 minutos, 10 al día).
- Tope de archivos ya vigente: 2 MB (planos 10 MB), 40 documentos por solicitud.

## Seguridad

- Sin enumeración: la respuesta al pedir código es idéntica exista o no la cuenta; los errores de código y de vínculo son genéricos.
- Tokens de un solo uso con vencimiento; claves HMAC derivadas por propósito de la clave de sesión existente (no se rota ni se agrega ningún secreto).
- Comprobación de origen en todos los envíos, además de SameSite=Lax.
- Con la sesión abierta solo se radica a nombre de la cédula o NIT de la cuenta.
- Cada vínculo manual queda en la bitácora de auditoría.

## Pantallas

1. `/solicitud-ambiental/ingresar`: correo → código.
2. `/solicitud-ambiental/mis-solicitudes`: primer ingreso pide completar datos; luego lista con estado, etapa «N de M», fechas; formulario «¿Radicó antes sin cuenta?».
3. `/solicitud-ambiental/mis-solicitudes/[id]`: estado y explicación, etapas del procedimiento, historial, documentos radicados, aviso si se requiere información.
4. Formulario de radicación: con sesión, la cédula, el tipo y el correo vienen de la cuenta; sin sesión, invita a ingresar.

## Etapa 2: devolución para corrección (siguiente PR)

- En la ficha interna, botón «Devolver para corrección»: el funcionario marca los documentos que están mal o faltan y escribe, por cada uno, el motivo que verá el ciudadano; fija el plazo (por defecto un mes, art. 17 CPACA, configurable).
- El expediente pasa a «Información adicional requerida» (estado existente), con evento en la Historia y correo al ciudadano con enlace a su solicitud.
- El ciudadano ve la lista de lo pendiente y reemplaza solo esos documentos (NAS, misma carpeta por módulo/año/tipo; la versión anterior se conserva y queda enlazada) o agrega los faltantes; al enviar, el expediente vuelve a la cola con aviso al responsable.
- Vencido el plazo, el sistema solo avisa a la CDMB; el desistimiento tácito lo decide la entidad, nunca de forma automática.
- Tablas nuevas previstas: `RequerimientoCorreccion` (expediente, plazo, estado, quién) y `ItemCorreccion` (documento o requisito, motivo público, documento de reemplazo).

## Fase posterior opcional

Autenticación Digital de MinTIC como segundo método de ingreso, sin cambiar las cuentas.

## Riesgos y pendientes

- Si el correo institucional no está configurado o falla, nadie recibe el código (el error queda en el registro del servidor).
- Expedientes radicados en ventanilla o desde VITAL no aparecen en la cuenta (no tienen número SL-); se puede añadir luego un vínculo con un número que entregue la ventanilla.
- Cambio de esquema: requiere despliegue manual.

## Perfil del ciudadano

- Tras el primer ingreso se pide el perfil completo, con el mismo estándar de datos de persona del resto del sistema (`CamposPersona`): tipo de persona, tipo y número de documento, nombres y apellidos o razón social, representante legal (persona jurídica), correo alterno, celular y teléfono, dirección, departamento y municipio de notificación, régimen tributario y gran contribuyente. Se suman el tipo de usuario (caracterización) y la autorización de notificación electrónica (art. 56 CPACA, con fecha).
- Las cuentas creadas antes deben completarlo al volver a «Mis solicitudes» y antes de radicar.
- «Mi perfil» (`/solicitud-ambiental/mis-solicitudes/perfil`) permite editarlo. El tipo y el número de documento no se cambian desde la cuenta.
- Cambio de correo: código de 6 dígitos al correo nuevo (propósito `CAMBIO_CORREO`, atado a la cuenta, 10 min, 5 intentos, un uso). La respuesta es la misma aunque el correo esté ocupado. El correo anterior recibe un aviso.
- Auditoría: cada guardado registra en la bitácora (`CuentaCiudadana`, CREA o MODIFICA) qué campos cambiaron, sin sus valores. El cambio de correo también queda registrado.
- La radicación se precarga con los datos del perfil.

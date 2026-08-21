# Esquema de datos — Trámites CDMB

Cada archivo `data/tramites/<CODIGO>.json` describe UN procedimiento (trámite) extraído de su PDF
en `procedimientos/`, siguiendo la plantilla estándar del SIGC de la CDMB (Objeto, Alcance,
Autoridad y Responsabilidad, Instrucciones en tabla No./Descripción/Responsable/Documentos-Registros,
tiempos por actividad, Anexos).

Este JSON es la fuente de verdad que se importa a la base de datos (ver `prisma/schema.prisma` y
`prisma/seed.ts`). El motor de la aplicación es genérico: NO se escribe código específico por
trámite, todo sale de estos archivos.

## Forma del objeto

```jsonc
{
  "codigo": "M-DA-PR05",              // Código del documento tal como aparece en el PDF
  "version": "13",
  "fecha": "2023-12-28",              // ISO yyyy-mm-dd (convertida de dd/mm/yyyy)
  "proceso": "EVALUACIÓN Y CONTROL A LA DEMANDA AMBIENTAL", // Área/proceso responsable (encabezado)
  "nombre": "Permiso de Vertimientos",          // Nombre corto, legible, Title Case (para UI)
  "nombreCompleto": "PROCEDIMIENTO PERMISO DE VERTIMIENTOS", // Título tal cual aparece en la portada
  "slug": "permiso-vertimientos",     // kebab-case, único, derivado del nombre corto
  "archivoFuente": "M-DA-PR05 version 13.pdf", // nombre de archivo en procedimientos/
  "objeto": "...",                    // Sección "1. OBJETO" (texto completo)
  "alcance": "...",                   // Sección "2. ALCANCE"
  "autoridadResponsabilidad": "...",  // Sección "4. AUTORIDAD Y RESPONSABILIDAD"
  "documentosRequeridos": [           // Checklist inicial para radicar (normalmente listado dentro
                                       // de la actividad 1 del primer flujo, o de una sección de
                                       // "Requisitos"). Es lo que el usuario debe subir al crear un
                                       // expediente.
    {
      "orden": 1,
      "nombre": "Formulario Único Nacional de Permiso de Vertimientos",
      "obligatorio": true,
      "notas": null
    }
  ],
  "flujos": [                         // Uno por cada subsección "7.X INSTRUCCIONES ..."
                                       // (ej: inicio, renovación, modificación, cesión...)
    {
      "codigo": "inicio",             // slug corto: inicio | renovacion | modificacion | cesion | ...
      "nombre": "INICIO TRÁMITE",     // tal como aparece en el PDF
      "esFlujoInicial": true,         // true = se usa al crear un expediente nuevo ("Nuevo trámite")
      "pasos": [
        {
          "numero": 1,
          "titulo": "RECIBIR, REVISAR Y RADICAR LA SOLICITUD",
          "descripcion": "Texto resumido de la actividad (sin perder el sentido, se puede\nabreviar prosa larga, pero conservar cifras/plazos/artículos citados).",
          "responsables": ["Servidor responsable de Ventanilla de trámites ambientales"],
          "documentos": ["Solicitud del usuario radicada", "Formulario Único Nacional de Permiso de Vertimientos"],
          "tiempo": "1 día hábil",
          "tiempoDias": 1,             // entero, null si no aplica/variable
          "esDecision": false,
          "opciones": null             // si esDecision=true: [{"respuesta":"Sí","siguientePaso":8},{"respuesta":"No","siguientePaso":null,"resultado":"DESISTIDO"}]
        }
      ]
    }
  ]
}
```

## Reglas de extracción

1. **Fuente de verdad = tabla "7. INSTRUCCIONES"** (columnas No. / Descripción de la actividad /
   Responsable / Documentos-Registros), NO el diagrama de flujo gráfico (es una imagen redundante
   de la misma tabla; no hace falta interpretarla visualmente).
2. Un paso puede abarcar varias páginas del PDF — se une por continuidad del número "No.".
3. `tiempo` se toma de la línea "Tiempo: ..." o "Término: ..." dentro de la actividad, si existe.
4. Pasos que son pregunta de decisión (ej. "¿EL INTERESADO PRESENTÓ LA INFORMACIÓN ADICIONAL?")
   se marcan `esDecision: true` y se listan sus ramas en `opciones` cuando el texto lo permite
   inferir con confianza; si no es inequívoco, dejar `opciones: null` y mantener el texto completo
   en `descripcion`.
5. Si el documento tiene varias subsecciones de instrucciones (7.1, 7.2, 7.3...) cada una es un
   `flujo` independiente. El primero (alta/inicio de trámite nuevo) lleva `esFlujoInicial: true`;
   el resto (renovación, modificación, cesión, etc.) `false`.
6. Codificación: los PDF a veces extraen texto con letras dobladas por negrita
   (`PPRROOCCEEDDIIMMIIEENNTTOO`) — deben normalizarse. Ver colapso de pares idénticos consecutivos.
7. Mantener SIEMPRE tildes y ñ correctamente (UTF-8). Revisar visualmente el JSON final.
8. `documentosRequeridos`: extraer del listado numerado de requisitos en la actividad 1 del flujo
   inicial (o sección "Requisitos" si existe aparte). Si el trámite distingue requisitos por
   subcaso (ej. vertimiento a cuerpo de agua vs. al suelo), usar el campo `notas` de cada ítem para
   indicar la condición.
9. No hace falta transcribir "6. TERMINOLOGÍA" ni "5. DOCUMENTACIÓN DE REFERENCIA O SOPORTE" ni
   "8. ANEXOS" (formatos/minutas internas) en el JSON — no se usan en la UI de gestión.

## Ejemplo de referencia completo

Ver [`tramites/M-DA-PR05.json`](tramites/M-DA-PR05.json) (Permiso de Vertimientos) — extraído a mano
como patrón de referencia para los demás.

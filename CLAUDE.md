# CLAUDE.md — GymGrecia

Contexto estable del proyecto para asistentes (Claude Code). Para **el estado en curso y los próximos pasos**, lee `SESSION_LOG.md`.

## Qué es
App web **local y offline** para gestionar socios y cuotas de un gimnasio pequeño (actividades: gimnasio, karate, pilates). Sustituye archivadores de papel: registra pagos, avisa de quién está atrasado / vence pronto / al día, y emite recibos. Usuario **no técnico** (se abre con doble clic en `GymGrecia.bat`).

## Cómo ejecutarla (IMPORTANTE)
- **Desarrollo** (al iterar la UI): `npm run dev` → Vite en http://localhost:5180 (recarga en caliente) + API en :4711.
- **Producción / "app de escritorio"**: `npm start` → `tsx server/index.ts`; sirve la web **compilada de `dist/`** + API en :4711.
- ⚠️ **Trampa clave**: `npm start` sirve `dist/`, NO el código fuente. Tras cambiar el **frontend** hay que `npm run build`; tras cambiar el **servidor** hay que **reiniciar** `npm start`. Si el usuario "no ve" un cambio, casi siempre es esto.
- `npm run typecheck` solo cubre el **web**. Para el servidor: `npx tsc -p tsconfig.json --noEmit`.
- `npm run test:filtros` ejecuta las pruebas (datos mockeados) de la lógica de filtrado de socios (`web/filtros.ts` es **pura** y testeable; el patrón vale para añadir más lógica testeable).
- `npm run test:ingresos` (`server/ingresos.pruebas.ts`) levanta un servidor REAL (puerto 4799, datos en carpeta temporal) y prueba por API las casuísticas de ingresos/cobertura (alta pendiente / cobrar-ahora / archivador, borrado de pagos, sin duplicidad). No está en `preversion` porque levanta servidor; córrelo a mano tras tocar pagos/suscripciones/métricas.
- **Entorno de pruebas**: `GymGrecia-MOCK.bat` abre la app con datos de mentira en `data-mock` (puerto 4712), sin tocar los reales. Por debajo: `GYM_DATA_DIR` cambia la carpeta de datos y `server/seed-mock.ts` (`npm run seed:mock`) genera ~60 socios. Para regenerar, borra `data-mock`.
- **Instalación en el PC del local** (sin git/VSCode): guía paso a paso en `INSTALAR.md` (instalar Node.js LTS, copiar carpeta, doble clic en `GymGrecia.bat`).

## Stack
React 18 + TS + Vite 6 (`web/`) · Node + Express 4 ejecutado con **tsx** (`server/`) · SQLite con **better-sqlite3**. Todo el estado vive en **un archivo**: `data/gymgrecia.db` (modo WAL). Copiar la carpeta `data/` a otro PC migra TODO.

## Estructura
- `server/`: `index.ts` (Express, rutas, static `dist`, copia automática al arrancar/cerrar) · `db.ts` (conexión `export let db` reabrible, esquema idempotente, migraciones suaves, `restaurarBaseDeDatos`) · `util.ts` (fechas ISO + estados de cuota) · `queries.ts` (filas → objetos enriquecidos) · `config.ts` (ajustes de email y datos de recibo en tabla `config`) · `correo.ts` (nodemailer) · `recibo.ts` (PDF con pdfkit) · `copias.ts` (backups) · `routes/` (socios, suscripciones, pagos, tarifas, dashboard, backups, ajustes).
- `web/`: `main.tsx` · `App.tsx` (layout + router + sidebar) · `pages/` (Panel, Socios, SocioDetalle, Tarifas, Copias, Ajustes) · `components/` (Modal, Confirmar, PagoModal, SocioFormModal, SuscripcionFormModal, Badges) · `api.ts` · `types.ts` · `format.ts` · `styles.css` (tema "templo griego").

## Modelo de datos (tablas)
`socios` (incl. `dni` opcional, `estado` activo|baja, `fecha_baja` desde v1.3: se apunta al dar de baja y se limpia al reactivar; bajas antiguas sin fecha) · `suscripciones` (1 socio→N; actividad, importe, periodicidad mensual|bono, `pagado_hasta`, `cobertura_manual`, `activa`) · `pagos` (cabecera) · `pago_lineas` (N por pago; copia `actividad` para informes) · `eventos` (desde v1.5: historial de movimientos por socio — `registrarEvento()` en `server/eventos.ts`, nunca rompe la operación principal; al estrenar la tabla se reconstruye de los datos existentes con `reconstruirEventos()` en `db.ts`; `socio_nombre` copiado y `ON DELETE SET NULL` para que sobreviva al borrado del socio) · `tarifas` (plantillas de precio) · `config` (clave/valor: `email.*`, `datos.*`).

## Lógica de dominio
El **estado de cuota se CALCULA** (no se guarda) desde `pagado_hasta` vs hoy (`util.ts` → `estadoDe`): pendiente / atrasado / pronto (≤7 días) / aldia. El `estadoResumen` del socio = el peor de sus subs activas. Un cobro puede pagar varias actividades; cada línea avanza `pagado_hasta` (solo adelanta, nunca retrocede). Filosofía: **agnóstica a ofertas** — se guarda el importe real cobrado; la app no calcula descuentos.
**Ingresos = SOLO la tabla `pagos`** (Panel y Métricas suman cobros por fecha). Una fecha de cobertura puesta a mano (alta «ya estaba pagado» del archivador, o edición) NO es un ingreso: se guarda además en `suscripciones.cobertura_manual` para (1) señalarla en la UI («apuntado a mano», aviso ⚠ en Métricas) y (2) restaurarla si se borra un pago posterior. El alta con **`cobroInicial`** (POST suscripciones) crea sub + pago real en una transacción; UI hace excluyentes «cobrar ahora» y «ya estaba pagado» para que no pueda duplicarse el mismo dinero.

## Convenciones
- `actividad` se guarda en minúsculas (server) y se muestra capitalizada. Conjunto conocido `ACTIVIDADES` en `web/api.ts` (gimnasio/karate/pilates), elegida con `<select>`.
- Fechas siempre ISO `YYYY-MM-DD` (`hoyISO` en hora local).
- Confirmaciones con `useConfirm()` (`web/components/Confirmar.tsx`), NO `confirm()` nativo.
- Banners: `.error-banner` (rojo) / `.ok-banner` (verde).

## Dependencias y cuidado con módulos nativos
- **better-sqlite3 en `^12.11.1`** (la 12.x SÍ trae binarios para Node 24; la 11.x no — fue el problema inicial, ya resuelto).
- ⚠️ **Registro npm**: hay un **`.npmrc` de proyecto** que fuerza el npm público (`registry.npmjs.org`). Es necesario porque el `.npmrc` GLOBAL de este equipo apunta al Artifactory de Inditex; sin el de proyecto, `npm install` grabaría URLs privadas en `package-lock.json` y la instalación fallaría en otros PC con `E401`. La 12.x de better-sqlite3 trae binario precompilado, así que `npm install` no necesita compilador (Visual Studio). Si reaparecen URLs `inditex` en el lock: `sed -i 's|https://inditex.jfrog.io/artifactory/api/npm/node-public/|https://registry.npmjs.org/|g' package-lock.json`.
- Libs JS puras añadidas: `nodemailer` (email), `pdfkit` (recibos).

## Versionado y publicación
- **SemVer** en `package.json` (arrancó en `1.0.0` por estar ya en producción). El número se ve en el **pie del sidebar** (inyectado en build con `define` de Vite → `__APP_VERSION__`; **recuerda que es build-time**: tras `npm version` hay que `npm run build` para que la UI lo refleje — el `Actualizar.bat` ya reconstruye).
- **Subir versión (un comando)**: `npm version patch|minor|major`.
  - `preversion` corre typecheck (web + server) y `test:filtros`; si algo falla, no se taggea.
  - `version` añade `CHANGELOG.md` al commit (edítalo ANTES, moviendo lo de `[Sin publicar]` a la nueva versión).
  - Crea el commit `vX.Y.Z` + tag, y `postversion` hace `git push --follow-tags`.
  - **Flujo típico de release**: 1) editar `CHANGELOG.md`; 2) `npm version minor` (sube, taggea y publica solo).
- **`npm run dist`**: genera `../GreciaGimnasio.zip` (build + `git archive`) como respaldo offline para USB. No es el canal habitual.
- **Actualizar el PC del gimnasio**: el dueño hace doble clic en **`Actualizar.bat`** → (1) **copia de seguridad** de toda la carpeta —**incluida `data/`**— al **Escritorio** en `GymGrecia-backup-vX.Y.Z_fecha` (omite `node_modules`/`dist`, que se regeneran; si la copia falla, aborta sin tocar nada); (2) **clona con git** la última `main` desde GitHub (clon superficial a `%TEMP%`); (3) la copia con `robocopy` **sin tocar `data/`** (ni `node_modules/`, ni el propio `Actualizar.bat`/`update-token.txt`) y reconstruye.
  - El repo es **privado**: `Actualizar.bat` usa un **token de solo lectura** que lee de **`update-token.txt`** (en `.gitignore`, nunca se sube) y lo inyecta en la URL de git (`https://x-access-token:TOKEN@github.com/...`). Es **no interactivo** (`GIT_TERMINAL_PROMPT=0`, sin credential helper), así que nunca abre ventanas de login.
  - ⚠️ **Por qué git y no la API "zipball"**: la versión anterior descargaba con `Invoke-WebRequest` desde `api.github.com/.../zipball/main`. Con un **fine-grained PAT** esa API devuelve **404** aunque el token sea válido y tenga acceso (GitHub oculta repos privados con 404, no con 403). El **mismo token funciona con git** (`git clone`/`ls-remote` sí lo aceptan), por eso se migró el mecanismo. Un token inválido/caducado sí daría un fallo real de autenticación en git.
  - **Bootstrap (una vez, lo hace el dev en el PC del local)**:
    1. **Instalar Git para Windows** (https://git-scm.com/download/win, opciones por defecto). Es el nuevo requisito.
    2. Crear el token: *fine-grained PAT* (acceso **solo** a `GreciaGimnasio`, **Contents: Read-only**) **o** *classic PAT* con scope `repo` (evita el paso de seleccionar el repo y puede ser **sin caducidad**). Pegar el token (solo el token, sin nada más) en `update-token.txt` junto a `Actualizar.bat`.
    3. El updater viejo (zipball) no puede entregarse a sí mismo el nuevo, así que la **primera vez** hay que copiar este `Actualizar.bat` git al PC del local a mano (USB). A partir de ahí, el dueño solo da doble clic.
  - Cuando el token caduque, repetir (un *classic PAT* sin caducidad evita repetir, a cambio de mayor alcance del secreto).

## Funcionalidades implementadas
Panel · Socios (CRUD + búsqueda) · SocioDetalle (actividades, pagos, baja/reactivar, recibos) · Tarifas · **Copias de seguridad** (auto + manual + restaurar; `db.backup()` consistente con WAL) · **Avisos por email** (SMTP en Ajustes) · **Recibos PDF** (descargar / enviar; datos fiscales configurables; recibo↔factura + IVA opcional).

## Notas de negocio / legal
Por defecto se emite un **Recibo** (justificante de pago), configurable a **Factura** con IVA en Ajustes. El tratamiento de IVA/factura depende del régimen fiscal del gimnasio → a confirmar con su gestor. El DNI/NIF del socio sale en el recibo si está en su ficha.

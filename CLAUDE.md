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
- **Entorno de pruebas**: `GymGrecia-MOCK.bat` abre la app con datos de mentira en `data-mock` (puerto 4712), sin tocar los reales. Por debajo: `GYM_DATA_DIR` cambia la carpeta de datos y `server/seed-mock.ts` (`npm run seed:mock`) genera ~60 socios. Para regenerar, borra `data-mock`.
- **Instalación en el PC del local** (sin git/VSCode): guía paso a paso en `INSTALAR.md` (instalar Node.js LTS, copiar carpeta, doble clic en `GymGrecia.bat`).

## Stack
React 18 + TS + Vite 6 (`web/`) · Node + Express 4 ejecutado con **tsx** (`server/`) · SQLite con **better-sqlite3**. Todo el estado vive en **un archivo**: `data/gymgrecia.db` (modo WAL). Copiar la carpeta `data/` a otro PC migra TODO.

## Estructura
- `server/`: `index.ts` (Express, rutas, static `dist`, copia automática al arrancar/cerrar) · `db.ts` (conexión `export let db` reabrible, esquema idempotente, migraciones suaves, `restaurarBaseDeDatos`) · `util.ts` (fechas ISO + estados de cuota) · `queries.ts` (filas → objetos enriquecidos) · `config.ts` (ajustes de email y datos de recibo en tabla `config`) · `correo.ts` (nodemailer) · `recibo.ts` (PDF con pdfkit) · `copias.ts` (backups) · `routes/` (socios, suscripciones, pagos, tarifas, dashboard, backups, ajustes).
- `web/`: `main.tsx` · `App.tsx` (layout + router + sidebar) · `pages/` (Panel, Socios, SocioDetalle, Tarifas, Copias, Ajustes) · `components/` (Modal, Confirmar, PagoModal, SocioFormModal, SuscripcionFormModal, Badges) · `api.ts` · `types.ts` · `format.ts` · `styles.css` (tema "templo griego").

## Modelo de datos (tablas)
`socios` (incl. `dni` opcional, `estado` activo|baja) · `suscripciones` (1 socio→N; actividad, importe, periodicidad mensual|bono, `pagado_hasta`, `activa`) · `pagos` (cabecera) · `pago_lineas` (N por pago; copia `actividad` para informes) · `tarifas` (plantillas de precio) · `config` (clave/valor: `email.*`, `datos.*`).

## Lógica de dominio
El **estado de cuota se CALCULA** (no se guarda) desde `pagado_hasta` vs hoy (`util.ts` → `estadoDe`): pendiente / atrasado / pronto (≤7 días) / aldia. El `estadoResumen` del socio = el peor de sus subs activas. Un cobro puede pagar varias actividades; cada línea avanza `pagado_hasta` (solo adelanta, nunca retrocede). Filosofía: **agnóstica a ofertas** — se guarda el importe real cobrado; la app no calcula descuentos.

## Convenciones
- `actividad` se guarda en minúsculas (server) y se muestra capitalizada. Conjunto conocido `ACTIVIDADES` en `web/api.ts` (gimnasio/karate/pilates), elegida con `<select>`.
- Fechas siempre ISO `YYYY-MM-DD` (`hoyISO` en hora local).
- Confirmaciones con `useConfirm()` (`web/components/Confirmar.tsx`), NO `confirm()` nativo.
- Banners: `.error-banner` (rojo) / `.ok-banner` (verde).

## Dependencias y cuidado con módulos nativos
- **better-sqlite3 en `^12.11.1`** (la 12.x SÍ trae binarios para Node 24; la 11.x no — fue el problema inicial, ya resuelto).
- ⚠️ **Registro npm**: hay un **`.npmrc` de proyecto** que fuerza el npm público (`registry.npmjs.org`). Es necesario porque el `.npmrc` GLOBAL de este equipo apunta al Artifactory de Inditex; sin el de proyecto, `npm install` grabaría URLs privadas en `package-lock.json` y la instalación fallaría en otros PC con `E401`. La 12.x de better-sqlite3 trae binario precompilado, así que `npm install` no necesita compilador (Visual Studio). Si reaparecen URLs `inditex` en el lock: `sed -i 's|https://inditex.jfrog.io/artifactory/api/npm/node-public/|https://registry.npmjs.org/|g' package-lock.json`.
- Libs JS puras añadidas: `nodemailer` (email), `pdfkit` (recibos).

## Funcionalidades implementadas
Panel · Socios (CRUD + búsqueda) · SocioDetalle (actividades, pagos, baja/reactivar, recibos) · Tarifas · **Copias de seguridad** (auto + manual + restaurar; `db.backup()` consistente con WAL) · **Avisos por email** (SMTP en Ajustes) · **Recibos PDF** (descargar / enviar; datos fiscales configurables; recibo↔factura + IVA opcional).

## Notas de negocio / legal
Por defecto se emite un **Recibo** (justificante de pago), configurable a **Factura** con IVA en Ajustes. El tratamiento de IVA/factura depende del régimen fiscal del gimnasio → a confirmar con su gestor. El DNI/NIF del socio sale en el recibo si está en su ficha.

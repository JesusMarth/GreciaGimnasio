# SESSION_LOG — GymGrecia

Bitácora para **retomar el proyecto en un chat nuevo sin tener que re-explicar nada**. Léela junto a `CLAUDE.md` (mapa estable del proyecto).

## 🚀 Cómo retomar en un chat nuevo
1. El proyecto está en **`C:\Users\JesusMartin\GreciaGimnasio`**. (La sesión de Claude suele abrirse desde `C:\Dev\n8n-qa-playwright`; **este proyecto es independiente** — ábrelo/apúntalo explícitamente.)
2. Lee **`CLAUDE.md`**: stack, estructura, modelo de datos, convenciones y las **trampas** (la principal: `npm start` sirve `dist/`, así que tras tocar el **front** hay que `npm run build`, y tras tocar el **servidor**, reiniciar).
3. Lee aquí **Estado actual** y **Para la próxima sesión**.
4. Comandos: `npm run dev` (desarrollo con recarga) · `npm start` (producción) · `npm run build` · `npm run typecheck` (web) · `npx tsc -p tsconfig.json --noEmit` (server) · `npm run test:filtros` (tests de filtros) · `npm run seed:mock` (datos de prueba).

## ✅ Estado actual (YA DESPLEGADO)
- La app **ya está instalada y funcionando en el PC del gimnasio** (se abre con `GymGrecia.bat`). ZIP de distribución verificado en `C:\Users\JesusMartin\GreciaGimnasio.zip` (incluye mock; lock 100% público; probado con subagentes: instala en un PC con solo **Node 22 LTS**).
- Funcionalidades completas: **Panel** (montones + ingresos del mes con ojo + tarjetas que llevan a Socios filtrado) · **Socios** (CRUD, búsqueda, filtros actividad/estado/cuota/fecha-de-alta, paginación que se ajusta a la pantalla, export Excel adaptado a la selección/filtro) · **Ficha de socio** (actividades, baja/reactivar, pausar actividad, historial de pagos con scroll interno, recibos) · **Tarifas** · **Copias** (auto + manual + restaurar) · **avisos por email** (SMTP) · **recibos PDF** · **export Excel** · **ayuda "?"** por pantalla · **entorno MOCK** (`GymGrecia-MOCK.bat`, ~60 socios en `data-mock`, puerto 4712).
- Dependencias (todas JS puro): `better-sqlite3` 12.x, `nodemailer`, `pdfkit`, `exceljs`. Hay un **`.npmrc` de proyecto** que fuerza el npm público (mantiene el lock portable).
- **Versionado SemVer en marcha** (arrancado en **`1.0.0`**): `npm version` sube+commitea+taggea+pushea en un comando; la versión se ve en el pie del sidebar; `Actualizar.bat` actualiza el PC del local en un clic. Ver el registro de hoy y `CLAUDE.md` → "Versionado y publicación".

## 🎯 Para la PRÓXIMA sesión

### A) Versionado correcto + automatizarlo ✅ HECHO (2026-06-26)
Implementado tal cual (ver registro de hoy). SemVer desde `1.0.0`, `npm version`
con push automático, versión en el sidebar (Vite `define`), `npm run dist` (ZIP de
respaldo) y **`Actualizar.bat`** (canal real de actualización del PC del local, con
token de solo lectura en `update-token.txt`). `CHANGELOG.md` manual.

### B) Sexo del socio (hombre/mujer) + nuevo filtro  ← SIGUIENTE
Replica el patrón con el que se añadió `dni` y el de los filtros existentes. Checklist:
1. **`server/db.ts`**: migración suave `ALTER TABLE socios ADD COLUMN sexo TEXT` (junto a la de `dni`). Valores: `hombre` | `mujer` | null.
2. **`server/queries.ts`**: `SocioRow` y `socioConResumen` → añadir `sexo`.
3. **`server/routes/socios.ts`**: POST y PUT → leer/guardar `sexo` (whitelist `hombre`|`mujer`; vacío = null).
4. **`web/types.ts`**: `Socio` → `sexo: string | null`.
5. **`web/components/SocioFormModal.tsx`**: selector Hombre/Mujer (opcional, al estilo del resto de campos).
6. **`web/filtros.ts`**: añadir `sexo: string[]` a `FiltrosSocios` y a `filtrarSocios` (OR como los demás). **Actualizar `web/filtros.pruebas.ts`** (datos mock + casos) y correr `npm run test:filtros`.
7. **`web/pages/Socios.tsx`**: nuevo grupo de chips "Sexo" (Hombre/Mujer), estado `filtroSexo`, init desde la URL (`?sexo=`), incluirlo en "Limpiar" y en el cálculo del export.
8. **`server/export.ts`**: columna "Sexo" en el informe.
9. (Opcional) mostrar el sexo en la ficha (tarjeta Datos).
10. Cerrar: typecheck web + server, `npm run test:filtros`, `npm run build`.
> Para probar con volumen, podrías hacer que `server/seed-mock.ts` asigne sexo aleatorio.

### Backlog (otras ideas, sin prisa)
- Enviar el recibo automáticamente al registrar el pago.
- Log de eventos (altas/bajas/pausas) → histórico de "tiempo inactivo".
- Filtrar por importe de cuota o por fecha de último pago (requiere traer esa fecha al listado de socios).
- Refactor de duplicados server↔web (`ddmmaaaa`/`fecha`, `cap`/`capitalizar`, mapas de estado) → carpeta `shared/`.

## 🧠 Decisiones / contexto que recordar
- App **local, offline, un solo PC**, usuario no técnico. Todo el estado en **un archivo** `data/gymgrecia.db`; portabilidad = copiar la carpeta `data`. `GYM_DATA_DIR` cambia esa carpeta (lo usa el mock).
- **Recibo** por defecto (no factura); IVA sin desglosar salvo configuración. Validez fiscal/IVA → a confirmar con el gestor.
- Avisos: descartado el **bot de WhatsApp** (viola ToS, riesgo de baneo); elegido **email automático** (SMTP). El `wa.me` manual queda como opción si algún día se quiere.
- `actividad` se guarda en minúsculas y se muestra capitalizada. Los **estados de cuota se calculan** (no se guardan): "Sin pagar" = morado (nunca pagó) · "Atrasado" = rojo (venció) · "Vence pronto" = ámbar (≤7 días) · "Al día" = verde.
- ⚠️ **Al añadir dependencias**: con el `.npmrc` de proyecto ya se instala del npm público y el lock queda portable. Si alguna vez reaparece `inditex` en `package-lock.json`, arreglar con:
  `sed -i 's|https://inditex.jfrog.io/artifactory/api/npm/node-public/|https://registry.npmjs.org/|g' package-lock.json`

## 📋 Registro (más reciente arriba)

### 2026-07-09 (2) · Exclamación de aviso + historial de movimientos (v1.5.0)
- **Feedback**: la marca «a mano» en la lista quedaba fea → sustituida por una
  **exclamación ámbar** en columna propia junto al nombre, con semántica GENÉRICA
  («algo pasa con este socio», detalle en el tooltip). `avisosDe(socio)` en
  `Socios.tsx` es una lista abierta: los avisos futuros se añaden ahí y salen por
  la misma exclamación. ⚠ La tabla usa `table-layout: fixed` con anchos por
  `nth-child`: al insertar la columna hubo que recorrerlos (documentado en el CSS).
- **Historial de movimientos** (petición del jefe: "que todo quede registrado"):
  - Tabla `eventos` (socio_id `ON DELETE SET NULL` + `socio_nombre` copiado → el
    historial sobrevive si se borra el socio) + `registrarEvento()` en
    `server/eventos.ts` (try/catch: el historial nunca rompe la operación).
  - Instrumentado: alta/edición de ficha/baja/reactivar/borrar socio · alta de
    actividad (con los 3 arranques descritos) · edición con diff (cuota,
    pagado-hasta a mano, actividad) · pausar/reactivar/quitar · **cobro** (importe,
    método, líneas y cobertura) · **pago borrado** (con lo que valía y de cuándo
    era) · recibo enviado · aviso por email.
  - **Reconstrucción del pasado**: al estrenar la tabla (o al regenerar el mock),
    `reconstruirEventos()` crea el historial desde lo que la BD conserva (altas,
    actividades, pagos, bajas con fecha), marcado "(reconstruido)" y sin hora.
    Lo borrado antes de v1.5 NO se puede recuperar salvo forense de backups.
  - **UI**: botón **«Movimientos»** en la ficha → modal con línea de tiempo
    (punto de color por tipo, fecha·hora en mono). GET `/api/socios/:id/eventos`.
- Verificado en vivo (mock): cobro+borrado dejan eventos con hora; reconstruidos
  sin hora; modal OK; exclamaciones en lista sin descuadrar columnas (fix de
  anchos verificado). `test:ingresos` ampliado a **35 checks** (5 de eventos).
  Publicado como **v1.5.0**.

### 2026-07-09 · Socios auditables: filtro «apuntado a mano» + navegación que no se pierde
- **Contexto (jefe)**: v1.3.0 ya desplegada en el local con datos reales, pero "las
  cifras del papel y de la app no cuadran" y auditar era un castigo: al entrar en
  una ficha y volver, la tabla volvía arriba y tocaba re-buscar. **No se tocó ni un
  dato**: el descuadre es dinero cobrado en papel que nunca entró en la app; la
  solución es poder ENCONTRAR cada caso y corregirlo socio a socio (registrar su
  siguiente pago; desde ahí cuadra solo).
- **Filtro nuevo Cobros → «Apuntado a mano»** (`web/filtros.ts` + pruebas): socios
  con cuota activa de cobertura manual **vigente** (al día o pronto) — EXACTAMENTE
  el criterio del aviso ⚠ de Métricas, que ahora enlaza «Ver quiénes son →»
  (`/socios?cobros=manual&estado=activo`; con `estado=activo` porque Métricas solo
  cuenta activos — sin él salía 9 vs 8 por un socio de baja con cuota manual).
  Marca **«a mano»** en la fila (solo si la cobertura manual sigue vigente; si
  venció es un atrasado normal y no lleva marca ni entra en el filtro).
- **Botón «Filtros» desplegable** (`Socios.tsx` + CSS `.filtros-panel`): búsqueda
  siempre visible; el resto de grupos (Actividad/Estado/Cuota/Cobros/Sexo/Alta) en
  panel plegable animado con contador de filtros activos. Se abre solo si la URL
  trae filtros.
- **La tabla recuerda dónde estabas** (`sessionStorage gym_socios_ui`): búsqueda,
  filtros, orden, nº de filas cargadas y scroll exacto se restauran al volver de
  una ficha. La URL con filtros (enlaces de Panel/Métricas) SIEMPRE manda sobre lo
  recordado. Detalle clave: el efecto "al cambiar filtros → scroll arriba" se salta
  el primer render para no pisar la restauración.
- Verificado en vivo (mock): Métricas ⚠ 8 → clic → 8 filtrados con chips puestos;
  scroll a 1200px + entrar en ficha + Volver → 1200px y 60 filas restauradas;
  `/socios?cuota=pendiente` ignora lo guardado. Tests: filtros (+9 casos), ingresos
  30/30, typecheck, build. **Publicado como v1.4.0** (tag + push).

### 2026-07-08 (2) · Métricas REDISEÑADA (handoff de diseño)
- Reimplementada la pantalla según **`design/Metricas Rediseño.dc.html`** (prototipo
  con la lógica en su clase `Component`; los colores del diseño ya coincidían 1:1
  con las variables de `styles.css`).
- **Server (`metricas.ts` reescrito)**: `?actividad=` (importes desde `pago_lineas`
  de esa actividad; nPagos/socios = pagos que la incluyen) · `serie[].porActividad`
  (desglose apilado) · `serie[].retencion` (∩ de socios que pagan M-1 y M, cargado
  una vez en un Map mes→Set) · `serieAnterior` (mismo rango −12, elemento a
  elemento) · `proyeccion` del mes en curso (cobrado/día·díasMes) · `retencionMedia`
  · `bajas` por mes vía **columna nueva `socios.fecha_baja`** (migración en `db.ts`;
  se escribe en el PUT de socios al cambiar estado; bajas antiguas sin fecha no se
  inventan) · `porActividadAnterior` (tendencia del reparto). `mejorMes` sigue en la
  respuesta por compat aunque la UI nueva no lo pinta.
- **Web (`Metricas.tsx` reescrito)**: filtros en tarjeta de 2 filas (presets + chips
  de año generados del historial + «A medida…» plegable animando `max-width` sin
  saltos de altura) · chips de actividad con punto de color · persistencia en
  `localStorage gym_metricas_filtros_v2` · KPIs con `useContador` (Ingresos+delta
  interanual, Mes en curso con proyección, Socios activos con neto, Retención
  media) · gráfica con barras apiladas, fantasma del año anterior (76% de ancho),
  tramo rayado de proyección, línea de retención SVG (escala 60–100, animación de
  trazo), tooltip con desglose y comparativa, media dorada · espejo altas/bajas ·
  barras por actividad clicables (atenúa no seleccionadas) · Estado de cuotas +
  aviso de cobertura manual se mantienen. CSS: bloque nuevo «MÉTRICAS v2» al final
  de `styles.css`. `AyudaMetricas` con los textos del modal de referencia.
- **Verificado**: typecheck web+server · test:filtros · **test:ingresos ampliado a
  30 checks** (desglose suma=total, filtro actividad, proyección, bajas con fecha,
  serieAnterior alineada) · build · y en vivo sobre el mock: cuadre a mano de los
  8 meses apilados contra `SUM(pagos)`, retención jun-2026 = 78% (21/27 recontado
  en BD), cambio de pestaña SIN re-nacer (mismo nodo DOM, transición), «A medida»
  no salta la tarjeta a ancho de escritorio (sí envuelve en ventanas muy estrechas,
  como el prototipo), filtro Karate de punta a punta, recarga conserva filtros+ojo,
  tooltip con desglose, baja→espejo (+1 jul) y reactivar→0.
- **Iteración con feedback**: pestaña «Socios que pagan» → **«Socios»**; ayuda «?»
  reescrita con tono natural; **seed mock multianual** (hasta ~30 meses de pagos con
  huecos → retención variable, bajas con `fecha_baja`, 800 pagos) para ver todas las
  casuísticas: comparativa interanual con fantasmas, chips 2024/2025/2026, delta
  ▲108%, espejo con bajas. Verificado en vivo y **publicado como v1.3.0** (commit +
  tag + push; el PC del gimnasio se actualiza con `Actualizar.bat`).

### 2026-07-08 · Ingresos que no cuadraban: cobertura manual vs. pagos reales
- **Diagnóstico (queja del jefe "los ingresos no se reflejan bien")**: el campo
  "Pagado hasta (si ya tenía pagos)" del alta de actividad ponía al socio **al día
  sin crear ningún pago** → Panel/Métricas (que suman la tabla `pagos`) no veían
  ese dinero. Verificado por API con casuísticas A–G (alta sin nada = "Sin pagar"
  correcto; alta con fecha = al día con 0 €; no había duplicidad real). Bug extra
  encontrado: **borrar un pago recalculaba `pagado_hasta` solo con las líneas
  restantes** y perdía la cobertura manual del alta (socio pasaba a "Sin pagar").
- **Arreglo**:
  - Columna nueva **`suscripciones.cobertura_manual`** (migración suave en `db.ts`
    que además clasifica las BDs existentes: cobertura más allá de lo que
    justifican las líneas de pago = manual).
  - **POST suscripciones acepta `cobroInicial {metodo, fecha?, meses?}`**: crea
    sub + pago + línea en una transacción (ingreso real). `pagadoHasta` manual y
    `cobroInicial` son excluyentes en la UI → no hay forma de duplicar dinero.
  - **Modal "Añadir actividad"**: chips **Queda pendiente / Cobrar ahora / Ya
    estaba pagado** con textos que explican qué cuenta en Ingresos. En edición,
    hint de que cambiar la fecha a mano no apunta cobros.
  - **DELETE pago**: recalcula con `max(líneas restantes, cobertura_manual)`.
  - **Visibilidad**: ficha → «apuntado a mano» en la cuota; Métricas → aviso ⚠
    "N socios al día sin cobro registrado"; ayudas "?" actualizadas.
  - **`npm run test:ingresos`** (`server/ingresos.pruebas.ts`): servidor real en
    puerto 4799 + carpeta temporal, 21 comprobaciones (papel no genera ingresos
    pero queda marcado; cobrar-ahora sí; sin duplicidad; borrar pago restaura la
    cobertura del papel; métricas == dashboard). NO está en `preversion` (levanta
    servidor); correrlo a mano antes de publicar.
  - **seed-mock**: ~25% de las cuotas cubiertas ahora son "del archivador" (sin
    pagos), para reproducir los datos reales. `data-mock` regenerado.
- Verificado: typecheck web+server, test:filtros, test:ingresos, build, migración
  probada sobre una BD con esquema viejo, y **UI en vivo** (mock): aviso en
  Métricas (10 socios), «apuntado a mano» en ficha, alta con "Cobrar ahora" desde
  el navegador → pago en historial y al día.
- **Pendiente / decisión de negocio**: los socios del archivador seguirán sin
  aparecer en Ingresos (ese dinero se cobró fuera de la app, contarlo AHORA sería
  falsear el mes). Si el jefe quiere "migrarlos", que registre su próximo cobro
  normal: desde ahí todo cuadra solo. Próxima sesión: repaso de Métricas con él.

### 2026-07-07 (4) · Métricas: gráfica con modos + animaciones + "Socio"
- **Socios**: cabecera de columna "Nombre" → **"Socio"** (sigue ordenando por apellido).
- **Animaciones arregladas**: las barras usaban `@keyframes barGrow` (scaleX → crecían
  "de lado"). Nuevo **`barGrowY`** (scaleY, `transform-origin: bottom`) para `.gb`/`.ga-bar`
  → nacen desde abajo y suben, con stagger por `animationDelay`. **`useContador`**
  extraído a `web/anim.ts` (Panel y Métricas lo comparten); KPIs de Métricas ahora con
  **count-up + fundido** y el **ojo con fundido** (`.fade-suave`, patrón del Panel).
- **Gráfica con 3 modos** (pestañas): **Ingresos** · **Socios** (distintos que pagaron
  ese mes) · **€ por socio** (ingresos/socios = retención). El eje, la media, el tooltip
  y el pie se adaptan; el ojo oculta el dinero pero NO los conteos de socios. Server:
  `serie[].socios = COUNT(DISTINCT socio_id)` por mes.
- Verificado en vivo: barras `barGrowY`, 3 modos con ejes/medias correctos (socios 24
  medio, €/socio 39,16 €), ojo respeta conteos, "Socio" en la tabla. Typecheck+build OK.

### 2026-07-07 (3) · Métricas: simplificar (feedback "muchas cosas confusas")
- **Fuera "cuota mensual esperada" (MRR) y toda la tarjeta de estado de cobro** (`ingresosMes`+`mrr` fuera del server, tipos y CSS `.cobro-*`).
- **Fuera "por método de cobro"** (ahora todo es efectivo): quitado `porMetodo` del server, tipo y UI. "Ingresos por actividad" pasa a ancho completo.
- **"Mejor mes" ahora es GLOBAL** (récord de todo el historial, `SELECT ... GROUP BY mes ORDER BY total DESC LIMIT 1`), NO reacciona al filtro. Antes se calculaba dentro del rango (confuso con rangos de 2 meses).
- **Historial**: el server ya expone `rango.dataDesde` (primer cobro) y la UI muestra **"Historial desde <mes>"** en la banda de periodo; es el suelo del selector.
- Verificado: con filtro ene–feb, "mejor mes" sigue siendo mar. 2026 (récord). Typecheck web+server OK, build OK.

### 2026-07-07 (2) · Métricas: filtro de periodo + métricas de negocio + fuera gastos
- Iteración sobre Métricas (feedback: "solo ingresos" + "filtros fecha y demás,
  actúa como diseñador de negocio").
- **Backend de gastos ELIMINADO** (quedó inactivo tras dejar Métricas solo-ingresos):
  fuera tabla `gastos` (`db.ts`), CRUD y agregación de gastos (`metricas.ts`), tipo
  `Gasto` y métodos `api.gastos/crearGasto/borrarGasto`, y campos `gastos/beneficio`.
- **`GET /api/metricas` ahora acepta rango**: `?desde=YYYY-MM&hasta=YYYY-MM` (o
  `?meses=N` por compat). Acota a datos reales; **"Todo" arranca en el primer cobro**
  (no en las altas, que pueden ser antiguas). Nuevos campos en la respuesta:
  `rango{desde,hasta,meses,dataDesde,dataHasta}`, `periodoAnterior` (mismo rango 12
  meses antes, para comparativa interanual), `ingresosMes` (cobrado en el mes) y
  `mrr` (**cuota mensual esperada** = suma de cuotas mensuales activas de socios activos).
- **Web `Metricas.tsx`**: **filtro de periodo** (presets Este mes/Este año/Año
  pasado/12m/24m/Todo + **rango a medida** con `<input type=month>`); KPIs del periodo
  (ingresos con **▲/▼ vs. año pasado**, media/mes, **mejor mes**, socios activos);
  **tarjeta "estado de cobro"** (MRR vs. cobrado del mes, barra y % con color verde/
  ámbar/rojo); gráfica con **línea de media** y **mejor mes** en oro. `api.metricas`
  pasa a recibir `{desde,hasta}`. CSS nuevo (`.met-filtros`, `.cobro-card`, `.graf-media`).
- Verificado en vivo: presets y rango a medida refetchean bien (incluso desde>hasta
  se ordena solo en el server), YoY, MRR (3688 € en el mock), "Todo"=primer cobro,
  sin overflow horizontal. Typecheck web+server OK, build OK.

### 2026-07-07 · Métricas + Nombre/Apellidos + scroll infinito (3 mejoras del jefe)
- **Pantalla de Métricas nueva** (`/metricas`, en el sidebar):
  - **Server**: tabla `gastos` (migración idempotente en `db.ts`) + `server/routes/metricas.ts`
    → `GET /api/metricas?meses=N` (serie mensual ingresos/gastos/beneficio + altas,
    `porActividad`, `porMetodo`, snapshot de socios/morosidad, comparativa mes actual
    vs. anterior) y CRUD `/api/gastos`. Registrado en `index.ts` (`app.use("/api", metricasRouter)`).
  - **Web**: `web/pages/Metricas.tsx` (KPIs con delta, gráfica de barras HTML/CSS
    ingresos+gastos con tooltip, barras H por actividad/método, altas por mes,
    barra segmentada de morosidad, alta/baja de gastos). Todo con el tema existente
    (CSS nuevo al final de `styles.css`, bloque "Métricas"). Ojo de privacidad
    (`localStorage gym_ver_metricas`). Ayuda `AyudaMetricas`.
- **"Ingresos del mes" (el "bug raro" del jefe)**: **el SQL es correcto**. "Ingresos del
  mes" = **cobrado en el mes natural en curso por fecha de pago**. A principios de mes
  o sin cobros aún sale 0/bajo comparado con meses llenos → parece raro pero no lo es.
  La pantalla de Métricas lo deja claro mes a mes. **Pendiente de hablar con el jefe**:
  si tras verlo quiere afinar la tarjeta del Panel (p. ej. etiqueta "cobrado este mes"
  más explícita o mini-tendencia). No se tocó la lógica de ingresos.
- **Nombre + Apellidos por separado**: `ALTER TABLE socios ADD COLUMN apellidos` con
  **reparto único** de los nombres existentes por el primer espacio (`db.ts`). Tocado
  todo el recorrido: `queries.ts` (añade `apellidos` + `nombreCompleto`), `socios.ts`
  (búsqueda por apellidos, `ORDER BY apellidos, nombre`, POST/PUT), `dashboard.ts`,
  `ajustes.ts` (avisos), `recibo.ts`, `export.ts` (columna Apellidos), `seed-mock.ts`.
  Web: `types.ts`, `SocioFormModal` (2 campos), `SocioDetalle`/`Socios` muestran
  `nombreCompleto`, `filtros.pruebas.ts` (factory actualizado, 40+ casos OK).
- **Socios: orden por apellido + scroll infinito**: `Socios.tsx` reescrito. Orden por
  apellido **A→Z por defecto** (como el archivador), toggle **Z→A** en la cabecera
  *Nombre*; se mantiene el orden por *Vence*. **Paginación eliminada** → `tbody` con
  scroll interno (alto medido para que **la página no scrollee**) que carga filas por
  bloques al bajar (`INICIAL=40`, `CHUNK=24`). CSS `.socios-scroll`/`.socios-pie`.
- **Verificado en vivo** (mock, Vite+API 4711): métricas (serie mensual correcta, CRUD
  de gastos, beneficio), migración de apellidos (60 socios repartidos y ordenados),
  scroll infinito (40→60), toggles de orden, búsqueda por apellido, modal con 2 campos,
  sin overflow de página. Typecheck web+server OK, `test:filtros` OK, `npm run build` OK.
- ⚠️ **Mock DB**: `data-mock/gymgrecia.db` (versionado) quedó migrado en sitio al
  arrancar el server. Para datos limpios con apellidos nativos: borrar `data-mock` y
  `npm run seed:mock` (el seed ya inserta `apellidos`).

### 2026-06-26 · Versionado + actualización automática
- **SemVer** arrancando en **`1.0.0`** (la app ya estaba en producción).
- **`npm version patch|minor|major`** = bump + commit + tag + push en un comando:
  `preversion` (typecheck web/server + tests), `version` (mete `CHANGELOG.md` en el commit), `postversion` (`git push --follow-tags`).
- **Versión visible** en el pie del sidebar: `__APP_VERSION__` inyectado por Vite (`define`) desde `package.json` (build-time → la UI lo refleja tras `build`).
- **`CHANGELOG.md`** (Keep a Changelog) con `[Sin publicar]` + `[1.0.0]`.
- **`npm run dist`** (`scripts/dist.mjs`): build + `git archive` → `../GreciaGimnasio.zip` (respaldo offline; solo ficheros versionados, sin `data/` real).
- **`Actualizar.bat`** (lo nuevo de verdad): el dueño da un clic y la app se actualiza desde GitHub **sin tocar `data/`** (robocopy excluye `data`/`node_modules`/el propio bat; luego `npm install` + `build`). Descarga a carpeta temporal primero: si falla, no toca nada.
  - El repo es **PRIVADO** → el bat usa un **token de solo lectura** leído de **`update-token.txt`** (en `.gitignore`; PowerShell lo lee del fichero, no aparece en línea de comandos). Bootstrap del token (una vez) documentado en `CLAUDE.md`.
  - Validado por partes: forma de la petición (401 con token falso), detección de la carpeta interna, robocopy preserva `data` y no se autopisa, lectura de versión con `node -p`. **Pendiente**: una prueba real con el token de verdad sobre una copia.

### 2026-06-25 · Handoff + .npmrc
- Creada esta bitácora completa para arrancar en otro chat (objetivos: versionado automático + campo/filtro "sexo").
- Añadido **`.npmrc`** de proyecto (registro público) para que el lock no se vuelva a contaminar con el Artifactory de Inditex.

### 2026-06-24/25 · Distribución y fix de instalación
- **ZIP** `GreciaGimnasio.zip` (código + bats + fuentes + mock, sin `node_modules`/`dist`/datos reales). Guía **`INSTALAR.md`** para el PC del local (sin git/VSCode): instalar Node LTS, copiar, doble clic.
- **Bug de instalación en el otro PC**: el `package-lock.json` tenía URLs del **Artifactory de Inditex** (heredadas del `.npmrc` global del dev) → `E401`. Reescritas todas al **npm público**; verificado con 2 subagentes (`npm ci` + build + arranque OK; lock 100% público, `integrity` intacto).

### 2026-06-24 · Pulido UX
- Scroll a juego con la marca; **anti-salto** (`scrollbar-gutter: stable`).
- **Socios** y **ficha de socio** se **ajustan a la pantalla** (sin scroll de página; paginación dinámica y scroll interno en las tarjetas largas).
- **Panel** acortado (hero compacto, tope 5 por columna); tarjetas-resumen y "+ N más" **llevan a Socios ya filtrado**.
- Ingresos con **botón de ojo** (sin blur). Estado "Sin pagar" en **morado** (distinto de "Atrasado" rojo) + tooltips y sección de ayuda explicando cada estado.
- Botón **"Volver"** y botón de ayuda **"?"** (SVG) afinados.

### 2026-06-24 · Funciones
- **Filtros avanzados** en Socios (actividad/estado/cuota/fecha-de-alta) con lógica **pura y testeada** (`web/filtros.ts` + `npm run test:filtros`, 33 casos).
- **Entorno MOCK** (`GymGrecia-MOCK.bat`, `GYM_DATA_DIR`, `server/seed-mock.ts`).
- **Export a Excel** (exceljs): listado de socios (todos/selección) e informe por socio.
- **Recibos PDF** (pdfkit) con diseño de marca; descargar y enviar por email. Datos fiscales en Ajustes; campo `dni` en socio.
- **Avisos por email** (nodemailer + SMTP configurable en Ajustes).
- **Copias de seguridad** (auto al arrancar/cerrar + manual + restaurar; `db.backup()` consistente con WAL; `db` reabrible).
- **Baja/reactivar** socio y **pausar/reactivar** actividad. **Diálogo de confirmación** propio (`useConfirm`). Campo Actividad de `datalist` → `<select>`.

### 2026-06-24 · Revisión con subagentes
- Pase de 3 revisores → **bugs críticos arreglados**: restaurar copia reabre la BD pase lo que pase + mutex de mantenimiento; `POST /pagos` valida fechas/método; borrado de pago en transacción; selección de Socios no se arrastra al filtrar; varias robusteces de UI.

### 2026-06-24 · Arranque
- Arreglado el `npm i` inicial: `better-sqlite3` 11 → 12 (binarios para Node 24).
- Creados `CLAUDE.md` y este `SESSION_LOG.md`.

# Registro de cambios

Todos los cambios relevantes de **GymGrecia** se anotan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/) (SemVer):
`MAYOR.MENOR.PARCHE` → cambios incompatibles · funciones nuevas · correcciones.

> Cómo se publica una versión: edita la sección **[Sin publicar]** con lo que
> entra, y luego ejecuta `npm version patch|minor|major`. Eso sube la versión,
> hace el commit y crea el tag de git. Ver `CLAUDE.md` (sección "Versionado").

## [Sin publicar]

## [1.2.0] - 2026-07-07

### Added
- **Pantalla de Métricas** (nueva sección en el menú): vista de negocio centrada
  en los **ingresos**, con **filtro de periodo** (Este mes · Este año · Año
  pasado · 12/24 meses · Todo · o un **rango a medida** de un mes a otro). El
  sistema **detecta desde cuándo tienes historial** (tu primer cobro) y lo usa como
  inicio del rango. Incluye: marcadores del periodo (ingresos con **comparativa
  frente al mismo periodo del año anterior**, media por mes, socios activos) y el
  **mejor mes de siempre** (récord de todo el historial); **gráfica mensual con 3
  vistas** que se alternan (Ingresos · **Socios que pagan** · **€ por socio**, esta
  última como medida de retención) y línea de media; desglose **por actividad**; y
  **evolución de socios** (altas por mes + estado de las cuotas hoy). Contadores
  animados y botón de **ojo** para ocultar los importes.
- **Nombre y apellidos por separado**: la ficha de socio ahora tiene un campo
  **Nombre** y otro **Apellidos**. Los socios existentes se reparten solos al
  actualizar (partiendo por el primer espacio; se puede afinar editando la ficha).
  El export a Excel gana una columna **Apellidos**.
- **Acceso directo en el Escritorio con icono propio**: `Crear icono en
  Escritorio.bat` crea (o actualiza) un acceso directo a `GymGrecia.bat` con
  `GymGrecia.ico` (los `.bat` no llevan icono; se le pone al acceso directo).
- **`Actualizar.bat` hace copia de seguridad antes de actualizar**: guarda toda
  la carpeta (**incluida `data/`**) en el Escritorio, en
  `GymGrecia-backup-v<version>_<fecha>`, marcada con la versión anterior. Si la
  copia falla, **no actualiza nada**. Se omiten `node_modules`/`dist` (se
  regeneran solos). Así siempre hay a mano una vuelta atrás.

### Changed
- **Socios se ordena por apellido** (A→Z, como el archivador de papel) en lugar de
  por nombre de pila; se puede alternar a **Z→A** pulsando la cabecera *Socio*
  (antes "Nombre").
- **Lista de socios con scroll infinito**: la tabla tiene su propio desplazamiento
  y va cargando más socios al bajar, en vez de dividirse en páginas. La pantalla no
  se mueve. El buscador también encuentra por **apellidos**.
- **Rediseño compacto con animaciones**: contadores animados en los marcadores
  del panel, cabecera (friso del templo) más baja, confirmación **"✓ Enviado"**
  en el propio botón de avisar (sin banners ni popups), **banda única de filtros**
  en Socios con fundido de filas al filtrar, y anchos de columna fijos para que
  ordenar no recoloque la tabla. Respeta `prefers-reduced-motion`.
- **`Actualizar.bat` ahora usa Git** en lugar de la API "zipball" de GitHub.
  Nuevo requisito: tener **Git para Windows** instalado en el PC del local.

### Fixed
- **Actualización falla con error 404** ("no se encontró el servidor remoto")
  usando un token *fine-grained*: esa API devuelve 404 en repos privados aunque
  el token sea válido. Con `git clone` el mismo token funciona. Los datos
  (`data/`) siguen sin tocarse y el flujo del dueño sigue siendo un doble clic.

## [1.1.0] - 2026-06-29

### Added
- **Rediseño visual** (sistema "Claude Design"): nueva paleta (azul Egeo profundo,
  oro olímpico, terracota, mármoles), tipografía (Cinzel para títulos y las cifras
  del panel, Archivo para cuerpo, **Space Mono** local para micro-etiquetas, fechas
  y chips), forma (radio, pastillas, sombra retro), **logo sólido** y **favicon**,
  iconos del panel lateral, y tarjetas del panel con desglose ("Sin pagar / Atrasado").
- **Columna "Vence"** en Socios: fecha de la cuota activa que expira antes,
  **ordenable** al pulsar la cabecera.
- **Sexo del socio** (hombre/mujer): selector rápido **♂ / ♀** al crear o editar,
  **filtro** en Socios (chips + `?sexo=` en la URL) y columna **Sexo** en el export
  a Excel. Migración suave: los socios existentes quedan sin asignar hasta editarlos.

### Changed
- Números del panel y nombres/importes ajustados a la jerarquía del nuevo diseño.

## [1.0.0] - 2026-06-26

Primera versión con **versionado formal**. La aplicación ya estaba en producción
en el PC del gimnasio; se arranca en `1.0.0` y a partir de aquí se versiona con
SemVer.

### Added
- **Versión visible** en el pie de la barra lateral (inyectada en el build desde
  `package.json`), para saber qué versión corre en el local.
- **Actualización en un clic** (`Actualizar.bat`): descarga la última versión
  desde GitHub y la aplica **sin tocar los datos** (`data/`); luego reconstruye.
- **`npm run dist`**: build + ZIP de respaldo (`GreciaGimnasio.zip`) para
  distribución offline (USB) cuando no haya internet.
- Este **CHANGELOG**.

### Incluido desde el inicio (resumen del estado en producción)
- **Panel** con montones (sin pagar / atrasados / vencen pronto / al día) e
  ingresos del mes; las tarjetas llevan a Socios ya filtrado.
- **Socios**: alta/baja/edición, búsqueda, filtros (actividad, estado, cuota,
  fecha de alta), paginación adaptada a la pantalla y export a Excel.
- **Ficha de socio**: actividades, baja/reactivar, pausar actividad, historial de
  pagos y recibos.
- **Tarifas**, **Copias de seguridad** (auto + manual + restaurar), **avisos por
  email** (SMTP), **recibos PDF** y **ayuda contextual** por pantalla.
- **Entorno MOCK** (`GymGrecia-MOCK.bat`, ~60 socios de prueba, puerto 4712).

[Sin publicar]: https://github.com/JesusMarth/GreciaGimnasio/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/JesusMarth/GreciaGimnasio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/JesusMarth/GreciaGimnasio/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/JesusMarth/GreciaGimnasio/releases/tag/v1.0.0

# Registro de cambios

Todos los cambios relevantes de **GymGrecia** se anotan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/) (SemVer):
`MAYOR.MENOR.PARCHE` → cambios incompatibles · funciones nuevas · correcciones.

> Cómo se publica una versión: edita la sección **[Sin publicar]** con lo que
> entra, y luego ejecuta `npm version patch|minor|major`. Eso sube la versión,
> hace el commit y crea el tag de git. Ver `CLAUDE.md` (sección "Versionado").

## [Sin publicar]

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

[Sin publicar]: https://github.com/JesusMarth/GreciaGimnasio/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/JesusMarth/GreciaGimnasio/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/JesusMarth/GreciaGimnasio/releases/tag/v1.0.0

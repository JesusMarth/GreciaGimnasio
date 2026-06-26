# Instalar GymGrecia en el ordenador del gimnasio

Guía para dejar la aplicación funcionando en un ordenador con **Windows** que **no tiene nada de programación instalado** (ni Git, ni VSCode, ni nada). Solo hace falta instalar **una cosa** (Node.js) y copiar la carpeta del programa.

> Tiempo: unos 10 minutos. Necesitas **internet** solo para la primera puesta en marcha; después funciona sin conexión.

---

## Paso 1 · Instalar Node.js (el "motor" de la app)

Es lo único que hay que instalar. Es gratuito y oficial.

1. Entra en **https://nodejs.org**
2. Descarga el botón que pone **"LTS"** (es la versión estable recomendada). Si te deja elegir, coge **Node.js 22 LTS**.
3. Abre el archivo descargado (`.msi`) y pulsa **Siguiente → Siguiente → Instalar** (deja todo como viene). No hace falta cambiar nada.
4. Cuando termine, **reinicia el ordenador** (recomendado, para que Windows reconozca Node).

> No necesitas crear cuenta ni nada. Tampoco hace falta Python, Visual Studio ni Git.

---

## Paso 2 · Copiar la carpeta del programa

1. Copia la carpeta **`GreciaGimnasio`** entera al ordenador (con un USB, o descargándola). Un buen sitio es **Documentos** o el **Escritorio**.
2. *(Opcional, para que pese menos)*: si dentro ves subcarpetas llamadas **`node_modules`** o **`dist`**, puedes **borrarlas antes de copiar** — el programa las vuelve a crear solo la primera vez.

> ⚠️ Importante: **no borres** la subcarpeta **`data`** si ya tiene datos: ahí viven todos los socios y pagos. Si es una instalación nueva, no existirá aún y se creará sola.

---

## Paso 3 · Abrir la aplicación

1. Entra en la carpeta `GreciaGimnasio`.
2. Haz **doble clic en `GymGrecia.bat`**.
3. **La primera vez** tardará un par de minutos (se descarga lo que necesita e instala; por eso hace falta internet). Verás texto moviéndose en una ventana negra — es normal.
4. Cuando esté listo, **se abre el navegador solo** con la aplicación. Si no se abriera, entra a mano en: **http://localhost:4711**

**A partir de ahí, cada día:** doble clic en `GymGrecia.bat` y se abre casi al instante.

> 🔴 **Deja la ventana negra abierta** mientras uses la app. Para **cerrar** la aplicación, cierra esa ventana.

---

## Copias de seguridad (¡importante!)

Todos los datos viven en **un solo archivo**, dentro de la subcarpeta **`data`**.

- Desde la propia app, en la pestaña **Copias**, puedes hacer una copia con un botón y restaurarla. La app también hace copias automáticas al abrir y cerrar.
- Para llevarte **todo** a otro ordenador o a un USB: copia la carpeta **`data`** entera.

---

## Probar sin tocar los datos reales (opcional)

Si quieres trastear con datos de mentira sin riesgo, haz doble clic en **`GymGrecia-MOCK.bat`**: abre una versión de pruebas con ~60 socios inventados, en otra ventana (puerto 4712) y en una carpeta aparte (`data-mock`). No toca tus datos reales.

---

## Actualizar cuando haya novedades

Cuando te avisen de que hay una **versión nueva**:

1. Si la aplicación está abierta, **cierra la ventana negra** de GymGrecia.
2. Haz **doble clic en `Actualizar.bat`** y sigue lo que dice (te pedirá pulsar una tecla).
3. Espera a que ponga **"Actualización COMPLETA"**. Tus **datos no se tocan** (socios, pagos y copias siguen igual).
4. Abre **`GymGrecia.bat`** como siempre.

> La versión que tienes instalada se ve abajo del todo en la barra lateral de la app (p. ej. `v1.0.0`).
> Si `Actualizar.bat` dice que falta `update-token.txt`, avisa a quien instaló la app: es un ajuste que se pone una sola vez.

---

## Si algo va mal

| Problema | Solución |
|---|---|
| Pone **"node no se reconoce..."** | Node no está instalado o falta reiniciar. Repite el Paso 1 y reinicia el ordenador. |
| Se queda parado o da error al instalar | Comprueba que hay **internet**. Cierra la ventana y vuelve a hacer doble clic en `GymGrecia.bat`. |
| Un intento anterior **falló a medias** (o error `EPERM` / no puede borrar `node_modules`) | **Cierra la ventana del Explorador** que tenga abierta la carpeta del programa, **borra la subcarpeta `node_modules`** si existe, y vuelve a hacer doble clic en `GymGrecia.bat`. |
| Windows pregunta **"¿Permitir esta app?"** | Pulsa **Más información → Ejecutar de todas formas** (es tu propio programa, es seguro). |
| El **antivirus** interfiere | Permite/excluye la carpeta `GreciaGimnasio` en el antivirus. |
| El navegador no se abre solo | Abre el navegador y entra en **http://localhost:4711**. |
| Pone que el **puerto ya está en uso** | Ya tienes la app abierta en otra ventana. Cierra las ventanas negras y vuelve a abrir una sola. |

---

## Resumen rápido

1. Instalar **Node.js LTS** (nodejs.org) → reiniciar.
2. Copiar la carpeta **`GreciaGimnasio`** al ordenador.
3. Doble clic en **`GymGrecia.bat`** (la 1.ª vez con internet).
4. Hacer **copias** de la carpeta `data` de vez en cuando.

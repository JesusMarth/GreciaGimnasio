# GymGrecia · Gestión de socios y cuotas

Aplicación web local para llevar los socios y los pagos del gimnasio (gimnasio,
karate y pilates). Sustituye los archivadores de papel: registra quién paga, y
avisa de quién está **atrasado**, a quién le **vence pronto** la cuota y quién
está **al día**.

Funciona **en este ordenador, sin internet**. Los datos se guardan en un único
archivo de base de datos que es muy fácil de respaldar.

---

## Cómo abrirla

**Doble clic en `GymGrecia.bat`.**

La primera vez tardará un poco (instala y prepara la aplicación). Las siguientes
veces abre el navegador casi al instante. Deja abierta la ventana negra mientras
la uses; para cerrar la aplicación, cierra esa ventana.

Si el navegador no se abriera solo, entra a mano en: <http://localhost:4711>

---

## Qué puedes hacer

- **Panel**: de un vistazo, los tres montones — *por cobrar / atrasados*,
  *vencen pronto* y *al día* — más los ingresos del mes. Botón **Cobrar** en cada
  socio.
- **Socios**: alta, búsqueda, ficha de cada socio con sus actividades, su
  historial de pagos y sus datos.
- **Cuotas por actividad**: cada socio puede tener gimnasio, karate y/o pilates,
  cada una con **su propio importe**. Un mismo cobro puede pagar varias a la vez,
  y cada actividad queda registrada por separado.
- **Tarifas**: plantillas de precio para no reescribir importes (orientativas; el
  precio real lo pones en cada socio).

### Sobre los precios (ofertas, descuentos, edad)

La aplicación es **agnóstica a las ofertas**: tú escribes el importe que se cobra
de verdad en cada actividad. Si una familia paga 30 en vez de 35, escribes 30; si
el bono pilates+gimnasio son 45, repartes ese total entre las dos líneas como
quieras. La app no calcula descuentos: guarda lo que cobras y mantiene cada
actividad por separado.

---

## Copia de seguridad (importante)

Todos los datos viven en un solo archivo:

```
data\gymgrecia.db
```

Para hacer una copia de seguridad, **cierra la aplicación y copia la carpeta
`data`** (o ese archivo) a un USB, a otra carpeta o a la nube. Para restaurar, se
vuelve a poner ese archivo en su sitio. Recomendado: una copia de vez en cuando.

---

## Detalles técnicos

- Frontend: React + TypeScript + Vite.
- Backend: Node + Express, base de datos SQLite (`better-sqlite3`).
- Puerto: la aplicación se sirve en `http://localhost:4711`.

Comandos (para desarrollo):

```
npm install        # instalar dependencias
npm run dev        # modo desarrollo (web en :5180, API en :4711)
npm run build      # compilar la web a /dist
npm start          # arrancar como aplicación (sirve la web + API en :4711)
npm run typecheck  # comprobar tipos del frontend
```

> Si actualizas el código, borra la carpeta `dist` (o ejecuta `npm run build`)
> para que el `.bat` recompile con los cambios.

import { useState, type ReactNode } from "react";
import { Modal } from "./Modal.tsx";

/** Botón "?" que abre una explicación de la pantalla actual. */
export function Ayuda({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button className="ayuda-btn" onClick={() => setAbierto(true)} title="¿Qué es esta pantalla?" aria-label="Ayuda">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>
      {abierto && (
        <Modal
          titulo={titulo}
          onCerrar={() => setAbierto(false)}
          ancho
          pie={
            <button className="btn primary" onClick={() => setAbierto(false)}>
              Entendido
            </button>
          }
        >
          <div className="modal-body ayuda-contenido">{children}</div>
        </Modal>
      )}
    </>
  );
}

export const AyudaPanel = () => (
  <Ayuda titulo="El Panel, explicado">
    <p>Es tu vista de “qué hay hoy”: de un vistazo ves quién te debe dinero y quién está al corriente.</p>
    <h4>Los cuatro marcadores de arriba</h4>
    <ul>
      <li><strong>Por cobrar</strong>: cuotas atrasadas o sin pagar. Es lo que toca reclamar.</li>
      <li><strong>Vencen pronto</strong>: cuotas que caducan en los próximos 7 días.</li>
      <li><strong>Al día</strong>: cuotas pagadas y al corriente.</li>
      <li><strong>Ingresos del mes</strong>: lo cobrado este mes. Está oculto por privacidad; pulsa el <strong>ojo</strong> para mostrarlo u ocultarlo (recuerda tu elección).</li>
    </ul>
    <h4>Las tres columnas</h4>
    <p>Cada cuota aparece en su columna según su estado, de la más urgente a la menos. Para no alargar la pantalla se muestran solo las primeras; si hay más, verás “<strong>+ N más</strong>”, que te lleva a la pantalla de Socios.</p>
    <h4>Botones de cada socio</h4>
    <ul>
      <li><strong>Cobrar</strong>: registra un pago de ese socio.</li>
      <li><strong>Avisar</strong>: le envía un recordatorio por email. Necesita el correo configurado en <strong>Ajustes</strong> y que el socio tenga email guardado.</li>
    </ul>
    <h4>Qué significa cada estado</h4>
    <ul>
      <li><strong>Sin pagar</strong> (morado): nunca ha pagado — socio nuevo o aún sin cobrar.</li>
      <li><strong>Atrasado</strong> (rojo): pagó antes, pero su cuota ya venció.</li>
      <li><strong>Vence pronto</strong> (ámbar): le quedan 7 días o menos.</li>
      <li><strong>Al día</strong> (verde): pagada y al corriente.</li>
    </ul>
    <p>Pincha un marcador de arriba (Por cobrar / Vencen pronto / Al día) o un “+ N más” para ver esos socios en la lista, ya filtrados.</p>
  </Ayuda>
);

export const AyudaSocios = () => (
  <Ayuda titulo="La pantalla de Socios, explicada">
    <p>Aquí tienes a todos los socios y gestionas altas, búsquedas y exportaciones.</p>
    <h4>Buscar y filtrar</h4>
    <ul>
      <li><strong>Buscador</strong>: escribe nombre o teléfono y la lista se filtra sola.</li>
      <li><strong>Actividad</strong> (Gimnasio / Karate / Pilates): se combinan en “o” — marca Karate y Pilates y salen los de uno u otro.</li>
      <li><strong>Estado</strong>: Activos o Bajas.</li>
      <li><strong>Cuota</strong>: Pendientes (atrasados o sin pagar), Vencen pronto, Al día o Sin cuotas.</li>
      <li><strong>Fecha de alta</strong>: abre una ventana con periodos rápidos (hoy, ayer, últimos 7 días, esta semana, este mes, este año) y, en “Más opciones”, un año entero o un rango exacto con calendario.</li>
      <li>Los filtros se <strong>suman</strong> entre sí; <strong>Limpiar filtros</strong> los quita todos. El export y “seleccionar todos” respetan lo filtrado.</li>
    </ul>
    <h4>Páginas</h4>
    <p>La tabla se divide en páginas para no tener que bajar sin fin. Usa <strong>Anterior</strong> / <strong>Siguiente</strong> abajo a la derecha.</p>
    <h4>Seleccionar y exportar</h4>
    <ul>
      <li>Las <strong>casillas</strong> de la izquierda te dejan elegir socios concretos (incluso de varias páginas). La casilla de la cabecera marca/desmarca todos los del filtro actual.</li>
      <li><strong>Exportar Excel</strong> se adapta: si tienes casillas marcadas exporta <strong>esos</strong>; si no, exporta <strong>lo que ves</strong> según el filtro; sin filtro, exporta <strong>todos</strong>. El número entre paréntesis te dice cuántos saldrán.</li>
    </ul>
    <h4>Más</h4>
    <ul>
      <li><strong>+ Nuevo socio</strong>: da de alta a alguien.</li>
      <li>Pulsa una <strong>fila</strong> para abrir la ficha completa del socio.</li>
    </ul>
    <h4>Qué significa cada estado de cuota</h4>
    <ul>
      <li><strong>Sin pagar</strong> (morado): nunca ha pagado esa cuota — socio nuevo o aún sin cobrar.</li>
      <li><strong>Atrasado</strong> (rojo): pagó antes, pero su cuota ya venció. Toca renovar.</li>
      <li><strong>Vence pronto</strong> (ámbar): le quedan 7 días o menos.</li>
      <li><strong>Al día</strong> (verde): pagada y al corriente.</li>
      <li><strong>Sin cuotas</strong> (gris): no tiene ninguna actividad activa.</li>
    </ul>
  </Ayuda>
);

export const AyudaSocioDetalle = () => (
  <Ayuda titulo="La ficha del socio, explicada">
    <h4>Botones de arriba</h4>
    <ul>
      <li><strong>Registrar pago</strong>: cobra una o varias actividades a la vez.</li>
      <li><strong>Avisar por email</strong>: manda un recordatorio de lo que debe.</li>
      <li><strong>Editar</strong>: cambia sus datos (nombre, teléfono, email, DNI…).</li>
      <li><strong>Dar de baja / Reactivar</strong>: lo saca de avisos y del panel sin borrarlo (queda guardado). Reactivar lo devuelve.</li>
      <li><strong>Borrar</strong>: elimina al socio y todo su historial. No se puede deshacer.</li>
    </ul>
    <h4>Actividades y cuotas</h4>
    <ul>
      <li>Cada actividad (gimnasio, karate, pilates…) tiene su importe y su estado.</li>
      <li><strong>Cobrar</strong> / <strong>Editar</strong> esa actividad, <strong>Pausar</strong> (deja de contar sin borrarla) o <strong>Quitar</strong>.</li>
      <li><strong>+ Añadir actividad</strong> para sumarle una nueva.</li>
    </ul>
    <h4>Historial de pagos</h4>
    <ul>
      <li><strong>Recibo PDF</strong>: abre el justificante de ese pago (puedes guardarlo o imprimirlo).</li>
      <li><strong>Enviar recibo</strong>: se lo manda por email en PDF.</li>
      <li><strong>Exportar Excel</strong>: informe del socio con sus pagos y retrasos.</li>
      <li><strong>Borrar</strong>: elimina ese pago (recalcula su cobertura).</li>
    </ul>
  </Ayuda>
);

export const AyudaTarifas = () => (
  <Ayuda titulo="Tarifas, explicado">
    <p>Las tarifas son <strong>plantillas de precio</strong> para no reescribir importes al dar de alta cuotas. Son orientativas: el precio real de cada socio se fija en su ficha y puede ser distinto (ofertas, descuentos…).</p>
    <ul>
      <li><strong>+ Nueva tarifa</strong>: crea una plantilla (nombre, actividad, importe, tipo).</li>
      <li><strong>Editar</strong> / <strong>Borrar</strong> en cada fila.</li>
    </ul>
    <p>Al crear una cuota a un socio puedes “partir de una tarifa” para precargar el importe.</p>
  </Ayuda>
);

export const AyudaCopias = () => (
  <Ayuda titulo="Copias de seguridad, explicado">
    <p>Tus datos viven en un único archivo en este ordenador. Estas copias te protegen ante un fallo y te permiten llevártelos.</p>
    <ul>
      <li><strong>Hacer copia ahora</strong>: guarda una copia con la fecha.</li>
      <li><strong>Restaurar</strong>: vuelve a un estado anterior. Antes guarda automáticamente una copia de lo actual, por si acaso.</li>
      <li>La app hace <strong>copias automáticas</strong> al abrir y al cerrar.</li>
    </ul>
    <h4>Llevar los datos a otro PC</h4>
    <p>Copia la carpeta <strong>data</strong> entera al otro ordenador (incluye la base y las copias) y tendrás <strong>todo</strong> allí.</p>
  </Ayuda>
);

export const AyudaAjustes = () => (
  <Ayuda titulo="Ajustes, explicado">
    <h4>Correo de envío</h4>
    <p>Configura el correo desde el que se mandan avisos y recibos. Con Gmail necesitas una <strong>contraseña de aplicación</strong> (no la normal): se explica en la tarjeta de al lado. Usa <strong>Enviar correo de prueba</strong> para comprobar que funciona.</p>
    <h4>Datos para los recibos</h4>
    <ul>
      <li><strong>Nombre/NIF/dirección</strong>: salen en la cabecera del recibo.</li>
      <li><strong>Tipo de documento</strong>: “Recibo” (justificante) o “Factura”.</li>
      <li><strong>IVA</strong>: si no estás seguro, déjalo en “No desglosar”. Consulta con tu gestor si necesitas factura con IVA.</li>
      <li><strong>Texto al pie</strong>: una nota opcional para todos los recibos.</li>
    </ul>
  </Ayuda>
);

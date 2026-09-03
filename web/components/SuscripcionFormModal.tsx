import { useEffect, useState } from "react";
import { Modal } from "./Modal.tsx";
import { Plegable } from "./Plegable.tsx";
import { Desplegable } from "./Desplegable.tsx";
import { api, ACTIVIDADES, METODOS } from "../api.ts";
import { capitalizar, duracionTxt, euros, hoyISO, opcionesMeses } from "../format.ts";
import type { Suscripcion, Tarifa } from "../types.ts";

interface Props {
  socioId: number;
  suscripcion?: Suscripcion; // si viene, es edicion
  onCerrar: () => void;
  onHecho: () => void;
}

// Cómo arranca la actividad nueva (solo en el alta):
//  - pendiente: sin pagos; el socio saldrá como "Sin pagar" hasta el primer cobro.
//  - cobrar   : registra AHORA el primer pago real → cuenta en Ingresos e historial.
//  - papel    : ya estaba pagado fuera de la app (archivador) → solo cuadra el estado.
//               En bonos: las sesiones que le quedaban del papelito.
type Arranque = "pendiente" | "cobrar" | "papel";

const SESIONES_POR_DEFECTO = 20;

// Flujo del formulario (para que no se puedan mezclar cosas):
//  1. Primero se elige el TIPO: cuota por tiempo (mensual, trimestral, semestral,
//     anual…) o bono de sesiones.
//  2. Las tarifas que se ofrecen son SOLO las de ese tipo; cambiar el tipo
//     descarta la tarifa elegida (y lo que precargó). La tarifa es solo un atajo:
//     importe, duración y meses del cobro son libres (sin guardar nada).
//  3. En edición el tipo NO se cambia (una cuota con meses cobrados no puede
//     convertirse en bono sin liar la cuenta). Excepción: los «bonos» de antes de
//     la versión 1.8, que no se sabe qué eran: ahí sí se elige (cuota por tiempo,
//     p. ej. un anual de 324 €, o bono de sesiones).
export function SuscripcionFormModal({ socioId, suscripcion, onCerrar, onHecho }: Props) {
  const [actividad, setActividad] = useState(suscripcion?.actividad ?? "gimnasio");
  const [etiqueta, setEtiqueta] = useState(suscripcion?.etiqueta ?? "");
  const [importe, setImporte] = useState<number>(suscripcion?.importe ?? 0);
  const [periodicidad, setPeriodicidad] = useState(suscripcion?.periodicidad ?? "mensual");
  const [meses, setMeses] = useState<number>(suscripcion?.meses ?? 1);
  const [pagadoHasta, setPagadoHasta] = useState(suscripcion?.pagadoHasta ?? "");
  const [activa, setActiva] = useState(suscripcion?.activa ?? true);
  const [arranque, setArranque] = useState<Arranque>("pendiente");
  const [fechaCobro, setFechaCobro] = useState(hoyISO());
  const [metodo, setMetodo] = useState("efectivo");
  const [mesesCobro, setMesesCobro] = useState<number>(suscripcion?.meses ?? 1);
  // Bonos por sesiones
  const [sesionesPorBono, setSesionesPorBono] = useState<number>(suscripcion?.sesionesPorBono ?? SESIONES_POR_DEFECTO);
  const [sesionesManual, setSesionesManual] = useState<number>(suscripcion?.sesionesManual ?? 0);
  const [sesionesPapel, setSesionesPapel] = useState<number>(0);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [tarifaId, setTarifaId] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const esBono = periodicidad === "bono";
  const editando = !!suscripcion;
  const legado = !!suscripcion?.bonoSinConfigurar; // «bono» de antes de v1.8: hay que decir qué es
  const tipoBloqueado = editando && !legado;

  useEffect(() => {
    if (!suscripcion) api.tarifas().then(setTarifas).catch(() => {});
  }, [suscripcion]);

  // Solo las tarifas del tipo elegido.
  // (una tarifa de bono sin sesiones, de antes de v1.8, no se ofrece: hay que editarla en Tarifas)
  const tarifasDelTipo = tarifas.filter((t) => t.periodicidad === periodicidad && (t.periodicidad !== "bono" || !!t.sesiones));

  function aplicarTarifa(id: string) {
    setTarifaId(id);
    const t = tarifas.find((x) => x.id === Number(id));
    if (!t) return;
    setActividad(t.actividad);
    setEtiqueta(t.nombre);
    setImporte(t.importe);
    if (t.periodicidad === "bono") setSesionesPorBono(t.sesiones ?? SESIONES_POR_DEFECTO);
    else {
      setMeses(t.meses || 1);
      setMesesCobro(t.meses || 1);
    }
  }

  function cambiarTipo(nuevo: string) {
    if (nuevo === periodicidad) return;
    setPeriodicidad(nuevo);
    // Lo precargado por una tarifa del otro tipo ya no vale.
    if (tarifaId) {
      setTarifaId("");
      setEtiqueta("");
      setImporte(0);
    }
    if (nuevo === "bono") setSesionesPorBono(SESIONES_POR_DEFECTO);
    if (arranque === "papel") setArranque("pendiente"); // el "ya estaba pagado" se expresa distinto en cada tipo
  }

  function cambiarDuracion(v: string) {
    const n = Number(v);
    setMeses(n);
    setMesesCobro(n); // el primer cobro cubre la duración, salvo que se cambie a mano
  }

  async function guardar() {
    if (!actividad.trim()) {
      setError("La actividad es obligatoria.");
      return;
    }
    if (!Number.isFinite(importe) || importe < 0) {
      setError("Importe no válido.");
      return;
    }
    if (esBono && (!Number.isInteger(sesionesPorBono) || sesionesPorBono < 1)) {
      setError("Indica cuántas sesiones trae el bono (p. ej. 20).");
      return;
    }
    if (!suscripcion && arranque === "papel") {
      if (esBono && (!Number.isInteger(sesionesPapel) || sesionesPapel < 1)) {
        setError("Pon cuántas sesiones le quedan del papelito (o elige otra opción).");
        return;
      }
      if (!esBono && !pagadoHasta) {
        setError("Pon hasta cuándo estaba pagado (o elige otra opción).");
        return;
      }
    }
    setGuardando(true);
    setError("");
    const datos: Record<string, unknown> = {
      actividad,
      etiqueta: etiqueta.trim() || null,
      importe: Number(importe),
      periodicidad,
      activa,
    };
    if (esBono) datos.sesionesPorBono = sesionesPorBono;
    else datos.meses = meses;
    if (suscripcion) {
      // Un bono por sesiones no tiene fecha: no se manda pagadoHasta (se conserva
      // en la BD tal cual estuviera, sin tocarla).
      if (esBono) datos.sesionesManual = sesionesManual;
      else datos.pagadoHasta = pagadoHasta || null;
    } else {
      // El alta manda pagadoHasta/sesionesManual o cobroInicial según el arranque
      // elegido, nunca los dos: así no se puede duplicar el mismo dinero.
      if (arranque === "papel") {
        if (esBono) datos.sesionesManual = sesionesPapel;
        else datos.pagadoHasta = pagadoHasta;
      }
      if (arranque === "cobrar") datos.cobroInicial = { metodo, fecha: fechaCobro, meses: esBono ? undefined : mesesCobro };
    }
    try {
      if (suscripcion) await api.editarSuscripcion(suscripcion.id, datos);
      else await api.crearSuscripcion(socioId, datos);
      onHecho();
    } catch (e: any) {
      setError(e.message);
      setGuardando(false);
    }
  }

  // La actividad es un conjunto conocido (ACTIVIDADES). Si se edita una con un
  // valor antiguo fuera de la lista, lo añadimos para no perderlo en el select.
  const opcionesActividad =
    actividad && !ACTIVIDADES.includes(actividad) ? [...ACTIVIDADES, actividad] : ACTIVIDADES;

  const ses = suscripcion?.sesiones ?? null;
  const etiquetaImporte = esBono ? "Precio del bono (€) *" : meses === 1 ? "Importe al mes (€) *" : `Importe por ${duracionTxt(meses).toLowerCase() === "anual" ? "año" : `${meses} meses`} (€) *`;

  return (
    <Modal
      titulo={suscripcion ? (esBono ? "Editar bono" : "Editar actividad") : "Añadir actividad"}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="btn ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn primary" onClick={guardar} disabled={guardando}>
            {guardando
              ? "Guardando…"
              : !suscripcion && arranque === "cobrar"
                ? `Guardar y cobrar ${euros(Number(importe) || 0)}`
                : "Guardar"}
          </button>
        </>
      }
    >
      <div className="modal-body">
        {/* Todo el cuerpo dentro de un Plegable: cualquier cambio de contenido (tipo, tarifa, chips, textos) anima el alto en vez de saltar. */}
        <Plegable>
        {error && <div className="error-banner">{error}</div>}

        {legado && (
          <div className="aviso-banner">
            Este «bono» se apuntó antes de la versión 1.8 y la app no sabe qué es. Elige el tipo: si es una <strong>cuota por
            tiempo</strong> (p. ej. un año pagado por 324 € o seis meses por 180 €), pon su duración y seguirá exactamente como
            hasta ahora, con su fecha y sus cobros intactos. Si es un <strong>bono de sesiones</strong>, indica sus sesiones y el
            cobro ya registrado contará como un bono completo.
          </div>
        )}

        {/* 1) Tipo primero: manda sobre todo lo demás */}
        <div className="row2">
          <div className="field">
            <label>Tipo</label>
            <Desplegable
              value={periodicidad}
              onChange={cambiarTipo}
              disabled={tipoBloqueado}
              opciones={[
                { value: "mensual", label: "Cuota por tiempo (mensual, trimestral, anual…)" },
                { value: "bono", label: "Bono de sesiones" },
              ]}
            />
          </div>
          {!editando && (
            <div className="field">
              <label>Partir de una tarifa (opcional)</label>
              <Desplegable
                value={tarifaId}
                onChange={aplicarTarifa}
                disabled={tarifasDelTipo.length === 0}
                opciones={[
                  { value: "", label: tarifasDelTipo.length === 0 ? "No hay tarifas de este tipo" : "Elegir para precargar…" },
                  ...tarifasDelTipo.map((t) => ({
                    value: String(t.id),
                    label: `${t.nombre} · ${capitalizar(t.actividad)} · ${t.periodicidad === "bono" ? `${t.sesiones} sesiones` : duracionTxt(t.meses || 1).toLowerCase()}`,
                    extra: `${t.importe} €`,
                  })),
                ]}
              />
            </div>
          )}
        </div>
        {tipoBloqueado && (
          <div className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
            El tipo no se cambia una vez creada: para pasar de cuota a bono (o al revés), quita esta actividad y añade otra.
          </div>
        )}

        <div className="row2">
          <div className="field">
            <label>Actividad *</label>
            <Desplegable value={actividad} onChange={setActividad} opciones={opcionesActividad.map((a) => ({ value: a, label: capitalizar(a) }))} />
          </div>
          <div className="field">
            <label>{etiquetaImporte}</label>
            <input type="number" step="0.01" min="0" value={importe} onChange={(e) => setImporte(Number(e.target.value))} />
          </div>
        </div>

        <div className="row2">
          <div className="field">
            <label>Etiqueta / descripción</label>
            <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder={esBono ? "p. ej. Bono 20 sesiones" : "p. ej. Karate juvenil, Anual gimnasio…"} />
          </div>
          <div className="field">
            <label>{esBono ? "Sesiones por bono *" : "Duración de la cuota"}</label>
            {esBono ? (
              <input type="number" step="1" min="1" value={sesionesPorBono} onChange={(e) => setSesionesPorBono(Number(e.target.value))} />
            ) : (
              <Desplegable value={String(meses)} onChange={cambiarDuracion} opciones={opcionesMeses(meses)} />
            )}
          </div>
        </div>
        {!esBono && (
          <div className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
            {meses === 1
              ? "Cada cobro cubre un mes (en el cobro puedes cambiar los meses y el importe libremente)."
              : `Cada cobro cubre ${meses} meses por ${euros(Number(importe) || 0)}. En el cobro puedes cambiar meses e importe libremente.`}
          </div>
        )}

        {!suscripcion && (
          <div>
            <div className="field">
              <label>Primer pago</label>
              <div className="chips" role="group" aria-label="Primer pago">
                <button type="button" className={"chip" + (arranque === "pendiente" ? " on" : "")} onClick={() => setArranque("pendiente")}>
                  Queda pendiente
                </button>
                <button type="button" className={"chip" + (arranque === "cobrar" ? " on" : "")} onClick={() => setArranque("cobrar")}>
                  Cobrar ahora
                </button>
                <button type="button" className={"chip" + (arranque === "papel" ? " on" : "")} onClick={() => setArranque("papel")}>
                  Ya estaba pagado
                </button>
              </div>
            </div>

            {arranque === "pendiente" && (
              <div className="hint">
                {esBono ? "Saldrá como «Sin bono» hasta que le cobres el primero." : "Saldrá como «Sin pagar» hasta que registres su primer cobro."}
              </div>
            )}

            {arranque === "cobrar" && (
              <>
                <div className={esBono ? "row2" : "row3"}>
                  <div className="field">
                    <label>Fecha del cobro</label>
                    <input type="date" value={fechaCobro} max={hoyISO()} onChange={(e) => setFechaCobro(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Método</label>
                    <Desplegable value={metodo} onChange={setMetodo} opciones={METODOS.map((m) => ({ value: m, label: capitalizar(m) }))} />
                  </div>
                  {!esBono && (
                    <div className="field">
                      <label>Meses que cubre</label>
                      <Desplegable value={String(mesesCobro)} onChange={(v) => setMesesCobro(Number(v))} opciones={opcionesMeses(mesesCobro, [2, 4])} />
                    </div>
                  )}
                </div>
                <div className="hint">
                  {esBono
                    ? `Se apunta un cobro de ${euros(Number(importe) || 0)} por un bono de ${sesionesPorBono || "N"} sesiones: cuenta en Ingresos y en su historial, con recibo.`
                    : `Se apunta un cobro de ${euros(Number(importe) || 0)} que cubre ${mesesCobro} mes${mesesCobro === 1 ? "" : "es"} desde hoy: cuenta en Ingresos y en su historial, con recibo. Si te paga otra cantidad o más meses, cámbialo aquí mismo.`}
                </div>
              </>
            )}

            {arranque === "papel" && !esBono && (
              <>
                <div className="field">
                  <label>Pagado hasta *</label>
                  <input type="date" value={pagadoHasta} onChange={(e) => setPagadoHasta(e.target.value)} />
                </div>
                <div className="hint">
                  Para socios que ya venían pagados de fuera de la app (archivador en papel). Solo cuadra su estado: NO se
                  apunta ningún cobro y ese dinero no saldrá en Ingresos.
                </div>
              </>
            )}

            {arranque === "papel" && esBono && (
              <>
                <div className="field">
                  <label>Sesiones que le quedan del papelito *</label>
                  <input type="number" step="1" min="1" value={sesionesPapel} onChange={(e) => setSesionesPapel(Number(e.target.value))} />
                </div>
                <div className="hint">
                  Para socios que ya tenían el bono en papel. Solo cuadra sus sesiones: NO se apunta ningún cobro y ese
                  dinero no saldrá en Ingresos. Quedará marcado como «apuntado a mano».
                </div>
              </>
            )}
          </div>
        )}

        {suscripcion && !esBono && (
          <>
            <div className="field">
              <label>Pagado hasta</label>
              <input type="date" value={pagadoHasta} onChange={(e) => setPagadoHasta(e.target.value)} />
            </div>
            <div className="hint">
              Cambiar esta fecha a mano solo cuadra el estado: no apunta ningún cobro. Para cobrar de verdad usa «Registrar
              pago».
            </div>
          </>
        )}

        {suscripcion && esBono && (
          <>
            {ses && (
              <div className="hint" style={{ marginBottom: 8 }}>
                Ahora mismo: <strong>quedan {ses.restantes}</strong> · compradas {ses.compradas} · a mano {ses.manual} · usadas {ses.usadas}.
              </div>
            )}
            <div className="field">
              <label>Sesiones apuntadas a mano (sin cobro)</label>
              <input type="number" step="1" min="0" value={sesionesManual} onChange={(e) => setSesionesManual(Number(e.target.value))} />
            </div>
            <div className="hint">
              Sesiones que trajo del papelito o que le regalas: suman al bono sin apuntar ningún cobro (no cuentan en
              Ingresos). Para cobrarle un bono usa «Cobrar bono»; para descontar visitas, pica sesiones desde la ficha.
            </div>
          </>
        )}

        {suscripcion && (
          <div className="field">
            <label>
              <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} style={{ width: "auto", marginRight: 8 }} />
              Activa (cuenta para los avisos de cobro)
            </label>
          </div>
        )}
        <div className="hint">
          El importe es libre: pon lo que pague de verdad (con su oferta, descuento familiar o por edad ya aplicados). No hace
          falta crear una tarifa para un precio único.
        </div>
        </Plegable>
      </div>
    </Modal>
  );
}

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Modal } from "./Modal.tsx";

interface Opciones {
  titulo?: string;
  mensaje: ReactNode;
  /** Texto del botón que confirma (por defecto "Aceptar"). */
  confirmar?: string;
  /** Texto del botón que cancela (por defecto "Cancelar"). */
  cancelar?: string;
  /** Si es una acción destructiva, pinta el botón de confirmar en rojo. */
  peligro?: boolean;
}

const ConfirmCtx = createContext<(o: Opciones | string) => Promise<boolean>>(() =>
  Promise.resolve(false)
);

/**
 * Diálogo de confirmación con el estilo de la app, en sustitución del `confirm()`
 * nativo del navegador. Uso:
 *
 *   const confirmar = useConfirm();
 *   if (!(await confirmar({ mensaje: "¿Seguro?", peligro: true }))) return;
 */
export function useConfirm() {
  return useContext(ConfirmCtx);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pendiente, setPendiente] = useState<{ opts: Opciones; resolver: (ok: boolean) => void } | null>(null);

  const confirmar = useCallback((o: Opciones | string) => {
    const opts = typeof o === "string" ? { mensaje: o } : o;
    return new Promise<boolean>((resolve) => setPendiente({ opts, resolver: resolve }));
  }, []);

  function responder(ok: boolean) {
    pendiente?.resolver(ok);
    setPendiente(null);
  }

  return (
    <ConfirmCtx.Provider value={confirmar}>
      {children}
      {pendiente && (
        <Modal
          titulo={pendiente.opts.titulo ?? "Confirmar"}
          onCerrar={() => responder(false)}
          pie={
            <>
              <button className="btn ghost" onClick={() => responder(false)}>
                {pendiente.opts.cancelar ?? "Cancelar"}
              </button>
              <button
                className={"btn " + (pendiente.opts.peligro ? "danger" : "primary")}
                onClick={() => responder(true)}
              >
                {pendiente.opts.confirmar ?? "Aceptar"}
              </button>
            </>
          }
        >
          <div className="modal-body">
            <p style={{ margin: 0, lineHeight: 1.6 }}>{pendiente.opts.mensaje}</p>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}

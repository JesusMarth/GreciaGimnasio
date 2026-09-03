import { Router } from "express";
import { db } from "../db.ts";
import { addMeses, hoyISO } from "../util.ts";
import { registrarEvento } from "../eventos.ts";
import { ddmmaaaa as ddmm, duracionTxt, eurCorto as eur, ISO, metodoValido } from "../texto.ts";
import { esBonoPorSesiones, sesionesDe, suscripcionConEstado, type SuscripcionRow } from "../queries.ts";


export const suscripcionesRouter = Router();


/** Entero ≥ 0 o null si no viene / no vale. */
function enteroOpcional(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Alta de suscripcion para un socio. Tres arranques posibles:
//  - pendiente (sin nada): quedará "Sin pagar" hasta el primer cobro.
//  - pagadoHasta a mano: cuadra el estado (archivador en papel) SIN apuntar cobro
//    → se guarda también en cobertura_manual (no cuenta como ingreso, a propósito).
//  - cobroInicial {metodo, fecha?, meses?}: además de crear la actividad registra
//    el primer pago REAL (pagos + pago_lineas) en la misma transacción, para que
//    los ingresos del Panel/Métricas cuadren con el dinero cobrado de verdad.
// Bonos por sesiones (periodicidad 'bono'): obligan a `sesionesPorBono` (p. ej. 20).
// No llevan fecha: «ya estaba pagado» se expresa con `sesionesManual` (las que le
// quedaban del papelito) y «cobrar ahora» compra un bono completo de sesiones.
suscripcionesRouter.post("/socios/:id/suscripciones", (req, res) => {
  const socio = db.prepare("SELECT id FROM socios WHERE id = ?").get(req.params.id);
  if (!socio) return res.status(404).json({ error: "Socio no encontrado" });
  const { actividad, etiqueta, importe, periodicidad, notas, cobroInicial } = req.body ?? {};
  let { pagadoHasta } = req.body ?? {};
  if (!actividad || !String(actividad).trim()) return res.status(400).json({ error: "La actividad es obligatoria" });
  const imp = Number(importe);
  if (!Number.isFinite(imp) || imp < 0) return res.status(400).json({ error: "Importe no valido" });
  if (pagadoHasta && !ISO.test(String(pagadoHasta))) return res.status(400).json({ error: "Fecha 'pagado hasta' no válida" });

  const esBono = periodicidad === "bono";
  const sesionesPorBono = esBono ? enteroOpcional(req.body?.sesionesPorBono) : null;
  if (esBono && !sesionesPorBono) return res.status(400).json({ error: "Indica cuántas sesiones trae el bono (p. ej. 20)" });
  const sesionesManual = esBono ? (enteroOpcional(req.body?.sesionesManual) ?? 0) : 0;
  if (esBono) pagadoHasta = null; // un bono por sesiones no tiene fecha de cobertura
  // Cuota por tiempo: meses que cubre cada cobro (1 mensual · 3 · 6 · 12 anual).
  const mesesCuota = esBono ? 1 : Math.min(Math.max(enteroOpcional(req.body?.meses) || 1, 1), 24);

  const hoy = hoyISO();
  let cobro: { metodo: string; fecha: string; meses: number } | null = null;
  if (cobroInicial) {
    const fecha = cobroInicial.fecha || hoy;
    if (!ISO.test(String(fecha))) return res.status(400).json({ error: "Fecha del cobro no válida" });
    if (String(fecha) > hoy) return res.status(400).json({ error: "La fecha del cobro no puede ser futura" });
    // Por defecto el primer cobro cubre la duración de la cuota (un anual, 12 meses).
    const meses = Math.min(Math.max(Number(cobroInicial.meses) || mesesCuota, 1), 120);
    const metodo = metodoValido(cobroInicial.metodo);
    cobro = { metodo, fecha, meses };
  }

  const tx = db.transaction(() => {
    const ph = pagadoHasta || null;
    const info = db
      .prepare(
        `INSERT INTO suscripciones (socio_id, actividad, etiqueta, importe, periodicidad, pagado_hasta, cobertura_manual, sesiones_por_bono, sesiones_manual, meses, activa, notas, creado_en)
         VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)`
      )
      .run(
        req.params.id,
        String(actividad).trim().toLowerCase(),
        etiqueta || null,
        imp,
        esBono ? "bono" : "mensual",
        ph,
        ph, // lo puesto a mano en el alta es, por definición, cobertura sin cobro
        sesionesPorBono,
        sesionesManual,
        mesesCuota,
        notas || null,
        hoy
      );
    const subId = info.lastInsertRowid as number;
    if (cobro) {
      const pago = db
        .prepare("INSERT INTO pagos (socio_id, fecha, metodo, total, notas, creado_en) VALUES (?,?,?,?,?,?)")
        .run(req.params.id, cobro.fecha, cobro.metodo, imp, null, hoy);
      const insLinea = db.prepare(
        `INSERT INTO pago_lineas (pago_id, suscripcion_id, actividad, concepto, importe, periodo_desde, periodo_hasta, sesiones)
         VALUES (?,?,?,?,?,?,?,?)`
      );
      if (esBono) {
        // Compra un bono completo: N sesiones, sin periodo ni fecha.
        insLinea.run(pago.lastInsertRowid, subId, String(actividad).trim().toLowerCase(), etiqueta || `Bono ${sesionesPorBono} sesiones`, imp, null, null, sesionesPorBono);
      } else {
        // Igual que POST /pagos: el cobro extiende desde la cobertura vigente si la hay.
        const base = ph && ph > cobro.fecha ? ph : cobro.fecha;
        const hasta = addMeses(base, cobro.meses);
        insLinea.run(pago.lastInsertRowid, subId, String(actividad).trim().toLowerCase(), etiqueta || null, imp, base, hasta, null);
        db.prepare("UPDATE suscripciones SET pagado_hasta = ? WHERE id = ?").run(hasta, subId);
      }
    }
    return subId;
  });

  const s = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(tx()) as SuscripcionRow;
  const act = s.actividad;
  if (esBono) {
    const ses = sesionesDe(s);
    if (cobro) {
      registrarEvento(req.params.id, "pago", `Bono de ${act} añadido con su primer cobro: ${eur(imp)} en ${cobro.metodo} (${sesionesPorBono} sesiones; quedan ${ses.restantes})`);
    } else if (sesionesManual > 0) {
      registrarEvento(req.params.id, "actividad", `Bono de ${act} añadido como «ya estaba pagado» con ${sesionesManual} sesiones del papelito — apuntadas a mano, sin cobro registrado`);
    } else {
      registrarEvento(req.params.id, "actividad", `Bono de ${act} añadido (${sesionesPorBono} sesiones por ${eur(imp)}), pendiente de su primer cobro`);
    }
  } else if (cobro) {
    registrarEvento(req.params.id, "pago", `Actividad ${act} (${duracionTxt(mesesCuota).toLowerCase()}) añadida con su primer cobro: ${eur(imp)} en ${cobro.metodo} (cubre hasta ${ddmm(s.pagado_hasta)})`);
  } else if (s.cobertura_manual) {
    registrarEvento(req.params.id, "actividad", `Actividad ${act} (${duracionTxt(mesesCuota).toLowerCase()}) añadida como «ya estaba pagado» hasta ${ddmm(s.cobertura_manual)} — fecha apuntada a mano, sin cobro registrado`);
  } else {
    registrarEvento(req.params.id, "actividad", `Actividad ${act} (${duracionTxt(mesesCuota).toLowerCase()}) añadida, pendiente de su primer cobro (cuota de ${eur(imp)})`);
  }
  res.status(201).json(suscripcionConEstado(s, hoy));
});

// Editar suscripcion (importe, etiqueta, activa, periodicidad, pagado_hasta manual...).
suscripcionesRouter.put("/suscripciones/:id", (req, res) => {
  const s = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(req.params.id) as SuscripcionRow | undefined;
  if (!s) return res.status(404).json({ error: "Suscripcion no encontrada" });
  const { actividad, etiqueta, importe, periodicidad, pagadoHasta, activa, notas } = req.body ?? {};
  const imp = importe === undefined ? s.importe : Number(importe);
  if (!Number.isFinite(imp) || imp < 0) return res.status(400).json({ error: "Importe no valido" });
  if (pagadoHasta && !ISO.test(String(pagadoHasta))) return res.status(400).json({ error: "Fecha 'pagado hasta' no válida" });
  const nuevaPeriodicidad = periodicidad === "bono" || periodicidad === "mensual" ? periodicidad : s.periodicidad;
  const seraBono = nuevaPeriodicidad === "bono";
  // Duración de la cuota por tiempo (solo si viene; en bonos no aplica y queda a 1).
  let meses = s.meses ?? 1;
  if (req.body?.meses !== undefined) {
    const n = enteroOpcional(req.body.meses);
    if (!n || n > 24) return res.status(400).json({ error: "La duración debe ser de 1 a 24 meses" });
    meses = n;
  }
  if (seraBono) meses = 1;
  // Sesiones del bono: solo se tocan si vienen en la petición (y solo tienen
  // sentido en un bono). Un bono antiguo (sin sesiones) puede seguir sin ellas,
  // pero si se mandan tienen que valer: un bono ya configurado no se "desconfigura".
  let sesionesPorBono = s.sesiones_por_bono;
  if (seraBono && req.body?.sesionesPorBono !== undefined) {
    const n = enteroOpcional(req.body.sesionesPorBono);
    if (!n) return res.status(400).json({ error: "Indica cuántas sesiones trae el bono (p. ej. 20)" });
    sesionesPorBono = n;
  }
  let sesionesManual = s.sesiones_manual ?? 0;
  if (seraBono && req.body?.sesionesManual !== undefined) {
    const n = enteroOpcional(req.body.sesionesManual);
    if (n === null) return res.status(400).json({ error: "Las sesiones apuntadas a mano deben ser 0 o más" });
    sesionesManual = n;
  }
  const eraBonoPorSesiones = esBonoPorSesiones(s);
  const seConfiguraAhora = seraBono && !eraBonoPorSesiones && !!sesionesPorBono;
  // Bono antiguo (apuntado como cuota con fecha) que venía «ya estaba pagado» del
  // papelito, SIN cobro registrado: al configurarlo no hay líneas de pago que
  // cuenten, así que, si no se indica otra cosa, se le apunta a mano un bono
  // completo (igual que su fecha a mano lo tenía al día). Queda marcado «a mano».
  let papelitoHeredado = 0;
  if (seConfiguraAhora && s.periodicidad === "bono" && req.body?.sesionesManual === undefined && s.cobertura_manual) {
    const nLineas = (db.prepare("SELECT COUNT(*) AS n FROM pago_lineas WHERE suscripcion_id = ?").get(s.id) as { n: number }).n;
    if (nLineas === 0) {
      papelitoHeredado = sesionesPorBono as number;
      sesionesManual = papelitoHeredado;
    }
  }
  const nuevoPH = pagadoHasta === undefined ? s.pagado_hasta : pagadoHasta || null;
  // Si el usuario cambia "pagado hasta" a mano, esa nueva fecha pasa a ser la
  // cobertura manual (sin cobro que la respalde). Si no lo toca, se conserva.
  const coberturaManual = pagadoHasta !== undefined && nuevoPH !== s.pagado_hasta ? nuevoPH : s.cobertura_manual;
  const tx = db.transaction(() => {
    // Congelar las líneas de pago sin `sesiones` ANTES de cambiar el tamaño del
    // bono: cada cobro vale las sesiones que valía cuando se hizo. Sin esto, pasar
    // el bono de 20 a 10 sesiones revalorizaría cobros antiguos. Solo se rellena
    // la columna nueva `sesiones`; importe, fecha y periodo no se tocan.
    if (s.periodicidad === "bono" && eraBonoPorSesiones && sesionesPorBono !== s.sesiones_por_bono) {
      db.prepare("UPDATE pago_lineas SET sesiones = ? WHERE suscripcion_id = ? AND sesiones IS NULL").run(s.sesiones_por_bono, s.id);
    }
    if (seConfiguraAhora && s.periodicidad === "bono") {
      // Bono de antes de v1.8 que se configura ahora: sus cobros (un mes cada uno)
      // pasan a valer un bono completo, y se deja escrito para que no dependa del
      // tamaño del bono en el futuro.
      db.prepare("UPDATE pago_lineas SET sesiones = ? WHERE suscripcion_id = ? AND sesiones IS NULL").run(sesionesPorBono, s.id);
    }
    db.prepare(
      `UPDATE suscripciones SET actividad=?, etiqueta=?, importe=?, periodicidad=?, pagado_hasta=?, cobertura_manual=?, sesiones_por_bono=?, sesiones_manual=?, meses=?, activa=?, notas=? WHERE id=?`
    ).run(
      actividad ? String(actividad).trim().toLowerCase() : s.actividad,
      etiqueta ?? s.etiqueta,
      imp,
      nuevaPeriodicidad,
      nuevoPH,
      coberturaManual,
      sesionesPorBono,
      sesionesManual,
      meses,
      activa === undefined ? s.activa : activa ? 1 : 0,
      notas ?? s.notas,
      s.id
    );
    // Cuota MENSUAL que pasa a bono por sesiones: sus cobros anteriores eran meses,
    // no bonos → se marcan con 0 sesiones para que no cuenten. (Las líneas de un
    // bono creado como tal antes de v1.8 se quedan a NULL y cuentan un bono cada
    // una: ese dinero sí compró sesiones.) Solo se rellena una columna nueva; no
    // se cambia importe, fecha ni periodo de ningún pago.
    if (s.periodicidad === "mensual" && seraBono) {
      db.prepare("UPDATE pago_lineas SET sesiones = 0 WHERE suscripcion_id = ? AND sesiones IS NULL").run(s.id);
    }
  });
  tx();
  const actualizada = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(s.id) as SuscripcionRow;
  // Historial: pausar/reactivar tiene su propia línea; el resto, solo lo que cambió.
  const activaAntes = !!s.activa;
  const activaAhora = !!actualizada.activa;
  if (activaAntes !== activaAhora) {
    registrarEvento(s.socio_id, "actividad", `Actividad ${actualizada.actividad} ${activaAhora ? "reactivada" : "pausada"}`);
  }
  const cambios: string[] = [];
  if (actualizada.importe !== s.importe) cambios.push(`cuota ${eur(s.importe)} → ${eur(actualizada.importe)}`);
  if (actualizada.pagado_hasta !== s.pagado_hasta)
    cambios.push(`pagado hasta ${ddmm(s.pagado_hasta)} → ${ddmm(actualizada.pagado_hasta)} (a mano, sin cobro)`);
  if (actualizada.actividad !== s.actividad) cambios.push(`actividad ${s.actividad} → ${actualizada.actividad}`);
  if (actualizada.periodicidad !== s.periodicidad)
    cambios.push(
      actualizada.periodicidad === "bono"
        ? "pasa de cuota por tiempo a bono por sesiones"
        : s.sesiones_por_bono
          ? `pasa de bono de sesiones a cuota por tiempo (${duracionTxt(actualizada.meses).toLowerCase()})`
          : `«bono» de antes de la versión 1.8 reclasificado como cuota por tiempo (${duracionTxt(actualizada.meses).toLowerCase()}); fechas y cobros intactos`
    );
  else if ((actualizada.meses ?? 1) !== (s.meses ?? 1)) cambios.push(`duración ${duracionTxt(s.meses ?? 1).toLowerCase()} → ${duracionTxt(actualizada.meses).toLowerCase()}`);
  if (esBonoPorSesiones(actualizada)) {
    const ses = sesionesDe(actualizada);
    if (!eraBonoPorSesiones && s.periodicidad === "bono")
      cambios.push(
        `bono configurado con ${actualizada.sesiones_por_bono} sesiones (` +
          (papelitoHeredado
            ? `venía «ya estaba pagado» del papelito sin cobro: se le apuntan ${papelitoHeredado} sesiones a mano`
            : "sus cobros anteriores cuentan como un bono completo cada uno") +
          `; quedan ${ses.restantes})`
      );
    else if (actualizada.sesiones_por_bono !== s.sesiones_por_bono)
      cambios.push(`sesiones por bono ${s.sesiones_por_bono ?? "—"} → ${actualizada.sesiones_por_bono} (los cobros anteriores conservan las sesiones que valían)`);
    if ((actualizada.sesiones_manual ?? 0) !== (s.sesiones_manual ?? 0))
      cambios.push(`sesiones apuntadas a mano ${s.sesiones_manual ?? 0} → ${actualizada.sesiones_manual} (sin cobro; quedan ${ses.restantes})`);
  }
  if (cambios.length) registrarEvento(s.socio_id, "actividad", `Actividad ${actualizada.actividad} editada: ${cambios.join(" · ")}`);
  res.json(suscripcionConEstado(actualizada, hoyISO()));
});

// Borrar suscripcion.
suscripcionesRouter.delete("/suscripciones/:id", (req, res) => {
  const s = db.prepare("SELECT * FROM suscripciones WHERE id = ?").get(req.params.id) as SuscripcionRow | undefined;
  const info = db.prepare("DELETE FROM suscripciones WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Suscripcion no encontrada" });
  if (s) {
    const detalle = esBonoPorSesiones(s)
      ? (() => {
          const ses = sesionesDe(s);
          return `Bono de ${s.actividad} quitado (${eur(s.importe)} por ${s.sesiones_por_bono} sesiones; le quedaban ${ses.restantes} y se borran sus ${ses.usadas} sesiones picadas)`;
        })()
      : `Actividad ${s.actividad} quitada (cuota de ${eur(s.importe)}, cubría hasta ${ddmm(s.pagado_hasta)})`;
    registrarEvento(s.socio_id, "actividad", detalle);
  }
  res.json({ ok: true });
});

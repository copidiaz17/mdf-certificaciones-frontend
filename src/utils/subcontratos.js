// Formatos compartidos por las pantallas de subcontratos.

export const monto = (n) =>
  "$" + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const num = (n, dec = 2) =>
  Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: dec });

export const pct = (n) =>
  `${Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

// Las fechas llegan como AAAA-MM-DD: se formatean como texto para no pasar por
// la zona horaria, que en Argentina corre el día para atrás.
export const fecha = (f) => {
  if (!f) return "—";
  const [a, m, d] = String(f).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : String(f);
};

export const periodo = (desde, hasta) => `${fecha(desde)} al ${fecha(hasta)}`;

export const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
export const r4 = (n) => Math.round(Number(n || 0) * 10000) / 10000;

export function sumarDias(f, dias) {
  const [a, m, d] = String(f).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

// Clase de cada renglón de la OC. Los adicionales son de dos clases: más
// cantidad de un rubro que ya estaba, o un rubro que no existía.
export const CLASES = {
  contrato: "Contrato",
  de_mas: "Adicional · cargado de más",
  nuevo: "Adicional · ítem nuevo",
};

/**
 * Desdobla un renglón en lo contratado y lo cargado de más, con las cantidades
 * totales anterior y actual. Es el mismo cálculo que hace el servidor
 * (utils/subcontratos.js → desglosar), para recalcular mientras se escribe.
 */
export function desglosar({ contratado, precioVigente, ant, act }) {
  const c = Number(contratado || 0);
  const qAnt = Number(ant.cantidad || 0), qAct = Number(act.cantidad || 0);
  const qAcum = qAnt + qAct;
  const pAnt = qAnt ? Number(ant.importe || 0) / qAnt : Number(precioVigente || 0);
  const pAct = Number(act.precio ?? precioVigente ?? 0);
  const capAnt = Math.min(qAnt, c), capAcum = Math.min(qAcum, c);
  const capAct = capAcum - capAnt;
  const excAnt = qAnt - capAnt, excAcum = qAcum - capAcum;
  const excAct = excAcum - excAnt;
  const tramo = (a, b, pend) => ({
    cantidad: { anterior: r4(a), actual: r4(b), acumulado: r4(a + b), pendiente: r4(pend) },
    importe: { anterior: r2(a * pAnt), actual: r2(b * pAct), acumulado: r2(a * pAnt + b * pAct), pendiente: r2(pend * Number(precioVigente || 0)) },
  });
  return {
    principal: tramo(capAnt, capAct, Math.max(0, c - qAcum)),
    deMas: excAcum > 0.00005 ? { ...tramo(excAnt, excAct, 0), total: r2(excAcum * Number(precioVigente || 0)) } : null,
  };
}

export const ESTADOS ={ vigente: "Vigente", finalizado: "Finalizado", anulado: "Anulado" };
export const TIPOS_DESCUENTO = { adelanto: "Adelanto de dinero", herramientas: "Herramientas", otro: "Otro" };

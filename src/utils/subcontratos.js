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

export const ESTADOS = { vigente: "Vigente", finalizado: "Finalizado", anulado: "Anulado" };
export const TIPOS_DESCUENTO = { adelanto: "Adelanto de dinero", herramientas: "Herramientas", otro: "Otro" };

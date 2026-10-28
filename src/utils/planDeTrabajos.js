// El plan de trabajos —el plan original o un replanteo— en Excel y en PDF.
//
// Antes solo se bajaba un PDF de cada mes, sin logo; José pidió el replanteo
// también en Excel (28/10/2026). Hay dos papeles:
//   - la versión entera, como la grilla del replanteo: cada ítem con lo
//     ejecutado al corte, lo que le falta, lo planificado mes a mes y lo que
//     queda; abajo la incidencia de cada mes en la obra y el avance acumulado;
//   - un mes suelto, como el PDF de siempre.
// Las cuentas son las de ReplanteoView: si el papel dijera otra cosa que la
// pantalla, no serviría para nada.
import { EMPRESA } from "../config/empresa.js";
import { cargarLogo } from "./logoEmpresa.js";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MOTIVOS = { tiempo: "Extensión de plazo", adicional_item: "Ítems adicionales", ambos: "Extensión de plazo + adicionales" };
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const fmtFecha = (f) => {
  if (!f) return "-";
  const [a, m, d] = String(f).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : String(f);
};
const fmtNum = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => `${fmtNum(n)} %`;
const fmtMonto = (n) => `$ ${fmtNum(n)}`;
// La fuente estándar del PDF no tiene algunos signos (−, –, —, →): con ellos el
// renglón sale con las letras separadas. Todo texto libre pasa por acá.
const plano = (t) => String(t ?? "").replace(/[−–—]/g, "-").replace(/→/g, "a").replace(/[“”]/g, '"');
const etiquetaMes = (fecha) => { const [a, m] = String(fecha).slice(0, 7).split("-").map(Number); return `${MESES[m - 1]} ${String(a).slice(2)}`; };
const archivo = (t) => plano(t).replace(/[\\/:*?"<>|]+/g, "-").trim();

/**
 * Arma los números de una versión del plan.
 * @param p.obra      nombre de la obra
 * @param p.version   0 = plan original; 1, 2… = replanteo
 * @param p.motivo    del replanteo
 * @param p.fecha_corte  hasta dónde estaba cargado el avance (replanteo)
 * @param p.items     el pliego: [{ id, numeroItem, descripcionItem, unidadMedida, cantidad, costoParcial, origen, avance_real?, disponible? }]
 * @param p.meses     [{ fecha_desde, fecha_hasta, items: [{ pliego_item_id, porcentaje }] }]
 */
export function armarPlan({ obra, version, motivo, fecha_corte, items, meses }) {
  const conReal = Number(version) > 0;
  const presupuesto = items.reduce((s, i) => s + Number(i.costoParcial || 0), 0);
  const ms = [...meses]
    .sort((a, b) => String(a.fecha_desde).localeCompare(String(b.fecha_desde)))
    .map((m) => ({
      fecha_desde: String(m.fecha_desde).slice(0, 10),
      fecha_hasta: String(m.fecha_hasta).slice(0, 10),
      etiqueta: etiquetaMes(m.fecha_desde),
      porItem: new Map((m.items || []).map((x) => [Number(x.pliego_item_id), Number(x.porcentaje || 0)])),
    }));

  const todas = items.map((i) => {
    const valores = ms.map((m) => m.porItem.get(Number(i.id)) || 0);
    const planificado = r2(valores.reduce((s, v) => s + v, 0));
    const real = conReal ? r2(i.avance_real) : 0;
    const falta = conReal ? r2(i.disponible) : 100;
    return {
      numero: i.numeroItem, descripcion: i.descripcionItem, unidad: i.unidadMedida || "",
      cantidad: Number(i.cantidad || 0), costo: Number(i.costoParcial || 0), origen: i.origen || "original",
      real, falta, valores, planificado, queda: r2(falta - planificado),
    };
  });
  const pond = (x) => (presupuesto ? r2((x / presupuesto) * 100) : 0);
  for (const [k, m] of ms.entries()) m.incidencia = pond(todas.reduce((s, f) => s + (f.valores[k] / 100) * f.costo, 0));
  const avanceBase = conReal ? pond(todas.reduce((s, f) => s + (Math.min(100, f.real) / 100) * f.costo, 0)) : 0;
  let ac = avanceBase;
  for (const m of ms) { ac = r2(ac + m.incidencia); m.acumulado = ac; }
  const totalPlanificado = r2(ms.reduce((s, m) => s + m.incidencia, 0));

  return {
    obra, version: Number(version), conReal,
    titulo: conReal ? `Replanteo N° ${version}` : "Plan original",
    motivo: conReal ? (MOTIVOS[motivo] || motivo || "-") : null,
    fecha_corte: conReal ? fecha_corte : null,
    presupuesto: r2(presupuesto),
    meses: ms,
    // Van al papel los ítems con algo planificado y, en un replanteo, los que
    // tienen algo por ejecutar aunque no se les haya planificado nada (es lo
    // que muestra la grilla con "Solo ítems con algo por ejecutar").
    filas: todas.filter((f) => f.planificado > 0 || (conReal && f.falta > 0)),
    itemsDelPliego: todas.length,
    avanceBase, totalPlanificado,
    final: r2(avanceBase + totalPlanificado),
  };
}

// ── Excel ────────────────────────────────────────────────────────────────
const argb = (rgb) => "FF" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase();
// El color de la empresa mezclado con blanco: para fondos que no tapen el texto.
const aclarar = (rgb, cuanto) => rgb.map((c) => Math.round(c + (255 - c) * cuanto));
const PCT = '0.00" %"';
const DINERO = '"$" #,##0.00';
const ahoraTexto = () => {
  const d = new Date(), dos = (n) => String(n).padStart(2, "0");
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} a las ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};

async function libroNuevo() {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = EMPRESA.nombre;
  libro.company = EMPRESA.nombre;
  libro.created = new Date();
  return libro;
}

// El encabezado de la empresa: logo a la izquierda; a la derecha, sobre todo
// el ancho, el nombre, el título, la bajada y cuándo se generó; debajo la franja.
async function encabezado(libro, hoja, n, { titulo, bajada }) {
  const logo = await cargarLogo();
  if (logo) {
    const alto = 60;
    hoja.addImage(libro.addImage({ base64: logo.dataUrl, extension: logo.formato === "PNG" ? "png" : "jpeg" }),
      { tl: { col: 0.15, row: 0.25 }, ext: { width: Math.round((alto * logo.ancho) / logo.alto), height: alto } });
  }
  const color = argb(EMPRESA.color);
  [
    [EMPRESA.nombre, { size: 9, bold: true, color: { argb: "FF6B7280" } }, 16],
    [titulo, { size: 17, bold: true, color: { argb: color } }, 26],
    [bajada, { size: 11, color: { argb: "FF1F2937" } }, 18],
    [`Generado el ${ahoraTexto()}`, { size: 8.5, italic: true, color: { argb: "FF6B7280" } }, 15],
  ].forEach(([valor, font, alto], k) => {
    if (n > 1) hoja.mergeCells(k + 1, 1, k + 1, n);
    const c = hoja.getCell(k + 1, 1);
    c.value = valor;
    c.font = font;
    c.alignment = { horizontal: "right", vertical: "middle" };
    hoja.getRow(k + 1).height = alto;
  });
  for (let c = 1; c <= n; c++) hoja.getCell(5, c).border = { bottom: { style: "medium", color: { argb: color } } };
  hoja.getRow(5).height = 6;
}

function cabeceraTabla(fila, textos, { centrar = [] } = {}) {
  textos.forEach((t, i) => {
    const c = fila.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(EMPRESA.color) } };
    c.alignment = { vertical: "middle", horizontal: centrar.includes(i) ? "center" : "left", wrapText: true };
    c.border = { right: { style: "thin", color: { argb: "FFFFFFFF" } } };
  });
  fila.height = 30;
}

// Datos sueltos arriba de la tabla: la etiqueta en la columna 2, el valor al lado.
function datos(hoja, desde, lista, n) {
  let f = desde;
  for (const [etq, valor, formato] of lista) {
    const e = hoja.getCell(f, 2);
    e.value = etq;
    e.font = { bold: true, size: 9.5, color: { argb: "FF6B7280" } };
    e.alignment = { horizontal: "right" };
    const hasta = Math.min(n, 6);
    if (hasta > 3) hoja.mergeCells(f, 3, f, hasta);
    const v = hoja.getCell(f, 3);
    v.value = valor;
    if (formato) v.numFmt = formato;
    v.font = { bold: true, size: 10.5, color: { argb: "FF1F2937" } };
    v.alignment = { horizontal: "left" };
    f++;
  }
  return f;
}

async function bajar(libro, nombre) {
  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** La versión entera del plan (lo que devuelve armarPlan) en Excel. */
export async function descargarPlanExcel(plan) {
  const libro = await libroNuevo();
  const real = plan.conReal;
  const cols = [
    { t: "Ítem", w: 8 }, { t: "Descripción", w: 48 }, { t: "Unidad", w: 8 }, { t: "Cantidad", w: 11 },
    ...(real ? [{ t: "Ejecutado al corte", w: 11 }, { t: "Falta", w: 9 }] : []),
    ...plan.meses.map((m) => ({ t: m.etiqueta, w: 9, mes: true })),
    { t: "Planificado", w: 11 },
    ...(real ? [{ t: "Queda", w: 9 }] : []),
  ];
  const n = cols.length;
  const c0 = real ? 7 : 5; // la columna del primer mes
  const titulo = `${plan.titulo} · Plan de trabajos`;
  const meses = plan.meses.length ? `${plan.meses[0].etiqueta} a ${plan.meses[plan.meses.length - 1].etiqueta}` : "-";

  const hoja = libro.addWorksheet("Plan de trabajos", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.5, header: 0.2, footer: 0.25 } },
    headerFooter: { oddFooter: `&L&8${EMPRESA.nombre.replace(/&/g, "&&")} · ${plan.titulo} · ${String(plan.obra || "").replace(/&/g, "&&")}&R&8Página &P de &N` },
  });
  hoja.columns = cols.map((c) => ({ width: c.w }));
  await encabezado(libro, hoja, n, { titulo, bajada: plan.obra || "" });

  let f = datos(hoja, 7, [
    ...(real ? [["Motivo", plan.motivo], ["Desde el avance cargado hasta", fmtFecha(plan.fecha_corte)]] : []),
    ["Meses", `${plan.meses.length} (${meses})`],
    ["Presupuesto", plan.presupuesto, DINERO],
    ...(real ? [["Avance real al corte", plan.avanceBase, PCT]] : []),
    ["Al terminar el plan la obra llega al", plan.final, PCT],
  ], n);
  f++;

  const hR = f;
  cabeceraTabla(hoja.getRow(hR), cols.map((c) => c.t), { centrar: cols.map((c, i) => (i >= 2 ? i : -1)) });
  const suave = argb(aclarar(EMPRESA.color, 0.88));
  const fino = { style: "thin", color: { argb: "FFE5E7EB" } };
  plan.filas.forEach((x, k) => {
    const fila = hoja.getRow(hR + 1 + k);
    fila.values = [
      x.numero, x.descripcion, x.unidad, x.cantidad,
      ...(real ? [x.real, x.falta] : []),
      ...x.valores.map((v) => (v > 0 ? v : null)),
      x.planificado,
      ...(real ? [x.queda] : []),
    ];
    fila.getCell(4).numFmt = "#,##0.00";
    for (let c = 5; c <= n; c++) fila.getCell(c).numFmt = PCT;
    fila.eachCell({ includeEmpty: true }, (celda, col) => {
      if (col > n) return;
      celda.border = { bottom: fino };
      celda.font = { size: 9.5, color: { argb: "FF1F2937" }, ...(col === n - (real ? 1 : 0) ? { bold: true } : {}) };
      celda.alignment = { vertical: "middle", horizontal: col >= 3 ? (col === 3 ? "center" : "right") : "left", wrapText: col === 2 };
      // Lo planificado en cada mes, con un fondo suave: se lee la forma del plan.
      if (col >= c0 && col < c0 + plan.meses.length && Number(celda.value) > 0) {
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: suave } };
      }
    });
    if (real && x.queda < -0.009) fila.getCell(n).font = { bold: true, color: { argb: "FFB91C1C" } };
    const renglones = Math.max(1, Math.ceil(String(x.descripcion || "").length / 50));
    fila.height = renglones > 1 ? 13 * renglones + 3 : 16;
  });
  let pie = hR + 1 + plan.filas.length;
  if (!plan.filas.length) {
    hoja.mergeCells(pie, 1, pie, n);
    hoja.getCell(pie, 1).value = "No hay ítems planificados en esta versión.";
    hoja.getCell(pie, 1).font = { italic: true, color: { argb: "FF6B7280" } };
    pie++;
  }

  // ── Abajo: la incidencia de cada mes y el avance acumulado de la obra ──
  const color = argb(EMPRESA.color);
  const filaPie = (texto, valores, extra) => {
    const fila = hoja.getRow(pie++);
    hoja.mergeCells(fila.number, 1, fila.number, 4);
    fila.getCell(1).value = texto;
    if (real && extra?.real !== undefined) fila.getCell(5).value = extra.real;
    valores.forEach((v, k) => { fila.getCell(c0 + k).value = v; });
    if (extra?.total !== undefined) fila.getCell(c0 + plan.meses.length).value = extra.total;
    for (let c = 1; c <= n; c++) {
      const celda = fila.getCell(c);
      celda.font = { bold: true, size: 10, color: { argb: color } };
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(aclarar(EMPRESA.color, 0.93)) } };
      celda.border = { top: { style: "thin", color: { argb: color } } };
      if (c >= 5) { celda.numFmt = PCT; celda.alignment = { horizontal: "right" }; }
    }
    fila.getCell(1).alignment = { horizontal: "right" };
    fila.height = 18;
  };
  filaPie("Incidencia en la obra", plan.meses.map((m) => m.incidencia), { total: plan.totalPlanificado });
  filaPie("Avance de la obra acumulado", plan.meses.map((m) => m.acumulado), { real: plan.avanceBase });

  hoja.views = [{ state: "frozen", xSplit: 2, ySplit: hR, showGridLines: false }];
  hoja.pageSetup.printTitlesRow = `${hR}:${hR}`;
  if (plan.filas.length) hoja.autoFilter = { from: { row: hR, column: 1 }, to: { row: hR + plan.filas.length, column: n } };

  // ── Segunda hoja: la curva, mes a mes ──
  const curva = libro.addWorksheet("Mes a mes", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter: { oddFooter: `&L&8${EMPRESA.nombre.replace(/&/g, "&&")} · ${plan.titulo}&R&8Página &P de &N` },
  });
  curva.columns = [{ width: 12 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 22 }];
  await encabezado(libro, curva, 5, { titulo: `${plan.titulo} · Mes a mes`, bajada: plan.obra || "" });
  cabeceraTabla(curva.getRow(7), ["Mes", "Desde", "Hasta", "Incidencia en la obra", "Avance acumulado"], { centrar: [1, 2, 3, 4] });
  let j = 8;
  if (real) {
    const fila = curva.getRow(j++);
    fila.values = ["Al corte", "", fmtFecha(plan.fecha_corte), null, plan.avanceBase];
    fila.getCell(5).numFmt = PCT;
    fila.eachCell({ includeEmpty: true }, (c, col) => { if (col <= 5) { c.font = { italic: true, color: { argb: "FF6B7280" } }; c.border = { bottom: fino }; } });
  }
  for (const m of plan.meses) {
    const fila = curva.getRow(j++);
    fila.values = [m.etiqueta, fmtFecha(m.fecha_desde), fmtFecha(m.fecha_hasta), m.incidencia, m.acumulado];
    fila.getCell(4).numFmt = PCT;
    fila.getCell(5).numFmt = PCT;
    fila.eachCell({ includeEmpty: true }, (c, col) => { if (col <= 5) { c.border = { bottom: fino }; c.alignment = { horizontal: col === 1 ? "left" : "right" }; } });
    fila.getCell(5).font = { bold: true, color: { argb: color } };
  }
  curva.views = [{ state: "frozen", ySplit: 7, showGridLines: false }];

  await bajar(libro, `${archivo(plan.titulo)} - ${archivo(plan.obra || "obra")}.xlsx`);
}

// ── PDF ──────────────────────────────────────────────────────────────────
// Se cargan recién al pedir un PDF. Los nombres se buscan de las dos formas en
// que llegan según cómo se empaquete la librería.
async function pdfNuevo(orientacion) {
  const mp = await import("jspdf");
  const ma = await import("jspdf-autotable");
  const jsPDF = mp.jsPDF || mp.default?.jsPDF || mp.default;
  const autoTable = ma.autoTable || ma.default?.autoTable || ma.default?.default || ma.default;
  return { doc: new jsPDF({ orientation: orientacion, unit: "mm", format: "a4" }), autoTable };
}

// El encabezado del papel, igual que el del certificado del contratista: el
// logo y la empresa a la izquierda; a la derecha qué papel es.
async function encabezadoPdf(doc, { obra, arriba, titulo }) {
  const W = doc.internal.pageSize.getWidth(), M = 12, color = EMPRESA.color;
  const logo = await cargarLogo();
  let xTexto = M;
  if (logo) {
    const proporcion = logo.ancho / logo.alto;
    let alto = 22, ancho = alto * proporcion;
    if (ancho > 48) { ancho = 48; alto = ancho / proporcion; }
    doc.addImage(logo.dataUrl, logo.formato, M, 8 + (22 - alto) / 2, ancho, alto);
    xTexto = M + ancho + 6;
  }
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...color);
  doc.text(EMPRESA.nombre, xTexto, 15);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90);
  doc.text(plano(`Obra: ${obra || "-"}`), xTexto, 21);
  doc.text(EMPRESA.ciudad, xTexto, 26);
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(30);
  doc.text(arriba, W - M, 15, { align: "right" });
  doc.setFontSize(18).setTextColor(...color);
  doc.text(plano(titulo), W - M, 24, { align: "right" });
  doc.setDrawColor(...color).setLineWidth(0.6);
  doc.line(M, 33, W - M, 33);
}

function datoPdf(doc, etq, valor, x, y) {
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(110);
  doc.text(etq.toUpperCase(), x, y);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(25);
  doc.text(plano(valor || "-"), x, y + 5);
}

function piesPdf(doc, texto) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(150);
    doc.text(plano(texto), M, H - 6);
    doc.text(`Página ${i} de ${paginas}`, W - M, H - 6, { align: "right" });
  }
}

/** La versión entera del plan (lo que devuelve armarPlan) en PDF apaisado. */
export async function descargarPlanPdf(plan) {
  const { doc, autoTable } = await pdfNuevo("landscape");
  const W = doc.internal.pageSize.getWidth(), M = 12;
  const real = plan.conReal;
  await encabezadoPdf(doc, { obra: plan.obra, arriba: "PLAN DE TRABAJOS", titulo: plan.titulo });

  const col = (W - 2 * M) / 5;
  const lista = [
    ...(real ? [["Motivo", plan.motivo], ["Avance cargado hasta", fmtFecha(plan.fecha_corte)]] : []),
    ["Meses", plan.meses.length ? `${plan.meses.length} (${plan.meses[0].etiqueta} a ${plan.meses[plan.meses.length - 1].etiqueta})` : "-"],
    ["Presupuesto", fmtMonto(plan.presupuesto)],
    ...(real ? [["Avance real al corte", fmtPct(plan.avanceBase)]] : []),
  ];
  lista.slice(0, 5).forEach(([e, v], k) => datoPdf(doc, e, v, M + k * col, 40));

  // Columnas: con muchos meses la letra baja y la descripción se angosta.
  const nMeses = plan.meses.length;
  const numericas = (real ? 2 : 0) + nMeses + 1 + (real ? 1 : 0);
  const fuente = nMeses > 16 ? 5.2 : nMeses > 12 ? 5.8 : nMeses > 8 ? 6.5 : 7.2;
  const anchoNum = Math.max(8.5, Math.min(15, (W - 2 * M - 11 - 60) / numericas));
  const anchoDesc = Math.max(45, W - 2 * M - 11 - anchoNum * numericas);

  const p = (v) => (v > 0 ? fmtNum(v) : "");
  const head = [["Ítem", "Descripción", ...(real ? ["Real", "Falta"] : []), ...plan.meses.map((m) => m.etiqueta), "Plan.", ...(real ? ["Queda"] : [])]];
  const body = plan.filas.map((x) => [
    x.numero || "", plano(x.descripcion), ...(real ? [fmtNum(x.real), fmtNum(x.falta)] : []),
    ...x.valores.map(p), fmtNum(x.planificado), ...(real ? [fmtNum(x.queda)] : []),
  ]);
  const vacios = (k) => Array.from({ length: k }, () => "");
  const foot = [
    ["", "Incidencia en la obra", ...(real ? vacios(2) : []), ...plan.meses.map((m) => fmtNum(m.incidencia)), fmtNum(plan.totalPlanificado), ...(real ? [""] : [])],
    ["", "Avance de la obra acumulado", ...(real ? [fmtNum(plan.avanceBase), ""] : []), ...plan.meses.map((m) => fmtNum(m.acumulado)), "", ...(real ? [""] : [])],
  ];
  const c0 = real ? 4 : 2;
  const columnStyles = { 0: { cellWidth: 11 }, 1: { cellWidth: anchoDesc } };
  for (let c = 2; c < head[0].length; c++) columnStyles[c] = { cellWidth: anchoNum, halign: "right" };
  const suave = aclarar(EMPRESA.color, 0.88);
  autoTable(doc, {
    startY: 52,
    margin: { left: M, right: M, bottom: 14 },
    theme: "grid",
    head, body, foot,
    // La incidencia y el acumulado van una vez, al final (si no, la tabla los
    // repite en cada hoja y parecen subtotales), y un ítem no se parte en dos hojas.
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    styles: { fontSize: fuente, cellPadding: 1.2, lineColor: [215, 215, 215], lineWidth: 0.1, valign: "middle", textColor: 30 },
    headStyles: { fillColor: EMPRESA.color, textColor: 255, fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: aclarar(EMPRESA.color, 0.9), textColor: EMPRESA.color, fontStyle: "bold", halign: "right" },
    columnStyles,
    didParseCell: (h) => {
      if (h.section === "body" && h.column.index >= c0 && h.column.index < c0 + nMeses && h.cell.raw) h.cell.styles.fillColor = suave;
      if (h.section === "foot" && h.column.index === 1) h.cell.styles.halign = "right";
    },
  });

  const y = doc.lastAutoTable.finalY + 7;
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...EMPRESA.color);
  doc.text(`Al terminar el plan la obra llega al ${fmtPct(plan.final)}.`, M, Math.min(y, doc.internal.pageSize.getHeight() - 12));
  piesPdf(doc, `${EMPRESA.nombre} · ${plan.titulo} · Plan de trabajos · ${plan.obra || ""}`);
  doc.save(`${archivo(plan.titulo)} - ${archivo(plan.obra || "obra")}.pdf`);
}

/**
 * Un mes del plan, en PDF o en Excel.
 * @param m.obra, m.version, m.desde, m.hasta, m.periodo (% ponderado del mes), m.acumulado (% ponderado acumulado)
 * @param m.items [{ numero, descripcion, unidad, cantidad, porcentaje }]
 */
function tituloMes(m) {
  return Number(m.version || 0) === 0 ? "Plan original" : `Replanteo N° ${m.version}`;
}

export async function descargarMesPdf(m) {
  const { doc, autoTable } = await pdfNuevo("portrait");
  const W = doc.internal.pageSize.getWidth(), M = 12;
  await encabezadoPdf(doc, { obra: m.obra, arriba: "PLAN DE TRABAJOS", titulo: `${tituloMes(m)} · ${etiquetaMes(m.desde)}` });
  const col = (W - 2 * M) / 3;
  datoPdf(doc, "Período", `del ${fmtFecha(m.desde)} al ${fmtFecha(m.hasta)}`, M, 40);
  datoPdf(doc, "Incidencia del mes en la obra", fmtPct(m.periodo), M + col, 40);
  datoPdf(doc, "Avance acumulado planificado", fmtPct(m.acumulado), M + 2 * col, 40);
  autoTable(doc, {
    startY: 52,
    margin: { left: M, right: M, bottom: 14 },
    theme: "grid",
    head: [["Ítem", "Descripción", "Unidad", "Cantidad", "% planificado"]],
    body: m.items.map((x) => [x.numero || "", plano(x.descripcion), x.unidad || "", fmtNum(x.cantidad), fmtPct(x.porcentaje)]),
    styles: { fontSize: 8, cellPadding: 1.6, lineColor: [215, 215, 215], lineWidth: 0.1, valign: "middle", textColor: 30 },
    headStyles: { fillColor: EMPRESA.color, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: aclarar(EMPRESA.color, 0.93) },
    columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 104 }, 2: { cellWidth: 16, halign: "center" }, 3: { cellWidth: 24, halign: "right" }, 4: { cellWidth: 28, halign: "right" } },
  });
  piesPdf(doc, `${EMPRESA.nombre} · ${tituloMes(m)} · ${fmtFecha(m.desde)} al ${fmtFecha(m.hasta)} · ${m.obra || ""}`);
  doc.save(`${archivo(tituloMes(m))} - ${String(m.desde).slice(0, 7)} - ${archivo(m.obra || "obra")}.pdf`);
}

export async function descargarMesExcel(m) {
  const libro = await libroNuevo();
  const n = 5;
  const hoja = libro.addWorksheet("Mes", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 } },
    headerFooter: { oddFooter: `&L&8${EMPRESA.nombre.replace(/&/g, "&&")} · ${tituloMes(m)}&R&8Página &P de &N` },
  });
  hoja.columns = [{ width: 9 }, { width: 60 }, { width: 9 }, { width: 13 }, { width: 14 }];
  await encabezado(libro, hoja, n, { titulo: `${tituloMes(m)} · ${etiquetaMes(m.desde)}`, bajada: m.obra || "" });
  let f = datos(hoja, 7, [
    ["Período", `del ${fmtFecha(m.desde)} al ${fmtFecha(m.hasta)}`],
    ["Incidencia del mes en la obra", m.periodo, PCT],
    ["Avance acumulado planificado", m.acumulado, PCT],
  ], n);
  f++;
  cabeceraTabla(hoja.getRow(f), ["Ítem", "Descripción", "Unidad", "Cantidad", "% planificado"], { centrar: [2, 3, 4] });
  const fino = { style: "thin", color: { argb: "FFE5E7EB" } };
  const suave = argb(aclarar(EMPRESA.color, 0.93));
  m.items.forEach((x, k) => {
    const fila = hoja.getRow(f + 1 + k);
    fila.values = [x.numero, x.descripcion, x.unidad, Number(x.cantidad || 0), Number(x.porcentaje || 0)];
    fila.getCell(4).numFmt = "#,##0.00";
    fila.getCell(5).numFmt = PCT;
    fila.eachCell({ includeEmpty: true }, (c, col) => {
      if (col > n) return;
      c.border = { bottom: fino };
      c.alignment = { vertical: "middle", horizontal: col === 3 ? "center" : col >= 4 ? "right" : "left", wrapText: col === 2 };
      if (k % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: suave } };
    });
  });
  hoja.views = [{ state: "frozen", ySplit: f, showGridLines: false }];
  await bajar(libro, `${archivo(tituloMes(m))} - ${String(m.desde).slice(0, 7)} - ${archivo(m.obra || "obra")}.xlsx`);
}

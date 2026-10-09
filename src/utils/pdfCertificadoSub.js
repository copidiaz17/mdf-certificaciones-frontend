// PDF del certificado del subcontratista.
//
// Antes se imprimía la pantalla (window.print): salía una captura del
// sistema, con botones, colores oscuros y la tabla cortada. Este es el
// documento que se le entrega al contratista y se firma: logo, número de
// certificado, período, cada ítem con lo anterior, lo de este período y lo
// acumulado, los descuentos y el total a pagar.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EMPRESA } from "../config/empresa.js";

const fmtMonto = (n) =>
  "$ " + Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n, dec = 2) =>
  Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: dec });
const fmtPct = (n) =>
  Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
// La fuente estándar del PDF no tiene algunos signos tipográficos (el menos −,
// los guiones – y —): con ellos el renglón entero sale con las letras separadas
// ("A d e l a n t o …"). Todo texto libre pasa por acá.
const plano = (t) => String(t ?? "").replace(/[−–—]/g, "-").replace(/[“”]/g, '"');
const fmtFecha = (f) => {
  if (!f) return "-";
  const [a, m, d] = String(f).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : String(f);
};

/** El logo como imagen embebida, con su proporción. Si no carga, el PDF sale igual. */
async function cargarLogo(url) {
  try {
    const blob = await (await fetch(url)).blob();
    const dataUrl = await new Promise((ok, mal) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = mal;
      r.readAsDataURL(blob);
    });
    const { ancho, alto } = await new Promise((ok, mal) => {
      const img = new Image();
      img.onload = () => ok({ ancho: img.naturalWidth, alto: img.naturalHeight });
      img.onerror = mal;
      img.src = dataUrl;
    });
    return { dataUrl, ancho, alto, formato: blob.type.includes("png") ? "PNG" : "JPEG" };
  } catch {
    return null;
  }
}

/**
 * @param d.obra        nombre de la obra
 * @param d.sub         { subcontratista, cuit, numero_oc }
 * @param d.cert        { numero, desde, hasta, fecha, observaciones }
 * @param d.precios     texto de con qué precios va (o null)
 * @param d.secciones   [{ titulo, filas: [{ numero, descripcion, unidad, contratado, precio, total,
 *                       q: {anterior, actual, acumulado}, imp: {anterior, actual, acumulado}, pct, etiqueta }] }]
 * @param d.totales     { contrato, anterior, actual, acumulado, avance }
 * @param d.descuentos  [{ etiqueta, importe }]
 * @param d.aPagar
 * @param d.borrador    true si todavía no se emitió
 */
export async function descargarPdfCertificado(d) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const color = EMPRESA.color;

  // ── Encabezado ─────────────────────────────────────────────────────────
  const logo = await cargarLogo(EMPRESA.logo);
  let xTexto = M;
  if (logo) {
    // Entra en un recuadro de 48 × 22 mm sin deformarse: el de Falube es
    // cuadrado y el de MDF, apaisado.
    const proporcion = logo.ancho / logo.alto;
    let alto = 22, ancho = alto * proporcion;
    if (ancho > 48) { ancho = 48; alto = ancho / proporcion; }
    doc.addImage(logo.dataUrl, logo.formato, M, 8 + (22 - alto) / 2, ancho, alto);
    xTexto = M + ancho + 6;
  }
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...color);
  doc.text(EMPRESA.nombre, xTexto, 15);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90);
  doc.text(plano(`Obra: ${d.obra || "-"}`), xTexto, 21);
  doc.text(EMPRESA.ciudad, xTexto, 26);

  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(30);
  doc.text("CERTIFICADO DE SUBCONTRATISTA", W - M, 15, { align: "right" });
  doc.setFontSize(20).setTextColor(...color);
  doc.text(`N° ${d.cert.numero}`, W - M, 24, { align: "right" });

  doc.setDrawColor(...color).setLineWidth(0.6);
  doc.line(M, 33, W - M, 33);

  // ── Datos del certificado ──────────────────────────────────────────────
  const dato = (etq, valor, x, y) => {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(110);
    doc.text(etq.toUpperCase(), x, y);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(25);
    doc.text(plano(valor || "-"), x, y + 5);
  };
  const col = (W - 2 * M) / 4;
  dato("Subcontratista", d.sub.subcontratista, M, 40);
  dato("CUIT", d.sub.cuit, M + col, 40);
  dato("Orden de compra", d.sub.numero_oc ? `N° ${d.sub.numero_oc}` : null, M + 2 * col, 40);
  dato("Fecha de emisión", fmtFecha(d.cert.fecha), M + 3 * col, 40);
  dato("Período", `del ${fmtFecha(d.cert.desde)} al ${fmtFecha(d.cert.hasta)}`, M, 52);
  if (d.precios) dato("Precios", d.precios, M + col, 52);

  if (d.borrador) {
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(185, 28, 28);
    doc.text("BORRADOR - TODAVÍA NO EMITIDO", W - M, 57, { align: "right" });
  }

  // ── Ítems ──────────────────────────────────────────────────────────────
  const cuerpo = [];
  for (const s of d.secciones) {
    if (!s.filas.length) continue;
    cuerpo.push([{ content: s.titulo.toUpperCase(), colSpan: 13, styles: { fontStyle: "bold", fillColor: [238, 238, 238], textColor: 60 } }]);
    for (const f of s.filas) {
      cuerpo.push([
        f.numero || "",
        plano(f.etiqueta ? `${f.descripcion}\n${f.etiqueta}` : f.descripcion),
        f.unidad || "",
        fmtNum(f.contratado, 4),
        fmtMonto(f.precio),
        fmtMonto(f.total),
        fmtNum(f.q.anterior, 4),
        fmtNum(f.q.actual, 4),
        fmtNum(f.q.acumulado, 4),
        fmtPct(f.pct),
        fmtMonto(f.imp.anterior),
        fmtMonto(f.imp.actual),
        fmtMonto(f.imp.acumulado),
      ]);
    }
  }
  const t = d.totales;
  autoTable(doc, {
    startY: 62,
    margin: { left: M, right: M },
    theme: "grid",
    head: [
      [
        { content: "Ítem", rowSpan: 2 }, { content: "Descripción", rowSpan: 2 }, { content: "Un.", rowSpan: 2 },
        { content: "Acordado", colSpan: 3 }, { content: "Cantidades", colSpan: 4 }, { content: "Importes", colSpan: 3 },
      ],
      ["Cantidad", "P. unitario", "Total", "Anterior", "Este período", "Acumulado", "% acum.", "Anterior", "Este período", "Acumulado"],
    ],
    body: cuerpo,
    foot: [[
      { content: "TOTALES", colSpan: 5, styles: { halign: "right" } },
      fmtMonto(t.contrato), "", "", "", fmtPct(t.avance),
      fmtMonto(t.anterior), fmtMonto(t.actual), fmtMonto(t.acumulado),
    ]],
    styles: { fontSize: 7.2, cellPadding: 1.4, lineColor: [210, 210, 210], lineWidth: 0.1, valign: "middle", textColor: 30 },
    headStyles: { fillColor: color, textColor: 255, fontStyle: "bold", halign: "center", fontSize: 7.2 },
    footStyles: { fillColor: [245, 245, 245], textColor: 20, fontStyle: "bold", halign: "right" },
    columnStyles: {
      0: { cellWidth: 11 }, 1: { cellWidth: 62 }, 2: { cellWidth: 10, halign: "center" },
      3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" },
      6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" }, 8: { halign: "right" }, 9: { halign: "right" },
      10: { halign: "right" }, 11: { halign: "right", fontStyle: "bold" }, 12: { halign: "right" },
    },
    // "Este período" es lo que se paga: se destaca la columna.
    didParseCell: (h) => {
      if (h.section === "body" && (h.column.index === 7 || h.column.index === 11) && !h.cell.raw?.colSpan) {
        h.cell.styles.fillColor = [250, 247, 235];
      }
    },
  });

  // ── Resumen a pagar ────────────────────────────────────────────────────
  let y = doc.lastAutoTable.finalY + 6;
  const anchoResumen = 105;
  const filasResumen = [
    ["Certificado de este período", fmtMonto(t.actual)],
    ...d.descuentos.map((x) => [`(-) ${plano(x.etiqueta)}`, fmtMonto(x.importe)]),
  ];
  // Solo pasa a otra hoja si el resumen no entra en esta.
  if (y + 10 + (filasResumen.length + 1) * 7 > H - 15) { doc.addPage(); y = 20; }
  autoTable(doc, {
    startY: y,
    margin: { left: W - M - anchoResumen, right: M },
    tableWidth: anchoResumen,
    theme: "plain",
    body: filasResumen,
    foot: [["TOTAL A PAGAR", fmtMonto(d.aPagar)]],
    styles: { fontSize: 9, cellPadding: 1.6, textColor: 30 },
    columnStyles: { 1: { halign: "right" } },
    footStyles: { fillColor: color, textColor: 255, fontStyle: "bold", fontSize: 11 },
  });
  const yResumenFin = doc.lastAutoTable.finalY;

  // Avance y observaciones, a la izquierda del resumen.
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(110);
  doc.text("AVANCE ACUMULADO DE LO ACORDADO", M, y + 4);
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...color);
  doc.text(fmtPct(t.avance), M, y + 12);
  if (d.cert.observaciones) {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(110);
    doc.text("OBSERVACIONES", M, y + 20);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(40);
    doc.text(doc.splitTextToSize(plano(d.cert.observaciones), W - 3 * M - anchoResumen), M, y + 25);
  }

  // ── Firmas ─────────────────────────────────────────────────────────────
  let yFirma = Math.max(yResumenFin, y + 30) + 18;
  if (yFirma > H - 16) { doc.addPage(); yFirma = 40; }
  doc.setDrawColor(120).setLineWidth(0.3);
  const anchoFirma = 70;
  const firma = (x, linea1, linea2) => {
    doc.line(x, yFirma, x + anchoFirma, yFirma);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(40);
    doc.text(linea1, x + anchoFirma / 2, yFirma + 5, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110);
    doc.text(linea2, x + anchoFirma / 2, yFirma + 9.5, { align: "center" });
  };
  firma(M + 10, `Por ${EMPRESA.nombre}`, "Firma y aclaración");
  firma(W - M - 10 - anchoFirma, d.sub.subcontratista || "Subcontratista", "Firma y aclaración");
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(70);
  doc.text(`${EMPRESA.ciudad}, ${fmtFecha(d.cert.fecha)}`, W / 2, yFirma + 5, { align: "center" });

  // ── Pie de cada página ─────────────────────────────────────────────────
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(150);
    doc.text(
      `${EMPRESA.nombre} · Certificado N° ${d.cert.numero} · ${d.sub.subcontratista || ""} · ${d.obra || ""}`,
      M, H - 6
    );
    doc.text(`Página ${i} de ${paginas}`, W - M, H - 6, { align: "right" });
  }

  const nombre = String(d.sub.subcontratista || "subcontratista").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
  doc.save(`certificado_${d.cert.numero}_${nombre}.pdf`);
}

<template>
  <div class="sc-vista planilla">
    <div v-if="cargando" class="sc-estado">Cargando…</div>
    <div v-else-if="errorCarga" class="sc-error">{{ errorCarga }}</div>

    <template v-else>
      <header class="sc-cabecera">
        <div>
          <p class="sc-eyebrow">Presupuesto y certificación · {{ obraNombre }}</p>
          <h2 class="sc-titulo">
            Certificado N° {{ cert.numero }}
            <span v-if="cert.anulado" class="sc-chip sc-chip-anulado">anulado</span>
            <span v-else-if="!editable" class="sc-chip sc-chip-finalizado">solo lectura</span>
          </h2>
          <p class="sc-bajada">
            Subcontratista: <strong>{{ sub.subcontratista }}</strong>
            <span v-if="sub.numero_oc"> · OC N° {{ sub.numero_oc }}</span>
          </p>
        </div>
        <div class="sc-acciones no-imprimir">
          <button class="sc-btn sc-btn-sec" @click="volver">← Volver</button>
          <button class="sc-btn sc-btn-sec" @click="imprimir">🖨 Imprimir</button>
        </div>
      </header>

      <section class="sc-panel periodo">
        <div class="sc-campo"><label>Desde</label><input type="date" v-model="cert.desde" class="sc-input" :disabled="!editable" /></div>
        <div class="sc-campo"><label>Hasta</label><input type="date" v-model="cert.hasta" class="sc-input" :disabled="!editable" /></div>
        <div class="sc-campo"><label>Fecha</label><input type="date" v-model="cert.fecha" class="sc-input" :disabled="!editable" /></div>
        <div class="sc-campo obs"><label>Observaciones</label><input v-model="cert.observaciones" class="sc-input" :disabled="!editable" /></div>
      </section>

      <p v-if="!editable && !cert.anulado" class="sc-aviso no-imprimir">
        Solo se corrige el último certificado: cambiar uno anterior alteraría el "anterior" de los
        siguientes, que ya se pagaron.
      </p>

      <div class="sc-tabla-wrap tabla-planilla">
        <table class="sc-tabla">
          <thead>
            <tr>
              <th rowspan="2">Ítem</th><th rowspan="2">Descripción</th><th rowspan="2">Un.</th>
              <th colspan="4" class="grupo">Orden de compra</th>
              <th colspan="4" class="grupo">Cantidades certificadas</th>
              <th colspan="4" class="grupo">Importes certificados</th>
              <th rowspan="2" class="num">% acum.</th>
            </tr>
            <tr>
              <th class="num">Contratado</th><th class="num">P. unit.</th><th class="num">Total</th><th class="num">Incid.</th>
              <th class="num">Anterior</th><th class="num actual">Actual</th><th class="num">Acumulado</th><th class="num">Pendiente</th>
              <th class="num">Anterior</th><th class="num">Actual</th><th class="num">Acumulado</th><th class="num">Pendiente</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="seccion in secciones" :key="seccion.nombre">
              <tr v-if="seccion.filas.length && secciones.length > 1" class="fila-seccion"><td colspan="16">{{ seccion.nombre }}</td></tr>
              <tr v-for="f in seccion.filas" :key="f.id" :class="{ 'fila-exced': c(f).excedente > 0.0001 }">
                <td>{{ f.numero }}</td>
                <td class="desc">
                  {{ f.descripcion }}
                  <span v-if="c(f).excedente > 0.0001" class="sc-chip sc-chip-exced">+{{ num(c(f).excedente, 4) }} de más</span>
                </td>
                <td>{{ f.unidad }}</td>
                <td class="num">{{ num(f.contratado, 4) }}</td>
                <td class="num">{{ monto(c(f).precio) }}</td>
                <td class="num">{{ monto(f.total) }}</td>
                <td class="num">{{ pct(f.incidencia) }}</td>
                <td class="num">{{ num(f.cantidad.anterior, 4) }}</td>
                <td class="num actual">
                  <input v-if="editable" type="number" min="0" step="0.01" class="sc-celda"
                    :class="{ 'sc-celda-llena': Number(actual[f.id]) > 0 }"
                    :value="actual[f.id] ?? ''" @input="setActual(f.id, $event.target.value)" />
                  <span v-else>{{ num(c(f).qAct, 4) }}</span>
                </td>
                <td class="num">{{ num(c(f).qAcum, 4) }}</td>
                <td class="num">{{ num(c(f).qPend, 4) }}</td>
                <td class="num">{{ monto(f.importe.anterior) }}</td>
                <td class="num">{{ monto(c(f).$act) }}</td>
                <td class="num">{{ monto(c(f).$acum) }}</td>
                <td class="num">{{ monto(c(f).$pend) }}</td>
                <td class="num">{{ pct(c(f).pctAcum) }}</td>
              </tr>
            </template>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" class="num">Totales</td>
              <td class="num">{{ monto(totales.contrato) }}</td><td></td>
              <td colspan="4"></td>
              <td class="num">{{ monto(totales.anterior) }}</td>
              <td class="num">{{ monto(totales.actual) }}</td>
              <td class="num">{{ monto(totales.acumulado) }}</td>
              <td class="num">{{ monto(totales.pendiente) }}</td>
              <td class="num">{{ pct(totales.avance) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="pie">
        <!-- Descuentos acordados con el subcontratista -->
        <section class="sc-panel descuentos">
          <h3 class="sc-panel-titulo">
            Descuentos
            <button v-if="editable" class="sc-btn sc-btn-sec sc-btn-mini no-imprimir" @click="agregarDescuento">+ Descuento</button>
          </h3>
          <p v-if="!descuentos.length" class="sc-muted chico">Sin descuentos en este certificado.</p>
          <div v-for="(d, i) in descuentos" :key="i" class="descuento">
            <select v-model="d.tipo" class="sc-input" :disabled="!editable">
              <option v-for="(etq, clave) in TIPOS_DESCUENTO" :key="clave" :value="clave">{{ etq }}</option>
            </select>
            <input v-model="d.concepto" class="sc-input concepto" placeholder="Detalle (ej. adelanto del 27/02)" :disabled="!editable" />
            <input type="number" min="0" step="0.01" v-model.number="d.importe" class="sc-input importe" :disabled="!editable" />
            <button v-if="editable" class="sc-btn sc-btn-peligro sc-btn-mini no-imprimir" @click="descuentos.splice(i, 1)">✕</button>
          </div>
        </section>

        <section class="sc-panel resumen">
          <dl>
            <div><dt>Certificado de este período</dt><dd>{{ monto(totales.actual) }}</dd></div>
            <div><dt>(−) Descuentos</dt><dd>{{ monto(totalDescuentos) }}</dd></div>
            <div class="total" :class="{ 'sc-malo': aPagar < 0 }"><dt>Total a pagar</dt><dd>{{ monto(aPagar) }}</dd></div>
            <div class="chico"><dt>Avance acumulado del contrato</dt><dd>{{ pct(totales.avance) }}</dd></div>
          </dl>
        </section>
      </div>

      <p v-if="excedidos.length" class="sc-aviso">
        {{ excedidos.length }} ítem(s) quedan por encima de lo contratado. Se registran como
        <strong>excedente</strong> y se pagan al precio del ítem; si es trabajo nuevo acordado,
        conviene cargarlo como <strong>adicional</strong> en la orden de compra.
      </p>
      <p v-if="aPagar < 0" class="sc-aviso">Los descuentos superan lo certificado en este período.</p>
      <p v-if="error" class="sc-error">{{ error }}</p>

      <div class="sc-acciones final no-imprimir" v-if="editable">
        <button v-if="cert.id" class="sc-btn sc-btn-peligro" :disabled="guardando" @click="anular">Anular certificado</button>
        <button class="sc-btn sc-btn-ok" :disabled="guardando" @click="guardar">
          {{ guardando ? "Guardando…" : cert.id ? "Guardar corrección" : "Emitir certificado" }}
        </button>
      </div>

      <div class="firmas solo-imprimir">
        <div>Santiago del Estero, {{ fecha(cert.fecha) }}</div>
        <div class="firma">Ing. …………………………</div>
        <div class="firma">{{ sub.subcontratista }}</div>
      </div>
    </template>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useToast } from "vue-toastification";
import { monto, num, pct, fecha, r2, r4, TIPOS_DESCUENTO } from "../utils/subcontratos.js";

export default {
  name: "SubcontratoCertificadoView",
  props: ["obraId", "subId", "certId"],
  setup() { return { toast: useToast() }; },
  data() {
    return {
      cargando: true, guardando: false, errorCarga: "", error: "", obraNombre: "",
      sub: {}, cert: {}, filas: [], editable: false,
      actual: {},          // cantidad actual por ítem, lo único que se carga
      descuentos: [],
      TIPOS_DESCUENTO,
    };
  },
  computed: {
    secciones() {
      return [
        { nombre: "Contrato", filas: this.filas.filter((f) => f.origen !== "adicional") },
        { nombre: "Adicionales", filas: this.filas.filter((f) => f.origen === "adicional") },
      ].filter((s) => s.filas.length);
    },
    totalDescuentos() { return r2(this.descuentos.reduce((s, d) => s + Number(d.importe || 0), 0)); },
    totales() {
      const contrato = this.filas.reduce((s, f) => s + f.total, 0);
      const suma = (k) => r2(this.filas.reduce((s, f) => s + this.c(f)[k], 0));
      // Avance físico: cada ítem pondera por su incidencia, TODOS los ítems.
      // En la planilla de Excel la fórmula cubría un rango fijo de filas.
      const avance = this.filas.reduce((s, f) => {
        if (!f.contratado) return s;
        return s + (f.incidencia / 100) * Math.min(1, this.c(f).qAcum / f.contratado);
      }, 0) * 100;
      return {
        contrato: r2(contrato),
        anterior: r2(this.filas.reduce((s, f) => s + f.importe.anterior, 0)),
        actual: suma("$act"), acumulado: suma("$acum"), pendiente: suma("$pend"),
        avance: r2(avance),
      };
    },
    aPagar() { return r2(this.totales.actual - this.totalDescuentos); },
    excedidos() { return this.filas.filter((f) => this.c(f).excedente > 0.0001); },
  },
  async mounted() {
    try {
      const ruta = this.certId
        ? `/obras/${this.obraId}/subcontratos/${this.subId}/certificados/${this.certId}`
        : `/obras/${this.obraId}/subcontratos/${this.subId}/certificados/nuevo`;
      const [obra, { data }] = await Promise.all([api.get(`/obras/${this.obraId}`), api.get(ruta)]);
      this.obraNombre = obra.data?.nombre || "";
      this.sub = data.subcontrato;
      this.cert = { ...data.certificado, fecha: data.certificado.fecha || "", observaciones: data.certificado.observaciones || "" };
      this.filas = data.filas;
      this.editable = data.editable;
      this.descuentos = data.descuentos.map((d) => ({ ...d }));
      const actual = {};
      for (const f of data.filas) if (f.cantidad.actual) actual[f.id] = f.cantidad.actual;
      this.actual = actual;
    } catch (e) {
      this.errorCarga = e.response?.data?.message || "No se pudo cargar el certificado.";
    } finally {
      this.cargando = false;
    }
  },
  methods: {
    monto, num, pct, fecha,
    setActual(id, texto) {
      if (texto === "") { delete this.actual[id]; return; }
      const n = Number(texto);
      this.actual[id] = Number.isFinite(n) && n >= 0 ? n : 0;
    },
    // Todo lo de una fila sale de lo anterior (fijo) y lo actual (lo que se carga).
    c(f) {
      const qAct = Number(this.actual[f.id] || 0);
      const qAcum = r4(f.cantidad.anterior + qAct);
      const qPend = f.contratado - qAcum;
      const precioVigente = f.contratado ? f.total / f.contratado : f.precio_unitario;
      const $act = r2(qAct * f.precio_unitario);
      const $acum = r2(f.importe.anterior + $act);
      return {
        precio: f.precio_unitario, qAct, qAcum,
        qPend: r4(Math.max(0, qPend)), excedente: r4(Math.max(0, -qPend)),
        $act, $acum, $pend: r2(Math.max(0, qPend) * precioVigente),
        pctAcum: f.total ? r2(($acum / f.total) * 100) : 0,
      };
    },
    agregarDescuento() { this.descuentos.push({ tipo: "adelanto", concepto: "", importe: null }); },
    volver() { this.$router.push({ name: "DetalleSubcontrato", params: { obraId: this.obraId, subId: this.subId } }); },
    imprimir() { window.print(); },
    async guardar() {
      this.error = "";
      const cuerpo = {
        desde: this.cert.desde, hasta: this.cert.hasta, fecha: this.cert.fecha || null,
        observaciones: this.cert.observaciones || null,
        items: Object.entries(this.actual)
          .filter(([, q]) => Number(q) > 0)
          .map(([id, q]) => ({ subcontrato_item_id: Number(id), cantidad: Number(q) })),
        descuentos: this.descuentos.filter((d) => Number(d.importe) > 0),
      };
      this.guardando = true;
      try {
        const { data } = this.cert.id
          ? await api.put(`/obras/${this.obraId}/subcontratos/${this.subId}/certificados/${this.cert.id}`, cuerpo)
          : await api.post(`/obras/${this.obraId}/subcontratos/${this.subId}/certificados`, cuerpo);
        this.toast.success(data.message || "Certificado guardado");
        for (const a of data.avisos || []) this.toast.warning(a.mensaje, { timeout: 9000 });
        this.volver();
      } catch (e) {
        this.error = e.response?.data?.message || "No se pudo guardar el certificado.";
      } finally {
        this.guardando = false;
      }
    },
    async anular() {
      if (!window.confirm(`¿Anular el certificado N° ${this.cert.numero}? Deja de contar en el acumulado.`)) return;
      this.guardando = true;
      try {
        await api.post(`/obras/${this.obraId}/subcontratos/${this.subId}/certificados/${this.cert.id}/anular`);
        this.toast.success(`Certificado N° ${this.cert.numero} anulado`);
        this.volver();
      } catch (e) {
        this.error = e.response?.data?.message || "No se pudo anular.";
      } finally {
        this.guardando = false;
      }
    },
  },
};
</script>

<style src="../assets/css/subcontratos.css"></style>
<style scoped>
.periodo { display: grid; grid-template-columns: repeat(3, minmax(140px, 180px)) 1fr; gap: 12px; }
.tabla-planilla { max-height: 60vh; }
.tabla-planilla th.grupo { text-align: center; border-left: 1px solid #334155; }
.tabla-planilla .actual { background: rgba(167, 139, 250, 0.06); }
.pie { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; margin-top: 16px; }
.descuento { display: grid; grid-template-columns: 170px 1fr 140px auto; gap: 8px; margin-bottom: 8px; }
.resumen dl { margin: 0; display: flex; flex-direction: column; gap: 10px; }
.resumen dl div { display: flex; justify-content: space-between; gap: 12px; font-variant-numeric: tabular-nums; }
.resumen dt { color: #94a3b8; }
.resumen dd { margin: 0; font-weight: 800; }
.resumen .total { border-top: 1px solid #334155; padding-top: 10px; font-size: 1.15rem; }
.chico { font-size: 0.8rem; }
.final { justify-content: flex-end; margin-top: 14px; }
.solo-imprimir { display: none; }
@media (max-width: 900px) { .pie { grid-template-columns: 1fr; } .periodo { grid-template-columns: 1fr 1fr; } }

/* Impresión: la planilla en papel, sin botones ni bordes de inputs. */
@media print {
  .no-imprimir { display: none !important; }
  .solo-imprimir { display: flex !important; }
  .planilla { color: #000; padding: 0; }
  .planilla :deep(.sc-panel), .planilla :deep(.sc-tabla-wrap) { border-color: #999; background: #fff; }
  .planilla :deep(.sc-tabla th), .planilla :deep(.sc-tabla td) { background: #fff !important; color: #000; border-color: #bbb; }
  .tabla-planilla { max-height: none; overflow: visible; }
  .firmas { justify-content: space-between; margin-top: 40px; gap: 20px; }
  .firma { border-top: 1px solid #000; padding-top: 4px; min-width: 200px; text-align: center; }
}
</style>

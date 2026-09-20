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
              <th colspan="3" class="grupo">Acordado</th>
              <th colspan="4" class="grupo">Cantidades certificadas</th>
              <th colspan="4" class="grupo">Importes certificados</th>
              <th rowspan="2" class="num">% acum.</th>
            </tr>
            <tr>
              <th class="num">Cantidad</th><th class="num">P. unit.</th><th class="num">Total</th>
              <th class="num">Anterior</th><th class="num actual">Actual</th><th class="num">Acumulado</th><th class="num">Pendiente</th>
              <th class="num">Anterior</th><th class="num">Actual</th><th class="num">Acumulado</th><th class="num">Pendiente</th>
            </tr>
          </thead>
          <tbody>
            <!-- Lo contratado: acá se carga la cantidad TOTAL hecha en el período.
                 Si pasa lo acordado, el excedente se muestra aparte, abajo. -->
            <tr class="fila-seccion"><td colspan="15">Contrato</td></tr>
            <tr v-for="f in filasContrato" :key="f.id" :class="{ 'fila-exced': c(f).deMas }">
              <td>{{ f.numero }}</td>
              <td class="desc">
                {{ f.descripcion }}
                <span v-if="c(f).deMas" class="sc-chip sc-chip-de_mas">+{{ num(c(f).deMas.cantidad.acumulado, 4) }} de más</span>
              </td>
              <td>{{ f.unidad }}</td>
              <td class="num">{{ num(f.contratado, 4) }}</td>
              <td class="num">{{ monto(f.precio) }}</td>
              <td class="num">{{ monto(f.total) }}</td>
              <td class="num">{{ num(f.anterior.cantidad, 4) }}</td>
              <td class="num actual">
                <input v-if="editable" type="number" min="0" step="0.01" class="sc-celda"
                  :class="{ 'sc-celda-llena': Number(actual[f.id]) > 0 }"
                  :value="actual[f.id] ?? ''" @input="setActual(f.id, $event.target.value)" />
                <span v-else>{{ num(f.actual.cantidad, 4) }}</span>
              </td>
              <td class="num">{{ num(c(f).principal.cantidad.acumulado, 4) }}</td>
              <td class="num">{{ num(c(f).principal.cantidad.pendiente, 4) }}</td>
              <td class="num">{{ monto(c(f).principal.importe.anterior) }}</td>
              <td class="num">{{ monto(c(f).principal.importe.actual) }}</td>
              <td class="num">{{ monto(c(f).principal.importe.acumulado) }}</td>
              <td class="num">{{ monto(c(f).principal.importe.pendiente) }}</td>
              <td class="num">{{ pct(c(f).pctAcum) }}</td>
            </tr>

            <!-- Adicionales: los que ya están en la OC y los que este certificado
                 registra (lo cargado de más, en gris, y los ítems nuevos). -->
            <tr v-if="filasAdicionales.length || deMasVirtuales.length || nuevos.length" class="fila-seccion">
              <td colspan="15">Adicionales</td>
            </tr>
            <tr v-for="f in filasAdicionales" :key="f.id" :class="f.clase === 'nuevo' ? 'fila-nuevo' : 'fila-exced'">
              <td>{{ f.numero }}</td>
              <td class="desc">
                {{ f.descripcion }}
                <span class="sc-chip" :class="`sc-chip-${f.clase}`">{{ CLASES[f.clase] }}</span>
              </td>
              <td>{{ f.unidad }}</td>
              <td class="num">{{ num(f.contratado, 4) }}</td>
              <td class="num">{{ monto(f.precio) }}</td>
              <td class="num">{{ monto(f.total) }}</td>
              <td class="num">{{ num(f.anterior.cantidad, 4) }}</td>
              <td class="num actual">
                <input v-if="editable" type="number" min="0" step="0.01" class="sc-celda"
                  :class="{ 'sc-celda-llena': Number(actual[f.id]) > 0 }"
                  :value="actual[f.id] ?? ''" @input="setActual(f.id, $event.target.value)" />
                <span v-else>{{ num(f.actual.cantidad, 4) }}</span>
              </td>
              <td class="num">{{ num(c(f).principal.cantidad.acumulado, 4) }}</td>
              <td class="num">{{ num(c(f).principal.cantidad.pendiente, 4) }}</td>
              <td class="num">{{ monto(c(f).principal.importe.anterior) }}</td>
              <td class="num">{{ monto(c(f).principal.importe.actual) }}</td>
              <td class="num">{{ monto(c(f).principal.importe.acumulado) }}</td>
              <td class="num">{{ monto(c(f).principal.importe.pendiente) }}</td>
              <td class="num">{{ pct(c(f).pctAcum) }}</td>
            </tr>

            <!-- Renglón calculado: lo que se certificó por encima de lo acordado. -->
            <tr v-for="v in deMasVirtuales" :key="`dm-${v.f.id}`" class="fila-exced">
              <td>{{ v.f.numero }}</td>
              <td class="desc">
                {{ v.f.descripcion }}
                <span class="sc-chip sc-chip-de_mas">{{ CLASES.de_mas }}</span>
                <span class="sc-origen">se hizo por encima de lo acordado en la OC</span>
              </td>
              <td>{{ v.f.unidad }}</td>
              <td class="num">{{ num(v.d.cantidad.acumulado, 4) }}</td>
              <td class="num">{{ monto(v.f.precio_vigente) }}</td>
              <td class="num">{{ monto(v.d.total) }}</td>
              <td class="num">{{ num(v.d.cantidad.anterior, 4) }}</td>
              <td class="num actual">{{ num(v.d.cantidad.actual, 4) }}</td>
              <td class="num">{{ num(v.d.cantidad.acumulado, 4) }}</td>
              <td class="num">—</td>
              <td class="num">{{ monto(v.d.importe.anterior) }}</td>
              <td class="num">{{ monto(v.d.importe.actual) }}</td>
              <td class="num">{{ monto(v.d.importe.acumulado) }}</td>
              <td class="num">—</td>
              <td class="num">{{ pct(100) }}</td>
            </tr>

            <!-- Rubros que no estaban en la OC, cargados acá mismo. -->
            <tr v-for="(n, i) in nuevos" :key="`n-${n.clave}`" class="fila-nuevo">
              <td><input v-model="n.numero" class="sc-input chico" placeholder="N°" /></td>
              <td class="desc">
                <input v-model="n.descripcion" class="sc-input ancho" placeholder="Qué se hizo *" />
                <span class="sc-chip sc-chip-nuevo">{{ CLASES.nuevo }}</span>
                <button class="sc-btn sc-btn-peligro sc-btn-mini no-imprimir" @click="nuevos.splice(i, 1)">✕</button>
              </td>
              <td><input v-model="n.unidad" class="sc-input chico" placeholder="un." /></td>
              <td class="num">{{ num(n.cantidad, 4) }}</td>
              <td class="num"><input type="number" min="0" step="0.01" v-model.number="n.precio_unitario" class="sc-celda" /></td>
              <td class="num">{{ monto(totalNuevo(n)) }}</td>
              <td class="num">—</td>
              <td class="num actual"><input type="number" min="0" step="0.01" v-model.number="n.cantidad" class="sc-celda sc-celda-llena" /></td>
              <td class="num">{{ num(n.cantidad, 4) }}</td>
              <td class="num">—</td>
              <td class="num">—</td>
              <td class="num">{{ monto(totalNuevo(n)) }}</td>
              <td class="num">{{ monto(totalNuevo(n)) }}</td>
              <td class="num">—</td>
              <td class="num">{{ pct(100) }}</td>
            </tr>
            <tr v-if="editable" class="no-imprimir">
              <td colspan="15">
                <button class="sc-btn sc-btn-sec sc-btn-mini" @click="agregarNuevo">+ Ítem nuevo (no está en la OC)</button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" class="num">Totales</td>
              <td class="num">{{ monto(totales.contrato) }}</td>
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
            <div class="chico"><dt>Avance acumulado de lo acordado</dt><dd>{{ pct(totales.avance) }}</dd></div>
          </dl>
        </section>
      </div>

      <p v-if="extras.length" class="sc-aviso">
        Este certificado registra {{ extras.length }} trabajo(s) como <strong>adicional</strong>:
        <span v-for="(e, i) in extras" :key="i">{{ i ? " · " : " " }}{{ e.texto }}</span>.
        Al guardar se pide confirmación.
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
import { monto, num, pct, fecha, r2, r4, desglosar, CLASES, TIPOS_DESCUENTO } from "../utils/subcontratos.js";

let claveNueva = 0;

export default {
  name: "SubcontratoCertificadoView",
  props: ["obraId", "subId", "certId"],
  setup() { return { toast: useToast() }; },
  data() {
    return {
      cargando: true, guardando: false, errorCarga: "", error: "", obraNombre: "",
      sub: {}, cert: {}, filas: [], editable: false,
      actual: {},          // cantidad actual por ítem, lo único que se carga
      nuevos: [],          // rubros que no están en la OC, cargados acá
      descuentos: [],
      CLASES, TIPOS_DESCUENTO,
    };
  },
  computed: {
    filasContrato() { return this.filas.filter((f) => f.clase === "contrato"); },
    filasAdicionales() { return this.filas.filter((f) => f.clase !== "contrato"); },
    // Lo que en este certificado se pasa de lo acordado: su propio renglón.
    deMasVirtuales() {
      return this.filas.map((f) => ({ f, d: this.c(f).deMas })).filter((v) => v.d);
    },
    totalDescuentos() { return r2(this.descuentos.reduce((s, d) => s + Number(d.importe || 0), 0)); },
    totales() {
      let contrato = 0, anterior = 0, actual = 0, pendiente = 0;
      for (const f of this.filas) {
        const { principal, deMas } = this.c(f);
        contrato += f.total + (deMas ? deMas.total : 0);
        anterior += principal.importe.anterior + (deMas ? deMas.importe.anterior : 0);
        actual += principal.importe.actual + (deMas ? deMas.importe.actual : 0);
        pendiente += principal.importe.pendiente;
      }
      for (const n of this.nuevos) { contrato += this.totalNuevo(n); actual += this.totalNuevo(n); }
      return {
        contrato: r2(contrato), anterior: r2(anterior), actual: r2(actual),
        acumulado: r2(anterior + actual), pendiente: r2(pendiente),
        // El avance pondera TODOS los ítems, sobre lo acordado a la fecha. En la
        // planilla de Excel la fórmula cubría un rango fijo de filas.
        avance: contrato ? r2(((contrato - pendiente) / contrato) * 100) : 0,
      };
    },
    aPagar() { return r2(this.totales.actual - this.totalDescuentos); },
    // Lo que el servidor va a pedir confirmar, anticipado en pantalla.
    extras() {
      const lista = this.deMasVirtuales
        .filter((v) => v.d.cantidad.actual > 0.00005 || (!this.cert.id && v.d.cantidad.acumulado > 0.00005))
        .map((v) => ({ texto: `${v.f.descripcion}: ${num(v.d.cantidad.acumulado, 4)} ${v.f.unidad || ""} de más` }));
      for (const n of this.nuevos) {
        if (n.descripcion && Number(n.cantidad) > 0) {
          lista.push({ texto: `${n.descripcion}: ítem nuevo, ${num(n.cantidad, 4)} ${n.unidad || ""}` });
        }
      }
      return lista;
    },
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
      for (const f of data.filas) if (f.actual.cantidad) actual[f.id] = f.actual.cantidad;
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
    // Cada fila se desdobla igual que en el servidor: lo acordado y lo de más.
    c(f) {
      const qAct = Number(this.actual[f.id] || 0);
      const { principal, deMas } = desglosar({
        contratado: f.contratado, precioVigente: f.precio_vigente,
        ant: { cantidad: f.anterior.cantidad, importe: f.anterior.importe },
        act: { cantidad: qAct, precio: f.precio },
      });
      const acum = principal.importe.acumulado + (deMas ? deMas.importe.acumulado : 0);
      return { principal, deMas, pctAcum: f.total ? r2((acum / f.total) * 100) : 0 };
    },
    totalNuevo(n) { return r2(Number(n.cantidad || 0) * Number(n.precio_unitario || 0)); },
    agregarNuevo() {
      this.nuevos.push({ clave: `n${++claveNueva}`, numero: "", descripcion: "", unidad: "", cantidad: 1, precio_unitario: 0 });
    },
    agregarDescuento() { this.descuentos.push({ tipo: "adelanto", concepto: "", importe: null }); },
    volver() { this.$router.push({ name: "DetalleSubcontrato", params: { obraId: this.obraId, subId: this.subId } }); },
    imprimir() { window.print(); },
    cuerpo(confirmar) {
      return {
        desde: this.cert.desde, hasta: this.cert.hasta, fecha: this.cert.fecha || null,
        observaciones: this.cert.observaciones || null,
        items: Object.entries(this.actual)
          .filter(([, q]) => Number(q) > 0)
          .map(([id, q]) => ({ subcontrato_item_id: Number(id), cantidad: Number(q) })),
        nuevos: this.nuevos
          .filter((n) => n.descripcion.trim() && Number(n.cantidad) > 0)
          .map((n) => ({ clave: n.clave, numero: n.numero, descripcion: n.descripcion, unidad: n.unidad, cantidad: Number(n.cantidad), precio_unitario: Number(n.precio_unitario || 0) })),
        descuentos: this.descuentos.filter((d) => Number(d.importe) > 0),
        ...(confirmar ? { confirmar_extras: true } : {}),
      };
    },
    enviar(cuerpo) {
      return this.cert.id
        ? api.put(`/obras/${this.obraId}/subcontratos/${this.subId}/certificados/${this.cert.id}`, cuerpo)
        : api.post(`/obras/${this.obraId}/subcontratos/${this.subId}/certificados`, cuerpo);
    },
    async guardar() {
      this.error = "";
      const nuevoSinPrecio = this.nuevos.find((n) => n.descripcion.trim() && !(Number(n.precio_unitario) > 0));
      if (nuevoSinPrecio && !window.confirm(`"${nuevoSinPrecio.descripcion}" tiene precio 0. ¿Guardar igual?`)) return;

      this.guardando = true;
      try {
        let { data } = await this.enviar(this.cuerpo(false));
        this.terminar(data);
      } catch (e) {
        // El servidor frena cuando hay trabajo de más o un rubro que no estaba:
        // avisa qué es cada cosa y recién con el sí lo registra.
        const r = e.response;
        if (r?.status === 409 && r.data?.requiere_confirmacion) {
          const detalle = (r.data.extras || []).map((x) => `• ${x.mensaje}`).join("\n");
          if (!window.confirm(`${r.data.message}\n\n${detalle}`)) { this.guardando = false; return; }
          try {
            const { data } = await this.enviar(this.cuerpo(true));
            this.terminar(data);
          } catch (e2) {
            this.error = e2.response?.data?.message || "No se pudo guardar el certificado.";
          } finally {
            this.guardando = false;
          }
          return;
        }
        this.error = r?.data?.message || "No se pudo guardar el certificado.";
      } finally {
        this.guardando = false;
      }
    },
    terminar(data) {
      this.toast.success(data.message || "Certificado guardado");
      for (const a of data.adicionales_registrados || []) this.toast.warning(a.mensaje, { timeout: 9000 });
      this.volver();
    },
    async anular() {
      if (!window.confirm(`¿Anular el certificado N° ${this.cert.numero}? Deja de contar en el acumulado, y se quitan los ítems nuevos que haya creado.`)) return;
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
.chico { width: 80px; font-size: 0.8rem; }
.ancho { width: 100%; min-width: 220px; }
.pie { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; margin-top: 16px; }
.descuento { display: grid; grid-template-columns: 170px 1fr 140px auto; gap: 8px; margin-bottom: 8px; }
.resumen dl { margin: 0; display: flex; flex-direction: column; gap: 10px; }
.resumen dl div { display: flex; justify-content: space-between; gap: 12px; font-variant-numeric: tabular-nums; }
.resumen dt { color: #94a3b8; }
.resumen dd { margin: 0; font-weight: 800; }
.resumen .total { border-top: 1px solid #334155; padding-top: 10px; font-size: 1.15rem; }
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

<template>
  <div class="sc-vista">
    <header class="sc-cabecera">
      <div>
        <p class="sc-eyebrow">Plan de trabajo · {{ sub.subcontratista }}</p>
        <h2 class="sc-titulo">¿Cuánto va a hacer en cada {{ sub.periodicidad === "semanal" ? "semana" : "quincena" }}?</h2>
        <p class="sc-bajada">
          Se carga en cantidades, en la unidad de cada ítem. Un ítem no puede planificarse por encima de
          lo contratado. Los certificados se comparan contra este plan.
        </p>
      </div>
      <button class="sc-btn sc-btn-sec" @click="volver">← Volver</button>
    </header>

    <div v-if="cargando" class="sc-estado">Cargando…</div>
    <template v-else>
      <p v-if="propuesto" class="sc-aviso">
        Todavía no hay plan: te propongo {{ periodos.length }} períodos desde el {{ fecha(periodos[0]?.desde) }}.
        Ajustá las fechas o agregá los que falten antes de guardar.
      </p>

      <div class="herramientas">
        <input v-model="busqueda" class="sc-input buscador" placeholder="Buscar ítem" />
        <span class="sc-acciones">
          <button class="sc-btn sc-btn-sec sc-btn-mini" @click="agregarPeriodo">+ Período</button>
          <button class="sc-btn sc-btn-sec sc-btn-mini" :disabled="periodos.length <= 1" @click="quitarPeriodo">− Último período</button>
        </span>
      </div>

      <div class="sc-tabla-wrap grilla">
        <table class="sc-tabla">
          <thead>
            <tr>
              <th class="fija">Ítem</th>
              <th class="fija fija-2">Descripción</th>
              <th class="num">Contratado</th>
              <th v-for="(p, i) in periodos" :key="i" class="col-periodo">
                <div class="cab-periodo">
                  <span>P{{ i + 1 }}</span>
                  <input type="date" v-model="p.desde" class="fecha" />
                  <input type="date" v-model="p.hasta" class="fecha" />
                </div>
              </th>
              <th class="num">Planificado</th>
              <th class="num">Queda</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in itemsVisibles" :key="it.id" :class="{ 'fila-exced': queda(it) < -0.0001 }">
              <td class="fija">{{ it.numero }}</td>
              <td class="fija fija-2 desc">{{ it.descripcion }} <span class="sc-muted">{{ it.unidad }}</span></td>
              <td class="num">{{ num(it.cantidad, 4) }}</td>
              <td v-for="(p, i) in periodos" :key="i" class="num">
                <input
                  type="number" min="0" step="0.01" class="sc-celda"
                  :class="{ 'sc-celda-llena': Number(valor(it.id, i)) > 0 }"
                  :value="valor(it.id, i)"
                  @input="setValor(it.id, i, $event.target.value)"
                />
              </td>
              <td class="num">{{ num(planificado(it), 4) }}</td>
              <td class="num" :class="queda(it) < -0.0001 ? 'sc-malo' : queda(it) < 0.0001 ? 'sc-ok' : ''">{{ num(queda(it), 4) }}</td>
              <td>
                <button v-if="queda(it) > 0.0001" class="sc-btn sc-btn-sec sc-btn-mini" title="Reparte lo que queda en partes iguales" @click="repartir(it)">Repartir</button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="fija"></td><td class="fija fija-2">% del contrato en el período</td><td></td>
              <td v-for="(p, i) in periodos" :key="i" class="num">{{ pct(pesoPeriodo(i)) }}</td>
              <td class="num">{{ pct(totalPlan) }}</td><td></td><td></td>
            </tr>
            <tr>
              <td class="fija"></td><td class="fija fija-2">Acumulado</td><td></td>
              <td v-for="(p, i) in periodos" :key="i" class="num acum">{{ pct(acumulado(i)) }}</td>
              <td></td><td></td><td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p v-if="error" class="sc-error">{{ error }}</p>
      <div class="sc-acciones final">
        <span class="sc-muted" v-if="excedidos.length">{{ excedidos.length }} ítem(s) planificados de más</span>
        <button class="sc-btn sc-btn-ok" :disabled="guardando || excedidos.length > 0" @click="guardar">
          {{ guardando ? "Guardando…" : "Guardar plan" }}
        </button>
      </div>
    </template>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useToast } from "vue-toastification";
import { num, pct, fecha, r4, sumarDias } from "../utils/subcontratos.js";

export default {
  name: "SubcontratoPlanView",
  props: ["obraId", "subId"],
  setup() { return { toast: useToast() }; },
  data() {
    return {
      cargando: true, guardando: false, error: "", busqueda: "",
      sub: {}, items: [], periodos: [], propuesto: false, totalContrato: 0,
      // valores[itemId][indicePeriodo] = cantidad
      valores: {},
    };
  },
  computed: {
    itemsVisibles() {
      const q = this.busqueda.trim().toLowerCase();
      return q ? this.items.filter((i) => `${i.numero} ${i.descripcion}`.toLowerCase().includes(q)) : this.items;
    },
    excedidos() { return this.items.filter((it) => this.queda(it) < -0.0001); },
    totalPlan() { return this.periodos.reduce((s, p, i) => s + this.pesoPeriodo(i), 0); },
  },
  async mounted() {
    try {
      const { data } = await api.get(`/obras/${this.obraId}/subcontratos/${this.subId}/plan`);
      this.sub = data.subcontrato;
      this.items = data.items;
      this.totalContrato = data.total_contrato;
      this.propuesto = data.propuesto;
      this.periodos = data.periodos.map((p) => ({ desde: p.desde, hasta: p.hasta }));
      const valores = {};
      for (const it of data.items) valores[it.id] = {};
      data.periodos.forEach((p, i) => { for (const pi of p.items) (valores[pi.subcontrato_item_id] ||= {})[i] = pi.cantidad; });
      this.valores = valores;
    } catch (e) {
      this.error = e.response?.data?.message || "No se pudo cargar el plan.";
    } finally {
      this.cargando = false;
    }
  },
  methods: {
    num, pct, fecha,
    valor(itemId, i) { return this.valores[itemId]?.[i] ?? ""; },
    setValor(itemId, i, texto) {
      if (!this.valores[itemId]) this.valores[itemId] = {};
      if (texto === "") { delete this.valores[itemId][i]; return; }
      const n = Number(texto);
      this.valores[itemId][i] = Number.isFinite(n) && n >= 0 ? n : 0;
    },
    planificado(it) { return r4(Object.values(this.valores[it.id] || {}).reduce((s, v) => s + Number(v || 0), 0)); },
    queda(it) { return r4(Number(it.cantidad) - this.planificado(it)); },
    // Cuánto del contrato (en plata) cae en el período.
    pesoPeriodo(i) {
      if (!this.totalContrato) return 0;
      const plata = this.items.reduce((s, it) => s + Number(this.valores[it.id]?.[i] || 0) * Number(it.precio_unitario), 0);
      return (plata / this.totalContrato) * 100;
    },
    acumulado(i) { let s = 0; for (let k = 0; k <= i; k++) s += this.pesoPeriodo(k); return s; },
    repartir(it) {
      const queda = this.queda(it);
      const n = this.periodos.length;
      const parte = Math.floor((queda / n) * 10000) / 10000;
      let asignado = 0;
      for (let i = 0; i < n; i++) {
        const extra = i === n - 1 ? r4(queda - asignado) : parte;
        asignado = r4(asignado + extra);
        this.setValor(it.id, i, r4(Number(this.valores[it.id]?.[i] || 0) + extra));
      }
    },
    agregarPeriodo() {
      const ultimo = this.periodos[this.periodos.length - 1];
      const largo = this.sub.periodicidad === "semanal" ? 7 : 14;
      const desde = ultimo ? sumarDias(ultimo.hasta, 1) : this.sub.fecha_inicio;
      this.periodos.push({ desde, hasta: sumarDias(desde, largo - 1) });
    },
    quitarPeriodo() {
      const i = this.periodos.length - 1;
      for (const fila of Object.values(this.valores)) delete fila[i];
      this.periodos.pop();
    },
    volver() { this.$router.push({ name: "DetalleSubcontrato", params: { obraId: this.obraId, subId: this.subId } }); },
    async guardar() {
      this.error = "";
      this.guardando = true;
      try {
        const periodos = this.periodos.map((p, i) => ({
          desde: p.desde, hasta: p.hasta,
          items: this.items.map((it) => ({ subcontrato_item_id: it.id, cantidad: Number(this.valores[it.id]?.[i] || 0) }))
            .filter((x) => x.cantidad > 0),
        }));
        await api.put(`/obras/${this.obraId}/subcontratos/${this.subId}/plan`, { periodos });
        this.toast.success("Plan guardado");
        this.volver();
      } catch (e) {
        this.error = e.response?.data?.message || "No se pudo guardar el plan.";
      } finally {
        this.guardando = false;
      }
    },
  },
};
</script>

<style src="../assets/css/subcontratos.css"></style>
<style scoped>
.herramientas { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
.buscador { min-width: 240px; }
.grilla { max-height: 62vh; }
.fija { position: sticky; left: 0; z-index: 3; }
.fija-2 { left: 56px; border-right: 1px solid #334155; }
thead .fija { z-index: 4; }
.col-periodo { min-width: 118px; }
.cab-periodo { display: flex; flex-direction: column; gap: 3px; align-items: stretch; }
.fecha { background: #020617; color: #cbd5e1; border: 1px solid #263349; border-radius: 4px; font-size: 0.7rem; padding: 2px 4px; }
.acum { color: #c4b5fd; }
.final { justify-content: flex-end; margin-top: 14px; align-items: center; }
</style>

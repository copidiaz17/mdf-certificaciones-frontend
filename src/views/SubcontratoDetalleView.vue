<template>
  <div class="sc-vista">
    <div v-if="cargando" class="sc-estado">Cargando…</div>
    <div v-else-if="error" class="sc-error">{{ error }}</div>

    <template v-else>
      <header class="sc-cabecera">
        <div>
          <p class="sc-eyebrow">Subcontratista · {{ obraNombre }}</p>
          <h2 class="sc-titulo">
            {{ sub.subcontratista }}
            <span class="sc-chip" :class="`sc-chip-${sub.estado}`">{{ ESTADOS[sub.estado] }}</span>
          </h2>
          <p class="sc-bajada">
            <span v-if="sub.numero_oc">OC N° {{ sub.numero_oc }} · </span>
            <span v-if="sub.cuit">CUIT {{ sub.cuit }} · </span>
            certificación {{ sub.periodicidad }}
            <span v-if="sub.fecha_inicio"> · trabaja desde el {{ fecha(sub.fecha_inicio) }}</span>
          </p>
        </div>
        <div class="sc-acciones">
          <button class="sc-btn sc-btn-sec" @click="$router.push({ name: 'SubcontratosObra', params: { obraId } })">← Subcontratistas</button>
          <template v-if="authStore.canModify">
            <button class="sc-btn sc-btn-sec" @click="ir('EditarSubcontrato')">Orden de compra</button>
            <button v-if="sub.estado !== 'anulado'" class="sc-btn sc-btn-primario" @click="ir('NuevoCertificadoSub')">➕ Nuevo certificado</button>
          </template>
        </div>
      </header>

      <!-- Estadísticas: sin plan de trabajo, el avance se mide contra lo acordado -->
      <section class="sc-tiles">
        <div class="sc-tile">
          <span class="sc-tile-label">Acordado</span>
          <span class="sc-tile-valor">{{ monto(t.contrato) }}</span>
          <span class="sc-tile-sub" v-if="t.de_mas || t.nuevo">{{ monto(t.original) }} de la OC + {{ monto(t.de_mas + t.nuevo) }} de adicionales</span>
          <span class="sc-tile-sub" v-else>{{ items.length }} ítems de la OC</span>
        </div>
        <div class="sc-tile">
          <span class="sc-tile-label">Avanzado</span>
          <span class="sc-tile-valor">{{ pct(t.avance) }}</span>
          <span class="sc-tile-sub">{{ monto(t.certificado) }} certificado</span>
        </div>
        <div class="sc-tile">
          <span class="sc-tile-label">Queda por hacer</span>
          <span class="sc-tile-valor">{{ monto(t.pendiente) }}</span>
          <span class="sc-tile-sub">{{ pct(Math.max(0, 100 - t.avance)) }} de lo acordado</span>
        </div>
        <div class="sc-tile" :class="{ 'sc-tile-alerta': t.de_mas > 0 }">
          <span class="sc-tile-label">Adicional · cargado de más</span>
          <span class="sc-tile-valor">{{ monto(t.de_mas) }}</span>
          <span class="sc-tile-sub">{{ t.renglones_de_mas }} rubro(s) por encima de la OC</span>
        </div>
        <div class="sc-tile" :class="{ 'sc-tile-alerta': t.nuevo > 0 }">
          <span class="sc-tile-label">Adicional · ítem nuevo</span>
          <span class="sc-tile-valor">{{ monto(t.nuevo) }}</span>
          <span class="sc-tile-sub">{{ t.renglones_nuevos }} rubro(s) que no estaban</span>
        </div>
        <div class="sc-tile">
          <span class="sc-tile-label">Neto pagado</span>
          <span class="sc-tile-valor">{{ monto(t.neto_pagado) }}</span>
          <span class="sc-tile-sub">{{ monto(t.descuentos) }} en descuentos</span>
        </div>
      </section>

      <!-- Avance por certificado -->
      <section class="sc-panel" v-if="resumen.curva.length">
        <h3 class="sc-panel-titulo">Avance por certificado</h3>
        <div class="grafico"><canvas ref="grafico"></canvas></div>
      </section>

      <!-- Por ítem -->
      <section class="sc-panel">
        <h3 class="sc-panel-titulo">Por ítem</h3>
        <div class="sc-tabla-wrap">
          <table class="sc-tabla">
            <thead>
              <tr>
                <th>Ítem</th><th>Descripción</th><th>Un.</th>
                <th class="num">Acordado</th><th class="num">Certificado</th><th class="num">Queda</th>
                <th class="num">Importe acordado</th><th>Avance</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="seccion in secciones" :key="seccion.nombre">
                <tr v-if="seccion.items.length" class="fila-seccion"><td :colspan="8">{{ seccion.nombre }}</td></tr>
                <tr v-for="it in seccion.items" :key="it.id" :class="{ 'fila-exced': it.clase === 'de_mas', 'fila-nuevo': it.clase === 'nuevo' }">
                  <td>{{ it.numero }}</td>
                  <td class="desc">
                    {{ it.descripcion }}
                    <span v-if="it.clase !== 'contrato'" class="sc-chip" :class="`sc-chip-${it.clase}`">{{ it.etiqueta }}</span>
                    <span v-if="it.clase === 'de_mas' && it.rubro_origen" class="sc-origen">
                      {{ it.virtual ? "certificado por encima de lo contratado en" : "agranda" }} «{{ it.rubro_origen }}»
                    </span>
                  </td>
                  <td>{{ it.unidad }}</td>
                  <td class="num">{{ num(it.contratado, 4) }}</td>
                  <td class="num">{{ num(it.certificado, 4) }}</td>
                  <td class="num">{{ num(it.pendiente, 4) }}</td>
                  <td class="num">{{ monto(it.total) }}</td>
                  <td>
                    <div class="barra-celda">
                      <div class="sc-barra"><div class="sc-barra-relleno" :style="{ width: it.avance + '%' }"></div></div>
                      <span>{{ pct(it.avance) }}</span>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Certificados -->
      <section class="sc-panel">
        <h3 class="sc-panel-titulo">Certificados</h3>
        <div v-if="!certificados.length" class="sc-vacio">Todavía no hay certificados.</div>
        <div v-else class="sc-tabla-wrap">
          <table class="sc-tabla">
            <thead>
              <tr><th>N°</th><th>Período</th><th class="num">Certificado</th><th class="num">Descuentos</th><th class="num">A pagar</th><th class="num">Avance acum.</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="c in [...certificados].reverse()" :key="c.id" class="clickable" :class="{ 'fila-anulada': c.anulado }" @click="verCert(c)">
                <td>{{ c.numero }}</td>
                <td>{{ periodo(c.desde, c.hasta) }}</td>
                <td class="num">{{ c.anulado ? "anulado" : monto(c.importe) }}</td>
                <td class="num">{{ c.anulado ? "" : monto(c.descuentos) }}</td>
                <td class="num">{{ c.anulado ? "" : monto(c.a_pagar) }}</td>
                <td class="num">{{ c.anulado ? "" : pct(c.avance_acumulado) }}</td>
                <td><span v-if="c.id === ultimoId" class="sc-chip sc-chip-vigente">último</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div v-if="authStore.canModify && !certificados.some((c) => !c.anulado)" class="sc-acciones borrar">
        <button class="sc-btn sc-btn-peligro" @click="borrar">Borrar este subcontrato</button>
      </div>
    </template>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import Chart from "chart.js/auto";
import { useAuthStore } from "../stores/authStore";
import { useToast } from "vue-toastification";
import { monto, num, pct, fecha, periodo, ESTADOS, CLASES } from "../utils/subcontratos.js";

export default {
  name: "SubcontratoDetalleView",
  props: ["obraId", "subId"],
  setup() { return { authStore: useAuthStore(), toast: useToast() }; },
  data() {
    return {
      cargando: true, error: "", obraNombre: "",
      sub: {}, items: [], resumen: { totales: {}, items: [], curva: [] },
      certificados: [], ultimoId: null, grafico: null, ESTADOS,
    };
  },
  computed: {
    t() { return this.resumen.totales || {}; },
    secciones() {
      // Lo de más calculado (renglón virtual) va junto a los adicionales, no
      // debajo de su rubro: así se ve todo lo extra en un solo lugar.
      const del = this.resumen.items;
      return [
        { nombre: "Contrato", items: del.filter((i) => i.clase === "contrato") },
        { nombre: CLASES.de_mas, items: del.filter((i) => i.clase === "de_mas") },
        { nombre: CLASES.nuevo, items: del.filter((i) => i.clase === "nuevo") },
      ].filter((s) => s.items.length);
    },
  },
  async mounted() { await this.cargar(); },
  beforeUnmount() { if (this.grafico) this.grafico.destroy(); },
  methods: {
    monto, num, pct, fecha, periodo,
    async cargar() {
      this.cargando = true;
      try {
        const [obra, det] = await Promise.all([
          api.get(`/obras/${this.obraId}`),
          api.get(`/obras/${this.obraId}/subcontratos/${this.subId}`),
        ]);
        this.obraNombre = obra.data?.nombre || "";
        Object.assign(this, {
          sub: det.data.subcontrato, items: det.data.items, resumen: det.data.resumen,
          certificados: det.data.certificados, ultimoId: det.data.ultimo_certificado_id,
        });
      } catch (e) {
        this.error = e.response?.data?.message || "No se pudo cargar el subcontrato.";
      } finally {
        this.cargando = false;
      }
      await this.$nextTick();
      this.dibujar();
    },
    dibujar() {
      if (!this.$refs.grafico || !this.resumen.curva.length) return;
      if (this.grafico) this.grafico.destroy();
      const c = this.resumen.curva;
      this.grafico = new Chart(this.$refs.grafico, {
        type: "line",
        data: {
          labels: c.map((p) => `N° ${p.numero} · ${fecha(p.hasta).slice(0, 5)}`),
          datasets: [
            // Avance acumulado sobre lo acordado a la fecha, después de cada certificado.
            { label: "Avance acumulado", data: c.map((p) => p.avance), borderColor: "rgba(34, 197, 94, 1)", backgroundColor: "rgba(34, 197, 94, 0.12)", fill: true, borderWidth: 3, pointRadius: 4, tension: 0.2 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + "%", color: "#94a3b8" }, grid: { color: "#1f2a44" } }, x: { ticks: { color: "#94a3b8" }, grid: { color: "#1f2a44" } } },
          plugins: { legend: { labels: { color: "#cbd5e1" } }, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${pct(ctx.parsed.y)}` } } },
        },
      });
    },
    ir(nombre) { this.$router.push({ name: nombre, params: { obraId: this.obraId, subId: this.subId } }); },
    verCert(c) { this.$router.push({ name: "CertificadoSub", params: { obraId: this.obraId, subId: this.subId, certId: c.id } }); },
    async borrar() {
      if (!window.confirm(`¿Borrar el subcontrato de ${this.sub.subcontratista}? No tiene certificados, así que no se pierde nada pagado.`)) return;
      try {
        await api.delete(`/obras/${this.obraId}/subcontratos/${this.subId}`);
        this.toast.success("Subcontrato borrado");
        this.$router.push({ name: "SubcontratosObra", params: { obraId: this.obraId } });
      } catch (e) {
        this.toast.error(e.response?.data?.message || "No se pudo borrar.");
      }
    },
  },
};
</script>

<style src="../assets/css/subcontratos.css"></style>
<style scoped>
.grafico { height: 300px; }
.barra-celda { display: flex; align-items: center; gap: 8px; }
.borrar { justify-content: flex-end; }
</style>

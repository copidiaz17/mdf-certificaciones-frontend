<template>
  <div class="sc-vista">
    <header class="sc-cabecera">
      <div>
        <p class="sc-eyebrow">{{ obraNombre || "Obra" }}</p>
        <h2 class="sc-titulo">Subcontratistas</h2>
        <p class="sc-bajada">
          Cada subcontratista tiene su orden de compra, su plan de trabajo y sus certificados.
          Es un circuito aparte: no se mezcla con la planificación, el avance ni la certificación de la obra.
        </p>
      </div>
      <div class="sc-acciones">
        <button class="sc-btn sc-btn-sec" @click="$router.push({ name: 'ObraDetalle', params: { obraId } })">← Volver a la obra</button>
        <button v-if="authStore.canModify" class="sc-btn sc-btn-primario" @click="$router.push({ name: 'NuevoSubcontrato', params: { obraId } })">
          ➕ Nueva orden de compra
        </button>
      </div>
    </header>

    <div v-if="cargando" class="sc-estado">Cargando…</div>
    <div v-else-if="error" class="sc-error">{{ error }}</div>

    <div v-else-if="!subs.length" class="sc-panel sc-vacio">
      <p>Esta obra todavía no tiene subcontratistas cargados.</p>
      <button v-if="authStore.canModify" class="sc-btn sc-btn-primario" @click="$router.push({ name: 'NuevoSubcontrato', params: { obraId } })">
        Cargar la primera orden de compra
      </button>
    </div>

    <div v-else class="lista">
      <article v-for="s in subs" :key="s.id" class="sc-panel tarjeta" @click="abrir(s)">
        <div class="tarjeta-cabeza">
          <div>
            <h3 class="nombre">{{ s.subcontratista }}</h3>
            <p class="dato">
              <span v-if="s.numero_oc">OC N° {{ s.numero_oc }} · </span>
              {{ s.items }} ítems · certificación {{ s.periodicidad }}
            </p>
          </div>
          <span class="sc-chip" :class="`sc-chip-${s.estado}`">{{ ESTADOS[s.estado] }}</span>
        </div>

        <div class="avance">
          <div class="avance-texto">
            <strong>{{ pct(s.totales.avance) }}</strong> ejecutado
            <span v-if="s.totales.planificado_hoy !== null" class="sc-muted">· plan a hoy {{ pct(s.totales.planificado_hoy) }}</span>
            <span v-if="s.totales.desvio !== null" class="sc-chip" :class="s.totales.desvio < -0.5 ? 'sc-chip-atraso' : 'sc-chip-adelanto'">
              {{ s.totales.desvio >= 0 ? "+" : "" }}{{ num(s.totales.desvio) }} pts
            </span>
          </div>
          <div class="sc-barra">
            <div class="sc-barra-relleno" :style="{ width: Math.min(100, s.totales.avance) + '%' }"></div>
            <div v-if="s.totales.planificado_hoy !== null" class="sc-barra-marca" :style="{ left: Math.min(100, s.totales.planificado_hoy) + '%' }" title="Plan a hoy"></div>
          </div>
        </div>

        <dl class="numeros">
          <div><dt>Contrato</dt><dd>{{ monto(s.totales.contrato) }}</dd></div>
          <div><dt>Certificado</dt><dd>{{ monto(s.totales.certificado) }}</dd></div>
          <div><dt>Pendiente</dt><dd>{{ monto(s.totales.pendiente) }}</dd></div>
          <div><dt>Neto pagado</dt><dd>{{ monto(s.totales.neto_pagado) }}</dd></div>
          <div v-if="s.totales.excedentes > 0" class="exced"><dt>Excedentes</dt><dd>{{ monto(s.totales.excedentes) }}</dd></div>
        </dl>

        <p class="pie sc-muted">
          {{ s.totales.certificados }} certificado(s)
          <span v-if="s.totales.ultimo_certificado"> · el último hasta el {{ fecha(s.totales.ultimo_certificado) }}</span>
        </p>
      </article>
    </div>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from "../stores/authStore";
import { monto, num, pct, fecha, ESTADOS } from "../utils/subcontratos.js";

export default {
  name: "SubcontratosObraView",
  props: ["obraId"],
  setup() { return { authStore: useAuthStore() }; },
  data() {
    return { subs: [], obraNombre: "", cargando: true, error: "", ESTADOS };
  },
  async mounted() {
    try {
      const [obra, lista] = await Promise.all([
        api.get(`/obras/${this.obraId}`),
        api.get(`/obras/${this.obraId}/subcontratos`),
      ]);
      this.obraNombre = obra.data?.nombre || "";
      this.subs = lista.data || [];
    } catch (e) {
      this.error = e.response?.data?.message || "No se pudieron cargar los subcontratos.";
    } finally {
      this.cargando = false;
    }
  },
  methods: {
    monto, num, pct, fecha,
    abrir(s) { this.$router.push({ name: "DetalleSubcontrato", params: { obraId: this.obraId, subId: s.id } }); },
  },
};
</script>

<style src="../assets/css/subcontratos.css"></style>
<style scoped>
.lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
.tarjeta { cursor: pointer; transition: border-color 0.15s ease, transform 0.15s ease; margin: 0; }
.tarjeta:hover { border-color: #7c3aed; transform: translateY(-2px); }
.tarjeta-cabeza { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.nombre { margin: 0; font-size: 1.1rem; color: #f8fafc; }
.dato { margin: 3px 0 0; font-size: 0.8rem; color: #94a3b8; }
.avance { margin: 14px 0 12px; display: flex; flex-direction: column; gap: 7px; }
.avance-texto { font-size: 0.86rem; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.numeros { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin: 0; }
.numeros div { display: flex; flex-direction: column; }
.numeros dt { font-size: 0.68rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
.numeros dd { margin: 0; font-weight: 800; font-variant-numeric: tabular-nums; }
.numeros .exced dd { color: #fdba74; }
.pie { margin: 12px 0 0; font-size: 0.76rem; }
</style>

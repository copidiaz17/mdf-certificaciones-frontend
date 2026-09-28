<template>
  <div class="sc-vista">
    <div v-if="cargando" class="sc-estado">Cargando…</div>
    <div v-else-if="errorCarga" class="sc-error">{{ errorCarga }}</div>

    <template v-else>
      <header class="sc-cabecera">
        <div>
          <p class="sc-eyebrow">Actualización de precios · {{ sub.subcontratista }}</p>
          <h2 class="sc-titulo">
            {{ actual ? `Actualización N° ${actual.numero}` : "Nueva actualización de precios" }}
            <span v-if="actual && !actual.editable" class="sc-chip sc-chip-finalizado">solo lectura</span>
          </h2>
          <p class="sc-bajada">
            Los precios nuevos valen para los certificados cuyo período termina el día que rigen o después.
            Lo ya certificado no cambia.
          </p>
        </div>
        <div class="sc-acciones">
          <button class="sc-btn sc-btn-sec" @click="volver">← Volver</button>
        </div>
      </header>

      <p v-if="actual && !actual.editable" class="sc-aviso">
        El certificado N° {{ actual.usada_por_certificado }} ya se hizo con estos precios: esta actualización
        no se puede cambiar. Si hay que corregir un precio, cargá otra actualización.
      </p>

      <section class="sc-panel cabecera-act">
        <div class="sc-campo">
          <label>Rigen desde</label>
          <input type="date" v-model="form.fecha_vigencia" :min="desdeMinima || undefined" class="sc-input" :disabled="soloLectura" />
        </div>
        <div class="sc-campo motivo">
          <label>Motivo</label>
          <input v-model="form.motivo" maxlength="300" class="sc-input" placeholder="Ej.: acuerdo por inflación de junio" :disabled="soloLectura" />
        </div>
        <div v-if="!soloLectura" class="sc-campo porcentaje">
          <label>Mismo % a todos</label>
          <div class="en-linea">
            <input type="number" step="0.01" v-model.number="porcentaje" class="sc-input" placeholder="%" />
            <button class="sc-btn sc-btn-sec" :disabled="!(porcentaje > -100)" @click="aplicarPorcentaje">Aplicar</button>
          </div>
        </div>
      </section>
      <p v-if="desdeMinima && !soloLectura" class="sc-muted chico">
        Tiene que regir desde el {{ fecha(desdeMinima) }} o después: hasta el día anterior ya hay certificados.
      </p>

      <section class="sc-panel">
        <h3 class="sc-panel-titulo">
          Precios
          <span class="sc-muted pista">Dejá vacío lo que no cambia.</span>
        </h3>
        <div class="sc-tabla-wrap">
          <table class="sc-tabla">
            <thead>
              <tr>
                <th>Ítem</th><th>Descripción</th><th>Un.</th><th class="num">Cantidad</th>
                <th class="num">Precio que regía</th><th class="num">Precio nuevo</th><th class="num">Variación</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in items" :key="it.id" :class="{ 'fila-nuevo': cambia(it) }">
                <td>{{ it.numero }}</td>
                <td class="desc">
                  {{ it.descripcion }}
                  <span v-if="it.origen === 'adicional'" class="sc-chip sc-chip-adicional">adicional</span>
                </td>
                <td>{{ it.unidad }}</td>
                <td class="num">{{ num(it.cantidad, 4) }}</td>
                <td class="num">{{ monto(anterior(it)) }}</td>
                <td class="num">
                  <input v-if="!soloLectura" type="number" min="0" step="0.01" class="sc-celda ancho-precio"
                    :class="{ 'sc-celda-llena': cambia(it) }" :placeholder="num(anterior(it), 2)"
                    :value="nuevos[it.id] ?? ''" @input="setNuevo(it.id, $event.target.value)" />
                  <span v-else>{{ cambia(it) ? monto(nuevos[it.id]) : "—" }}</span>
                </td>
                <td class="num" :class="{ sube: variacion(it) > 0, baja: variacion(it) < 0 }">
                  {{ cambia(it) ? (variacion(it) > 0 ? "+" : "") + pct(variacion(it)) : "" }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="num">Toda la OC</td>
                <td class="num">{{ monto(totalAnterior) }}</td>
                <td class="num">{{ monto(totalNuevo) }}</td>
                <td class="num">{{ totalAnterior ? pct(((totalNuevo - totalAnterior) / totalAnterior) * 100) : "" }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p v-if="error" class="sc-error">{{ error }}</p>

      <div v-if="!soloLectura" class="sc-acciones final">
        <button v-if="actual" class="sc-btn sc-btn-peligro" :disabled="guardando" @click="borrar">Borrar actualización</button>
        <button class="sc-btn sc-btn-ok" :disabled="guardando || !cambiados.length" @click="guardar">
          {{ guardando ? "Guardando…" : actual ? "Guardar corrección" : `Guardar ${cambiados.length} precio(s) nuevo(s)` }}
        </button>
      </div>
    </template>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useToast } from "vue-toastification";
import { monto, num, pct, fecha, r2, sumarDias, precioAl } from "../utils/subcontratos.js";

export default {
  name: "SubcontratoActualizacionView",
  props: ["obraId", "subId", "actId"],
  setup() { return { toast: useToast() }; },
  data() {
    return {
      cargando: true, guardando: false, errorCarga: "", error: "",
      sub: {}, items: [], actual: null, desdeMinima: null,
      form: { fecha_vigencia: "", motivo: "" },
      nuevos: {},        // precio nuevo por ítem; vacío = no cambia
      porcentaje: null,
    };
  },
  computed: {
    soloLectura() { return !!this.actual && !this.actual.editable; },
    // El precio que regía el día antes: el que se reemplaza.
    diaAnterior() { return this.form.fecha_vigencia ? sumarDias(this.form.fecha_vigencia, -1) : null; },
    cambiados() { return this.items.filter((it) => this.cambia(it)); },
    totalAnterior() { return r2(this.items.reduce((s, it) => s + Number(it.cantidad || 0) * this.anterior(it), 0)); },
    totalNuevo() {
      return r2(this.items.reduce((s, it) => s + Number(it.cantidad || 0) * (this.cambia(it) ? Number(this.nuevos[it.id]) : this.anterior(it)), 0));
    },
  },
  async mounted() {
    try {
      const { data } = await api.get(`/obras/${this.obraId}/subcontratos/${this.subId}`);
      this.sub = data.subcontrato;
      this.items = data.items;
      this.desdeMinima = data.actualizacion_desde_minima;
      if (this.actId) {
        this.actual = (data.actualizaciones || []).find((a) => a.id === Number(this.actId)) || null;
        if (!this.actual) throw { response: { data: { message: "La actualización no existe." } } };
        this.form = { fecha_vigencia: this.actual.fecha_vigencia, motivo: this.actual.motivo || "" };
        const nuevos = {};
        for (const r of this.actual.items) nuevos[r.subcontrato_item_id] = r.precio;
        this.nuevos = nuevos;
      } else {
        this.form.fecha_vigencia = this.desdeMinima || "";
      }
    } catch (e) {
      this.errorCarga = e.response?.data?.message || "No se pudo cargar el subcontrato.";
    } finally {
      this.cargando = false;
    }
  },
  methods: {
    monto, num, pct, fecha,
    // Sin la actualización que se corrige: si no, "lo que regía" sería ella misma.
    anterior(it) { return precioAl(it.precios, this.diaAnterior, this.actual?.numero ?? null); },
    cambia(it) {
      const v = this.nuevos[it.id];
      return v !== undefined && v !== "" && r2(v) !== r2(this.anterior(it));
    },
    variacion(it) {
      const a = this.anterior(it);
      return a ? ((Number(this.nuevos[it.id]) - a) / a) * 100 : 0;
    },
    setNuevo(id, texto) {
      if (texto === "") { delete this.nuevos[id]; return; }
      const n = Number(texto);
      this.nuevos[id] = Number.isFinite(n) && n >= 0 ? n : 0;
    },
    aplicarPorcentaje() {
      const f = 1 + Number(this.porcentaje) / 100;
      const nuevos = {};
      for (const it of this.items) nuevos[it.id] = r2(this.anterior(it) * f);
      this.nuevos = nuevos;
    },
    volver() { this.$router.push({ name: "DetalleSubcontrato", params: { obraId: this.obraId, subId: this.subId } }); },
    async guardar() {
      this.error = "";
      if (!this.form.fecha_vigencia) { this.error = "Indicá desde qué fecha rigen los precios nuevos."; return; }
      const cuerpo = {
        fecha_vigencia: this.form.fecha_vigencia,
        motivo: this.form.motivo || null,
        items: this.cambiados.map((it) => ({ subcontrato_item_id: it.id, precio_unitario: Number(this.nuevos[it.id]) })),
      };
      this.guardando = true;
      try {
        const ruta = `/obras/${this.obraId}/subcontratos/${this.subId}/actualizaciones`;
        const { data } = this.actual ? await api.put(`${ruta}/${this.actual.id}`, cuerpo) : await api.post(ruta, cuerpo);
        this.toast.success(data.message || "Actualización guardada");
        this.volver();
      } catch (e) {
        this.error = e.response?.data?.message || "No se pudo guardar la actualización.";
      } finally {
        this.guardando = false;
      }
    },
    async borrar() {
      if (!window.confirm(`¿Borrar la actualización N° ${this.actual.numero}? Los certificados que vengan vuelven a los precios anteriores.`)) return;
      this.guardando = true;
      try {
        await api.delete(`/obras/${this.obraId}/subcontratos/${this.subId}/actualizaciones/${this.actual.id}`);
        this.toast.success("Actualización borrada");
        this.volver();
      } catch (e) {
        this.error = e.response?.data?.message || "No se pudo borrar.";
      } finally {
        this.guardando = false;
      }
    },
  },
};
</script>

<style src="../assets/css/subcontratos.css"></style>
<style scoped>
.cabecera-act { display: grid; grid-template-columns: 180px 1fr 220px; gap: 12px; align-items: end; }
.en-linea { display: flex; gap: 6px; }
.en-linea .sc-input { width: 90px; }
.ancho-precio { width: 120px; }
.chico { font-size: 0.8rem; margin: -8px 0 14px; }
.pista { font-size: 0.78rem; font-weight: 500; }
.sube { color: #fdba74; }
.baja { color: #86efac; }
.final { justify-content: flex-end; }
@media (max-width: 760px) { .cabecera-act { grid-template-columns: 1fr; } }
</style>

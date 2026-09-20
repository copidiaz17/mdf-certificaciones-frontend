<template>
  <div class="sc-vista">
    <header class="sc-cabecera">
      <div>
        <p class="sc-eyebrow">Orden de compra</p>
        <h2 class="sc-titulo">{{ editando ? `Editar OC · ${form.subcontratista}` : "Nueva orden de compra" }}</h2>
        <p class="sc-bajada">
          Los ítems salen del pliego de la obra, pero con la cantidad y el precio acordados con el
          subcontratista. También se pueden sumar trabajos que el pliego no tiene. Los adicionales
          dicen de qué clase son: más cantidad de un rubro que ya estaba («cargado de más») o un
          rubro que no existía («ítem nuevo»). Lo que se certifique por encima de la OC se registra
          solo, al certificar.
        </p>
      </div>
      <button class="sc-btn sc-btn-sec" @click="volver">← Volver</button>
    </header>

    <div v-if="cargando" class="sc-estado">Cargando…</div>
    <template v-else>
      <!-- Cabecera -->
      <section class="sc-panel">
        <h3 class="sc-panel-titulo">Datos del contrato</h3>
        <div class="grilla-campos">
          <div class="sc-campo campo-ancho">
            <label>Subcontratista *</label>
            <input v-model="form.subcontratista" class="sc-input" placeholder="Apellido, Nombre o razón social" />
          </div>
          <div class="sc-campo"><label>CUIT</label><input v-model="form.cuit" class="sc-input" /></div>
          <div class="sc-campo"><label>N° de OC</label><input v-model="form.numero_oc" class="sc-input" /></div>
          <div class="sc-campo"><label>Fecha de contrato</label><input type="date" v-model="form.fecha_contrato" class="sc-input" /></div>
          <div class="sc-campo"><label>Empieza a trabajar</label><input type="date" v-model="form.fecha_inicio" class="sc-input" /></div>
          <div class="sc-campo">
            <label>Se certifica</label>
            <select v-model="form.periodicidad" class="sc-input">
              <option value="quincenal">Quincenal</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>
          <div v-if="editando" class="sc-campo">
            <label>Estado</label>
            <select v-model="form.estado" class="sc-input">
              <option value="vigente">Vigente</option>
              <option value="finalizado">Finalizado</option>
              <option value="anulado">Anulado</option>
            </select>
          </div>
          <div class="sc-campo campo-ancho">
            <label>Observaciones</label>
            <input v-model="form.observaciones" class="sc-input" />
          </div>
        </div>
      </section>

      <!-- Selector del pliego -->
      <section class="sc-panel">
        <h3 class="sc-panel-titulo">
          Agregar ítems del pliego
          <input v-model="busqueda" class="sc-input buscador" placeholder="Buscar por número o descripción" />
        </h3>
        <div class="sc-tabla-wrap pliego-wrap">
          <table class="sc-tabla">
            <thead>
              <tr><th></th><th>Ítem</th><th>Descripción</th><th>Unidad</th><th class="num">Cant. pliego</th><th>Ya en</th></tr>
            </thead>
            <tbody>
              <tr v-for="p in pliegoVisible" :key="p.id" class="clickable" @click="alternar(p)">
                <td><input type="checkbox" :checked="enOC(p.id)" @click.stop="alternar(p)" /></td>
                <td>{{ p.numeroItem }}</td>
                <td class="desc">{{ p.descripcionItem }}</td>
                <td>{{ p.unidadMedida }}</td>
                <td class="num">{{ num(p.cantidad, 4) }}</td>
                <td>
                  <span v-for="u in otrosSubs(p)" :key="u.subcontrato_id" class="sc-chip sc-chip-propio">{{ u.subcontratista }}</span>
                </td>
              </tr>
              <tr v-if="!pliegoVisible.length"><td colspan="6" class="sc-vacio">Ningún ítem coincide.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Ítems de la OC -->
      <section class="sc-panel">
        <h3 class="sc-panel-titulo">
          Ítems de la orden de compra
          <span class="sc-acciones">
            <button class="sc-btn sc-btn-sec sc-btn-mini" @click="agregarPropio('contrato')">+ Ítem que no está en el pliego</button>
            <button class="sc-btn sc-btn-sec sc-btn-mini" @click="agregarPropio('adicional')">+ Adicional</button>
          </span>
        </h3>
        <div class="sc-tabla-wrap">
          <table class="sc-tabla">
            <thead>
              <tr>
                <th>Ítem</th><th>Descripción</th><th>Unidad</th>
                <th class="num">Cantidad</th><th class="num">Precio unit.</th><th class="num">Total</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!items.length"><td colspan="7" class="sc-vacio">Elegí ítems del pliego o agregá uno propio.</td></tr>
              <tr v-for="(it, i) in items" :key="it._k">
                <td>
                  <input v-if="!it.pliego_item_id" v-model="it.numero" class="sc-input chico" />
                  <span v-else>{{ it.numero }}</span>
                </td>
                <td class="desc">
                  <input v-if="!it.pliego_item_id" v-model="it.descripcion" class="sc-input ancho" placeholder="Descripción *" />
                  <span v-else>{{ it.descripcion }}</span>
                  <span v-if="it.origen !== 'adicional' && !it.pliego_item_id" class="sc-chip sc-chip-propio">fuera del pliego</span>
                  <div v-if="it.origen === 'adicional'" class="adicional-tipo">
                    <select v-model="it.tipo_adicional" class="sc-input" @change="it.tipo_adicional === 'nuevo' && (it.item_origen_id = null)">
                      <option value="nuevo">Adicional · ítem nuevo</option>
                      <option value="de_mas" :disabled="!rubrosGuardados.length">Adicional · cargado de más</option>
                    </select>
                    <select v-if="it.tipo_adicional === 'de_mas'" v-model="it.item_origen_id" class="sc-input">
                      <option :value="null" disabled>¿Qué rubro agranda?</option>
                      <option v-for="r in rubrosGuardados" :key="r.id" :value="r.id">{{ r.numero ? r.numero + " · " : "" }}{{ r.descripcion }}</option>
                    </select>
                    <span v-if="it.creado_en_certificado_id" class="sc-muted nota">nació en un certificado</span>
                  </div>
                </td>
                <td>
                  <input v-if="!it.pliego_item_id" v-model="it.unidad" class="sc-input chico" />
                  <span v-else>{{ it.unidad }}</span>
                </td>
                <td class="num"><input type="number" min="0" step="0.0001" v-model.number="it.cantidad" class="sc-celda" /></td>
                <td class="num"><input type="number" min="0" step="0.01" v-model.number="it.precio_unitario" class="sc-celda ancho-precio" /></td>
                <td class="num">{{ monto(totalDe(it)) }}</td>
                <td><button class="sc-btn sc-btn-peligro sc-btn-mini" @click="quitar(i)" title="Quitar">✕</button></td>
              </tr>
            </tbody>
            <tfoot v-if="items.length">
              <tr><td colspan="5" class="num">Contrato original</td><td class="num">{{ monto(totalOriginal) }}</td><td></td></tr>
              <tr v-if="totalDe_mas"><td colspan="5" class="num">Adicionales · cargado de más</td><td class="num">{{ monto(totalDe_mas) }}</td><td></td></tr>
              <tr v-if="totalNuevo"><td colspan="5" class="num">Adicionales · ítem nuevo</td><td class="num">{{ monto(totalNuevo) }}</td><td></td></tr>
              <tr><td colspan="5" class="num">Total de la orden de compra</td><td class="num">{{ monto(totalOriginal + totalDe_mas + totalNuevo) }}</td><td></td></tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p v-if="error" class="sc-error">{{ error }}</p>
      <div class="sc-acciones final">
        <button class="sc-btn sc-btn-sec" @click="volver">Cancelar</button>
        <button class="sc-btn sc-btn-ok" :disabled="guardando" @click="guardar">
          {{ guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear orden de compra" }}
        </button>
      </div>
    </template>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useToast } from "vue-toastification";
import { monto, num } from "../utils/subcontratos.js";

let clave = 0;

export default {
  name: "SubcontratoFormView",
  props: ["obraId", "subId"],
  setup() { return { toast: useToast() }; },
  data() {
    return {
      cargando: true,
      guardando: false,
      error: "",
      busqueda: "",
      pliego: [],
      items: [],
      form: {
        subcontratista: "", cuit: "", numero_oc: "", fecha_contrato: "", fecha_inicio: "",
        periodicidad: "quincenal", estado: "vigente", observaciones: "",
      },
    };
  },
  computed: {
    editando() { return !!this.subId; },
    pliegoVisible() {
      const q = this.busqueda.trim().toLowerCase();
      if (!q) return this.pliego;
      return this.pliego.filter((p) => String(p.numeroItem).toLowerCase().includes(q) || String(p.descripcionItem).toLowerCase().includes(q));
    },
    totalOriginal() { return this.items.filter((i) => i.origen !== "adicional").reduce((s, i) => s + this.totalDe(i), 0); },
    totalDe_mas() { return this.items.filter((i) => i.origen === "adicional" && i.tipo_adicional === "de_mas").reduce((s, i) => s + this.totalDe(i), 0); },
    totalNuevo() { return this.items.filter((i) => i.origen === "adicional" && i.tipo_adicional !== "de_mas").reduce((s, i) => s + this.totalDe(i), 0); },
    // Un adicional "de más" agranda un rubro que ya está guardado en la OC.
    rubrosGuardados() { return this.items.filter((i) => i.id && i.origen !== "adicional"); },
  },
  async mounted() {
    try {
      const pedidos = [api.get(`/obras/${this.obraId}/subcontratos-pliego`)];
      if (this.editando) pedidos.push(api.get(`/obras/${this.obraId}/subcontratos/${this.subId}`));
      const [pliego, det] = await Promise.all(pedidos);
      this.pliego = pliego.data || [];
      if (det) {
        const s = det.data.subcontrato;
        Object.assign(this.form, {
          subcontratista: s.subcontratista || "", cuit: s.cuit || "", numero_oc: s.numero_oc || "",
          fecha_contrato: s.fecha_contrato || "", fecha_inicio: s.fecha_inicio || "",
          periodicidad: s.periodicidad, estado: s.estado, observaciones: s.observaciones || "",
        });
        this.items = det.data.items.map((it) => ({ ...it, _k: ++clave }));
      }
    } catch (e) {
      this.error = e.response?.data?.message || "No se pudo cargar la información.";
    } finally {
      this.cargando = false;
    }
  },
  methods: {
    monto, num,
    totalDe(it) { return Math.round(Number(it.cantidad || 0) * Number(it.precio_unitario || 0) * 100) / 100; },
    enOC(pliegoId) { return this.items.some((i) => i.pliego_item_id === pliegoId); },
    otrosSubs(p) { return (p.en_subcontratos || []).filter((u) => String(u.subcontrato_id) !== String(this.subId)); },
    alternar(p) {
      const i = this.items.findIndex((x) => x.pliego_item_id === p.id);
      if (i >= 0) { this.items.splice(i, 1); return; }
      // La cantidad arranca en la del pliego; el precio lo pone quien arma la OC.
      this.items.push({
        _k: ++clave, pliego_item_id: p.id, numero: p.numeroItem, descripcion: p.descripcionItem,
        unidad: p.unidadMedida, cantidad: p.cantidad, precio_unitario: 0, origen: "contrato",
      });
    },
    agregarPropio(origen) {
      this.items.push({
        _k: ++clave, pliego_item_id: null, numero: "", descripcion: "", unidad: "", cantidad: 1, precio_unitario: 0, origen,
        tipo_adicional: origen === "adicional" ? "nuevo" : null, item_origen_id: null,
      });
    },
    quitar(i) { this.items.splice(i, 1); },
    volver() {
      if (this.editando) this.$router.push({ name: "DetalleSubcontrato", params: { obraId: this.obraId, subId: this.subId } });
      else this.$router.push({ name: "SubcontratosObra", params: { obraId: this.obraId } });
    },
    async guardar() {
      this.error = "";
      if (!this.form.subcontratista.trim()) { this.error = "Falta el nombre del subcontratista."; return; }
      if (!this.items.length) { this.error = "La orden de compra tiene que tener al menos un ítem."; return; }
      const sinRubro = this.items.find((i) => i.origen === "adicional" && i.tipo_adicional === "de_mas" && !i.item_origen_id);
      if (sinRubro) { this.error = `El adicional "${sinRubro.descripcion || "sin descripción"}" es de más: elegí qué rubro agranda.`; return; }
      const sinPrecio = this.items.find((i) => !(Number(i.precio_unitario) > 0));
      if (sinPrecio && !window.confirm(`"${sinPrecio.descripcion || "Un ítem"}" tiene precio 0. ¿Guardar igual?`)) return;

      this.guardando = true;
      try {
        const cuerpo = {
          ...this.form,
          fecha_contrato: this.form.fecha_contrato || null,
          fecha_inicio: this.form.fecha_inicio || null,
          items: this.items.map(({ _k, creado_en_certificado_id, ...it }) => it),
        };
        if (this.editando) {
          await api.put(`/obras/${this.obraId}/subcontratos/${this.subId}`, cuerpo);
          this.toast.success("Orden de compra actualizada");
          this.$router.push({ name: "DetalleSubcontrato", params: { obraId: this.obraId, subId: this.subId } });
        } else {
          const { data } = await api.post(`/obras/${this.obraId}/subcontratos`, cuerpo);
          this.toast.success("Orden de compra creada");
          this.$router.push({ name: "DetalleSubcontrato", params: { obraId: this.obraId, subId: data.id } });
        }
      } catch (e) {
        this.error = e.response?.data?.message || "No se pudo guardar la orden de compra.";
      } finally {
        this.guardando = false;
      }
    },
  },
};
</script>

<style src="../assets/css/subcontratos.css"></style>
<style scoped>
.grilla-campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.campo-ancho { grid-column: span 2; }
.buscador { min-width: 260px; font-weight: 400; }
.pliego-wrap { max-height: 320px; }
.chico { width: 80px; }
.ancho { width: 100%; min-width: 220px; }
.ancho-precio { width: 120px; }
.final { justify-content: flex-end; }
.adicional-tipo { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 6px; }
.adicional-tipo .sc-input { font-size: 0.78rem; padding: 4px 8px; max-width: 280px; }
.nota { font-size: 0.72rem; }
@media (max-width: 700px) { .campo-ancho { grid-column: span 1; } }
</style>

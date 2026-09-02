<template>
  <div class="excedentes-view">
    <h2 class="titulo">Excedentes de obra</h2>

    <p class="ayuda">
      Lo que se ejecutó <strong>por encima de lo que dice el pliego</strong>. Va en cantidad y
      <strong>sin precio</strong>: cuánto vale se negocia después con el comitente, en el replanteo o
      en un adicional al terminar lo planificado.
    </p>

    <div v-if="cargando" class="estado">Cargando…</div>

    <div v-else-if="!excedentes.length" class="estado vacio">
      <span class="icono">✓</span>
      <p>Ningún ítem se pasó de lo planificado.</p>
      <small v-if="resumen.items_con_avance === 0">
        Todavía no hay avances cargados en esta obra.
      </small>
      <small v-else>
        Se revisaron {{ resumen.items_con_avance }} ítem(s) con avance sobre {{ resumen.items_pliego }} del pliego.
      </small>
    </div>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>Ítem</th>
            <th>Descripción</th>
            <th>Unidad</th>
            <th class="der">Pliego</th>
            <th class="der">Ejecutado</th>
            <th class="der">Excedente</th>
            <th class="der">Reconocido</th>
            <th class="der">Pendiente</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in excedentes" :key="e.pliego_item_id" :class="{ saldado: e.pendiente <= 0 }">
            <td>{{ e.numero_item }}</td>
            <td>{{ e.descripcion }}</td>
            <td>{{ e.unidad }}</td>
            <td class="der">{{ n(e.cantidad_pliego) }}</td>
            <td class="der">
              {{ n(e.cantidad_ejecutada) }}
              <span class="sub">{{ e.acumulado_porcentaje }}%</span>
            </td>
            <td class="der excedente">+{{ n(e.excedente) }}</td>
            <td class="der">{{ n(e.ya_convertido) }}</td>
            <td class="der">
              <strong v-if="e.pendiente > 0" class="pendiente">{{ n(e.pendiente) }}</strong>
              <span v-else class="saldado-txt">saldado</span>
            </td>
            <td>
              <button v-if="e.pendiente > 0 && puedeModificar" class="btn-convertir" @click="abrir(e)">
                Convertir en ítem
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <p class="nota">{{ resumen.nota }}</p>
    </template>

    <!-- Convertir -->
    <div v-if="convirtiendo" class="modal-fondo" @click.self="convirtiendo = null">
      <div class="modal">
        <div class="modal-cab">
          <h3>Convertir excedente en ítem del pliego</h3>
          <button class="cerrar" @click="convirtiendo = null">✕</button>
        </div>

        <div class="modal-cuerpo">
          <div class="resumen-item">
            <div class="ri-titulo">{{ convirtiendo.numero_item }} — {{ convirtiendo.descripcion }}</div>
            <div class="ri-cifras">
              <div><span class="et">Pliego</span>{{ n(convirtiendo.cantidad_pliego) }} {{ convirtiendo.unidad }}</div>
              <div><span class="et">Ejecutado</span>{{ n(convirtiendo.cantidad_ejecutada) }} {{ convirtiendo.unidad }}</div>
              <div class="pend"><span class="et">Sin reconocer</span>{{ n(convirtiendo.pendiente) }} {{ convirtiendo.unidad }}</div>
            </div>
          </div>

          <p class="explica">
            Se crea un <strong>ítem nuevo</strong> del pliego, no se le agranda la cantidad al
            original. El ítem nace <strong>sin precio</strong>: cuánto vale se define cuando se
            negocie con el comitente.
          </p>

          <label class="campo">
            <span>¿Cuánto se reconoce? *</span>
            <div class="fila-cantidad">
              <input type="number" v-model.number="form.cantidad" min="0"
                     :max="convirtiendo.pendiente" step="0.00001" />
              <span class="unidad">{{ convirtiendo.unidad }}</span>
              <button type="button" class="link" @click="form.cantidad = convirtiendo.pendiente">
                todo ({{ n(convirtiendo.pendiente) }})
              </button>
            </div>
            <small>
              Se puede reconocer una parte ahora y el resto más adelante, en otro replanteo o en el
              adicional del final.
            </small>
          </label>

          <label class="campo">
            <span>N° del ítem nuevo</span>
            <input type="text" v-model="form.numero_item" :placeholder="`${convirtiendo.numero_item} EXC`" />
            <small>Se deja así para reconocerlo de un vistazo en el pliego.</small>
          </label>

          <label class="campo">
            <span>Descripción</span>
            <input type="text" v-model="form.descripcion"
                   :placeholder="`${convirtiendo.descripcion} — excedente`" />
          </label>

          <label class="campo">
            <span>Fecha de incorporación</span>
            <input type="date" v-model="form.fecha" />
          </label>

          <button class="btn-guardar" @click="convertir" :disabled="!valido || guardando">
            {{ guardando ? "Creando…" : "Crear el ítem" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useToast } from "vue-toastification";

export default {
  name: "ExcedentesObraView",
  props: ["obraId"],
  setup() {
    return { toast: useToast() };
  },
  data() {
    return {
      excedentes: [],
      resumen: {},
      cargando: true,
      convirtiendo: null,
      guardando: false,
      form: {},
    };
  },
  computed: {
    valido() {
      const c = Number(this.form.cantidad);
      return c > 0 && c <= Number(this.convirtiendo?.pendiente || 0) + 0.00001;
    },
    puedeModificar() {
      const rol = String(localStorage.getItem("rol") || "").toLowerCase();
      // Lector solo mira. Los demás roles del sistema pueden convertir.
      return rol !== "lector" && rol !== "viewer";
    },
  },
  methods: {
    n(v) {
      return Number(v || 0).toLocaleString("es-AR", { maximumFractionDigits: 5 });
    },
    async cargar() {
      this.cargando = true;
      try {
        const res = await api.get(`/avanceObra/${this.obraId}/excedentes`);
        this.excedentes = res.data?.excedentes || [];
        this.resumen = res.data || {};
      } catch (e) {
        this.toast.error("No se pudieron cargar los excedentes.");
        this.excedentes = [];
      } finally {
        this.cargando = false;
      }
    },
    abrir(e) {
      this.convirtiendo = e;
      this.form = {
        cantidad: e.pendiente,
        numero_item: "",
        descripcion: "",
        fecha: new Date().toISOString().slice(0, 10),
      };
    },
    async convertir() {
      this.guardando = true;
      try {
        const res = await api.post(
          `/avanceObra/${this.obraId}/excedentes/${this.convirtiendo.pliego_item_id}/convertir`,
          {
            cantidad: this.form.cantidad,
            numero_item: this.form.numero_item || undefined,
            descripcion: this.form.descripcion || undefined,
            fecha: this.form.fecha || undefined,
          }
        );
        this.toast.success(res.data?.message || "Ítem creado.");
        this.convirtiendo = null;
        await this.cargar();
      } catch (err) {
        this.toast.error(err.response?.data?.message || "No se pudo convertir el excedente.");
      } finally {
        this.guardando = false;
      }
    },
  },
  mounted() {
    this.cargar();
  },
};
</script>

<style scoped>
.excedentes-view { padding: 20px; }
.titulo { color: #1e293b; margin-bottom: 6px; }
.ayuda { color: #475569; font-size: 0.9rem; line-height: 1.6; margin: 0 0 18px; max-width: 900px; }

.estado { color: #64748b; padding: 24px 0; }
.estado.vacio { text-align: center; }
.estado.vacio .icono { font-size: 2rem; color: #16a34a; display: block; }
.estado.vacio p { margin: 8px 0 4px; font-weight: 600; color: #334155; }
.estado.vacio small { color: #94a3b8; }

.data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.data-table th, .data-table td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
.data-table th { background: #f1f5f9; color: #334155; font-weight: 700; }
.der { text-align: right; }
.sub { display: block; font-size: 0.72rem; color: #94a3b8; }
.excedente { color: #b45309; font-weight: 700; }
.pendiente { color: #b45309; }
.saldado-txt { color: #16a34a; font-size: 0.82rem; }
tr.saldado td { opacity: 0.6; }

.nota { margin-top: 14px; font-size: 0.82rem; color: #64748b; font-style: italic; line-height: 1.5; }

.btn-convertir {
  background: #1d4ed8; color: #fff; border: 0; border-radius: 6px;
  padding: 6px 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
}

.modal-fondo {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 200;
}
.modal { background: #fff; border-radius: 14px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
.modal-cab { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; }
.modal-cab h3 { margin: 0; font-size: 1rem; color: #1e293b; }
.cerrar { background: none; border: 0; font-size: 1.1rem; cursor: pointer; color: #64748b; }
.modal-cuerpo { padding: 20px; }

.resumen-item { background: #f8fafc; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
.ri-titulo { font-weight: 700; color: #1e293b; margin-bottom: 8px; }
.ri-cifras { display: flex; gap: 18px; flex-wrap: wrap; font-size: 0.88rem; }
.ri-cifras .et { display: block; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; }
.ri-cifras .pend { color: #b45309; font-weight: 700; }

.explica { font-size: 0.85rem; color: #475569; line-height: 1.55; margin: 0 0 16px; }

.campo { display: block; margin-bottom: 14px; }
.campo > span { display: block; font-size: 0.82rem; color: #475569; margin-bottom: 4px; font-weight: 600; }
.campo input { width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.campo small { display: block; margin-top: 4px; font-size: 0.76rem; color: #94a3b8; line-height: 1.45; }

.fila-cantidad { display: flex; align-items: center; gap: 8px; }
.fila-cantidad input { flex: 1; }
.fila-cantidad .unidad { color: #64748b; font-size: 0.85rem; }
.link { background: none; border: 0; color: #1d4ed8; font-size: 0.78rem; cursor: pointer; text-decoration: underline; white-space: nowrap; }

.btn-guardar {
  width: 100%; background: #166534; color: #fff; border: 0; border-radius: 8px;
  padding: 10px; font-weight: 700; cursor: pointer; margin-top: 6px;
}
.btn-guardar:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

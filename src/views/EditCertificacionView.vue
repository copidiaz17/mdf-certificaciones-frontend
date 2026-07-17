<template>
  <div class="edit-cert-view">
    <h2 class="titulo">Editar Certificación</h2>

    <form class="form-cert" @submit.prevent="guardar">
      <div class="grid-cab">
        <div class="campo">
          <label>N° Certificado</label>
          <input v-model="form.numero_certificado" type="text" placeholder="Ej: 1" />
        </div>
        <div class="campo">
          <label>Fecha de Emisión</label>
          <input v-model="form.fecha_certificacion" type="date" min="2000-01-01" max="2099-12-31" />
        </div>
        <div class="campo">
          <label>Período Desde</label>
          <input v-model="form.periodo_desde" type="date" min="2000-01-01" max="2099-12-31" />
        </div>
        <div class="campo">
          <label>Período Hasta</label>
          <input v-model="form.periodo_hasta" type="date" min="2000-01-01" max="2099-12-31" />
        </div>
      </div>

      <h3 class="sub">Ítems y avance</h3>
      <p class="hint">Editá el avance de cada ítem. El "% Disp." es lo máximo que podés certificar (ya descuenta las otras certificaciones).</p>

      <div class="tabla-wrap">
        <table class="tabla-items">
          <thead>
            <tr>
              <th>Ítem</th><th>Descripción</th><th>Unidad</th><th>Cantidad</th>
              <th>Avance (%)</th><th>% Disp.</th><th>Precio Unit.</th><th>Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in certItems" :key="it.pliego_item_id">
              <td>{{ it.numeroItem }}</td>
              <td class="td-desc">{{ it.descripcion }}</td>
              <td>{{ it.unidad }}</td>
              <td class="num">{{ mostrar(it.cantidad) }}</td>
              <td>
                <input class="inp-pct" type="number" min="0" :max="it.porcentajeDisponible"
                       step="0.01" v-model.number="it.avance_porcentaje" @input="calcularImporte(it)" />
              </td>
              <td>{{ it.porcentajeDisponible }}%</td>
              <td class="num">{{ mostrar(it.precioUnitario) }}</td>
              <td class="num">{{ mostrar(it.importe) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="row-total">
              <td colspan="7" class="text-right">Costo total del certificado</td>
              <td class="num">{{ mostrar(subtotal) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="acciones">
        <button type="submit" class="btn-guardar">Guardar cambios</button>
        <button type="button" class="btn-cancelar" @click="$router.back()">Cancelar</button>
      </div>
    </form>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useToast } from "vue-toastification";

export default {
  name: "EditCertificacionView",
  props: ["obraId", "certId"],

  setup() {
    const toast = useToast();
    return { toast };
  },

  data() {
    return {
      form: {
        numero_certificado: "",
        fecha_certificacion: "",
        periodo_desde: "",
        periodo_hasta: "",
      },
      certItems: [],
    };
  },

  computed: {
    subtotal() {
      return this.certItems.reduce((s, it) => s + Number(it.importe || 0), 0);
    },
  },

  async mounted() {
    await this.cargarDatos();
  },

  methods: {
    mostrar(n) {
      return Number(n || 0).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },

    async cargarDatos() {
      try {
        const [detRes, dispRes] = await Promise.all([
          api.get(`/certificaciones/${this.certId}/detalle`),
          api.get(`/obras/${this.obraId}/items-disponibles-certificacion?excludeCertId=${this.certId}`),
        ]);

        if (detRes.data.ok) {
          const c = detRes.data.certificado;
          this.form.numero_certificado = c.numero_certificado || "";
          this.form.fecha_certificacion = (c.fecha_certificacion || "").slice(0, 10);
          this.form.periodo_desde = (c.periodo_desde || "").slice(0, 10);
          this.form.periodo_hasta = (c.periodo_hasta || "").slice(0, 10);

          // Avance actual de esta certificación por ítem de pliego
          const actual = {};
          (detRes.data.items || []).forEach((i) => {
            actual[i.pliego_item_id] = Number(i.avance_porcentaje || 0);
          });

          this.certItems = (dispRes.data || []).map((p) => {
            const pct = actual[p.id] || 0;
            const cantidad = Number(p.cantidad || 0);
            const precioUnitario = Number(p.costoUnitario || 0);
            return {
              pliego_item_id: p.id,
              numeroItem: p.numeroItem,
              descripcion: p.descripcionItem,
              unidad: p.unidadMedida,
              cantidad,
              precioUnitario,
              porcentajeDisponible: p.porcentajeDisponible,
              avance_porcentaje: pct,
              importe: (cantidad * precioUnitario * pct) / 100,
            };
          });
        }
      } catch (e) {
        this.toast.error("Error al cargar la certificación.");
      }
    },

    calcularImporte(it) {
      const pct = Number(it.avance_porcentaje || 0);
      it.importe = (Number(it.cantidad || 0) * Number(it.precioUnitario || 0) * pct) / 100;
    },

    async guardar() {
      const { numero_certificado, fecha_certificacion, periodo_desde, periodo_hasta } = this.form;
      if (!numero_certificado || !fecha_certificacion || !periodo_desde || !periodo_hasta) {
        this.toast.warning("Completá los datos de cabecera.");
        return;
      }
      if (periodo_hasta < periodo_desde) {
        this.toast.warning("El período Hasta no puede ser anterior al período Desde.");
        return;
      }

      const items = this.certItems
        .filter((it) => Number(it.avance_porcentaje) > 0)
        .map((it) => ({ pliego_item_id: it.pliego_item_id, avance_porcentaje: Number(it.avance_porcentaje) }));

      if (!items.length) {
        this.toast.warning("La certificación debe tener al menos un ítem con avance.");
        return;
      }

      try {
        const res = await api.put(`/certificaciones/${this.certId}`, { ...this.form, items });
        if (res.data.ok) {
          this.toast.success("Certificación actualizada correctamente.");
          this.$router.push({
            name: "DetalleCertificacion",
            params: { obraId: this.obraId, certId: this.certId },
          });
        }
      } catch (e) {
        this.toast.error(e?.response?.data?.error || "Error al guardar los cambios.");
      }
    },
  },
};
</script>

<style scoped>
.edit-cert-view {
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
  color: #e5e7eb;
}
.titulo {
  font-size: 1.5rem;
  margin-bottom: 20px;
  color: #bbf7d0;
}
.form-cert {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #0b1120;
  border: 1px solid #22c55e;
  border-radius: 10px;
  padding: 24px;
}
.grid-cab {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.campo label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.campo input {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #374151;
  background: #1f2937;
  color: #f9fafb;
  font-size: 0.95rem;
}
.campo input:focus { outline: none; border-color: #22c55e; }

.sub {
  color: #bbf7d0;
  font-size: 1.05rem;
  margin: 8px 0 2px;
}
.hint { color: #9ca3af; font-size: 0.82rem; margin: 0 0 8px; }

.tabla-wrap { overflow-x: auto; }
.tabla-items {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.tabla-items th, .tabla-items td {
  border: 1px solid #374151;
  padding: 6px 8px;
  text-align: center;
}
.tabla-items th {
  background: linear-gradient(90deg, #047857, #22c55e);
  color: #f9fafb;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.72rem;
}
.tabla-items tbody tr:nth-child(odd) { background: #0b1120; }
.tabla-items tbody tr:nth-child(even) { background: #020617; }
.td-desc { text-align: left; }
.num { text-align: right; white-space: nowrap; }
.text-right { text-align: right; }
.inp-pct {
  width: 78px;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid #374151;
  background: #1f2937;
  color: #f9fafb;
  text-align: center;
}
.inp-pct:focus { outline: none; border-color: #22c55e; }
.row-total td {
  background: linear-gradient(90deg, #047857, #22c55e);
  color: #f9fafb;
  font-weight: 800;
}

.acciones {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
.btn-guardar {
  padding: 9px 20px;
  border-radius: 999px;
  border: none;
  background: #22c55e;
  color: #022c22;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-guardar:hover { background: #16a34a; color: #ecfdf5; }
.btn-cancelar {
  padding: 9px 20px;
  border-radius: 999px;
  border: 1px solid #6b7280;
  background: transparent;
  color: #9ca3af;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-cancelar:hover { border-color: #9ca3af; color: #e5e7eb; }
</style>

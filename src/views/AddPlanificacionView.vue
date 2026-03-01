<template>
  <div class="add-cert-view">
    <h2 class="titulo">{{ editMode ? "Editar Planificación" : "Planificación de Obra" }}</h2>

    <!-- MENSAJES -->
    <div v-if="mensaje" class="mensaje-exito">{{ mensaje }}</div>
    <div v-if="error" class="mensaje-error">{{ error }}</div>

    <!-- CABECERA -->
    <div class="cabecera-cert">
      <div class="campo">
        <label>Desde</label>
        <input type="date" v-model="periodo.desde" />
      </div>
      <div class="campo">
        <label>Hasta</label>
        <input type="date" v-model="periodo.hasta" />
      </div>
    </div>

    <!-- GRILLA -->
    <table class="data-table">
      <thead>
        <tr>
          <th>Ítem</th>
          <th>Descripción</th>
          <th>Unidad</th>
          <th>Cantidad</th>
          <th>% Disponible</th>
          <th>% Planificado</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.pliego_item_id">
          <td>{{ item.numeroItem }}</td>
          <td>{{ item.descripcion }}</td>
          <td>{{ item.unidad }}</td>
          <td>{{ mostrar(item.cantidad) }}</td>
          <td>{{ item.porcentaje_disponible }}%</td>
          <td>
            <input
              type="number"
              min="0"
              :max="item.porcentaje_disponible"
              step="0.01"
              v-model.number="item.porcentaje_planificado"
              class="input-porcentaje"
            />
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="6" class="sin-items">No hay ítems disponibles para planificar</td>
        </tr>
      </tbody>
    </table>

    <button class="btn-guardar" @click="guardar" :disabled="guardando">
      {{ guardando ? "Guardando..." : (editMode ? "Actualizar Planificación" : "Guardar Planificación") }}
    </button>

    <!-- HISTORIAL DE PLANIFICACIONES -->
    <div class="historial-panel">
      <h3 class="historial-titulo">Historial de Planificaciones</h3>

      <div v-if="cargandoHistorial" class="historial-skeleton">
        <div class="skel-row" v-for="n in 3" :key="n"></div>
      </div>

      <div v-else-if="historial.length === 0" class="historial-empty">
        <span>📅</span>
        <p>No hay planificaciones registradas aún</p>
      </div>

      <div v-else class="historial-table-wrap">
        <table class="historial-table">
          <thead>
            <tr>
              <th>Período Desde</th>
              <th>Período Hasta</th>
              <th>% Pond. Período</th>
              <th>% Pond. Acum.</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="planif in historial" :key="planif.id"
              :class="{ 'fila-activa': planifId && planif.id == planifId }">
              <td>{{ formatDate(planif.fecha_desde) }}</td>
              <td>{{ formatDate(planif.fecha_hasta) }}</td>
              <td>{{ formatPercent(planif.total_porcentaje) }}</td>
              <td :class="planif.total_porcentaje_acum >= 99.9 ? 'td-completo' : ''">
                {{ formatPercent(planif.total_porcentaje_acum) }}
              </td>
              <td>
                <button
                  class="btn-hist-editar"
                  @click="editarPlanificacion(planif.id)"
                  :disabled="planifId && planif.id == planifId"
                  :title="planifId && planif.id == planifId ? 'Estás editando esta planificación' : ''"
                >
                  {{ planifId && planif.id == planifId ? "✏️ Editando" : "Editar" }}
                </button>
                <button class="btn-hist-pdf" @click="exportarPlanificacionPDF(planif)">PDF</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default {
  props: ["obraId", "planifId"],

  data() {
    return {
      editMode: false,
      periodo: { desde: "", hasta: "" },
      items: [],
      mensaje: "",
      error: "",
      guardando: false,
      historial: [],
      cargandoHistorial: false,
    };
  },

  watch: {
    planifId(newId) {
      if (newId) {
        this.editMode = true;
        this.cargarPlanificacionExistente();
      } else {
        this.editMode = false;
        this.cargarPliego();
      }
    },
  },

  methods: {
    mostrar(n) {
      return Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2 });
    },

    formatDate(dateStr) {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return isNaN(d) ? dateStr : d.toLocaleDateString("es-AR");
    },

    formatPercent(value) {
      return `${Number(value || 0).toFixed(2)}%`;
    },

    async cargarHistorial() {
      this.cargandoHistorial = true;
      try {
        const res = await api.get(`/obras/${this.obraId}/planificaciones`);
        this.historial = res.data || [];
      } catch (e) {
        console.error("Error cargando historial de planificaciones:", e);
        this.historial = [];
      } finally {
        this.cargandoHistorial = false;
      }
    },

    async cargarPliego() {
      try {
        const res = await api.get(`/obras/${this.obraId}/items-disponible-planificacion`);
        this.items = res.data.map(it => ({
          pliego_item_id: it.id,
          numeroItem: it.numeroItem,
          descripcion: it.descripcionItem,
          unidad: it.unidadMedida,
          cantidad: it.cantidad,
          porcentaje_planificado: 0,
          porcentaje_disponible: it.porcentajeDisponible,
        }));
      } catch (err) {
        console.error(err);
        this.error = "Error al cargar ítems disponibles para planificar";
      }
    },

    async cargarPlanificacionExistente() {
      try {
        const [disponiblesRes, planifRes] = await Promise.all([
          api.get(`/obras/${this.obraId}/items-disponible-planificacion`),
          api.get(`/obras/${this.obraId}/planificaciones/${this.planifId}`),
        ]);

        const planifData = planifRes.data;
        this.periodo.desde = planifData.fecha_desde ? planifData.fecha_desde.split("T")[0] : "";
        this.periodo.hasta = planifData.fecha_hasta ? planifData.fecha_hasta.split("T")[0] : "";

        const disponiblesMap = {};
        (disponiblesRes.data || []).forEach((it) => {
          disponiblesMap[it.id] = {
            pliego_item_id: it.id,
            numeroItem: it.numeroItem,
            descripcion: it.descripcionItem,
            unidad: it.unidadMedida,
            cantidad: it.cantidad,
            porcentaje_disponible: Number(it.porcentajeDisponible || 0),
            porcentaje_planificado: 0,
          };
        });

        (planifData.items || []).forEach((ei) => {
          const pid = ei.pliego_item_id;
          const porcentaje = Number(ei.porcentaje_planificado || 0);
          const pi = ei.pliegoItem || {};

          if (disponiblesMap[pid]) {
            disponiblesMap[pid].porcentaje_disponible = Math.min(
              100,
              disponiblesMap[pid].porcentaje_disponible + porcentaje
            );
            disponiblesMap[pid].porcentaje_planificado = porcentaje;
          } else {
            disponiblesMap[pid] = {
              pliego_item_id: pid,
              numeroItem: pi.numeroItem || "",
              descripcion: pi.descripcionItem || "",
              unidad: pi.unidadMedida || "",
              cantidad: pi.cantidad || 0,
              porcentaje_disponible: porcentaje,
              porcentaje_planificado: porcentaje,
            };
          }
        });

        this.items = Object.values(disponiblesMap);
      } catch (err) {
        console.error(err);
        this.error = "Error al cargar la planificación";
      }
    },

    validarPeriodo() {
      if (!this.periodo.desde || !this.periodo.hasta) {
        this.error = "Debe indicar fecha desde y hasta";
        return false;
      }
      if (this.periodo.desde > this.periodo.hasta) {
        this.error = "La fecha desde no puede ser mayor que la fecha hasta";
        return false;
      }
      return true;
    },

    async guardar() {
      this.mensaje = "";
      this.error = "";
      if (!this.validarPeriodo()) return;

      this.guardando = true;
      const payload = {
        fecha_desde: this.periodo.desde,
        fecha_hasta: this.periodo.hasta,
        items: this.items
          .filter(i => i.porcentaje_planificado > 0)
          .map(i => ({
            pliego_item_id: i.pliego_item_id,
            porcentaje_planificado: Number(i.porcentaje_planificado),
          })),
      };

      try {
        if (this.editMode) {
          await api.put(`/obras/${this.obraId}/planificacion/${this.planifId}`, payload);
          this.mensaje = "Planificación actualizada correctamente";
        } else {
          await api.post(`/obras/${this.obraId}/planificacion`, payload);
          this.mensaje = "Planificación guardada correctamente";
        }

        await this.cargarHistorial();

        setTimeout(() => {
          this.$router.back();
        }, 1500);
      } catch (err) {
        const msg = err.response?.data?.message || "Error al guardar la planificación";
        this.error = msg;
      } finally {
        this.guardando = false;
      }
    },

    editarPlanificacion(planifId) {
      this.$router.push({
        name: "EditarPlanificacion",
        params: { obraId: this.obraId, planifId },
      });
    },

    async exportarPlanificacionPDF(planif) {
      try {
        const res = await api.get(`/obras/${this.obraId}/planificaciones/${planif.id}`);
        const data = res.data;

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        // Header
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Planificación de Obra", 14, 18);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Período: ${this.formatDate(planif.fecha_desde)} → ${this.formatDate(planif.fecha_hasta)}`, 14, 26);
        doc.text(`% Ponderado Período: ${this.formatPercent(planif.total_porcentaje)}`, 14, 32);
        doc.text(`% Ponderado Acumulado: ${this.formatPercent(planif.total_porcentaje_acum)}`, 14, 38);

        const rows = (data.items || []).map((it) => {
          const pi = it.pliegoItem || {};
          return [
            pi.numeroItem || "",
            pi.descripcionItem || "",
            pi.unidadMedida || "",
            this.mostrar(pi.cantidad || 0),
            `${Number(it.porcentaje_planificado || 0).toFixed(2)}%`,
          ];
        });

        autoTable(doc, {
          startY: 44,
          head: [["Ítem", "Descripción", "Unidad", "Cantidad", "% Planificado"]],
          body: rows,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [240, 245, 255] },
          columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: 90 },
            2: { cellWidth: 20 },
            3: { cellWidth: 25, halign: "right" },
            4: { cellWidth: 30, halign: "right" },
          },
        });

        const desde = (planif.fecha_desde || "").slice(0, 10);
        const hasta = (planif.fecha_hasta || "").slice(0, 10);
        doc.save(`planificacion_${desde}_${hasta}.pdf`);
      } catch (e) {
        console.error("Error generando PDF:", e);
        this.error = "Error al generar el PDF";
      }
    },
  },

  mounted() {
    if (this.planifId) {
      this.editMode = true;
      this.cargarPlanificacionExistente();
    } else {
      this.cargarPliego();
    }
    this.cargarHistorial();
  },
};
</script>

<style scoped>
.cabecera-cert {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
}

.campo { display: flex; flex-direction: column; }

.mensaje-exito {
  background: #e6f4ea;
  color: #1e7e34;
  padding: 10px;
  margin-bottom: 12px;
  border-radius: 4px;
  font-weight: 600;
}

.mensaje-error {
  background: #fdecea;
  color: #b02a37;
  padding: 10px;
  margin-bottom: 12px;
  border-radius: 4px;
  font-weight: 600;
}

.input-porcentaje { width: 90px; }

.sin-items {
  text-align: center;
  font-style: italic;
  color: #666;
}

.btn-guardar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ========================
   HISTORIAL PANEL
======================== */
.historial-panel {
  margin-top: 32px;
  background: #020617;
  border: 1px solid #3b82f6;
  border-radius: 10px;
  padding: 16px;
  color: #e5e7eb;
  transition: opacity 0.3s ease-out, transform 0.3s ease-out;
}

@starting-style {
  .historial-panel {
    opacity: 0;
    transform: translateY(10px);
  }
}

.historial-titulo {
  font-size: 1rem;
  font-weight: 800;
  color: #93c5fd;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 14px;
}

.historial-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.historial-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  min-width: 500px;
}

.historial-table th,
.historial-table td {
  border: 1px solid #374151;
  padding: 8px 10px;
  text-align: center;
}

.historial-table thead th {
  background: linear-gradient(90deg, #1d4ed8, #3b82f6);
  color: #f9fafb;
  font-weight: 700;
  position: sticky;
  top: 0;
  z-index: 2;
}

.historial-table tbody tr:nth-child(odd) { background: #0b1120; }
.historial-table tbody tr:nth-child(even) { background: #020617; }

.fila-activa {
  outline: 2px solid #f59e0b;
  outline-offset: -2px;
}

.btn-hist-editar {
  padding: 4px 12px;
  background: #f59e0b;
  color: #1c1917;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.8rem;
  transition: filter 0.15s ease, transform 0.1s ease;
}

.btn-hist-editar:hover:not(:disabled) { filter: brightness(1.15); }
.btn-hist-editar:active:not(:disabled) { transform: scale(0.96); }
.btn-hist-editar:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-hist-pdf {
  padding: 4px 12px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.8rem;
  margin-left: 6px;
  transition: filter 0.15s ease, transform 0.1s ease;
}
.btn-hist-pdf:hover { filter: brightness(1.15); }
.btn-hist-pdf:active { transform: scale(0.96); }

.td-completo {
  color: #4ade80;
  font-weight: 700;
}

/* SKELETON */
.historial-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skel-row {
  height: 36px;
  border-radius: 6px;
  background: linear-gradient(90deg, #1a2744 25%, #1e3060 50%, #1a2744 75%);
  background-size: 200% 100%;
  animation: shimmer-hist 1.5s infinite;
}

@keyframes shimmer-hist {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.historial-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 24px;
  color: #6b7280;
  font-size: 0.9rem;
}
.historial-empty span { font-size: 2rem; }
.historial-empty p { margin: 0; }
</style>

<template>
  <div class="add-cert-view">
    <h2 class="titulo">{{ editMode ? "Editar Avance de Obra" : "Nuevo Avance de Obra" }}</h2>

    <!-- CABECERA -->
    <div class="cabecera-cert">
      <div class="campo">
        <label>N° de Avance</label>
        <input type="number" v-model="avance.numero_avance" />
      </div>
      <div class="campo">
        <label>Fecha de Avance</label>
        <input type="date" v-model="avance.fecha_avance" />
      </div>
      <div class="campo">
        <label>Periodo Desde</label>
        <input type="date" v-model="avance.periodo_desde" />
      </div>
      <div class="campo">
        <label>Periodo Hasta</label>
        <input type="date" v-model="avance.periodo_hasta" />
      </div>
    </div>

    <!-- RESUMEN PONDERADO -->
    <div class="resumen-total" v-if="avanceItems.length">
      <div>
        <strong>Total obra:</strong> $ {{ mostrar(totalProyecto) }}
      </div>
      <div>
        <strong>Avance real del período (ponderado):</strong>
        <span :class="avanceGlobalPonderado >= 0 ? 'ok' : 'bad'">
          {{ avanceGlobalPonderado.toFixed(2) }}%
        </span>
      </div>
    </div>

    <!-- TABLA -->
    <table class="data-table">
      <thead>
        <tr>
          <th>Ítem</th>
          <th>Descripción</th>
          <th>Unidad</th>
          <th>Cantidad</th>
          <th>% Disp.</th>
          <th>Avance (%)</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in avanceItems" :key="item.pliego_item_id">
          <td>{{ item.numeroItem }}</td>
          <td>{{ item.descripcion }}</td>
          <td>{{ item.unidad }}</td>
          <td>{{ mostrar(item.cantidad) }}</td>
          <td>{{ item.porcentajeDisponible }}%</td>
          <td>
            <input
              type="number"
              min="0"
              :max="item.porcentajeDisponible"
              step="0.01"
              v-model.number="item.avance_porcentaje"
              class="input-porcentaje"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <button class="btn-guardar" @click="guardarAvance">
      {{ editMode ? "Actualizar Avance de Obra" : "Guardar Avance de Obra" }}
    </button>

    <!-- HISTORIAL DE AVANCES -->
    <div class="historial-panel">
      <h3 class="historial-titulo">Historial de Avances de Obra</h3>

      <div v-if="cargandoHistorial" class="historial-skeleton">
        <div class="skel-row" v-for="n in 3" :key="n"></div>
      </div>

      <div v-else-if="historial.length === 0" class="historial-empty">
        <span>📈</span>
        <p>No hay avances de obra registrados aún</p>
      </div>

      <div v-else class="historial-table-wrap">
        <table class="historial-table">
          <thead>
            <tr>
              <th>N° Avance</th>
              <th>Fecha</th>
              <th>Período</th>
              <th>Avance Ponderado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="av in historial" :key="av.id"
              :class="{ 'fila-activa': avanceId && av.id == avanceId }">
              <td>{{ av.numero_avance }}</td>
              <td>{{ formatDate(av.fecha_avance) }}</td>
              <td>{{ formatPeriodo(av) }}</td>
              <td>{{ formatPercent(av.avance_ponderado) }}</td>
              <td>
                <button
                  class="btn-hist-editar"
                  @click="editarAvance(av.id)"
                  :disabled="avanceId && av.id == avanceId"
                  :title="avanceId && av.id == avanceId ? 'Estás editando este avance' : ''"
                >
                  {{ avanceId && av.id == avanceId ? "✏️ Editando" : "Editar" }}
                </button>
                <button class="btn-hist-pdf" @click="exportarAvancePDF(av)">PDF</button>
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
import { useToast } from "vue-toastification";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default {
  name: "AddAvanceObraView",
  props: ["obraId", "avanceId"],

  setup() {
    const toast = useToast();
    return { toast };
  },

  data() {
    return {
      editMode: false,
      obraNombre: "",
      avance: {
        numero_avance: "",
        fecha_avance: "",
        periodo_desde: "",
        periodo_hasta: "",
      },
      avanceItems: [],
      historial: [],
      cargandoHistorial: false,
    };
  },

  computed: {
    totalProyecto() {
      return this.avanceItems.reduce((acc, i) => acc + Number(i.costoParcial || 0), 0);
    },

    avanceGlobalPonderado() {
      const total = this.totalProyecto;
      if (!total) return 0;

      const ejecutado = this.avanceItems.reduce((acc, i) => {
        const costo = Number(i.costoParcial || 0);
        const porc = Math.max(0, Math.min(100, Number(i.avance_porcentaje || 0)));
        return acc + (costo * porc) / 100;
      }, 0);

      return Number(((ejecutado / total) * 100).toFixed(2));
    },
  },

  watch: {
    avanceId(newId) {
      if (newId) {
        this.editMode = true;
        this.cargarAvanceExistente();
      } else {
        this.editMode = false;
        this.cargarPliego();
      }
    },
  },

  methods: {
    mostrar(n) {
      return Number(n || 0).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },

    formatDate(dateStr) {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      return isNaN(d) ? dateStr : d.toLocaleDateString("es-AR");
    },

    formatPeriodo(av) {
      if (!av.periodo_desde || !av.periodo_hasta) return "";
      return `${this.formatDate(av.periodo_desde)} → ${this.formatDate(av.periodo_hasta)}`;
    },

    formatPercent(value) {
      return `${Number(value || 0).toFixed(2)}%`;
    },

    async cargarHistorial() {
      this.cargandoHistorial = true;
      try {
        const res = await api.get(`/obras/${this.obraId}/avances`);
        this.historial = res.data || [];
      } catch (e) {
        console.error("Error cargando historial de avances:", e);
        this.historial = [];
      } finally {
        this.cargandoHistorial = false;
      }
    },

    async cargarPliego() {
      const res = await api.get(`/obras/${this.obraId}/items-disponibles-avance`);
      this.avanceItems = (res.data || []).map((it) => ({
        pliego_item_id: it.id,
        numeroItem: it.numeroItem,
        descripcion: it.descripcionItem,
        unidad: it.unidadMedida,
        cantidad: it.cantidad,
        costoParcial: Number(it.costoParcial || 0),
        porcentajeDisponible: Number(it.porcentajeDisponible || 100),
        avance_porcentaje: 0,
      }));
    },

    async cargarAvanceExistente() {
      const [disponiblesRes, avanceRes] = await Promise.all([
        api.get(`/obras/${this.obraId}/items-disponibles-avance`),
        api.get(`/obras/${this.obraId}/avances/${this.avanceId}`),
      ]);

      const avanceData = avanceRes.data;

      this.avance.numero_avance = avanceData.numero_avance;
      this.avance.fecha_avance = avanceData.fecha_avance ? avanceData.fecha_avance.split("T")[0] : "";
      this.avance.periodo_desde = avanceData.periodo_desde ? avanceData.periodo_desde.split("T")[0] : "";
      this.avance.periodo_hasta = avanceData.periodo_hasta ? avanceData.periodo_hasta.split("T")[0] : "";

      const disponiblesMap = {};
      (disponiblesRes.data || []).forEach((it) => {
        disponiblesMap[it.id] = {
          pliego_item_id: it.id,
          numeroItem: it.numeroItem,
          descripcion: it.descripcionItem,
          unidad: it.unidadMedida,
          cantidad: it.cantidad,
          costoParcial: Number(it.costoParcial || 0),
          porcentajeDisponible: Number(it.porcentajeDisponible || 0),
          avance_porcentaje: 0,
        };
      });

      (avanceData.items || []).forEach((ei) => {
        const pid = ei.pliego_item_id;
        const porcentaje = Number(ei.avance_porcentaje || 0);
        const pi = ei.pliegoItem || {};

        if (disponiblesMap[pid]) {
          disponiblesMap[pid].porcentajeDisponible = Math.min(
            100,
            disponiblesMap[pid].porcentajeDisponible + porcentaje
          );
          disponiblesMap[pid].avance_porcentaje = porcentaje;
        } else {
          disponiblesMap[pid] = {
            pliego_item_id: pid,
            numeroItem: pi.numeroItem || "",
            descripcion: pi.descripcionItem || "",
            unidad: pi.unidadMedida || "",
            cantidad: pi.cantidad || 0,
            costoParcial: Number(pi.costoParcial || 0),
            porcentajeDisponible: porcentaje,
            avance_porcentaje: porcentaje,
          };
        }
      });

      this.avanceItems = Object.values(disponiblesMap);
    },

    async guardarAvance() {
      if (!this.avance.numero_avance || !this.avance.fecha_avance) {
        this.toast.warning("Completá N° de avance y Fecha.");
        return;
      }

      const payload = {
        ...this.avance,
        items: this.avanceItems.map((i) => ({
          pliego_item_id: i.pliego_item_id,
          avance_porcentaje: Math.max(0, Math.min(100, Number(i.avance_porcentaje || 0))),
        })),
      };

      try {
        if (this.editMode) {
          await api.put(`/obras/${this.obraId}/avances/${this.avanceId}`, payload);
          this.toast.success("Avance actualizado correctamente.");
        } else {
          const res = await api.post(`/obras/${this.obraId}/avances`, payload);
          const msgExtra =
            res?.data?.avance_periodo_ponderado != null
              ? `\nAvance ponderado período: ${Number(res.data.avance_periodo_ponderado).toFixed(2)}%`
              : "";
          this.toast.success("Avance de obra guardado correctamente" + msgExtra);
        }

        await this.cargarHistorial();
        this.$router.back();
      } catch (err) {
        const msg = err.response?.data?.message || "Error al guardar el avance.";
        this.toast.error(msg);
      }
    },

    editarAvance(avanceId) {
      this.$router.push({
        name: "EditarAvance",
        params: { obraId: this.obraId, avanceId },
      });
    },

    async exportarAvancePDF(av) {
      try {
        const res = await api.get(`/obras/${this.obraId}/avances/${av.id}`);
        const data = res.data;
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        // Encabezado
        doc.setFontSize(16); doc.setTextColor(185, 28, 28);
        doc.text("AVANCE DE OBRA", 14, 18);
        doc.setFontSize(13); doc.setTextColor(30, 30, 30);
        doc.text(this.obraNombre || "Obra", 14, 27);
        doc.setFontSize(9); doc.setTextColor(80, 80, 80);
        doc.text("N° Avance: " + (data.numero_avance || "-"), 14, 34);
        doc.text("Fecha: " + this.formatDate(data.fecha_avance), 14, 39);
        if (data.periodo_desde && data.periodo_hasta) {
          doc.text("Periodo: " + this.formatDate(data.periodo_desde) + " al " + this.formatDate(data.periodo_hasta), 14, 44);
        }
        doc.text("Avance ponderado: " + Number(av.avance_ponderado || 0).toFixed(2) + "%", 14, 49);

        // Tabla de items
        const items = data.items || [];
        autoTable(doc, {
          startY: 56,
          head: [["Item", "Descripcion", "Unidad", "Avance %"]],
          body: items.map(it => {
            const pi = it.pliegoItem || {};
            return [
              pi.numeroItem || "-",
              pi.descripcionItem || "-",
              pi.unidadMedida || "-",
              Number(it.avance_porcentaje || 0).toFixed(2) + "%",
            ];
          }),
          headStyles: { fillColor: [185, 28, 28], textColor: [249, 250, 251], fontStyle: "bold", fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 18, halign: "center" },
            1: { cellWidth: 120 },
            2: { cellWidth: 22, halign: "center" },
            3: { cellWidth: 20, halign: "center" },
          },
          styles: { fontSize: 8, cellPadding: 3 },
          alternateRowStyles: { fillColor: [254, 242, 242] },
          margin: { left: 14, right: 14 },
        });

        // Pie de pagina
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
          doc.text("Generado el " + new Date().toLocaleDateString("es-AR") + " - Pag. " + i + " de " + pageCount, 14, doc.internal.pageSize.height - 8);
        }

        const nombre = (this.obraNombre || "obra").replace(/ /g, "-");
        doc.save("avance_" + nombre + "_N" + (data.numero_avance || "0") + ".pdf");
      } catch (e) {
        console.error("Error generando PDF de avance:", e);
      }
    },
  },

  mounted() {
    if (this.avanceId) {
      this.editMode = true;
      this.cargarAvanceExistente();
    } else {
      this.cargarPliego();
    }
    this.cargarHistorial();
    api.get("/obras/" + this.obraId).then(r => { this.obraNombre = r.data?.nombre || ""; }).catch(() => {});
  },
};
</script>

<style scoped>
.add-cert-view { padding: 20px; }

.cabecera-cert {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  background: #16163A;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #2D2D5E;
}

.campo { display: flex; flex-direction: column; }

.campo label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #e5e7eb;
}

.campo input {
  padding: 6px 8px;
  border: 1px solid #999;
  border-radius: 4px;
  font-size: 14px;
}

.resumen-total {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin: 10px 0 18px;
  padding: 12px 14px;
  background: #0b1120;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #e5e7eb;
  font-weight: 600;
}

.ok { color: #bef264; }
.bad { color: #fb7185; }

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  border: 1px solid #666;
  padding: 6px;
  text-align: center;
}

.data-table th {
  background: #222;
  color: white;
  font-size: 0.9rem;
  position: sticky;
  top: 0;
  z-index: 2;
}

.input-porcentaje {
  width: 80px;
  padding: 4px;
  text-align: center;
}

.btn-guardar {
  margin-top: 20px;
  background: #166534;
  color: white;
  padding: 10px 18px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: filter 0.15s ease, transform 0.1s ease;
}

.btn-guardar:hover { filter: brightness(1.12); }
.btn-guardar:active { transform: scale(0.97); }

/* ========================
   HISTORIAL PANEL
======================== */
.historial-panel {
  margin-top: 32px;
  background: #020617;
  border: 1px solid #ef4444;
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
  color: #fca5a5;
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
  min-width: 560px;
}

.historial-table th,
.historial-table td {
  border: 1px solid #374151;
  padding: 8px 10px;
  text-align: center;
}

.historial-table thead th {
  background: linear-gradient(90deg, #b91c1c, #ef4444);
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
  margin-left: 6px;
  padding: 4px 10px;
  background: #7f1d1d;
  color: #fecaca;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.75rem;
  transition: filter 0.15s ease;
}
.btn-hist-pdf:hover { filter: brightness(1.2); }

/* SKELETON */
.historial-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skel-row {
  height: 36px;
  border-radius: 6px;
  background: linear-gradient(90deg, #3a0a0a 25%, #5a1010 50%, #3a0a0a 75%);
  background-size: 200% 100%;
  animation: shimmer-avance 1.5s infinite;
}

@keyframes shimmer-avance {
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

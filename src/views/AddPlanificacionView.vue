<template>
  <div class="add-cert-view">
    <h2 class="titulo">{{ editMode ? "Editar mes del plan original" : "Planificación de Obra" }}</h2>

    <div v-if="mensaje" class="mensaje-exito">{{ mensaje }}</div>
    <div v-if="error" class="mensaje-error">{{ error }}</div>

    <!-- QUÉ SE CARGA ACÁ Y QUÉ NO -->
    <div class="tipo-banner banner-original">
      <span class="tipo-icon">📋</span>
      <div class="tipo-cuerpo">
        <div class="tipo-label">Plan original · un mes</div>
        <div class="tipo-desc">
          Acá se carga el plan de trabajos original, de a un mes. Si la obra se atrasó o entran
          ítems adicionales, eso es un <strong>replanteo</strong>: un plan nuevo desde el último
          avance, con todos sus meses juntos.
        </div>
      </div>
      <button v-if="!editMode && hayOriginal" class="btn-replanteo" @click="irAReplanteo()">
        🔄 Hacer un replanteo
      </button>
    </div>

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

    <!-- GRILLA DE DISTRIBUCIÓN -->
    <div class="grilla-titulo">Distribución del porcentaje planificado</div>
    <div class="tabla-wrap">
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
          <tr v-for="item in items" :key="item.pliego_item_id" :class="{ 'fila-excedida': Number(item.porcentaje_planificado) > item.porcentaje_disponible + 0.009 }">
            <td>{{ item.numeroItem }}</td>
            <td class="td-desc">{{ item.descripcion }}</td>
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
        <tfoot v-if="items.length > 0">
          <tr>
            <!--
              Antes esta fila sumaba los porcentajes de ítems distintos sin
              ponderar: cinco ítems al 50% mostraban "250%" en rojo. Lo que sirve
              saber es cuánto de la OBRA representa el mes.
            -->
            <td colspan="5" class="tf-label">Este mes representa de la obra</td>
            <td class="tf-total">{{ incidenciaMes.toFixed(2) }}%</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <button class="btn-guardar" @click="guardar" :disabled="guardando">
      {{ guardando ? "Guardando..." : (editMode ? "Actualizar mes" : "Guardar mes") }}
    </button>

    <!-- HISTORIAL -->
    <div class="historial-panel">
      <div class="historial-cabeza">
        <h3 class="historial-titulo">Historial de planificaciones</h3>
        <button v-if="hayOriginal" class="btn-replanteo btn-replanteo-chico" @click="irAReplanteo()">🔄 Nuevo replanteo</button>
      </div>

      <div v-if="cargandoHistorial" class="historial-skeleton">
        <div class="skel-row" v-for="n in 3" :key="n"></div>
      </div>

      <div v-else-if="historial.length === 0" class="historial-empty">
        <span>📅</span>
        <p>No hay planificaciones registradas aún</p>
      </div>

      <template v-else>
        <div v-for="grupo in grupos" :key="grupo.version" class="grupo">
          <div class="grupo-cabeza" :class="grupo.version === 0 ? 'cabeza-original' : 'cabeza-replanteo'">
            <span class="grupo-nombre">
              {{ grupo.version === 0 ? "Plan original" : `Replanteo ${grupo.version}` }}
            </span>
            <span v-if="grupo.version > 0" class="grupo-dato">
              desde el avance del {{ formatDate(grupo.fecha_corte) }} · {{ motivoLabel(grupo.motivo) }}
            </span>
            <span v-if="grupo.vigente" class="badge-vigente">vigente</span>
            <button v-if="grupo.version > 0" class="btn-hist-editar grupo-accion" @click="irAReplanteo(grupo.version)">
              {{ grupo.vigente ? "Abrir / editar" : "Ver" }}
            </button>
          </div>
          <div class="historial-table-wrap">
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
                <tr v-for="planif in grupo.filas" :key="planif.id" :class="{ 'fila-activa': planifId && planif.id == planifId }">
                  <td>{{ formatDate(planif.fecha_desde) }}</td>
                  <td>{{ formatDate(planif.fecha_hasta) }}</td>
                  <td>{{ formatPercent(planif.total_porcentaje) }}</td>
                  <td :class="planif.total_porcentaje_acum >= 99.9 ? 'td-completo' : ''">
                    {{ formatPercent(planif.total_porcentaje_acum) }}
                  </td>
                  <td class="td-acciones">
                    <template v-if="grupo.version === 0">
                      <button class="btn-hist-editar" @click="editarPlanificacion(planif.id)"
                        :disabled="planifId && planif.id == planifId">
                        {{ planifId && planif.id == planifId ? "✏️ Editando" : "Editar" }}
                      </button>
                      <button class="btn-hist-borrar" @click="borrarMes(planif)">Borrar</button>
                    </template>
                    <button class="btn-hist-pdf" @click="exportarPlanificacionPDF(planif)">PDF</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
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
      costoPorItem: {},
      presupuestoTotal: 0,
      mensaje: "",
      error: "",
      guardando: false,
      historial: [],
      cargandoHistorial: false,
    };
  },

  computed: {
    hayOriginal() {
      return this.historial.some((p) => Number(p.version || 0) === 0);
    },

    incidenciaMes() {
      if (!this.presupuestoTotal) return 0;
      return this.items.reduce(
        (s, i) => s + (Number(i.porcentaje_planificado) || 0) / 100 * (this.costoPorItem[i.pliego_item_id] || 0), 0
      ) / this.presupuestoTotal * 100;
    },

    grupos() {
      const mapa = new Map();
      for (const p of this.historial) {
        const v = Number(p.version || 0);
        if (!mapa.has(v)) mapa.set(v, { version: v, motivo: p.motivo, fecha_corte: p.fecha_corte, vigente: !!p.es_vigente, filas: [] });
        mapa.get(v).filas.push(p);
      }
      // El vigente arriba: es lo que rige hoy.
      return [...mapa.values()].sort((a, b) => b.version - a.version);
    },
  },

  watch: {
    planifId(newId) {
      if (newId) {
        this.editMode = true;
        this.cargarPlanificacionExistente();
      } else {
        this.editMode = false;
        this.periodo = { desde: "", hasta: "" };
        this.cargarPliego();
      }
    },
  },

  methods: {
    mostrar(n) {
      return Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2 });
    },

    // Las fechas llegan como AAAA-MM-DD. Con new Date() se interpretan en UTC y
    // en Argentina mostraban el día anterior.
    formatDate(dateStr) {
      if (!dateStr) return "";
      const [a, m, d] = String(dateStr).slice(0, 10).split("-");
      return a && m && d ? `${d}/${m}/${a}` : dateStr;
    },

    formatPercent(value) {
      return `${Number(value || 0).toFixed(2)}%`;
    },

    motivoLabel(m) {
      return { tiempo: "Extensión de plazo", adicional_item: "Adicional de ítem", ambos: "Extensión + Adicional" }[m] || (m || "—");
    },

    irAReplanteo(version) {
      if (version) {
        this.$router.push({ name: "EditarReplanteo", params: { obraId: this.obraId, version } });
      } else {
        this.$router.push({ name: "NuevoReplanteo", params: { obraId: this.obraId } });
      }
    },

    async cargarHistorial() {
      this.cargandoHistorial = true;
      try {
        const res = await api.get(`/obras/${this.obraId}/planificaciones`);
        this.historial = res.data || [];
      } catch (e) {
        console.error("Error cargando historial:", e);
        this.historial = [];
      } finally {
        this.cargandoHistorial = false;
      }
    },

    async cargarPresupuesto() {
      const res = await api.get(`/obras/${this.obraId}/pliego`);
      const costos = {};
      let total = 0;
      for (const it of res.data || []) {
        costos[it.id] = Number(it.costoParcial || 0);
        total += costos[it.id];
      }
      this.costoPorItem = costos;
      this.presupuestoTotal = total;
    },

    async cargarPliego() {
      try {
        const res = await api.get(`/obras/${this.obraId}/items-disponible-planificacion`);
        this.items = res.data.map((it) => ({
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

        // Un mes de un replanteo no se edita suelto: se abre el replanteo entero.
        if (Number(planifData.version || 0) > 0) {
          this.irAReplanteo(planifData.version);
          return;
        }

        this.periodo.desde = planifData.fecha_desde ? String(planifData.fecha_desde).slice(0, 10) : "";
        this.periodo.hasta = planifData.fecha_hasta ? String(planifData.fecha_hasta).slice(0, 10) : "";

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
            disponiblesMap[pid].porcentaje_disponible = Math.min(100, disponiblesMap[pid].porcentaje_disponible + porcentaje);
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
      const excedido = this.items.find((i) => Number(i.porcentaje_planificado) > i.porcentaje_disponible + 0.009);
      if (excedido) {
        this.error = `El ítem ${excedido.numeroItem} tiene más planificado (${excedido.porcentaje_planificado}%) que lo disponible (${excedido.porcentaje_disponible}%).`;
        return false;
      }
      return true;
    },

    async guardar() {
      this.mensaje = "";
      this.error = "";
      if (!this.validarPeriodo()) return;

      this.guardando = true;
      try {
        const payload = {
          fecha_desde: this.periodo.desde,
          fecha_hasta: this.periodo.hasta,
          items: this.items
            .filter((i) => Number(i.porcentaje_planificado) > 0)
            .map((i) => ({ pliego_item_id: i.pliego_item_id, porcentaje_planificado: Number(i.porcentaje_planificado) })),
        };

        if (this.editMode) {
          await api.put(`/obras/${this.obraId}/planificacion/${this.planifId}`, payload);
          this.mensaje = "Mes actualizado correctamente";
        } else {
          await api.post(`/obras/${this.obraId}/planificacion`, payload);
          this.mensaje = "Mes guardado correctamente";
        }

        await this.cargarHistorial();
        setTimeout(() => { this.$router.back(); }, 1500);
      } catch (err) {
        this.error = err.response?.data?.message || "Error al guardar la planificación";
      } finally {
        this.guardando = false;
      }
    },

    async borrarMes(planif) {
      const ok = window.confirm(
        `¿Borrar el mes ${this.formatDate(planif.fecha_desde)} → ${this.formatDate(planif.fecha_hasta)} del plan original?\n\nEsto no se puede deshacer.`
      );
      if (!ok) return;
      this.mensaje = "";
      this.error = "";
      try {
        await api.delete(`/obras/${this.obraId}/planificacion/${planif.id}`);
        this.mensaje = "Mes borrado";
        await this.cargarHistorial();
        if (!this.editMode) await this.cargarPliego();
      } catch (err) {
        this.error = err.response?.data?.message || "No se pudo borrar el mes";
      }
    },

    editarPlanificacion(planifId) {
      this.$router.push({ name: "EditarPlanificacion", params: { obraId: this.obraId, planifId } });
    },

    async exportarPlanificacionPDF(planif) {
      try {
        const res = await api.get(`/obras/${this.obraId}/planificaciones/${planif.id}`);
        const data = res.data;
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Planificación de Obra", 14, 18);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Período: ${this.formatDate(planif.fecha_desde)} → ${this.formatDate(planif.fecha_hasta)}`, 14, 26);
        doc.text(`Versión: ${Number(planif.version || 0) === 0 ? "Plan original" : `Replanteo ${planif.version}`}`, 14, 32);
        doc.text(`% Ponderado Período: ${this.formatPercent(planif.total_porcentaje)}`, 14, 38);
        doc.text(`% Ponderado Acumulado: ${this.formatPercent(planif.total_porcentaje_acum)}`, 14, 44);
        const rows = (data.items || []).map((it) => {
          const pi = it.pliegoItem || {};
          return [pi.numeroItem || "", pi.descripcionItem || "", pi.unidadMedida || "", this.mostrar(pi.cantidad || 0), `${Number(it.porcentaje_planificado || 0).toFixed(2)}%`];
        });
        autoTable(doc, {
          startY: 50,
          head: [["Ítem", "Descripción", "Unidad", "Cantidad", "% Planificado"]],
          body: rows,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [240, 245, 255] },
          columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 90 }, 2: { cellWidth: 20 }, 3: { cellWidth: 25, halign: "right" }, 4: { cellWidth: 30, halign: "right" } },
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

  async mounted() {
    await this.cargarPresupuesto().catch(() => {});
    if (this.planifId) {
      this.editMode = true;
      this.cargarPlanificacionExistente();
      this.cargarHistorial();
    } else {
      await this.cargarHistorial();
      await this.cargarPliego();
    }
  },
};
</script>

<style scoped>
.add-cert-view { padding: 20px; color: #e5e7eb; }
.titulo { margin: 0 0 16px; color: #f1f5f9; }

/* Banner */
.tipo-banner { display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border-radius: 10px; margin-bottom: 20px; border: 1px solid; flex-wrap: wrap; }
.banner-original { background: rgba(56,189,248,0.08); border-color: rgba(56,189,248,0.3); }
.tipo-icon { font-size: 1.5rem; line-height: 1; }
.tipo-cuerpo { flex: 1; min-width: 240px; }
.tipo-label { font-weight: 700; font-size: 1rem; color: #f1f5f9; }
.tipo-desc { font-size: 0.84rem; color: #94a3b8; margin-top: 2px; line-height: 1.5; max-width: 80ch; }
.btn-replanteo { align-self: center; padding: 8px 14px; background: #fb923c; color: #1c1917; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; white-space: nowrap; }
.btn-replanteo:hover { filter: brightness(1.08); }
.btn-replanteo-chico { padding: 5px 12px; font-size: 0.82rem; }

/* Cabecera */
.cabecera-cert { display: flex; gap: 20px; margin-bottom: 16px; flex-wrap: wrap; align-items: flex-start; background: #16163A; padding: 15px; border-radius: 8px; border: 1px solid #2D2D5E; }
.campo { display: flex; flex-direction: column; gap: 4px; }
.campo label { font-size: 0.8rem; color: #94a3b8; font-weight: 600; }
.campo input { padding: 7px 10px; border-radius: 6px; border: 1px solid #374151; background: #0b1120; color: #e5e7eb; font-size: 0.9rem; }

/* Grilla (estos estilos existían solo con scoped en otras pantallas y acá no aplicaban) */
.grilla-titulo { font-size: 0.85rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
.tabla-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { border: 1px solid #374151; padding: 6px 8px; text-align: center; }
.data-table th { background: #1f2937; color: #f9fafb; font-size: 0.85rem; position: sticky; top: 0; z-index: 2; }
.td-desc { text-align: left !important; }
.fila-excedida td { background: rgba(248, 113, 113, 0.08); }
.input-porcentaje { width: 90px; padding: 4px 6px; border-radius: 5px; border: 1px solid #374151; background: #020617; color: #e5e7eb; text-align: right; }
.sin-items { text-align: center; font-style: italic; color: #666; }
.tf-label { text-align: right !important; color: #94a3b8; font-size: 0.85rem; font-weight: 600; padding: 8px 12px; }
.tf-total { text-align: center; font-weight: 700; color: #4ade80; padding: 8px 12px; }

.btn-guardar { margin-top: 20px; background: #166534; color: white; padding: 10px 18px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
.btn-guardar:hover:not(:disabled) { filter: brightness(1.12); }
.btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }

/* Mensajes */
.mensaje-exito { background: #e6f4ea; color: #1e7e34; padding: 10px; margin-bottom: 12px; border-radius: 4px; font-weight: 600; }
.mensaje-error { background: #fdecea; color: #b02a37; padding: 10px; margin-bottom: 12px; border-radius: 4px; font-weight: 600; }

/* Historial */
.historial-panel { margin-top: 32px; background: #020617; border: 1px solid #3b82f6; border-radius: 10px; padding: 16px; color: #e5e7eb; }
.historial-cabeza { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.historial-titulo { font-size: 1rem; font-weight: 800; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }

.grupo { margin-bottom: 18px; }
.grupo-cabeza { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 12px; border-radius: 8px 8px 0 0; border: 1px solid; border-bottom: none; }
.cabeza-original { background: rgba(56,189,248,0.08); border-color: rgba(56,189,248,0.3); }
.cabeza-replanteo { background: rgba(251,146,60,0.08); border-color: rgba(251,146,60,0.35); }
.grupo-nombre { font-weight: 800; color: #f1f5f9; }
.grupo-dato { font-size: 0.82rem; color: #94a3b8; }
.grupo-accion { margin-left: auto; }
.badge-vigente { padding: 2px 8px; border-radius: 999px; background: rgba(74,222,128,0.16); color: #4ade80; font-size: 0.72rem; font-weight: 800; }

.historial-table-wrap { overflow-x: auto; }
.historial-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 600px; }
.historial-table th, .historial-table td { border: 1px solid #374151; padding: 8px 10px; text-align: center; }
.historial-table thead th { background: linear-gradient(90deg, #1d4ed8, #3b82f6); color: #f9fafb; font-weight: 700; }
.historial-table tbody tr:nth-child(odd) { background: #0b1120; }
.historial-table tbody tr:nth-child(even) { background: #020617; }
.fila-activa { outline: 2px solid #f59e0b; outline-offset: -2px; }
.td-acciones { white-space: nowrap; }
.btn-hist-editar { padding: 4px 12px; background: #f59e0b; color: #1c1917; border: none; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.8rem; }
.btn-hist-editar:hover:not(:disabled) { filter: brightness(1.15); }
.btn-hist-editar:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-hist-borrar { padding: 4px 12px; background: transparent; color: #fca5a5; border: 1px solid #7f1d1d; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.8rem; margin-left: 6px; }
.btn-hist-borrar:hover { background: #3b1219; }
.btn-hist-pdf { padding: 4px 12px; background: #3b82f6; color: #fff; border: none; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.8rem; margin-left: 6px; }
.btn-hist-pdf:hover { filter: brightness(1.15); }
.td-completo { color: #4ade80; font-weight: 700; }
.historial-skeleton { display: flex; flex-direction: column; gap: 10px; }
.skel-row { height: 36px; border-radius: 6px; background: linear-gradient(90deg, #1a2744 25%, #1e3060 50%, #1a2744 75%); background-size: 200% 100%; animation: shimmer-hist 1.5s infinite; }
@keyframes shimmer-hist { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.historial-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 24px; color: #6b7280; font-size: 0.9rem; }
.historial-empty span { font-size: 2rem; }
.historial-empty p { margin: 0; }
</style>

<template>
  <div class="add-cert-view">
    <h2 class="titulo">{{ editMode ? "Editar Planificación" : "Planificación de Obra" }}</h2>

    <div v-if="mensaje" class="mensaje-exito">{{ mensaje }}</div>
    <div v-if="error" class="mensaje-error">{{ error }}</div>

    <!-- TIPO DE PLANIFICACIÓN -->
    <div class="tipo-banner" :class="esReplanteo ? 'banner-replanteo' : 'banner-original'">
      <span class="tipo-icon">{{ esReplanteo ? '🔄' : '📋' }}</span>
      <div>
        <div class="tipo-label">{{ esReplanteo ? 'Replanteo' : 'Primera Planificación (Original)' }}</div>
        <div class="tipo-desc" v-if="esReplanteo">
          Existe una planificación previa. Esta nueva planificación se registra como replanteo.
        </div>
        <div class="tipo-desc" v-else>
          No hay planificaciones registradas. Se creará la planificación original de la obra.
        </div>
      </div>
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
      <div class="campo" v-if="esReplanteo">
        <label>Motivo del replanteo</label>
        <select v-model="motivo" class="select-motivo">
          <option value="tiempo">Solo extensión de plazo</option>
          <option value="adicional_item">Adicional de ítem</option>
          <option value="ambos">Extensión de plazo + Adicional de ítem</option>
        </select>
      </div>
    </div>

    <!-- SECCIÓN DE ÍTEMS ADICIONALES (solo cuando el motivo lo requiere) -->
    <div v-if="esReplanteo && (motivo === 'adicional_item' || motivo === 'ambos')" class="adicionales-panel">
      <h3 class="adicionales-titulo">➕ Ítems Adicionales</h3>
      <p class="adicionales-desc">Agregá los ítems nuevos que se incorporan con este replanteo. Luego asigná el porcentaje planificado en la tabla de abajo.</p>

      <!-- Formulario para agregar ítem adicional -->
      <div class="adicional-form">
        <div class="adicional-row">
          <input v-model="nuevoItem.numeroItem" type="text" placeholder="N° Ítem" class="input-adicional input-num" />
          <input v-model="nuevoItem.descripcionItem" type="text" placeholder="Descripción *" class="input-adicional input-desc" />
          <input v-model="nuevoItem.unidadMedida" type="text" placeholder="Unidad" class="input-adicional input-small" />
          <input v-model.number="nuevoItem.cantidad" type="number" min="0" step="0.01" placeholder="Cantidad" class="input-adicional input-small" />
          <input v-model.number="nuevoItem.costoUnitario" type="number" min="0" step="0.01" placeholder="Costo unit." class="input-adicional input-small" />
          <input v-model="nuevoItem.fecha_incorporacion" type="date" class="input-adicional" title="Fecha de incorporación" />
          <button class="btn-agregar-item" @click="agregarItemAdicional">+ Agregar</button>
        </div>
        <p v-if="errorItem" class="error-item">{{ errorItem }}</p>
      </div>

      <!-- Lista de ítems adicionales pendientes de guardar -->
      <div v-if="itemsAdicionales.length > 0" class="adicionales-lista">
        <div v-for="(it, idx) in itemsAdicionales" :key="idx" class="adicional-chip">
          <span class="chip-num">{{ it.numeroItem || '—' }}</span>
          <span class="chip-desc">{{ it.descripcionItem }}</span>
          <span class="chip-unit">{{ it.unidadMedida }}</span>
          <span class="chip-cant">{{ it.cantidad }}</span>
          <button class="chip-remove" @click="itemsAdicionales.splice(idx, 1)">✕</button>
        </div>
      </div>
    </div>

    <!-- PANEL IMPACTO PRESUPUESTARIO (solo adicional_item / ambos) -->
    <div v-if="mostrarPanelImpacto" class="panel-impacto">
      <div class="impacto-titulo">📊 Impacto presupuestario del replanteo</div>
      <div class="impacto-grid">
        <div class="impacto-bloque">
          <span class="impacto-label">Presupuesto actual</span>
          <span class="impacto-valor">${{ formatMonto(presupuestoActualTotal) }}</span>
        </div>
        <div class="impacto-bloque" :class="totalAdicionalPendiente > 0 ? 'bloque-plus' : 'bloque-neutro'">
          <span class="impacto-label">Ítems adicionales</span>
          <span class="impacto-valor">{{ totalAdicionalPendiente > 0 ? '+$' + formatMonto(totalAdicionalPendiente) : '—' }}</span>
        </div>
        <div class="impacto-bloque bloque-nuevo">
          <span class="impacto-label">Nuevo presupuesto</span>
          <span class="impacto-valor">${{ formatMonto(presupuestoNuevo) }}</span>
          <span v-if="totalAdicionalPendiente > 0" class="badge-incremento">+{{ porcentajeCambioPresupuesto }}%</span>
        </div>
      </div>
      <div v-if="totalAdicionalPendiente > 0" class="impacto-aviso">
        ⚠️ Al incorporar ítems adicionales, el % certificado y el % de avance acumulados hasta hoy
        disminuirán proporcionalmente al recalcularse sobre el nuevo presupuesto.
        El monto en pesos ya cobrado <strong>no cambia</strong>.
      </div>

      <!-- Tabla de incidencias por ítem -->
      <div v-if="items.length > 0" class="incidencia-tabla-wrap">
        <table class="incidencia-tabla">
          <thead>
            <tr>
              <th>Ítem</th>
              <th>Descripción</th>
              <th>Costo parcial</th>
              <th>Incidencia actual</th>
              <th>Incidencia nueva</th>
              <th>Δ Incidencia</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.pliego_item_id" :class="item.esNuevo ? 'inc-fila-nueva' : ''">
              <td>{{ item.numeroItem }}</td>
              <td>{{ item.descripcion }} <span v-if="item.esNuevo" class="badge-nuevo">nuevo</span></td>
              <td class="td-monto">${{ formatMonto(item.costoParcial || 0) }}</td>
              <td class="td-inc-actual">
                {{ item.incidenciaActual != null ? item.incidenciaActual.toFixed(2) + '%' : '—' }}
              </td>
              <td class="td-inc-nueva">
                {{ presupuestoNuevo > 0 ? (((item.costoParcial || 0) / presupuestoNuevo) * 100).toFixed(2) + '%' : '—' }}
              </td>
              <td :class="item.incidenciaActual != null && presupuestoNuevo > 0 ? 'td-delta-neg' : 'td-delta-neutro'">
                <template v-if="item.incidenciaActual != null && presupuestoNuevo > 0">
                  {{ (((item.costoParcial || 0) / presupuestoNuevo) * 100 - item.incidenciaActual).toFixed(2) }}%
                </template>
                <template v-else>—</template>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="tf-label">TOTAL</td>
              <td class="td-monto tf-label">${{ formatMonto(presupuestoNuevo) }}</td>
              <td class="td-inc-actual tf-label">100%</td>
              <td class="td-inc-nueva tf-label">100%</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- GRILLA DE DISTRIBUCIÓN -->
    <div class="grilla-titulo">Distribución del porcentaje planificado</div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Ítem</th>
          <th>Descripción</th>
          <th>Unidad</th>
          <th>Cantidad</th>
          <th v-if="esReplanteo" class="th-avance">% Avance ejecutado</th>
          <th>% Disponible</th>
          <th>% Planificado</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.pliego_item_id" :class="item.esNuevo ? 'fila-nueva' : ''">
          <td>{{ item.numeroItem }}</td>
          <td>
            {{ item.descripcion }}
            <span v-if="item.esNuevo" class="badge-nuevo">nuevo</span>
          </td>
          <td>{{ item.unidad }}</td>
          <td>{{ mostrar(item.cantidad) }}</td>
          <td v-if="esReplanteo" class="td-avance">{{ item.avanceAcumulado != null ? item.avanceAcumulado + '%' : '—' }}</td>
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
          <td colspan="5" class="tf-label">Total planificado este período</td>
          <td class="tf-total" :class="totalPlanificado > 100 ? 'tf-exceso' : ''">{{ totalPlanificado.toFixed(2) }}%</td>
        </tr>
      </tfoot>
    </table>

    <button class="btn-guardar" @click="guardar" :disabled="guardando">
      {{ guardando ? "Guardando..." : (editMode ? "Actualizar Planificación" : "Guardar Planificación") }}
    </button>

    <!-- HISTORIAL -->
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
              <th>Tipo</th>
              <th>Motivo</th>
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
              <td>
                <span :class="planif.tipo === 'replanteo' ? 'badge-replanteo' : 'badge-original'">
                  {{ planif.tipo === 'replanteo' ? 'Replanteo' : 'Original' }}
                </span>
              </td>
              <td>{{ motivoLabel(planif.motivo) }}</td>
              <td>{{ formatPercent(planif.total_porcentaje) }}</td>
              <td :class="planif.total_porcentaje_acum >= 99.9 ? 'td-completo' : ''">
                {{ formatPercent(planif.total_porcentaje_acum) }}
              </td>
              <td>
                <button class="btn-hist-editar" @click="editarPlanificacion(planif.id)"
                  :disabled="planifId && planif.id == planifId">
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
      esReplanteo: false,
      motivo: "tiempo",
      periodo: { desde: "", hasta: "" },
      items: [],
      itemsAdicionales: [],
      nuevoItem: this.emptyNuevoItem(),
      errorItem: "",
      mensaje: "",
      error: "",
      guardando: false,
      historial: [],
      cargandoHistorial: false,
      presupuestoActualTotal: 0,   // total del pliego antes del replanteo
    };
  },

  computed: {
    totalPlanificado() {
      return this.items.reduce((sum, i) => sum + (Number(i.porcentaje_planificado) || 0), 0);
    },

    // ── Computed de impacto presupuestario (solo adicional_item) ──────────────
    totalAdicionalPendiente() {
      return this.itemsAdicionales.reduce(
        (sum, it) => sum + Number(it.cantidad || 0) * Number(it.costoUnitario || 0), 0
      );
    },
    presupuestoNuevo() {
      return this.presupuestoActualTotal + this.totalAdicionalPendiente;
    },
    porcentajeCambioPresupuesto() {
      if (!this.presupuestoActualTotal) return 0;
      return ((this.presupuestoNuevo / this.presupuestoActualTotal - 1) * 100).toFixed(1);
    },
    mostrarPanelImpacto() {
      return this.esReplanteo && (this.motivo === 'adicional_item' || this.motivo === 'ambos');
    },
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
    // Cuando cambia el motivo y ya no incluye adicional, limpia la lista
    motivo(val) {
      if (val === 'tiempo') {
        this.itemsAdicionales = [];
        this.items = this.items.filter(i => !i.esNuevo);
      }
    },
  },

  methods: {
    emptyNuevoItem() {
      return { numeroItem: '', descripcionItem: '', unidadMedida: '', cantidad: 0, costoUnitario: 0, fecha_incorporacion: new Date().toISOString().split('T')[0] };
    },

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

    formatMonto(value) {
      return Number(value || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    motivoLabel(m) {
      return { tiempo: 'Extensión de plazo', adicional_item: 'Adicional de ítem', ambos: 'Extensión + Adicional' }[m] || (m || '—');
    },

    agregarItemAdicional() {
      this.errorItem = "";
      if (!this.nuevoItem.descripcionItem.trim()) {
        this.errorItem = "La descripción es obligatoria";
        return;
      }
      if (!this.nuevoItem.cantidad || this.nuevoItem.cantidad <= 0) {
        this.errorItem = "La cantidad debe ser mayor a 0";
        return;
      }
      if (!this.nuevoItem.costoUnitario || this.nuevoItem.costoUnitario <= 0) {
        this.errorItem = "El costo unitario debe ser mayor a 0";
        return;
      }
      // Agregar a la lista de pendientes y también a la tabla de distribución
      this.itemsAdicionales.push({ ...this.nuevoItem });
      this.items.push({
        pliego_item_id: `nuevo_${Date.now()}`,
        numeroItem: this.nuevoItem.numeroItem || '—',
        descripcion: this.nuevoItem.descripcionItem,
        unidad: this.nuevoItem.unidadMedida,
        cantidad: this.nuevoItem.cantidad,
        costoParcial: this.nuevoItem.cantidad * this.nuevoItem.costoUnitario,
        avanceAcumulado: 0,
        incidenciaActual: null,   // ítem nuevo, sin incidencia en total anterior
        porcentaje_planificado: 0,
        porcentaje_disponible: 100,
        esNuevo: true,
        _datos: { ...this.nuevoItem },
      });
      this.nuevoItem = this.emptyNuevoItem();
    },

    async cargarHistorial() {
      this.cargandoHistorial = true;
      try {
        const res = await api.get(`/obras/${this.obraId}/planificaciones`);
        this.historial = res.data || [];
        if (!this.editMode) {
          this.esReplanteo = this.historial.length > 0;
        }
      } catch (e) {
        console.error("Error cargando historial:", e);
        this.historial = [];
      } finally {
        this.cargandoHistorial = false;
      }
    },

    async cargarPliego() {
      try {
        if (this.esReplanteo) {
          // Replanteo: disponible = 100% - avance de obra real acumulado
          const res = await api.get(`/obras/${this.obraId}/items-disponible-replanteo`);
          const { items, ultimoAvancePeriodoHasta } = res.data;

          this.presupuestoActualTotal = res.data.presupuestoTotal || 0;
          this.items = items.map(it => ({
            pliego_item_id:        it.id,
            numeroItem:            it.numeroItem,
            descripcion:           it.descripcionItem,
            unidad:                it.unidadMedida,
            cantidad:              it.cantidad,
            costoParcial:          it.costoParcial,
            avanceAcumulado:       it.avanceAcumulado,
            incidenciaActual:      it.incidenciaActual,
            porcentaje_disponible: it.porcentajeDisponible,
            porcentaje_planificado: 0,
            esNuevo: false,
          }));

          // Fecha desde = día siguiente al fin del último avance de obra
          if (ultimoAvancePeriodoHasta && !this.periodo.desde) {
            const d = new Date(ultimoAvancePeriodoHasta);
            d.setDate(d.getDate() + 1);
            this.periodo.desde = d.toISOString().split('T')[0];
          }
        } else {
          // Planificación original: disponible = 100% - lo ya planificado
          const res = await api.get(`/obras/${this.obraId}/items-disponible-planificacion`);
          this.items = res.data.map(it => ({
            pliego_item_id: it.id,
            numeroItem:     it.numeroItem,
            descripcion:    it.descripcionItem,
            unidad:         it.unidadMedida,
            cantidad:       it.cantidad,
            porcentaje_planificado: 0,
            porcentaje_disponible:  it.porcentajeDisponible,
            esNuevo: false,
          }));
        }
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
        this.esReplanteo = planifData.tipo === 'replanteo';
        this.motivo = planifData.motivo || 'tiempo';

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
            esNuevo: false,
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
              esNuevo: false,
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
      try {
        // 1. Si hay ítems adicionales nuevos, crearlos primero en el pliego
        const itemsNuevosCreados = [];
        if (this.itemsAdicionales.length > 0) {
          for (const it of this.itemsAdicionales) {
            const res = await api.post(`/obras/${this.obraId}/pliego-item`, {
              ItemGeneralId: null,
              numeroItem: it.numeroItem,
              descripcionItem: it.descripcionItem,
              unidadMedida: it.unidadMedida,
              cantidad: it.cantidad,
              costoUnitario: it.costoUnitario,
              costoParcial: it.cantidad * it.costoUnitario,
              origen: 'adicional',
              fecha_incorporacion: it.fecha_incorporacion || null,
            });
            itemsNuevosCreados.push({ tempKey: `nuevo_${it.descripcionItem}`, realId: res.data.id });
          }
        }

        // 2. Armar los items para la planificación, reemplazando IDs temporales de nuevos
        const itemsParaPlanif = this.items
          .filter(i => i.porcentaje_planificado > 0)
          .map(i => {
            if (i.esNuevo) {
              const match = itemsNuevosCreados.find(c => c.tempKey === `nuevo_${i.descripcion}`);
              return match ? { pliego_item_id: match.realId, porcentaje_planificado: Number(i.porcentaje_planificado) } : null;
            }
            return { pliego_item_id: i.pliego_item_id, porcentaje_planificado: Number(i.porcentaje_planificado) };
          })
          .filter(Boolean);

        // 3. Guardar la planificación
        const payload = {
          fecha_desde: this.periodo.desde,
          fecha_hasta: this.periodo.hasta,
          tipo: this.esReplanteo ? "replanteo" : "original",
          motivo: this.esReplanteo ? this.motivo : null,
          items: itemsParaPlanif,
        };

        if (this.editMode) {
          await api.put(`/obras/${this.obraId}/planificacion/${this.planifId}`, payload);
          this.mensaje = "Planificación actualizada correctamente";
        } else {
          await api.post(`/obras/${this.obraId}/planificacion`, payload);
          this.mensaje = "Planificación guardada correctamente";
        }

        await this.cargarHistorial();
        setTimeout(() => { this.$router.back(); }, 1500);
      } catch (err) {
        const msg = err.response?.data?.message || "Error al guardar la planificación";
        this.error = msg;
      } finally {
        this.guardando = false;
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
        doc.text(`Tipo: ${planif.tipo === 'replanteo' ? 'Replanteo' : 'Original'}`, 14, 32);
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
    if (this.planifId) {
      this.editMode = true;
      this.cargarPlanificacionExistente();
      this.cargarHistorial();
    } else {
      // Primero historial (determina esReplanteo), luego pliego según tipo
      await this.cargarHistorial();
      await this.cargarPliego();
    }
  },
};
</script>

<style scoped>
/* Banner tipo */
.tipo-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  margin-bottom: 20px;
  border: 1px solid;
}
.banner-original { background: rgba(56,189,248,0.08); border-color: rgba(56,189,248,0.3); }
.banner-replanteo { background: rgba(251,146,60,0.08); border-color: rgba(251,146,60,0.3); }
.tipo-icon { font-size: 1.5rem; line-height: 1; }
.tipo-label { font-weight: 700; font-size: 1rem; color: #f1f5f9; }
.tipo-desc { font-size: 0.82rem; color: #94a3b8; margin-top: 2px; }

/* Cabecera */
.cabecera-cert { display: flex; gap: 20px; margin-bottom: 16px; flex-wrap: wrap; align-items: flex-start; }
.campo { display: flex; flex-direction: column; gap: 4px; }
.campo label { font-size: 0.8rem; color: #94a3b8; font-weight: 600; }
.campo input, .campo select { padding: 7px 10px; border-radius: 6px; border: 1px solid #374151; background: #0b1120; color: #e5e7eb; font-size: 0.9rem; }
.select-motivo { padding: 7px 10px; border-radius: 6px; border: 1px solid #374151; background: #0b1120; color: #e5e7eb; font-size: 0.9rem; min-width: 220px; }

/* Panel adicionales */
.adicionales-panel { background: #0f172a; border: 1px solid rgba(251,146,60,0.35); border-radius: 10px; padding: 16px; margin-bottom: 20px; }
.adicionales-titulo { color: #fb923c; font-size: 1rem; font-weight: 700; margin: 0 0 6px; }
.adicionales-desc { font-size: 0.82rem; color: #94a3b8; margin: 0 0 14px; }
.adicional-form { margin-bottom: 12px; }
.adicional-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.input-adicional { padding: 7px 10px; border-radius: 6px; border: 1px solid #374151; background: #0b1120; color: #e5e7eb; font-size: 0.85rem; }
.input-num { width: 70px; }
.input-desc { flex: 1; min-width: 160px; }
.input-small { width: 100px; }
.btn-agregar-item { padding: 7px 14px; background: #fb923c; color: #1c1917; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 0.85rem; white-space: nowrap; }
.btn-agregar-item:hover { background: #f97316; }
.error-item { color: #f87171; font-size: 0.82rem; margin: 6px 0 0; }

/* Chips de ítems adicionales */
.adicionales-lista { display: flex; flex-direction: column; gap: 6px; }
.adicional-chip { display: flex; align-items: center; gap: 10px; background: #1e293b; border: 1px solid rgba(251,146,60,0.2); border-radius: 6px; padding: 6px 12px; font-size: 0.85rem; color: #cbd5e1; }
.chip-num { color: #fb923c; font-weight: 700; min-width: 32px; }
.chip-desc { flex: 1; }
.chip-unit, .chip-cant { color: #94a3b8; font-size: 0.78rem; }
.chip-remove { margin-left: auto; background: none; border: none; color: #f87171; cursor: pointer; font-size: 1rem; padding: 0 4px; }
.chip-remove:hover { color: #ef4444; }

/* Grilla */
.grilla-titulo { font-size: 0.85rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
.fila-nueva { background: rgba(251,146,60,0.06) !important; }
.badge-nuevo { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; background: rgba(251,146,60,0.2); color: #fb923c; font-size: 0.7rem; font-weight: 700; vertical-align: middle; }
.input-porcentaje { width: 90px; }
.th-avance { color: #fb923c; }
.td-avance { color: #fb923c; font-weight: 600; text-align: center; }
.sin-items { text-align: center; font-style: italic; color: #666; }
.tf-label { text-align: right; color: #94a3b8; font-size: 0.85rem; font-weight: 600; padding: 8px 12px; }
.tf-total { text-align: center; font-weight: 700; color: #4ade80; padding: 8px 12px; }
.tf-exceso { color: #f87171 !important; }

/* Mensajes */
.mensaje-exito { background: #e6f4ea; color: #1e7e34; padding: 10px; margin-bottom: 12px; border-radius: 4px; font-weight: 600; }
.mensaje-error { background: #fdecea; color: #b02a37; padding: 10px; margin-bottom: 12px; border-radius: 4px; font-weight: 600; }

/* Badges tipo */
.badge-original { display: inline-block; padding: 2px 8px; border-radius: 999px; background: rgba(56,189,248,0.2); color: #38bdf8; font-size: 0.8rem; font-weight: 700; }
.badge-replanteo { display: inline-block; padding: 2px 8px; border-radius: 999px; background: rgba(251,146,60,0.2); color: #fb923c; font-size: 0.8rem; font-weight: 700; }

.btn-guardar:disabled { opacity: 0.6; cursor: not-allowed; }

/* Historial */
.historial-panel { margin-top: 32px; background: #020617; border: 1px solid #3b82f6; border-radius: 10px; padding: 16px; color: #e5e7eb; }
.historial-titulo { font-size: 1rem; font-weight: 800; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 14px; }
.historial-table-wrap { overflow-x: auto; }
.historial-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 600px; }
.historial-table th, .historial-table td { border: 1px solid #374151; padding: 8px 10px; text-align: center; }
.historial-table thead th { background: linear-gradient(90deg, #1d4ed8, #3b82f6); color: #f9fafb; font-weight: 700; }
.historial-table tbody tr:nth-child(odd) { background: #0b1120; }
.historial-table tbody tr:nth-child(even) { background: #020617; }
.fila-activa { outline: 2px solid #f59e0b; outline-offset: -2px; }
.btn-hist-editar { padding: 4px 12px; background: #f59e0b; color: #1c1917; border: none; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.8rem; }
.btn-hist-editar:hover:not(:disabled) { filter: brightness(1.15); }
.btn-hist-editar:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-hist-pdf { padding: 4px 12px; background: #3b82f6; color: #fff; border: none; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.8rem; margin-left: 6px; }
.btn-hist-pdf:hover { filter: brightness(1.15); }
.td-completo { color: #4ade80; font-weight: 700; }
.historial-skeleton { display: flex; flex-direction: column; gap: 10px; }
.skel-row { height: 36px; border-radius: 6px; background: linear-gradient(90deg, #1a2744 25%, #1e3060 50%, #1a2744 75%); background-size: 200% 100%; animation: shimmer-hist 1.5s infinite; }
@keyframes shimmer-hist { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.historial-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 24px; color: #6b7280; font-size: 0.9rem; }
.historial-empty span { font-size: 2rem; }
.historial-empty p { margin: 0; }

/* Panel impacto presupuestario */
.panel-impacto {
  background: #0a0f1e;
  border: 1px solid rgba(251,146,60,0.4);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
}
.impacto-titulo {
  font-size: 0.92rem;
  font-weight: 700;
  color: #fb923c;
  margin-bottom: 14px;
}
.impacto-grid {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.impacto-bloque {
  flex: 1;
  min-width: 140px;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bloque-plus {
  border-color: rgba(251,146,60,0.5);
  background: rgba(251,146,60,0.06);
}
.bloque-neutro {
  border-color: #374151;
}
.bloque-nuevo {
  border-color: rgba(74,222,128,0.4);
  background: rgba(74,222,128,0.05);
}
.impacto-label {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.impacto-valor {
  font-size: 1rem;
  font-weight: 700;
  color: #e5e7eb;
}
.badge-incremento {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(74,222,128,0.15);
  color: #4ade80;
  font-size: 0.78rem;
  font-weight: 700;
  margin-top: 2px;
  width: fit-content;
}
.impacto-aviso {
  background: rgba(245,158,11,0.08);
  border: 1px solid rgba(245,158,11,0.3);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.82rem;
  color: #fbbf24;
  margin-bottom: 14px;
}

/* Tabla de incidencias */
.incidencia-tabla-wrap { overflow-x: auto; }
.incidencia-tabla {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  min-width: 520px;
}
.incidencia-tabla th,
.incidencia-tabla td {
  border: 1px solid #1f2937;
  padding: 6px 10px;
  text-align: center;
}
.incidencia-tabla thead th {
  background: #1e293b;
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.incidencia-tabla tbody tr:nth-child(odd) { background: #111827; }
.incidencia-tabla tbody tr:nth-child(even) { background: #0b1120; }
.incidencia-tabla tfoot td {
  background: #1e293b;
  font-weight: 700;
  color: #e5e7eb;
}
.inc-fila-nueva {
  background: rgba(251,146,60,0.05) !important;
}
.td-monto { color: #e5e7eb; font-family: monospace; text-align: right; }
.td-inc-actual { color: #94a3b8; }
.td-inc-nueva { color: #60a5fa; font-weight: 600; }
.td-delta-neg { color: #f87171; font-weight: 700; }
.td-delta-neutro { color: #6b7280; }
</style>

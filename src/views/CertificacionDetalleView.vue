<template>
  <div class="cert-detalle-view">
    <h2 class="titulo">Detalle de Certificación</h2>

    <!-- ENCABEZADO -->
    <div class="encabezado">
      <div>
        <h3 class="obra-nombre">{{ certificado.obraNombre }}</h3>
        <p>
          Repartición:
          <strong>{{ etiquetaReparticion }}</strong>
        </p>
      </div>
      <div class="datos-cert">
        <p><strong>N° Certificado:</strong> {{ certificado.numero_certificado }}</p>
        <p><strong>Fecha de Emisión:</strong> {{ certificado.fecha_certificacion }}</p>
        <p>
          <strong>Período:</strong>
          {{ certificado.periodo_desde }} → {{ certificado.periodo_hasta }}
        </p>
        <p v-if="certificado.totalProyecto">
          <strong>Participación sobre obra:</strong>
          {{ certificado.porcentajeFinanciero.toFixed(2) }}%
        </p>
      </div>
    </div>

    <!-- TABLA DE ÍTEMS -->
    <h3 class="subtitulo">Ítems certificados</h3>
    <table class="tabla-items" v-if="items.length">
      <thead>
        <tr>
          <th>Ítem</th>
          <th>Descripción</th>
          <th>Unidad</th>
          <th>Cantidad Total</th>
          <th>Avance (%)</th>
          <th>Importe</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="it in items" :key="it.id">
          <td>{{ it.numeroItem }}</td>
          <td class="col-descripcion">{{ it.descripcion }}</td>
          <td>{{ it.unidad }}</td>
          <td>{{ formatNumber(it.cantidad_total) }}</td>
          <td class="avance-col">
            {{ it.avance_porcentaje.toFixed(2) }}%
          </td>
          <td>{{ formatMoney(it.importe) }}</td>
        </tr>
      </tbody>
    </table>
    <p v-else class="text-muted">
      No hay ítems en esta certificación.
    </p>

    <!-- DESGLOSE FINANCIERO -->
    <div class="panel-financiero">
      <h3>Desglose financiero</h3>

      <table class="tabla-financiero">
        <tbody>
          <!-- Subtotal base -->
          <tr>
            <td>Subtotal ítems</td>
            <td class="num">{{ formatMoney(certificado.subtotal) }}</td>
          </tr>

          <!-- MUNICIPALIDAD -->
          <template v-if="esMunicipalidad">
            <tr v-if="certificado.deduccion_anticipo">
              <td>– Devolución de anticipo financiero</td>
              <td class="num negativo">
                {{ formatMoney(-certificado.deduccion_anticipo) }}
              </td>
            </tr>
            <tr v-if="certificado.fondo_reparo">
              <td>– Fondo de reparo</td>
              <td class="num negativo">
                {{ formatMoney(-certificado.fondo_reparo) }}
              </td>
            </tr>
            <tr v-if="certificado.tasa_inspeccion">
              <td>– Tasa de inspección</td>
              <td class="num negativo">
                {{ formatMoney(-certificado.tasa_inspeccion) }}
              </td>
            </tr>
            <tr v-if="certificado.sustitucion_fondo_reparo">
              <td>+ Sustitución fondo de reparo (póliza)</td>
              <td class="num positivo">
                {{ formatMoney(certificado.sustitucion_fondo_reparo) }}
              </td>
            </tr>
          </template>

          <!-- DIRECCIÓN DE ARQUITECTURA -->
          <template v-else-if="esArquitectura">
            <tr v-if="certificado.gastos_generales">
              <td>+ Gastos generales</td>
              <td class="num positivo">
                {{ formatMoney(certificado.gastos_generales) }}
              </td>
            </tr>
            <tr v-if="certificado.beneficios">
              <td>+ Beneficios</td>
              <td class="num positivo">
                {{ formatMoney(certificado.beneficios) }}
              </td>
            </tr>
            <tr v-if="certificado.iva">
              <td>– IVA 21%</td>
              <td class="num negativo">
                {{ formatMoney(-certificado.iva) }}
              </td>
            </tr>
            <tr v-if="certificado.ingresos_brutos">
              <td>– Ingresos brutos 2,5%</td>
              <td class="num negativo">
                {{ formatMoney(-certificado.ingresos_brutos) }}
              </td>
            </tr>
          </template>

          <!-- TOTAL NETO -->
          <tr class="fila-total">
            <td><strong>Total Neto del Certificado</strong></td>
            <td class="num">
              <strong>{{ formatMoney(certificado.total_neto) }}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button class="btn-volver" @click="$router.back()">
      Volver
    </button>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";

export default {
  name: "CertificacionDetalleView",
  props: ["certId"],
  data() {
    return {
      certificado: {
        obraNombre: "",
        reparticion: null,
        numero_certificado: "",
        fecha_certificacion: "",
        periodo_desde: "",
        periodo_hasta: "",
        subtotal: 0,
        total_neto: 0,
        deduccion_anticipo: 0,
        fondo_reparo: 0,
        tasa_inspeccion: 0,
        sustitucion_fondo_reparo: 0,
        gastos_generales: 0,
        beneficios: 0,
        iva: 0,
        ingresos_brutos: 0,
        totalProyecto: 0,
        porcentajeFinanciero: 0,
      },
      items: [],
    };
  },
  computed: {
    esMunicipalidad() {
      return this.certificado.reparticion === "municipalidad_sgo";
    },
    esArquitectura() {
      return this.certificado.reparticion === "direccion_arquitectura";
    },
    etiquetaReparticion() {
      if (this.esMunicipalidad) return "Municipalidad de la Capital";
      if (this.esArquitectura)
        return "Dirección de Arquitectura de la Provincia";
      return this.certificado.reparticion || "-";
    },
  },
  methods: {
    async cargarDetalle() {
      try {
        const res = await api.get(
          `/certificaciones/${this.certId}/detalle`
        );

        if (!res.data.ok) {
          console.error("Error detalle certificación:", res.data.error);
          return;
        }

        this.certificado = res.data.certificado;
        this.items = res.data.items || [];
      } catch (error) {
        console.error("Error llamando detalle certificación:", error);
      }
    },
    formatMoney(n) {
      return Number(n || 0).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
    formatNumber(n) {
      return Number(n || 0).toLocaleString("es-AR", {
        maximumFractionDigits: 2,
      });
    },
  },
  mounted() {
    this.cargarDetalle();
  },
};
</script>

<style scoped>
.cert-detalle-view {
  padding: 20px;
  background: #020617;          /* Igual que panel-certificaciones */
  min-height: 100%;
  color: #e5e7eb;
}

.titulo {
  font-size: 1.6rem;
  margin-bottom: 15px;
  color: #bbf7d0;               /* Verde claro */
}

/* ENCABEZADO */
.encabezado {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
  padding: 14px 18px;
  border-radius: 10px;
  border: 1px solid #22c55e;    /* Borde verde */
  background: #020617;          /* Fondo oscuro */
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.35);
}

.obra-nombre {
  margin: 0 0 6px 0;
  font-size: 1.1rem;
  color: #bbf7d0;
}

.datos-cert p {
  margin: 2px 0;
}

/* SUBTÍTULO ÍTEMS */
.subtitulo {
  font-size: 1.1rem;
  margin: 12px 0 8px 0;
  color: #bbf7d0;
}

/* TABLA DE ÍTEMS (mismas gamas que historial) */
.tabla-items {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.35);
}

.tabla-items th,
.tabla-items td {
  border: 1px solid #4b5563;
  padding: 8px 10px;
  text-align: center;
}

/* Encabezado fuerte en verde */
.tabla-items th {
  background: linear-gradient(90deg, #047857, #22c55e);
  color: #f9fafb;
  font-weight: 800;
  text-transform: uppercase;
  font-size: 0.8rem;
}

/* Filas alternadas */
.tabla-items tbody tr:nth-child(odd) {
  background: #0b1120;
}

.tabla-items tbody tr:nth-child(even) {
  background: #020617;
}

/* Hover marcado */
.tabla-items tbody tr:hover {
  background: #1d283a;
}

.col-descripcion {
  text-align: left;
  padding-left: 12px;
}

/* Columna avance más destacada */
.avance-col {
  font-weight: 700;
  color: #bef264; /* Verde lima */
}

/* PANEL FINANCIERO, mismo estilo verde oscuro */
.panel-financiero {
  margin-top: 10px;
  background: #020617;
  border: 1px solid #22c55e;
  color: #e5e7eb;
  padding: 14px 18px;
  border-radius: 10px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.35);
}

.panel-financiero h3 {
  font-size: 1.1rem;
  margin-bottom: 10px;
  font-weight: 800;
  color: #bbf7d0;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.tabla-financiero {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.tabla-financiero td {
  border: 1px solid #4b5563;
  padding: 8px 10px;
}

.tabla-financiero tr:nth-child(odd) {
  background: #0b1120;
}

.tabla-financiero tr:nth-child(even) {
  background: #020617;
}

.tabla-financiero td:first-child {
  text-align: left;
}

.tabla-financiero .num {
  text-align: right;
  white-space: nowrap;
}

/* Valores positivos / negativos */
.positivo {
  color: #bbf7d0;
  font-weight: 700;
}

.negativo {
  color: #fecaca;
  font-weight: 700;
}

/* Total */
.fila-total td {
  background: linear-gradient(90deg, #047857, #22c55e);
  color: #f9fafb;
  font-weight: 800;
}

/* Botón volver en la misma línea de verde */
.btn-volver {
  margin-top: 16px;
  padding: 8px 16px;
  border-radius: 999px;
  border: none;
  background: #22c55e;
  color: #022c22;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.btn-volver:hover {
  background: #16a34a;
  color: #ecfdf5;
}

/* Texto auxiliar */
.text-muted {
  color: #9ca3af;
  font-size: 0.9rem;
}
</style>

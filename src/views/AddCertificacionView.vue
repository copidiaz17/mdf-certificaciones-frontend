<template>
  <div class="add-cert-view">
    <h2 class="titulo">Nuevo Certificado de Obra</h2>

    <!-- CABECERA -->
    <div class="cabecera-cert">
      <div class="campo">
        <label>N° de Certificado</label>
        <input type="number" v-model="cert.numero_certificado" />
      </div>

      <div class="campo">
        <label>Fecha de Emisión</label>
        <input type="date" v-model="cert.fecha_certificacion" />
      </div>

      <div class="campo">
        <label>Periodo Desde</label>
        <input type="date" v-model="cert.periodo_desde" />
      </div>

      <div class="campo">
        <label>Periodo Hasta</label>
        <input type="date" v-model="cert.periodo_hasta" />
      </div>

      <!-- Badge de repartición (normalizado) -->
      <div class="campo campo-reparticion">
        <label>Repartición</label>
        <span class="badge-reparticion">
          {{ tipoReparticion === "municipalidad" ? "Municipalidad SGO" : "Dirección de Arquitectura" }}
        </span>
      </div>
    </div>

    <!-- TABLA PRINCIPAL -->
    <table class="data-table">
      <thead>
        <tr>
          <th>Ítem</th>
          <th>Descripción</th>
          <th>Unidad</th>
          <th>Cantidad</th>
          <th>Avance (%)</th>
          <th>% Disp.</th>
          <th>Precio Unit.</th>
          <th>Importe</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="item in certItems" :key="item.pliego_item_id">
          <td>{{ item.numeroItem }}</td>
          <td>{{ item.descripcion }}</td>
          <td>{{ item.unidad }}</td>
          <td>{{ mostrar(item.cantidad) }}</td>

          <td>
            <input
              type="number"
              min="0"
              :max="item.porcentajeDisponible"
              step="0.01"
              v-model.number="item.avance_porcentaje"
              @input="calcularImporte(item)"
              class="input-porcentaje"
            />
          </td>
          <td>{{ item.porcentajeDisponible }}%</td>

          <td>{{ mostrar(item.precioUnitario) }}</td>
          <td>{{ mostrar(item.importe) }}</td>
        </tr>
      </tbody>

      <!-- DESGLOSE FINANCIERO COMO PIE DE TABLA -->
      <tfoot>
        <tr class="row-subtotal">
          <td colspan="6" class="text-right">Subtotal ítems</td>
          <td>{{ mostrar(totales.subtotal) }}</td>
        </tr>

        <!-- MUNICIPALIDAD (municipalidad_sgo) -->
        <template v-if="esMunicipalidad">
          <tr>
            <td colspan="6" class="text-right">
              Devolución anticipo financiero (40% del subtotal)
            </td>
            <td>- {{ mostrar(totales.deduccionAnticipo) }}</td>
          </tr>

          <tr>
            <td colspan="6" class="text-right">Subtotal 1</td>
            <td>{{ mostrar(totales.subtotal1) }}</td>
          </tr>

          <tr>
            <td colspan="6" class="text-right">
              Fondo de reparo (5% del subtotal)
            </td>
            <td>- {{ mostrar(totales.fondoReparo) }}</td>
          </tr>

          <tr>
            <td colspan="6" class="text-right">
              Tasa de inspección (3% del subtotal)
            </td>
            <td>- {{ mostrar(totales.tasaInspeccion) }}</td>
          </tr>

          <tr>
            <td colspan="6" class="text-right">Subtotal 2</td>
            <td>{{ mostrar(totales.subtotal2) }}</td>
          </tr>

          <tr>
            <td colspan="6" class="text-right">
              Sustitución fondo de reparo mediante póliza
            </td>
            <td>+ {{ mostrar(totales.sustitucionFondoReparo) }}</td>
          </tr>

          <tr class="row-total-final">
            <td colspan="6" class="text-right">TOTAL NETO CERTIFICADO</td>
            <td>{{ mostrar(totales.totalNeto) }}</td>
          </tr>
        </template>

        <!-- ARQUITECTURA (direccion_arquitectura) -->
        <template v-else-if="esArquitectura">
          <tr>
            <td colspan="6" class="text-right">
              Gastos generales (15% del subtotal)
            </td>
            <td>+ {{ mostrar(totales.gastosGenerales) }}</td>
          </tr>

          <tr>
            <td colspan="6" class="text-right">Subtotal 1</td>
            <td>{{ mostrar(totales.subtotal1) }}</td>
          </tr>

          <tr>
            <td colspan="6" class="text-right">
              Beneficios (10% del subtotal 1)
            </td>
            <td>+ {{ mostrar(totales.beneficios) }}</td>
          </tr>

          <tr>
            <td colspan="6" class="text-right">Subtotal 2</td>
            <td>{{ mostrar(totales.subtotal2) }}</td>
          </tr>

          <tr>
            <td colspan="6" class="text-right">IVA 21% (sobre subtotal 2)</td>
            <td>- {{ mostrar(totales.iva) }}</td>
          </tr>

          <tr>
            <td colspan="6" class="text-right">
              Ingresos brutos 2,5% (sobre subtotal 2)
            </td>
            <td>- {{ mostrar(totales.ingresosBrutos) }}</td>
          </tr>

          <tr class="row-total-final">
            <td colspan="6" class="text-right">TOTAL NETO CERTIFICADO</td>
            <td>{{ mostrar(totales.totalNeto) }}</td>
          </tr>
        </template>
      </tfoot>
    </table>

    <!-- RESUMEN FINAL DEL CERTIFICADO -->
    <div class="resumen-certificado">
      <h3>Resumen del certificado</h3>
      <p>
        <strong>Total neto del certificado:</strong>
        {{ mostrar(totales.totalNeto) }}
      </p>
      <p>
        <strong>Avance financiero de la obra (este certificado):</strong>
        {{ totales.avanceObraPct.toFixed(2) }} %
      </p>
    </div>

    <button class="btn-guardar" @click="guardarCertificacion">
      Guardar Certificación
    </button>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useToast } from "vue-toastification";

export default {
  name: "AddCertificacionView",
  props: ["obraId"],

  setup() {
    const toast = useToast();
    return { toast };
  },

  data() {
    return {
      obra: {},
      cert: {
        numero_certificado: "",
        fecha_certificacion: "",
        periodo_desde: "",
        periodo_hasta: "",
      },
      certItems: [],
      totalObra: 0, // suma de costo total de todos los ítems de la obra
      totales: {
        subtotal: 0,
        subtotal1: 0,
        subtotal2: 0,
        deduccionAnticipo: 0,
        fondoReparo: 0,
        tasaInspeccion: 0,
        sustitucionFondoReparo: 0,
        gastosGenerales: 0,
        beneficios: 0,
        iva: 0,
        ingresosBrutos: 0,
        totalNeto: 0,
        avanceObraPct: 0,
      },
    };
  },

  computed: {
    // Valor crudo que viene de DB: puede ser 'municipalidad_sgo', 'direccion_arquitectura', null, etc.
    rawReparticion() {
      return this.obra?.reparticion || null;
    },

    // Normalizamos a dos valores lógicos: 'municipalidad' o 'arquitectura'
    tipoReparticion() {
      const r = (this.rawReparticion || "").toLowerCase();

      if (r.includes("municipalidad")) return "municipalidad";
      if (r.includes("arquitectura")) return "arquitectura";

      // default si no hay nada: tomamos MUNICIPALIDAD
      return "municipalidad";
    },

    esMunicipalidad() {
      return this.tipoReparticion === "municipalidad";
    },

    esArquitectura() {
      return this.tipoReparticion === "arquitectura";
    },
  },

  methods: {
    mostrar(n) {
      return Number(n || 0).toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },

    calcularImporte(item) {
      const cantidad = Number(item.cantidad || 0);
      const precio = Number(item.precioUnitario || 0);
      const pct = Number(item.avance_porcentaje || 0);

      item.importe = (cantidad * precio * pct) / 100;
      this.recalcularTotales();
    },

    recalcularTotales() {
      // Subtotal de ítems
      const subtotal = this.certItems.reduce(
        (sum, it) => sum + Number(it.importe || 0),
        0
      );

      // Avance financiero relativo al total de la obra
      const totalObra = Number(this.totalObra || 0);
      const avancePct = totalObra > 0 ? (subtotal / totalObra) * 100 : 0;

      let t = {
        subtotal,
        subtotal1: subtotal,
        subtotal2: subtotal,
        deduccionAnticipo: 0,
        fondoReparo: 0,
        tasaInspeccion: 0,
        sustitucionFondoReparo: 0,
        gastosGenerales: 0,
        beneficios: 0,
        iva: 0,
        ingresosBrutos: 0,
        totalNeto: subtotal,
        avanceObraPct: avancePct,
      };

      // Lógica financiera para MUNICIPALIDAD (municipalidad_sgo)
      if (this.esMunicipalidad) {
        const deduccionAnticipo = subtotal * 0.4; // 40%
        const fondoReparo = subtotal * 0.05; // 5%
        const tasaInspeccion = subtotal * 0.03; // 3%

        const subtotal1 = subtotal - deduccionAnticipo;
        const subtotal2 = subtotal1 - fondoReparo - tasaInspeccion;

        const sustitucionFondoReparo = fondoReparo; // se suma de nuevo
        const totalNeto = subtotal2 + sustitucionFondoReparo;

        Object.assign(t, {
          deduccionAnticipo,
          fondoReparo,
          tasaInspeccion,
          sustitucionFondoReparo,
          subtotal1,
          subtotal2,
          totalNeto,
        });
      }

      // Lógica financiera para ARQUITECTURA (direccion_arquitectura)
      if (this.esArquitectura) {
        const gastosGenerales = subtotal * 0.15; // 15%
        const subtotal1 = subtotal + gastosGenerales;

        const beneficios = subtotal1 * 0.1; // 10%
        const subtotal2 = subtotal1 + beneficios;

        const iva = subtotal2 * 0.21; // 21%
        const ingresosBrutos = subtotal2 * 0.025; // 2.5%

        const totalNeto = subtotal2 - iva - ingresosBrutos;

        Object.assign(t, {
          gastosGenerales,
          beneficios,
          iva,
          ingresosBrutos,
          subtotal1,
          subtotal2,
          totalNeto,
        });
      }

      this.totales = t;
    },

    async cargarDatos() {
      try {
        const [obraRes, pliegoRes] = await Promise.all([
          api.get(`/obras/${this.obraId}`),
          api.get(`/obras/${this.obraId}/items-disponibles-certificacion`),
        ]);

        this.obra = obraRes.data;

        this.certItems = pliegoRes.data.map((it) => {
          const cantidad = Number(it.cantidad || 0);
          const costoUnitario = Number(it.costoUnitario || 0);
          const costoParcial =
            it.costoParcial != null
              ? Number(it.costoParcial)
              : cantidad * costoUnitario;

          return {
            pliego_item_id: it.id,
            numeroItem: it.numeroItem,
            descripcion: it.descripcionItem,
            unidad: it.unidadMedida,
            cantidad,
            precioUnitario: costoUnitario,
            costoTotalItem: costoParcial,
            porcentajeDisponible: Number(it.porcentajeDisponible || 100),
            avance_porcentaje: 0,
            importe: 0,
          };
        });

        this.totalObra = this.certItems.reduce(
          (sum, it) => sum + Number(it.costoTotalItem || 0),
          0
        );

        this.recalcularTotales();
      } catch (error) {
        console.error("Error cargando datos de certificación:", error);
        this.toast.error("Error al cargar datos para la certificación.");
      }
    },

    async guardarCertificacion() {
      try {
        const payload = {
          numero_certificado: this.cert.numero_certificado,
          fecha_certificacion: this.cert.fecha_certificacion,
          periodo_desde: this.cert.periodo_desde,
          periodo_hasta: this.cert.periodo_hasta,

          // Enviamos TODO el desglose financiero al backend
          totales: {
            subtotal: this.totales.subtotal,
            subtotal1: this.totales.subtotal1,
            subtotal2: this.totales.subtotal2,
            deduccionAnticipo: this.totales.deduccionAnticipo,
            fondoReparo: this.totales.fondoReparo,
            tasaInspeccion: this.totales.tasaInspeccion,
            sustitucionFondoReparo: this.totales.sustitucionFondoReparo,
            gastosGenerales: this.totales.gastosGenerales,
            beneficios: this.totales.beneficios,
            iva: this.totales.iva,
            ingresosBrutos: this.totales.ingresosBrutos,
            totalNeto: this.totales.totalNeto,
            avanceObraPct: this.totales.avanceObraPct,
          },

          items: this.certItems
            .filter((i) => Number(i.avance_porcentaje) > 0)
            .map((i) => ({
              pliego_item_id: i.pliego_item_id,
              avance_porcentaje: i.avance_porcentaje,
              importe: i.importe,
            })),
        };

        if (payload.items.length === 0) {
          this.toast.warning("Debe cargar al menos un ítem con avance mayor a 0.");
          return;
        }

        await api.post(
          `/certificaciones/obras/${this.obraId}/certificaciones`,
          payload
        );

        this.toast.success("Certificación guardada correctamente.");
        this.$router.back();
      } catch (error) {
        console.error("Error guardando certificación:", error);
        const msg =
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Error al guardar la certificación.";
        this.toast.error(msg);
      }
    },
  },

  mounted() {
    this.cargarDatos();
  },
};
</script>

<style scoped>
.add-cert-view {
  padding: 20px;
}

/* ---------- CABECERA ---------- */

.cabecera-cert {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 25px;
  background: #16163A;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #2D2D5E;
}

.campo {
  display: flex;
  flex-direction: column;
}

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

.campo-reparticion {
  align-self: flex-end;
}

.badge-reparticion {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 999px;
  background: #1f2937;
  color: #e5e7eb;
  font-size: 12px;
}

/* ---------- TABLA ---------- */

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 18px;
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
}

.input-porcentaje {
  width: 80px;
  padding: 4px;
  text-align: center;
}

/* FOOTER DE TABLA */

.text-right {
  text-align: right;
}

.row-subtotal td {
  font-weight: 600;
  background: #111827;
}

.row-total-final td {
  font-weight: 700;
  background: #047857;
  color: #fff;
}

/* -------- RESUMEN -------- */

.resumen-certificado {
  margin-top: 10px;
  margin-bottom: 20px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #020617;
  border: 1px solid #4b5563;
}

.resumen-certificado h3 {
  margin-top: 0;
  margin-bottom: 8px;
}

/* -------- BOTÓN -------- */

.btn-guardar {
  margin-top: 10px;
  background: #1769aa;
  color: white;
  padding: 10px 18px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}
</style>

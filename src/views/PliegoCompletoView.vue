<template>
  <div class="pliego-completo-view">
    <h2 class="titulo-pagina">Pliego Completo de la Obra</h2>
    <p class="mb-3">Obra: {{ obra?.nombre }}</p>

    <table class="data-table">
      <thead>
        <tr>
          <th>N° Ítem</th>
          <th>Descripción</th>
          <th>Unidad</th>
          <th class="num-col">Cantidad</th>
          <th class="num-col">Costo Unitario</th>
          <th class="num-col">Costo Parcial</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td>{{ item.numeroItem }}</td>
          <td>{{ item.ItemGeneral?.descripcion || item.descripcionItem }}</td>
          <td>{{ item.ItemGeneral?.unidad || item.unidadMedida }}</td>

          <!-- NUMÉRICOS CON SEPARADORES -->
          <td class="num-col">
            {{ formatNumber(item.cantidad) }}
          </td>
          <td class="num-col">
            {{ formatNumber(item.costoUnitario) }}
          </td>
          <td class="num-col">
            {{ formatNumber(item.costoParcial) }}
          </td>
        </tr>

        <!-- FILAS DE RESUMEN -->
        <tr class="resumen-row">
          <td colspan="5"><strong>Costo Total</strong></td>
          <td class="num-col">{{ formatNumber(costoTotal) }}</td>
        </tr>
        <tr class="resumen-row">
          <td colspan="5">Gastos Generales (15%)</td>
          <td class="num-col">{{ formatNumber(gastosGenerales) }}</td>
        </tr>
        <tr class="resumen-row">
          <td colspan="5"><strong>Subtotal 1</strong></td>
          <td class="num-col">{{ formatNumber(subtotal1) }}</td>
        </tr>
        <tr class="resumen-row">
          <td colspan="5">Beneficio (10%)</td>
          <td class="num-col">{{ formatNumber(beneficio) }}</td>
        </tr>
        <tr class="resumen-row">
          <td colspan="5"><strong>Subtotal 2</strong></td>
          <td class="num-col">{{ formatNumber(subtotal2) }}</td>
        </tr>
        <tr class="resumen-row">
          <td colspan="5">IVA (21%)</td>
          <td class="num-col">{{ formatNumber(iva) }}</td>
        </tr>
        <tr class="resumen-row">
          <td colspan="5">Ingresos Brutos (2.5%)</td>
          <td class="num-col">{{ formatNumber(ingBrutos) }}</td>
        </tr>
        <tr class="total-final-row">
          <td colspan="5"><strong>PRECIO TOTAL DE OBRA</strong></td>
          <td class="num-col">{{ formatNumber(totalObra) }}</td>
        </tr>
      </tbody>
    </table>

    <button class="btn-primary mt-4" @click="$router.back()">⬅ Volver</button>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";

export default {
  props: ["obraId"],

  data() {
    return {
      items: [],
      obra: null,
    };
  },

  methods: {
    /** 🔥 Formateo universal de números con separador de miles */
    formatNumber(value) {
      const num = Number(value);
      return isNaN(num)
        ? value
        : num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
  },

  computed: {
    costoTotal() {
      return this.items.reduce((sum, i) => sum + Number(i.costoParcial), 0);
    },
    gastosGenerales() {
      return this.costoTotal * 0.15;
    },
    subtotal1() {
      return this.costoTotal + this.gastosGenerales;
    },
    beneficio() {
      return this.subtotal1 * 0.10;
    },
    subtotal2() {
      return this.subtotal1 + this.beneficio;
    },
    iva() {
      return this.subtotal2 * 0.21;
    },
    ingBrutos() {
      return this.subtotal2 * 0.025;
    },
    totalObra() {
      return this.subtotal2 + this.iva + this.ingBrutos;
    }
  },

  async mounted() {
    try {
      const res = await api.get(`/obras/${this.obraId}/pliego`);
      this.items = res.data;

      const obraRes = await api.get(`/obras/${this.obraId}`);
      this.obra = obraRes.data;

    } catch (error) {
      console.error("Error cargando pliego:", error);
      this.items = [];
      this.obra = { nombre: 'Error al cargar', ubicacion: '' };
    }
  }
};
</script>

<style scoped>
.pliego-completo-view {
  padding: 20px;
}

.titulo-pagina {
  font-size: 1.8em;
  margin-bottom: 15px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

.data-table th, 
.data-table td {
  border: 1px solid #444;
  padding: 8px;
  text-align: left;
}

/* Encabezado oscuro y texto blanco para contraste */
.data-table th {
  background-color: #222;
  color: white;
}

/* Números alineados a la derecha */
.num-col {
  text-align: right;
  font-family: monospace;
  padding-right: 12px;
}

/* Filas de resumen */
.resumen-row {
  background: #1c1c1c;
  color: #fff;
  font-weight: bold;
}

/* Total final destacado */
.total-final-row {
  background: #000;
  color: #fff;
  font-weight: bold;
  font-size: 1.05rem;
}

.btn-primary {
  cursor: pointer;
  padding: 8px 15px;
  border: none;
  border-radius: 5px;
  background: #17a2b8;
  color: #fff;
  font-weight: bold;
}

.mt-4 {
  margin-top: 16px;
}
</style>

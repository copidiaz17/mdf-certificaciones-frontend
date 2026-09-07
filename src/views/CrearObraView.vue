<template>
  <div class="panel-content-centered">
    <div class="card form-card">
      <h2 class="titulo-pagina">Registrar Nueva Obra</h2>

      <form @submit.prevent="guardarObra" class="form-grid">
        
        <div class="form-group-row">
          <div class="col-md-12">
            <label class="form-label">Nombre de la Obra:</label>
            <input
              type="text"
              v-model="form.nombre"
              class="input-control"
              required
              placeholder="Ej: Torre Residencial Sol Naciente"
            />
          </div>
        </div>

        <div class="form-group-row">
          <div class="col-md-12">
            <label class="form-label">Ubicación / Dirección:</label>
            <input
              type="text"
              v-model="form.ubicacion"
              class="input-control"
              placeholder="Ej: Av. Principal 123"
            />
          </div>
        </div>

        <!-- 🔹 NUEVO CAMPO -->
        <div class="form-group-row">
          <div class="col-md-12">
            <label class="form-label">Repartición:</label>
            <select
              v-model="form.reparticion"
              class="input-control"
              required
            >
              <option value="" disabled>
                Seleccione una repartición
              </option>

              <option value="municipalidad_sgo">
                Municipalidad de Santiago del Estero
              </option>

              <option value="direccion_arquitectura">
                Dirección Provincial de Arquitectura
              </option>
            </select>
          </div>
        </div>

        <div class="form-group-row">
          <div class="col-md-12">
            <label class="opcion-total">
              <input type="checkbox" v-model="form.solo_costo_total" />
              <span>
                <strong>Contratada por un precio total</strong>
                <small>
                  El pliego muestra solo el total, sin abrir gastos generales,
                  beneficios, IVA ni ingresos brutos. Marcala si el contrato no
                  tiene ese desglose: mostrarlo sería inventar una apertura que
                  no existe.
                </small>
              </span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          class="btn-primary btn-success mt-3"
          :disabled="!authStore.canModify"
        >
          Guardar Obra
        </button>

        <p v-if="mensaje" class="alert success mt-2">{{ mensaje }}</p>
        <p v-if="error" class="alert error mt-2">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from "../stores/authStore";

export default {
  name: "CrearObraView",

  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },

  data() {
    return {
      form: {
        nombre: "",
        ubicacion: "",
        reparticion: "", // 👈 NUEVO
        solo_costo_total: false,
      },
      mensaje: "",
      error: "",
    };
  },

  methods: {
    async guardarObra() {
      this.mensaje = "";
      this.error = "";

      try {
        const res = await api.post("/obras", this.form);

        this.mensaje = `Obra '${res.data.nombre}' registrada exitosamente.`;
        this.error = "";

        // Limpiar formulario
        this.form = {
          nombre: "",
          ubicacion: "",
          reparticion: "",
        };
      } catch (err) {
        const msg =
          err.response?.data?.message || "Error al guardar la obra.";
        this.error = msg;
        this.mensaje = "";
      }
    },
  },
};
</script>

<style scoped>
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.form-group-row {
  display: flex;
  width: 100%;
}
.col-md-12 {
  flex: 1;
}

.opcion-total {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  cursor: pointer;
}
.opcion-total input {
  margin-top: 3px;
  width: 16px;
  height: 16px;
  flex: none;
  cursor: pointer;
}
.opcion-total span {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.opcion-total small {
  font-size: 0.82rem;
  line-height: 1.5;
  opacity: 0.75;
}
</style>

<template>
  <div class="edit-cert-view">
    <h2 class="titulo">Editar Certificación</h2>

    <form class="form-cert" @submit.prevent="guardar">
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
    };
  },

  async mounted() {
    await this.cargarDatos();
  },

  methods: {
    async cargarDatos() {
      try {
        const res = await api.get(`/certificaciones/${this.certId}/detalle`);
        if (!res.data.ok) return;
        const c = res.data.certificado;
        this.form.numero_certificado = c.numero_certificado || "";
        this.form.fecha_certificacion = (c.fecha_certificacion || "").slice(0, 10);
        this.form.periodo_desde = (c.periodo_desde || "").slice(0, 10);
        this.form.periodo_hasta = (c.periodo_hasta || "").slice(0, 10);
      } catch (e) {
        this.toast.error("Error al cargar la certificación.");
      }
    },

    async guardar() {
      const { numero_certificado, fecha_certificacion, periodo_desde, periodo_hasta } = this.form;

      if (!numero_certificado || !fecha_certificacion || !periodo_desde || !periodo_hasta) {
        this.toast.warning("Completá todos los campos.");
        return;
      }

      if (periodo_hasta < periodo_desde) {
        this.toast.warning("El período Hasta no puede ser anterior al período Desde.");
        return;
      }

      try {
        const res = await api.put(`/certificaciones/${this.certId}`, this.form);
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
  max-width: 520px;
  margin: 0 auto;
  color: #e5e7eb;
}

.titulo {
  font-size: 1.5rem;
  margin-bottom: 24px;
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

.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.campo label {
  font-size: 0.85rem;
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

.campo input:focus {
  outline: none;
  border-color: #22c55e;
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

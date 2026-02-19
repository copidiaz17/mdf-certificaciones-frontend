<template>
  <div class="crear-usuario-view">
    <h2>Crear nuevo usuario</h2>

    <!-- Mensajes -->
    <p v-if="mensaje" :class="['mensaje', mensajeTipo]">
      {{ mensaje }}
    </p>

    <form @submit.prevent="crearUsuario" class="form-usuario">
      <div class="campo">
        <label>Nombre</label>
        <input v-model="form.nombre" type="text" required />
      </div>

      <div class="campo">
        <label>Email</label>
        <input v-model="form.email" type="email" required />
      </div>

      <div class="campo">
        <label>Contraseña</label>
        <input v-model="form.password" type="password" required />
      </div>

      <div class="campo">
        <label>Rol</label>
        <select v-model="form.rol" required>
          <option value="administrador">Administrador</option>
          <option value="usuario">Usuario</option>
        </select>
      </div>

      <button type="submit" class="btn-primario">
        Crear Usuario
      </button>
    </form>

    <button class="btn-volver" @click="$router.back()">
      Volver
    </button>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from "../stores/authStore";

export default {
  name: "CrearUsuarioView",
  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },
  data() {
    return {
      form: {
        nombre: "",
        email: "",
        password: "",
        rol: "usuario",
      },
      mensaje: "",
      mensajeTipo: "", // 'ok' | 'error'
    };
  },
  computed: {
    esSuperAdmin() {
      return this.authStore.user && this.authStore.user.id === 1;
    },
  },
  methods: {
    async crearUsuario() {
      try {
        // Defensa extra: si por alguna razón llega acá y no es id=1, no dejamos
        if (!this.esSuperAdmin) {
          this.mensaje = "No tiene permisos para crear usuarios.";
          this.mensajeTipo = "error";
          return;
        }

        this.mensaje = "";
        this.mensajeTipo = "";

        const payload = {
          nombre: this.form.nombre.trim(),
          email: this.form.email.trim(),
          password: this.form.password,
          rol: this.form.rol,
        };

        const res = await api.post("/usuarios", payload);

        if (res.data && res.data.ok) {
          this.mensaje = "Usuario creado correctamente.";
          this.mensajeTipo = "ok";

          // Limpiar formulario
          this.form.nombre = "";
          this.form.email = "";
          this.form.password = "";
          this.form.rol = "usuario";
        } else {
          this.mensaje =
            res.data?.message || "No se pudo crear el usuario.";
          this.mensajeTipo = "error";
        }
      } catch (error) {
        console.error("Error creando usuario:", error);
        this.mensaje =
          error.response?.data?.message ||
          "Error inesperado al crear el usuario.";
        this.mensajeTipo = "error";
      }
    },
  },
  mounted() {
    // Defensa preventiva: si alguien entra por URL directa y no es id=1
    if (!this.esSuperAdmin) {
      this.$router.replace({ name: "DashboardHome" });
    }
  },
};
</script>

<style scoped>
.crear-usuario-view {
  max-width: 480px;
  margin: 0 auto;
  padding: 20px;
}

h2 {
  font-size: 1.4rem;
  margin-bottom: 15px;
}

.form-usuario {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 15px;
}

.campo {
  display: flex;
  flex-direction: column;
}

.campo label {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.campo input,
.campo select {
  padding: 6px 8px;
  border: 1px solid #9ca3af;
  border-radius: 4px;
  font-size: 0.9rem;
}

.btn-primario {
  margin-top: 8px;
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: #0f766e;
  color: #ecfdf5;
  cursor: pointer;
  font-weight: 600;
}

.btn-primario:hover {
  background: #0d9488;
}

.btn-volver {
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  background: #4b5563;
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-volver:hover {
  background: #374151;
}

.mensaje {
  margin-bottom: 10px;
  font-size: 0.9rem;
  padding: 6px 10px;
  border-radius: 4px;
}

.mensaje.ok {
  background: #ecfdf5;
  border: 1px solid #16a34a;
  color: #14532d;
}

.mensaje.error {
  background: #fef2f2;
  border: 1px solid #dc2626;
  color: #7f1d1d;
}
</style>

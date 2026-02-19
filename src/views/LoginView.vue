<template>
  <div class="login-page">
    <div class="login-container">
      <h1 class="login-title">SISTEMA DE CERTIFICACIÓN DE OBRA</h1>

      <form @submit.prevent="login" class="login-form">
        <img src="/logo-mdf.jpg" alt="Logo" class="logo" />

        <div class="input-group">
          <input v-model="email" type="email" placeholder="Email" required />
        </div>

        <div class="input-group">
          <input v-model="password" type="password" placeholder="Contraseña" required />
        </div>

        <button type="submit" class="btn-submit">Ingresar</button>

        <p v-if="error" class="error">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from "../stores/authStore";
import "../assets/css/Loguin.css";

export default {
  name: "LoginView",
  data() {
    return {
      email: "",
      password: "",
      error: null,
      loading: false,
    };
  },
  methods: {
    async login() {
      this.error = null;
      this.loading = true;

      try {
        console.log("[LOGIN] intentando:", this.email);

        const res = await api.post("/auth/login", {
          email: this.email,
          password: this.password,
        });

        console.log("[LOGIN] OK:", res.data);

        const token = res.data?.token;
        if (!token) throw new Error("No vino token en la respuesta");

        localStorage.setItem("token", token);

        const authStore = useAuthStore();
        // si tu store tiene loadUserFromToken, ok:
        if (authStore.loadUserFromToken) authStore.loadUserFromToken(token);
        // si además tenés initialize(), no hace daño:
        if (authStore.initialize) authStore.initialize();

        // ✅ navegación SPA (no recarga el sitio)
        this.$router.push({ name: "Dashboard" });
      } catch (err) {
        console.error("[LOGIN] ERROR:", err);
        console.error("[LOGIN] response:", err?.response);
        this.error = err?.response?.data?.message || err?.message || "Error al iniciar sesión";
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>


<style scoped>
/* NOTA: Estos estilos son mínimos, el resto debe estar en login.css */
img {
  max-width: 320px;
  height: auto;
}
</style>
<template>
  <div class="dashboard">
    <header class="header header-principal">
      <img src="/logo-mdf.jpg" alt="MDF Obras Civiles" class="logo" />

      <div class="header-main-area">
        <h1 class="main-dashboard-title">SISTEMA CERTIFICACIÓN DE OBRA</h1>

        <div class="action-buttons-container" v-if="authStore.canModify">
          <button @click="navigate('CrearObra')" class="btn-action btn-create-obra">
            <i class="fas fa-hammer"></i> Agregar Obra
          </button>

          <button @click="navigate('GestionarCatalogo')" class="btn-action btn-info">
            <i class="fas fa-list"></i> Agregar Item
          </button>

          <button
            v-if="esSuperAdmin"
            @click="navigate('CrearUsuario')"
            class="btn-action btn-user"
          >
            <i class="fas fa-user-plus"></i> Crear Usuario
          </button>
        </div>
      </div>

      <!-- PERFIL + LOGOUT -->
      <div class="user-profile-widget">
        <p class="welcome-text">¡Bienvenido!</p>
        <p class="user-name">{{ authStore.user?.nombre || authStore.user?.email }}</p>

        <button @click="logout" class="btn-logout-visible" type="button" title="Cerrar sesión">
          <span class="logout-icon" aria-hidden="true">⎋</span>
          <span class="logout-text">Salir</span>
        </button>
      </div>

      <button class="hamburger" @click="toggleSidebar" type="button">☰</button>
    </header>

    <!-- overlay para mobile -->
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>

    <div class="main-content">
      <aside :class="['sidebar', { open: sidebarOpen }]">
        <h2 class="sidebar-title">Obras</h2>

        <ul class="obra-list">
          <li
            v-for="obra in obras"
            :key="obra.id"
            :class="{ selected: obra.id == obraActiva }"
            @click="seleccionarObra(obra.id)"
          >
            <span class="icon">🏗</span>
            <span class="obra-nombre">{{ obra.nombre }}</span>
            <div v-if="obra.id == obraActiva" class="active-indicator"></div>
          </li>
        </ul>
      </aside>

      <main class="panel-central">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from "../stores/authStore";

export default {
  name: "DashboardView",
  setup() {
    const authStore = useAuthStore();
    return { authStore };
  },
  data() {
    return {
      obras: [],
      sidebarOpen: false,
      obraActiva: null,
    };
  },
  computed: {
    esSuperAdmin() {
      return this.authStore.user && this.authStore.user.id === 1;
    },
  },
  watch: {
    // ✅ mantiene seleccionado cuando cambia la ruta (cambio de obra)
    "$route.params.obraId": {
      immediate: true,
      handler(newId) {
        this.obraActiva = newId ? Number(newId) : null;
      },
    },
  },
  methods: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },

    async cargarObras() {
      try {
        const res = await api.get("/obras");
        this.obras = res.data || [];
      } catch (error) {
        console.error("Error cargando obras:", error);
        this.obras = [];
      }
    },

    logout() {
      this.authStore.logout();
      delete api.defaults.headers.common["Authorization"];
      this.obraActiva = null;
      this.sidebarOpen = false;
      this.$router.push({ name: "Login" });
    },

    navigate(name) {
      this.$router.push({ name });
    },

    seleccionarObra(id) {
      this.obraActiva = Number(id);

      // ✅ en mobile cierro sidebar para que se vea el contenido
      this.sidebarOpen = false;

      this.$router.push({ name: "ObraDetalle", params: { obraId: id } });
    },
  },
  mounted() {
    this.cargarObras();
  },
};
</script>

<style src="../assets/css/Dashboard.css"></style>

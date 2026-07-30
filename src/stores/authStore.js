// src/stores/authStore.js
import { defineStore } from "pinia";
import { jwtDecode } from "jwt-decode";

function readTokenFromStorage() {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const decoded = jwtDecode(token);
      // Verifica expiración
      if (decoded.exp * 1000 > Date.now()) {
        // rol puede venir como 'rol' o 'role' según backend
        const rol = (decoded.rol || decoded.role || "").toLowerCase().trim();
        return { token, user: decoded, role: rol };
      } else {
        localStorage.removeItem("token");
      }
    } catch (e) {
      localStorage.removeItem("token");
    }
  }
  return { token: null, user: null, role: null };
}

const initialState = readTokenFromStorage();

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: initialState.token,
    user: initialState.user,
    role: initialState.role, // 'administrador' | 'usuario' | 'lector' | null
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,

    // 🔑 Quién puede modificar:
    // administrador y usuario -> true
    // lector -> false
    canModify: (state) => {
      if (!state.role) return false;
      const rol = state.role.toLowerCase().trim();
      return rol === "admin" || rol === "administrador" || rol === "operator" || rol === "usuario";
    },

    // 🔑 Es administrador (acepta los dos nombres que quedaron en la base)
    //
    // ⚠️ POR QUÉ ESTÁ ACÁ: en la base los roles quedaron mezclados — hay
    // usuarios con "admin" y otros con "administrador". El backend ya los
    // normaliza (ver middlewares/authorization.js), pero la vista comparaba
    // contra la palabra exacta "administrador" y dejaba afuera a los "admin",
    // incluido admin@mdf.com. Centralizado para que no vuelva a pasar.
    esAdmin: (state) => {
      if (!state.role) return false;
      const rol = state.role.toLowerCase().trim();
      return rol === "admin" || rol === "administrador";
    },

    // 🔑 Súper administrador (id = 1)
    isSuperAdmin: (state) => {
      return !!state.user && Number(state.user.id) === 1;
    },
  },

  actions: {
    loadUserFromToken(token) {
      if (token) {
        try {
          const decoded = jwtDecode(token);
          const rol = (decoded.rol || decoded.role || "").toLowerCase().trim();
          this.user = decoded;
          this.role = rol;
          this.token = token;
        } catch (e) {
          this.logout();
        }
      }
    },

    logout() {
      localStorage.removeItem("token");
      this.user = null;
      this.role = null;
      this.token = null;
      // Redirige forzosamente a la raíz para iniciar el flujo de autenticación
      window.location.replace("/");
    },

    initialize() {
      this.loadUserFromToken(this.token);
    },
  },
});

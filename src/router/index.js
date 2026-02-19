// src/router/index.js
import { createRouter, createWebHashHistory } from "vue-router";
import { h } from "vue";
import { useToast } from "vue-toastification";

import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";
import { useAuthStore } from "../stores/authStore";

// Vistas del flujo de certificación
import ObraDetalleView from "../views/ObraDetalleView.vue";
import CargarPliegoView from "../views/CargarPliegoView.vue";
import AddCertificacionView from "../views/AddCertificacionView.vue";
import CrearObraView from "../views/CrearObraView.vue";
import GestionarCatalogoView from "../views/GestionarCatalogoView.vue";
import AddPlanificacionView from "../views/AddPlanificacionView.vue";
import AddAvanceObraView from "../views/AddAvanceObraView.vue";
import CrearUsuarioView from "../views/CrearUsuarioView.vue";


// Componente placeholder para el inicio del Dashboard
const DashboardHomeView = {
  render: () =>
    h("div", { class: "panel-content-centered" }, [
      h("h1", { class: "main-dashboard-title" }, "SISTEMA CERTIFICACIÓN DE OBRA"),
      h("p", {}, "Selecciona una obra para iniciar la certificación."),
    ]),
};

const routes = [
  {
    path: "/",
    name: "Login",
    component: LoginView,
    meta: { requiresAuth: false },
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: DashboardView,
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        name: "DashboardHome",
        component: DashboardHomeView,
      },

      {
        path: "obra/:obraId",
        name: "ObraDetalle",
        component: ObraDetalleView,
        props: true,
        meta: { requiresAuth: true },
      },

      { 
      path: "usuarios/crear",
      name: "CrearUsuario",
      component: CrearUsuarioView,
      meta: { requiresAuth: true },
    },

      {
        path: "pliego/cargar/:obraId",
        name: "CargarPliego",
        component: CargarPliegoView,
        props: true,
        meta: { requiresAuth: true, requiresModification: true },
      },

      {
        path: "certificacion/agregar/:obraId",
        name: "AddCertificacion",
        component: AddCertificacionView,
        props: true,
        meta: { requiresAuth: true, requiresModification: true },
      },

      {
        path: "obra/crear",
        name: "CrearObra",
        component: CrearObraView,
        meta: { requiresAuth: true, requiresModification: true },
      },

      {
        path: "catalogo/gestion",
        name: "GestionarCatalogo",
        component: GestionarCatalogoView,
        meta: { requiresAuth: true, requiresModification: true },
      },

      {
        path: "obra/:obraId/planificacion",
        name: "ProyeccionObra",
        component: AddPlanificacionView, // 👈 usamos el import estático que ya tenés
        props: true,
        meta: { requiresAuth: true, requiresModification: true },
      },

      {
        path: "obra/:obraId/pliego", // 👈 sin "/", ahora es /dashboard/obra/:obraId/pliego
        name: "VerPliego",
        component: () => import("../views/PliegoCompletoView.vue"),
        props: true,
        meta: { requiresAuth: true }, // 🔒 también protegido
      },

      {
        path: "obra/:obraId/avance", // 👈 sin "/", anidado en /dashboard
        name: "AddAvanceObra",
        component: AddAvanceObraView,
        props: true,
        meta: { requiresAuth: true, requiresModification: true },
      },

     {
  path: "obra/:obraId/certificaciones/:certId",
  name: "DetalleCertificacion",
  component: () => import("../views/CertificacionDetalleView.vue"),
  props: true,
  meta: { requiresAuth: true }
},

      {
        path: "obra/:obraId/planificacion/:planifId/editar",
        name: "EditarPlanificacion",
        component: AddPlanificacionView,
        props: true,
        meta: { requiresAuth: true, requiresModification: true },
      },

      {
        path: "obra/:obraId/avance/:avanceId/editar",
        name: "EditarAvance",
        component: AddAvanceObraView,
        props: true,
        meta: { requiresAuth: true, requiresModification: true },
      },

    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 🛡️ NAVIGATION GUARD (Seguridad)
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const requiresModify = to.matched.some(record => record.meta.requiresModification);

  const isAuthenticated = authStore.isLoggedIn;
  const canUserModify = authStore.canModify;

  if (requiresAuth && !isAuthenticated) {
    next({ name: "Login" });
  } else if (requiresModify && !canUserModify) {
    const toast = useToast();
    toast.warning("Acceso denegado. Rol de solo lectura.");
    next({ name: "DashboardHome" });
  } else if (to.name === "Login" && isAuthenticated) {
    next({ name: "DashboardHome" });
  } else {
    next();
  }
});

export default router;

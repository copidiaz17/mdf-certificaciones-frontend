// src/main.js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/authStore';
import Toast from 'vue-toastification';
import 'vue-toastification/dist/index.css';
// import './assets/main.css'; // Si usas archivos CSS por defecto
import './assets/css/Dashboard.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(Toast, { timeout: 3000 });

// 🟢 2. CRÍTICO: Inicializar el estado de autenticación ANTES de montar
const authStore = useAuthStore(); 
authStore.initialize(); 

app.mount('#app');
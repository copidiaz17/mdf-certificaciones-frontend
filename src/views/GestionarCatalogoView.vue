<template>
    <div class="panel-content-centered">
        
        <div class="card form-card">
            <h2 class="titulo-pagina">Catálogo de Items Generales</h2>

            <form v-if="authStore.canModify" @submit.prevent="guardarItemGeneral" class="form-grid">
                
                <div class="flex-col-left">
                    <div class="col-md-7">
                        <label class="form-label">Nombre del Item (General):</label>
                        <input type="text" v-model="form.nombre" class="input-control" required placeholder="Ej: Hormigón H-21, Ladrillo Común">
                    </div>

                    <div class="flex-col-rigth">
                        <label class="form-label">Unidad de Medida:</label>
                        <input type="text" v-model="form.unidadMedida" class="input-control" required placeholder="Ej: m3, m2, Kg, Unidad">
                    </div>
                </div>

                <button type="submit" class="btn-primary btn-success mt-3">
                    Guardar Item
                </button>
                
                <p v-if="mensaje" class="alert success mt-2">{{ mensaje }}</p>
                <p v-if="error" class="alert error mt-2">{{ error }}</p>
            </form>
            <p v-else class="alert warning mt-2">Acceso denegado: Solo usuarios con permiso de modificación pueden gestionar el catálogo.</p>
        </div>
        
        <div class="card list-margin-top list-card large-card">
            <h3 class="titulo-pagina" style="font-size: 1.5em; margin-bottom: 10px;">Items Existentes</h3>
            
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nombre del Item</th>
                        <th>Unidad de Medida</th>
                        <th v-if="authStore.canModify">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in itemsGenerales" :key="item.id">
                        <td>{{ item.nombre }}</td>
                        <td>{{ item.unidadMedida }}</td>
                        <td v-if="authStore.canModify">
                            <button class="btn-danger btn-small">Eliminar</button>
                        </td>
                    </tr>
                </tbody>
            </table>
            <p v-if="itemsGenerales.length === 0" class="text-center mt-4 text-muted">No hay ítems en el catálogo general.</p>
        </div>
    </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from '../stores/authStore';

export default {
    name: "GestionarCatalogoView",
    
    setup() {
        const authStore = useAuthStore();
        return { authStore };
    },
    data() {
        return {
            itemsGenerales: [],
            form: {
                nombre: '',
                unidadMedida: '',
            },
            mensaje: '',
            error: '',
        };
    },
    methods: {
        async fetchItemsGeneral() {
            // API CALL: GET /api/catalogo (Necesita ser implementada en el backend)
            try {
                const res = await api.get('/catalogo'); 
                this.itemsGenerales = res.data;
            } catch (err) {
                console.error("Error al cargar el catálogo:", err);
                this.error = "Fallo al cargar el catálogo de ítems.";
            }
        },
        
        async guardarItemGeneral() {
            this.mensaje = '';
            this.error = '';
            
            try {
                // 🛑 API CALL: POST /api/catalogo
                await api.post('/catalogo', this.form);
                
                this.mensaje = `Item '${this.form.nombre}' guardado exitosamente.`;
                this.form = { nombre: '', unidadMedida: '' }; // Limpiar
                await this.fetchItemsGeneral(); // Recargar lista

            } catch (err) {
                const msg = err.response?.data?.message || 'Error al guardar el ítem general.';
                this.error = msg;
                this.mensaje = '';
            }
        },

        // Método de navegación simple para ir al dashboard principal
        goToVerPliego() {
            this.$router.push({ name: 'DashboardHome' });
        }
    },
    mounted() {
        this.fetchItemsGeneral();
    }
};
</script>

<style scoped>
/* Estilos necesarios para la cuadrícula del formulario, si no están en dashboard.css */
.form-grid {
    display: flex;
    flex-direction: column;
    gap: 15px;
}
.form-group-row {
    display: flex;
    gap: 15px;
}
.col-md-7, .col-md-5 {
    flex: 1;
}
</style>
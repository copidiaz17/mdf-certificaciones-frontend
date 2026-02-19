<template>
    <div class="panel-content-centered">
        <div class="card form-card large-card">
            <h1 class="titulo-pagina">Carga de Ítems del Pliego</h1>
            <p class="text-muted mb-4">Obra ID: {{ obraId }}</p>

            <button @click="goToVerPliego" class="btn-primary btn-info action-btn mb-4" style="width: auto;">
                <i class="fas fa-eye"></i> Volver al Pliego de Costos
            </button>

            <form v-if="authStore.canModify" @submit.prevent="guardarItem" class="form-grid">
                
                <div class="form-group-row">
                    <div class="col-md-3">
                        <label class="form-label">Nro. Item:</label>
                        <input type="text" v-model="form.numeroItem" class="input-control" required placeholder="Ej: 01.1">
                    </div>

                    <div class="col-md-7">
                        <label class="form-label">Descripción (Catálogo):</label>
                        <select 
                            @change="handleItemSelection"
                            v-model="form.ItemGeneralId" 
                            class="input-control" 
                            required
                        >
                            <option :value="null" disabled>Seleccione un item</option>
                            <option 
                                v-for="item in itemsGenerales" 
                                :key="item.id" 
                                :value="item.id"
                            >
                                {{ item.nombre }}
                            </option>
                        </select>
                    </div>

                    <div class="col-md-2">
                        <label class="form-label">U. Medida:</label>
                        <input type="text" v-model="form.unidadMedida" class="input-control bg-dark" readonly required>
                    </div>
                </div>

                <div class="form-group-row">
                    <div class="col-md-3">
                        <label class="form-label">Cantidad:</label>
                        <input type="number" v-model.number="form.cantidad" class="input-control" min="0" step="0.001" required>
                    </div>

                    <div class="col-md-4">
                        <label class="form-label">Costo Unitario ($):</label>
                        <input 
                            type="text" 
                            :value="costoUnitarioFocused 
                                ? String(form.costoUnitario).replace('.', ',') 
                                : formatNumber(form.costoUnitario)"
                            @input="form.costoUnitario = parseNumber($event.target.value)"
                            @focus="costoUnitarioFocused = true"
                            @blur="costoUnitarioFocused = false"
                            class="input-control" 
                            required
                        >
                    </div>
                    
                    <div class="col-md-5">
                        <label class="form-label">Costo Parcial ($):</label>
                        <input
                            type="text"
                            v-model="costoParcialStr"
                            @input="costoParcialManual = true"
                            class="input-control"
                            required
                        >
                    </div>
                </div>
                
                <button type="submit" class="btn-primary btn-success mt-3">
                    {{ editMode ? "Actualizar Item" : "Guardar Item al Pliego" }}
                </button>
                
                <p v-if="mensaje" class="alert success mt-2">{{ mensaje }}</p>
                <p v-if="error" class="alert error mt-2">{{ error }}</p>
            </form>

            <p v-else class="alert error mt-2">Acceso denegado. Solo usuarios con permiso de modificación pueden editar el pliego.</p>
        </div>
        
        <div v-if="itemsPliego.length" class="card list-margin-top list-card large-card">
            <h3 class="titulo-pagina" style="font-size: 1.5em; margin-bottom: 10px;">Items Cargados</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th class="col-num">N°</th>
                        <th>Descripción</th>
                        <th>U. Medida</th>
                        <th>Cant.</th>
                        <th>Costo Unitario</th>
                        <th class="col-parcial">Costo Parcial</th>
                        <th v-if="authStore.canModify">Acciones</th>
                    </tr>
                </thead>

                <tbody>
                    <tr v-for="item in itemsPliego" :key="item.id">
                        <td>{{ item.numeroItem }}</td>
                        <td>{{ item.ItemGeneral?.nombre || item.descripcionItem }}</td>
                        <td>{{ item.ItemGeneral?.unidadMedida || item.unidadMedida }}</td>
                        <td>{{ item.cantidad }}</td>
                        <td>${{ formatNumber(item.costoUnitario) }}</td>
                        <td>${{ formatNumber(item.costoParcial) }}</td>
                        <td v-if="authStore.canModify">
                            <button class="btn-small btn-warning" @click.prevent="editarItem(item)">Editar</button>
                            <button class="btn-danger btn-small" @click.prevent="eliminarItem(item)">X</button>
                        </td>
                    </tr>

                    <!-- 🟢 FILAS AUTOMÁTICAS DE RESUMEN -->
                    <tr class="resumen-row">
                        <td colspan="5"><strong>Costo Total</strong></td>
                        <td><strong>${{ formatNumber(costoTotal) }}</strong></td>
                        <td v-if="authStore.canModify"></td>
                    </tr>

                    <tr class="resumen-row">
                        <td colspan="5">Gastos Generales (10%)</td>
                        <td>${{ formatNumber(gastosGenerales) }}</td>
                        <td v-if="authStore.canModify"></td>
                    </tr>

                    <tr class="resumen-row">
                        <td colspan="5"><strong>Subtotal 1</strong></td>
                        <td><strong>${{ formatNumber(subtotal1) }}</strong></td>
                        <td v-if="authStore.canModify"></td>
                    </tr>

                    <tr class="resumen-row">
                        <td colspan="5">Beneficio (10%)</td>
                        <td>${{ formatNumber(beneficio) }}</td>
                        <td v-if="authStore.canModify"></td>
                    </tr>

                    <tr class="resumen-row">
                        <td colspan="5"><strong>Subtotal 2</strong></td>
                        <td><strong>${{ formatNumber(subtotal2) }}</strong></td>
                        <td v-if="authStore.canModify"></td>
                    </tr>

                    <tr class="resumen-row">
                        <td colspan="5">IVA (21%)</td>
                        <td>${{ formatNumber(iva) }}</td>
                        <td v-if="authStore.canModify"></td>
                    </tr>

                    <tr class="resumen-row">
                        <td colspan="5">Ingresos Brutos (2.5%)</td>
                        <td>${{ formatNumber(ingresosBrutos) }}</td>
                        <td v-if="authStore.canModify"></td>
                    </tr>

                    <tr class="resumen-final-row">
                        <td colspan="5"><strong>PRECIO TOTAL DE OBRA</strong></td>
                        <td><strong>${{ formatNumber(precioTotalObra) }}</strong></td>
                        <td v-if="authStore.canModify"></td>
                    </tr>

                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from '../stores/authStore';
import { useToast } from "vue-toastification";


export default {
    name: "CargarPliegoView",
    props: {
        obraId: { type: [String, Number], required: true }
    },
    setup() {
        const authStore = useAuthStore();
        const toast = useToast();
        return { authStore, toast };
    },
    data() {
        return {
            itemsPliego: [],
            itemsGenerales: [],
            editMode: false,
            editId: null,
            form: {
                numeroItem: '',
                descripcionItem: '',
                unidadMedida: '',
                cantidad: 0,
                costoUnitario: 0,
                costoParcial: 0,
                ItemGeneralId: null
            },
            mensaje: '',
            error: '',
            costoUnitarioFocused: false,
            costoParcialStr: '',
            costoParcialManual: false
        };
    },

    watch: {
        'form.cantidad'(val) {
            if (!this.costoParcialManual) {
                const cantidad = parseFloat(val) || 0;
                const unitario = parseFloat(this.form.costoUnitario) || 0;
                this.costoParcialStr = this.formatNumber(parseFloat((cantidad * unitario).toFixed(2)));
            }
        },
        'form.costoUnitario'(val) {
            if (!this.costoParcialManual) {
                const cantidad = parseFloat(this.form.cantidad) || 0;
                const unitario = parseFloat(val) || 0;
                this.costoParcialStr = this.formatNumber(parseFloat((cantidad * unitario).toFixed(2)));
            }
        }
    },

    computed: {
        costoTotal() {
            return this.itemsPliego.reduce((sum, item) => sum + Number(item.costoParcial || 0), 0);
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
        ingresosBrutos() {
            return this.subtotal2 * 0.025;
        },
        precioTotalObra() {
            return this.subtotal2 + this.iva + this.ingresosBrutos;
        }
    },

    methods: {
        parseNumber(value) {
            if (!value) return 0;
            let cleaned = String(value).replace(/\./g, '');
            cleaned = cleaned.replace(',', '.');
            return parseFloat(cleaned) || 0;
        },

        formatNumber(value) {
            if (value === null || value === undefined || isNaN(value)) return '';
            return new Intl.NumberFormat('es-AR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value);
        },

        async fetchItemsGeneral() {
            try {
                const res = await api.get('/catalogo');
                this.itemsGenerales = res.data;
            } catch (err) {
                console.error("Error al cargar el catálogo:", err);
            }
        },
        
        async fetchItemsPliego() {
            try {
                const res = await api.get(`/obras/${this.obraId}/pliego`);
                // asegurar orden numérico en frontend como fallback
                this.itemsPliego = res.data.sort((a, b) => {
                    const na = Number(a.numeroItem);
                    const nb = Number(b.numeroItem);
                    if (isNaN(na) || isNaN(nb)) return String(a.numeroItem).localeCompare(String(b.numeroItem));
                    return na - nb;
                });
            } catch (err) {
                console.error("Error al cargar pliego:", err);
            }
        },

        handleItemSelection() {
            const selectedItem = this.itemsGenerales.find(
                item => item.id === this.form.ItemGeneralId
            );

            if (selectedItem) {
                this.form.descripcionItem = selectedItem.nombre;
                this.form.unidadMedida = selectedItem.unidadMedida;
            } else {
                this.form.descripcionItem = '';
                this.form.unidadMedida = '';
            }
        },

        editarItem(item) {
            this.editMode = true;
            this.editId = item.id;

            // Precargar el formulario con los valores del item
            this.form.numeroItem = item.numeroItem;
            // si ItemGeneral está incluido, setear ItemGeneralId si corresponde
            this.form.ItemGeneralId = item.ItemGeneralId || null;
            this.form.descripcionItem = item.ItemGeneral?.nombre || item.descripcionItem || '';
            this.form.unidadMedida = item.ItemGeneral?.unidadMedida || item.unidadMedida || '';
            this.form.cantidad = Number(item.cantidad) || 0;
            this.form.costoUnitario = Number(item.costoUnitario) || 0;
            this.form.costoParcial = Number(item.costoParcial) || 0;
            this.costoParcialStr = this.formatNumber(Number(item.costoParcial) || 0);
            this.costoParcialManual = true;

            // foco en el input costo unitario para visual
            this.costoUnitarioFocused = true;
            setTimeout(() => this.costoUnitarioFocused = false, 800);
        },

        async eliminarItem(item) {
            if (!confirm('Confirmar eliminación del ítem?')) return;
            try {
                await api.delete(`/obras/${this.obraId}/pliego-item/${item.id}`);
                await this.fetchItemsPliego();
            } catch (err) {
                console.error('Error eliminando item:', err);
                this.toast.error('Error eliminando ítem');
            }
        },

        async guardarItem() {
            this.mensaje = '';
            this.error = '';

            if (!this.form.ItemGeneralId) {
                this.error = "Seleccione un ítem del catálogo.";
                return;
            }

            if (!this.form.descripcionItem || !this.form.unidadMedida) {
                this.error = "Debe seleccionar un ítem válido.";
                return;
            }

            const dataToSave = {
                numeroItem: this.form.numeroItem,
                descripcionItem: this.form.descripcionItem,
                unidadMedida: this.form.unidadMedida,
                cantidad: this.form.cantidad,
                costoUnitario: this.form.costoUnitario,
                costoParcial: this.parseNumber(this.costoParcialStr),
                ItemGeneralId: this.form.ItemGeneralId ? parseInt(this.form.ItemGeneralId) : null
            };

            try {
                if (this.editMode && this.editId) {
                    await api.put(`/obras/${this.obraId}/pliego-item/${this.editId}`, dataToSave);
                    this.mensaje = 'Item actualizado correctamente.';
                } else {
                    await api.post(`/obras/${this.obraId}/pliego-item`, dataToSave);
                    this.mensaje = 'Item guardado exitosamente.';
                }

                // reset
                this.editMode = false;
                this.editId = null;
                this.form = { numeroItem: '', descripcionItem: '', unidadMedida: '', cantidad: 0, costoUnitario: 0, costoParcial: 0, ItemGeneralId: null };
                this.costoParcialStr = '';
                this.costoParcialManual = false;

                await this.fetchItemsPliego();

            } catch (err) {
                console.error('Error guardando item:', err);
                const msg = err.response?.data?.message || 'Error al guardar el ítem de pliego.';
                this.error = msg;
            }
        },

        goToVerPliego() {
            this.$router.push({ name: 'ObraDetalle', params: { obraId: this.obraId } });
        }
    },

    mounted() {
        this.fetchItemsPliego();
        this.fetchItemsGeneral();
    }
};
</script>

<style scoped>
/* Estilos adicionales para que el campo de unidad readonly se vea distinto */
.bg-dark {
    background-color: #22224E !important;
    color: #ABABAB !important;
    font-weight: bold;
}
.large-card {
    max-width: 800px; 
}
/* Estilos para el layout de la cuadrícula, si no están en dashboard.css */
.form-grid {
    display: flex;
    flex-direction: column;
    gap: 20px; 
}
.form-group-row {
    display: flex;
    gap: 20px; 
    width: 100%;
}
.col-md-2, .col-md-3, .col-md-4, .col-md-5, .col-md-7 {
    flex: 1;
}
.data-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
}
.data-table th, .data-table td {
    padding: 8px;
    border: 1px solid #444;
}

/* 🟢 Estilos para los botones pequeños */
.btn-small {
    padding: 4px 8px;
    margin-right: 6px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
}
.btn-warning { background: #f0ad4e; color: #fff; }
.btn-danger { background: #d9534f; color: #fff; }

/* 🟢 Estilos para los totales */
.resumen-row td {
    background: #222;
    color: #fff;
    font-weight: bold;
}

.resumen-final-row td {
    background: #22224E;
    color: #ABABAB;
    font-size: 1.1em;
    font-weight: bold;
}

/* Ajustes responsivos */
@media (max-width: 700px) {
    .form-group-row { flex-direction: column; }
    .col-md-2, .col-md-3, .col-md-4, .col-md-5, .col-md-7 { width: 100%; }
}
</style>

<template>
  <div class="informes-view">
    <h2 class="titulo">Informes de avance de obra</h2>
    <p class="subtitulo" v-if="obra.nombre">{{ obra.nombre }}</p>

    <!-- ── Armar uno nuevo ────────────────────────────────────────────── -->
    <div class="panel" v-if="authStore.canModify">
      <h3>Nuevo informe</h3>

      <div class="fila">
        <div class="campo">
          <label>Desde</label>
          <input type="date" v-model="form.fecha_desde" min="2000-01-01" max="2099-12-31" />
        </div>
        <div class="campo">
          <label>Hasta</label>
          <input type="date" v-model="form.fecha_hasta" min="2000-01-01" max="2099-12-31" />
        </div>
        <div class="campo campo-botones">
          <button class="btn-ver" :disabled="!rangoValido || cargando" @click="previsualizar">
            {{ cargando ? "Calculando…" : "Ver qué se ejecutó" }}
          </button>
        </div>
      </div>

      <div class="fila" v-if="atajos.length">
        <span class="atajos-et">Rápido:</span>
        <button v-for="a in atajos" :key="a.nombre" class="atajo" @click="usarAtajo(a)">
          {{ a.nombre }}
        </button>
      </div>

      <!-- ── Lo que se ejecutó, antes de guardar ─────────────────────── -->
      <div v-if="vista" class="previa">
        <div class="cifras">
          <div class="cifra">
            <span class="et">Avance del período</span>
            <strong>{{ pct(vista.totales.avance_periodo_porcentaje) }}</strong>
            <span class="pie">{{ money(vista.totales.ejecutado_periodo_importe) }}</span>
          </div>
          <div class="cifra">
            <span class="et">Acumulado a la fecha</span>
            <strong>{{ pct(vista.totales.avance_acumulado_porcentaje) }}</strong>
            <span class="pie">{{ money(vista.totales.ejecutado_acumulado_importe) }}</span>
          </div>
          <div class="cifra">
            <span class="et">Ítems con movimiento</span>
            <strong>{{ vista.totales.items_con_movimiento }}</strong>
            <span class="pie">de {{ vista.totales.items_del_pliego }} del pliego</span>
          </div>
          <div class="cifra" :class="{ alerta: vista.totales.items_con_excedente > 0 }">
            <span class="et">Con excedente</span>
            <strong>{{ vista.totales.items_con_excedente }}</strong>
            <span class="pie">ejecutado sobre el pliego</span>
          </div>
        </div>

        <p v-if="!vista.items.length" class="vacio">
          No hay avances cargados en ese período. El informe se puede guardar
          igual: «este mes no se hizo nada» también es algo que hay que poder
          mostrar.
        </p>

        <div v-else class="tabla-scroll">
          <table class="tabla">
            <thead>
              <tr>
                <th>Ítem</th>
                <th>Descripción</th>
                <th class="num">Del período</th>
                <th class="num">%</th>
                <th class="num">Acumulado</th>
                <th class="num">% acum.</th>
                <th class="num">Excedente</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in vista.items" :key="i.pliego_item_id">
                <td class="nro">
                  {{ i.numero }}
                  <span v-if="i.origen !== 'original'" class="etq">{{ i.origen }}</span>
                </td>
                <td>{{ i.descripcion }}</td>
                <td class="num">{{ cantidad(i.cantidad_periodo) }} <small>{{ i.unidad }}</small></td>
                <td class="num">{{ pct(i.porcentaje_periodo) }}</td>
                <td class="num">{{ cantidad(i.cantidad_acumulada) }} <small>de {{ cantidad(i.cantidad_pliego) }}</small></td>
                <td class="num">{{ pct(i.porcentaje_acumulado) }}</td>
                <td class="num">
                  <span v-if="i.excedente > 0" class="exc">+{{ cantidad(i.excedente) }} {{ i.unidad }}</span>
                  <span v-else class="sin">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="campo">
          <label>Título <small>(opcional)</small></label>
          <input type="text" v-model="form.titulo" placeholder="Avance de marzo" />
        </div>

        <div class="campo">
          <label>Observaciones</label>
          <textarea
            v-model="form.observaciones" rows="3"
            placeholder="Qué frentes se abrieron, qué está trabado, por qué se atrasó…"
          ></textarea>
          <small class="ayuda">
            Es la parte que ningún cálculo puede producir, y la primera que se
            lee. Los números ya están arriba.
          </small>
        </div>

        <button class="btn-guardar" :disabled="guardando" @click="guardar">
          {{ guardando ? "Guardando…" : "Guardar informe" }}
        </button>
        <p class="nota">{{ vista.nota }}</p>
      </div>
    </div>

    <!-- ── Los ya emitidos ────────────────────────────────────────────── -->
    <div class="panel">
      <h3>Informes emitidos</h3>

      <p v-if="cargandoLista" class="vacio">Cargando…</p>
      <p v-else-if="!informes.length" class="vacio">Todavía no se emitió ninguno.</p>

      <div v-else class="lista">
        <div v-for="inf in informes" :key="inf.id" class="emitido">
          <div class="emitido-datos">
            <div class="emitido-titulo">
              {{ inf.titulo || "Informe de avance" }}
              <span class="emitido-rango">{{ fecha(inf.fecha_desde) }} → {{ fecha(inf.fecha_hasta) }}</span>
            </div>
            <div class="emitido-pie">
              Emitido el {{ fecha(inf.fecha_informe) }}
              <template v-if="inf.autor"> · {{ inf.autor.nombre }}</template>
            </div>
            <p v-if="inf.observaciones" class="emitido-obs">{{ inf.observaciones }}</p>
          </div>
          <div class="emitido-acciones">
            <button class="btn-ver-chico" @click="abrir(inf.id)">Ver</button>
            <button v-if="authStore.esAdmin" class="btn-borrar" @click="borrar(inf)">Borrar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Un informe guardado ────────────────────────────────────────── -->
    <div class="panel" v-if="abierto">
      <h3>
        {{ abierto.titulo || "Informe de avance" }}
        <span class="congelado">tal como se emitió</span>
      </h3>
      <p class="subtitulo">
        {{ fecha(abierto.fecha_desde) }} → {{ fecha(abierto.fecha_hasta) }}
        · emitido el {{ fecha(abierto.fecha_informe) }}
        <template v-if="abierto.autor"> por {{ abierto.autor.nombre }}</template>
      </p>

      <p v-if="abierto.error" class="vacio">{{ abierto.error }}</p>

      <template v-else-if="abierto.datos">
        <div class="cifras">
          <div class="cifra">
            <span class="et">Avance del período</span>
            <strong>{{ pct(abierto.datos.totales.avance_periodo_porcentaje) }}</strong>
            <span class="pie">{{ money(abierto.datos.totales.ejecutado_periodo_importe) }}</span>
          </div>
          <div class="cifra">
            <span class="et">Acumulado</span>
            <strong>{{ pct(abierto.datos.totales.avance_acumulado_porcentaje) }}</strong>
            <span class="pie">{{ money(abierto.datos.totales.ejecutado_acumulado_importe) }}</span>
          </div>
        </div>

        <p v-if="abierto.observaciones" class="obs-grande">{{ abierto.observaciones }}</p>

        <div class="tabla-scroll" v-if="abierto.datos.items.length">
          <table class="tabla">
            <thead>
              <tr>
                <th>Ítem</th><th>Descripción</th>
                <th class="num">Del período</th><th class="num">%</th>
                <th class="num">% acum.</th><th class="num">Excedente</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in abierto.datos.items" :key="i.pliego_item_id">
                <td class="nro">{{ i.numero }}</td>
                <td>{{ i.descripcion }}</td>
                <td class="num">{{ cantidad(i.cantidad_periodo) }} <small>{{ i.unidad }}</small></td>
                <td class="num">{{ pct(i.porcentaje_periodo) }}</td>
                <td class="num">{{ pct(i.porcentaje_acumulado) }}</td>
                <td class="num">
                  <span v-if="i.excedente > 0" class="exc">+{{ cantidad(i.excedente) }} {{ i.unidad }}</span>
                  <span v-else class="sin">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="vacio">No hubo avances cargados en ese período.</p>
      </template>
    </div>

    <button class="btn-volver" @click="$router.back()">Volver</button>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useAuthStore } from "../stores/authStore";
import { useToast } from "vue-toastification";

// Los rangos que se piden de verdad: el mes pasado y el actual. Escribir dos
// fechas a mano cada vez, para lo que el 90% de las veces es "marzo", es la
// clase de fricción que hace que un informe no se emita.
function rangoDeMes(desplazamiento) {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth() + desplazamiento, 1);
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const f = (x) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return { nombre: MESES[d.getMonth()], desde: f(d), hasta: f(fin) };
}

export default {
  name: "InformesAvanceView",
  props: { obraId: { type: [String, Number], required: true } },

  setup() {
    return { authStore: useAuthStore(), toast: useToast() };
  },

  data() {
    return {
      obra: {},
      form: { fecha_desde: "", fecha_hasta: "", titulo: "", observaciones: "" },
      vista: null,
      informes: [],
      abierto: null,
      cargando: false,
      guardando: false,
      cargandoLista: true,
      atajos: [rangoDeMes(0), rangoDeMes(-1)],
    };
  },

  computed: {
    rangoValido() {
      const { fecha_desde: d, fecha_hasta: h } = this.form;
      return Boolean(d && h && d <= h);
    },
  },

  mounted() {
    this.usarAtajo(this.atajos[0]);
    this.traerObra();
    this.traerInformes();
  },

  methods: {
    usarAtajo(a) {
      this.form.fecha_desde = a.desde;
      this.form.fecha_hasta = a.hasta;
      this.vista = null;
    },

    async traerObra() {
      try {
        const { data } = await api.get(`/obras/${this.obraId}`);
        this.obra = data;
      } catch { /* el nombre es decorativo: sin él la pantalla sirve igual */ }
    },

    async traerInformes() {
      this.cargandoLista = true;
      try {
        const { data } = await api.get(`/obras/${this.obraId}/informes-avance`);
        this.informes = Array.isArray(data) ? data : [];
      } catch (e) {
        this.toast.error(e?.response?.data?.message || "No se pudieron traer los informes");
      } finally {
        this.cargandoLista = false;
      }
    },

    async previsualizar() {
      this.cargando = true;
      this.vista = null;
      try {
        const { data } = await api.post(
          `/obras/${this.obraId}/informes-avance/previsualizar`,
          { fecha_desde: this.form.fecha_desde, fecha_hasta: this.form.fecha_hasta }
        );
        this.vista = data.informe;
      } catch (e) {
        this.toast.error(e?.response?.data?.error || "No se pudo armar el informe");
      } finally {
        this.cargando = false;
      }
    },

    async guardar() {
      this.guardando = true;
      try {
        const { data } = await api.post(`/obras/${this.obraId}/informes-avance`, {
          fecha_desde: this.form.fecha_desde,
          fecha_hasta: this.form.fecha_hasta,
          titulo: this.form.titulo,
          observaciones: this.form.observaciones,
        });
        this.toast.success(data.message || "Informe guardado");
        this.form.titulo = "";
        this.form.observaciones = "";
        this.vista = null;
        await this.traerInformes();
      } catch (e) {
        this.toast.error(e?.response?.data?.error || "No se pudo guardar el informe");
      } finally {
        this.guardando = false;
      }
    },

    async abrir(id) {
      try {
        const { data } = await api.get(`/obras/${this.obraId}/informes-avance/${id}`);
        this.abierto = data;
      } catch (e) {
        this.toast.error(e?.response?.data?.message || "No se pudo abrir el informe");
      }
    },

    async borrar(inf) {
      const ok = confirm(
        `¿Borrar el informe del ${this.fecha(inf.fecha_desde)} al ${this.fecha(inf.fecha_hasta)}?\n\n` +
        "Se pierde la foto de cómo estaba la obra ese día, y esa foto no se " +
        "puede reconstruir: un informe nuevo del mismo rango va a dar otros " +
        "números si desde entonces se cargó algo."
      );
      if (!ok) return;
      try {
        await api.delete(`/obras/${this.obraId}/informes-avance/${inf.id}`);
        if (this.abierto?.id === inf.id) this.abierto = null;
        await this.traerInformes();
      } catch (e) {
        this.toast.error(e?.response?.data?.message || "No se pudo borrar");
      }
    },

    pct(v) {
      return Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
    },
    money(v) {
      return "$ " + Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    // Las cantidades de obra no son plata: 0,5 m3 se escribe "0,5", no "0,50".
    cantidad(v) {
      return Number(v || 0).toLocaleString("es-AR", { maximumFractionDigits: 5 });
    },
    fecha(f) {
      if (!f) return "—";
      const [a, m, d] = String(f).slice(0, 10).split("-");
      return `${d}/${m}/${a}`;
    },
  },
};
</script>

<style scoped>
.informes-view { padding: 16px; display: flex; flex-direction: column; gap: 18px; }
.titulo { margin: 0; }
.subtitulo { margin: 0; opacity: 0.75; }

.panel {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 10px;
  padding: 16px;
}
.panel h3 { margin: 0 0 12px; }

.fila { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 12px; }
.campo { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 180px; }
.campo-botones { flex: none; }
.campo label { font-size: 0.85rem; font-weight: 600; }
.campo input, .campo textarea {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.35);
  color: inherit;
  font: inherit;
}
.ayuda { font-size: 0.8rem; opacity: 0.7; line-height: 1.5; }

.atajos-et { font-size: 0.85rem; opacity: 0.7; align-self: center; }
.atajo {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-transform: capitalize;
}
.atajo:hover { border-color: #60a5fa; }

.btn-ver, .btn-guardar {
  padding: 9px 18px; border: none; border-radius: 8px;
  font-weight: 700; cursor: pointer; background: #1d4ed8; color: #eff6ff;
}
.btn-guardar { background: #15803d; color: #f0fdf4; margin-top: 10px; }
.btn-ver:disabled, .btn-guardar:disabled { opacity: 0.5; cursor: not-allowed; }

.previa { margin-top: 16px; border-top: 1px solid rgba(148, 163, 184, 0.25); padding-top: 16px; }

.cifras {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.cifra {
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 8px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 2px;
}
.cifra .et { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.cifra strong { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
.cifra .pie { font-size: 0.76rem; opacity: 0.7; }
.cifra.alerta { border-color: #ca8a04; }

.tabla-scroll { overflow-x: auto; margin-bottom: 14px; }
.tabla { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.tabla th {
  text-align: left; font-size: 0.72rem; text-transform: uppercase;
  letter-spacing: 0.04em; opacity: 0.7; padding: 6px 10px 8px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.3);
}
.tabla td { padding: 8px 10px 8px 0; border-bottom: 1px solid rgba(148, 163, 184, 0.15); }
.tabla .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tabla small { opacity: 0.6; }
.nro { font-weight: 600; white-space: nowrap; }
.etq {
  margin-left: 5px; font-size: 0.62rem; text-transform: uppercase;
  background: #ca8a04; color: #fefce8; border-radius: 999px; padding: 1px 6px;
}
.exc { color: #ca8a04; font-weight: 700; }
.sin { opacity: 0.4; }

.vacio { opacity: 0.7; line-height: 1.55; margin: 0; }
.nota { font-size: 0.8rem; opacity: 0.65; line-height: 1.55; margin: 12px 0 0; }

.lista { display: flex; flex-direction: column; gap: 10px; }
.emitido {
  display: flex; justify-content: space-between; gap: 12px; align-items: flex-start;
  border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 8px; padding: 10px 12px;
}
.emitido-titulo { font-weight: 700; }
.emitido-rango { font-weight: 400; opacity: 0.7; margin-left: 8px; font-size: 0.88rem; }
.emitido-pie { font-size: 0.8rem; opacity: 0.65; margin-top: 2px; }
.emitido-obs { margin: 6px 0 0; font-size: 0.88rem; line-height: 1.5; opacity: 0.85; }
.emitido-acciones { display: flex; gap: 6px; flex: none; }

.btn-ver-chico, .btn-borrar, .btn-volver {
  padding: 6px 14px; border: none; border-radius: 999px;
  font-size: 0.85rem; font-weight: 700; cursor: pointer;
}
.btn-ver-chico { background: #1d4ed8; color: #eff6ff; }
.btn-borrar { background: #b91c1c; color: #fef2f2; }
.btn-volver { background: #475569; color: #f8fafc; align-self: flex-start; padding: 8px 20px; }

.congelado {
  margin-left: 10px; font-size: 0.7rem; text-transform: uppercase;
  letter-spacing: 0.06em; background: rgba(148, 163, 184, 0.25);
  border-radius: 999px; padding: 2px 10px; vertical-align: middle;
}
.obs-grande {
  border-left: 3px solid rgba(148, 163, 184, 0.5);
  padding-left: 12px; margin: 0 0 14px; line-height: 1.6;
}
</style>

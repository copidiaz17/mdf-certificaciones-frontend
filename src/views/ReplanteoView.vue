<template>
  <div class="replanteo-view">
    <header class="cabecera">
      <div>
        <p class="eyebrow">{{ ctx?.obra?.nombre || "Obra" }}</p>
        <h2 class="titulo">
          {{ editando ? `Replanteo ${version}` : `Nuevo replanteo · versión ${ctx?.proxima_version || ""}` }}
          <span v-if="editando && !editable" class="chip chip-historia">historia</span>
        </h2>
        <p class="bajada">
          Un replanteo es el nuevo plan de trabajos desde el último avance cargado. Lo ejecutado hasta
          ahí no se toca: se reparte lo que le falta a cada ítem en los meses que vienen.
        </p>
      </div>
      <button class="btn-sec" @click="volver">← Volver a la planificación</button>
    </header>

    <div v-if="cargando" class="estado">Cargando…</div>
    <div v-else-if="errorCarga" class="mensaje-error">{{ errorCarga }}</div>

    <template v-else>
      <div v-if="editando && !editable" class="aviso-historia">
        Este replanteo ya no es el vigente: hay uno posterior. Queda como historia de lo que se
        prometió y no se puede modificar.
      </div>

      <!-- Un replanteo parte de lo ya ejecutado: sin el avance cargado, el
           corte queda en un mes viejo y lo que falta se reparte mal. -->
      <div v-if="ctx.bloqueo" class="panel-bloqueo">
        <div>
          <strong>Falta cargar el avance de obra</strong>
          <p>{{ ctx.bloqueo }}</p>
        </div>
        <button class="btn-ir" @click="$router.push({ name: 'AddAvanceObra', params: { obraId } })">
          Cargar avance de obra
        </button>
      </div>

      <div v-else-if="ctx.al_dia && !ctx.al_dia.certificacion_al_dia" class="panel-aviso">
        <strong>La certificación no está al día.</strong>
        <span v-if="ctx.al_dia.ultimo_certificado">
          El último certificado llega al {{ fecha(ctx.al_dia.ultimo_certificado) }} y debería llegar
          al {{ fecha(ctx.al_dia.mes_exigido) }}.
        </span>
        <span v-else>Todavía no hay certificados registrados en esta obra.</span>
        Se puede replantear igual, pero la curva de certificación va a quedar corta contra la nueva.
      </div>

      <!-- Resumen superior -->
      <section class="tarjetas">
        <div class="tarjeta">
          <span class="t-label">Avance real al corte</span>
          <template v-if="ctx.fecha_corte">
            <span class="t-valor">{{ pct(avanceBase) }}</span>
            <span class="t-sub">hasta el {{ fecha(ctx.fecha_corte) }}</span>
          </template>
          <template v-else>
            <input type="date" v-model="corteManual" class="input" :disabled="editando" />
            <span class="t-sub">No hay avances cargados: indicá desde cuándo rige.</span>
          </template>
        </div>

        <div class="tarjeta">
          <label class="t-label" for="motivo">Motivo</label>
          <select id="motivo" v-model="motivo" class="input" :disabled="soloLectura">
            <option value="tiempo">Extensión de plazo</option>
            <option value="adicional_item">Ítems adicionales</option>
            <option value="ambos">Extensión de plazo + adicionales</option>
          </select>
        </div>

        <div class="tarjeta">
          <label class="t-label" for="hasta">Meses del replanteo</label>
          <div class="rango">
            <span class="rango-desde">{{ meses[0]?.etiqueta || "—" }}</span>
            <span>→</span>
            <input id="hasta" type="month" v-model="mesHasta" :min="primerMes" class="input input-mes" :disabled="soloLectura" />
          </div>
          <span class="t-sub">{{ meses.length }} {{ meses.length === 1 ? "mes" : "meses" }}</span>
        </div>

        <div class="tarjeta">
          <span class="t-label">Presupuesto</span>
          <span class="t-valor">${{ monto(presupuestoNuevo) }}</span>
          <span v-if="totalAdicionales > 0" class="t-sub t-mas">
            +${{ monto(totalAdicionales) }} en adicionales (+{{ incrementoPresupuesto }}%)
          </span>
          <span v-else class="t-sub">sin cambios</span>
        </div>
      </section>

      <!-- Adicionales -->
      <section v-if="admiteAdicionales && !soloLectura" class="panel-adicionales">
        <h3>Ítems adicionales</h3>
        <p class="panel-texto">
          Entran al pliego al guardar el replanteo, y solo si se guarda: si algo falla, no queda nada a medias.
          Al sumar presupuesto, el porcentaje de avance de toda la obra baja proporcionalmente; lo cobrado en pesos no cambia.
        </p>
        <div class="fila-form">
          <input v-model="nuevo.numeroItem" class="input w-num" placeholder="N° (opcional)" />
          <input v-model="nuevo.descripcionItem" class="input w-desc" placeholder="Descripción *" />
          <input v-model="nuevo.unidadMedida" class="input w-uni" placeholder="Unidad" />
          <input v-model.number="nuevo.cantidad" type="number" min="0" step="0.01" class="input w-num" placeholder="Cantidad *" />
          <input v-model.number="nuevo.costoUnitario" type="number" min="0" step="0.01" class="input w-costo" placeholder="Costo unitario *" />
          <button class="btn-agregar" @click="agregarAdicional">+ Agregar</button>
        </div>
        <p v-if="errorAdicional" class="error-linea">{{ errorAdicional }}</p>
      </section>

      <!-- Barra de herramientas -->
      <div class="herramientas">
        <input v-model="busqueda" class="input buscador" placeholder="Buscar ítem por número o descripción" />
        <label class="toggle">
          <input type="checkbox" v-model="soloConSaldo" />
          Solo ítems con algo por ejecutar
        </label>
        <span class="contador">{{ filasVisibles.length }} de {{ filas.length }} ítems</span>
      </div>

      <!-- Grilla -->
      <div class="grilla-wrap">
        <table class="grilla">
          <thead>
            <tr>
              <th class="col-fija col-num">Ítem</th>
              <th class="col-fija col-desc">Descripción</th>
              <th class="col-dato" title="Porcentaje ejecutado al corte">Real</th>
              <th class="col-dato" title="Lo que le falta ejecutar">Falta</th>
              <th v-for="m in meses" :key="m.clave" class="col-mes">{{ m.etiqueta }}</th>
              <th class="col-dato">Plan.</th>
              <th class="col-dato">Queda</th>
              <th v-if="!soloLectura" class="col-accion"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in filasVisibles" :key="f.clave" :class="claseFila(f)">
              <td class="col-fija col-num">{{ f.numeroItem }}</td>
              <td class="col-fija col-desc" :title="f.descripcionItem">
                {{ f.descripcionItem }}
                <span v-if="f.esNuevo" class="chip chip-nuevo">nuevo</span>
                <span v-else-if="f.origen === 'adicional'" class="chip chip-adicional">adicional</span>
                <button v-if="f.esNuevo && !soloLectura" class="quitar" title="Quitar adicional" @click="quitarAdicional(f.clave)">✕</button>
              </td>
              <td class="col-dato">{{ num(f.avance_real) }}</td>
              <td class="col-dato">{{ num(f.disponible) }}</td>
              <td v-for="m in meses" :key="m.clave" class="col-mes">
                <input
                  type="number" min="0" max="100" step="0.01"
                  class="celda"
                  :class="{ 'celda-llena': Number(valores[f.clave]?.[m.clave]) > 0 }"
                  :value="valores[f.clave]?.[m.clave] ?? ''"
                  :disabled="soloLectura || f.disponible <= 0"
                  @input="setValor(f.clave, m.clave, $event.target.value)"
                />
              </td>
              <td class="col-dato col-plan">{{ num(planificadoDe(f)) }}</td>
              <td class="col-dato col-queda">{{ num(quedaDe(f)) }}</td>
              <td v-if="!soloLectura" class="col-accion">
                <button
                  v-if="quedaDe(f) > 0.009 && meses.length"
                  class="btn-mini"
                  title="Reparte lo que queda en partes iguales entre los meses"
                  @click="repartir(f)"
                >Repartir</button>
              </td>
            </tr>
            <tr v-if="!filasVisibles.length">
              <td :colspan="columnas" class="vacio">
                {{ filas.length ? "Ningún ítem coincide con el filtro." : "La obra no tiene ítems en el pliego." }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td class="col-fija col-num"></td>
              <td class="col-fija col-desc pie-label">Incidencia en la obra</td>
              <td class="col-dato"></td>
              <td class="col-dato"></td>
              <td v-for="m in meses" :key="m.clave" class="col-mes pie-valor">{{ num(incidenciaMes[m.clave]) }}</td>
              <td class="col-dato pie-valor">{{ num(totalPlanificadoObra) }}</td>
              <td class="col-dato"></td>
              <td v-if="!soloLectura" class="col-accion"></td>
            </tr>
            <tr>
              <td class="col-fija col-num"></td>
              <td class="col-fija col-desc pie-label">Avance de la obra acumulado</td>
              <td class="col-dato pie-valor">{{ num(avanceBase) }}</td>
              <td class="col-dato"></td>
              <td v-for="m in meses" :key="m.clave" class="col-mes pie-acum">{{ num(acumuladoMes[m.clave]) }}</td>
              <td class="col-dato"></td>
              <td class="col-dato"></td>
              <td v-if="!soloLectura" class="col-accion"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Cierre -->
      <section class="cierre" :class="claseCierre">
        <div class="cierre-texto">
          <strong>Al terminar el replanteo la obra llega al {{ pct(finalObra) }}.</strong>
          <span v-if="itemsExcedidos.length" class="linea-error">
            {{ itemsExcedidos.length }} {{ itemsExcedidos.length === 1 ? "ítem tiene" : "ítems tienen" }}
            más planificado que lo que les falta ejecutar: {{ itemsExcedidos.slice(0, 5).map((f) => f.numeroItem).join(", ") }}{{ itemsExcedidos.length > 5 ? "…" : "" }}
          </span>
          <span v-else-if="finalObra < 99.9" class="linea-aviso">
            Queda {{ pct(100 - finalObra) }} de la obra sin planificar. Se puede guardar igual y completarlo después.
          </span>
          <span v-else class="linea-ok">Todo lo que falta ejecutar quedó repartido.</span>
        </div>
        <div class="cierre-botones">
          <button v-if="editando && editable" class="btn-borrar" :disabled="guardando" @click="borrar">Borrar replanteo</button>
          <button v-if="!soloLectura" class="btn-guardar" :disabled="!puedeGuardar || guardando" @click="guardar">
            {{ guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar replanteo" }}
          </button>
        </div>
      </section>
      <p v-if="errorGuardar" class="mensaje-error">{{ errorGuardar }}</p>
    </template>
  </div>
</template>

<script>
import api from "../config/axios.Config.js";
import { useToast } from "vue-toastification";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const pad = (n) => String(n).padStart(2, "0");
const ultimoDia = (anio, mes) => new Date(anio, mes, 0).getDate(); // mes 1-12

// Suma un día a una fecha AAAA-MM-DD sin pasar por la zona horaria.
function diaSiguiente(fecha) {
  const [a, m, d] = fecha.split("-").map(Number);
  if (d < ultimoDia(a, m)) return `${a}-${pad(m)}-${pad(d + 1)}`;
  return m === 12 ? `${a + 1}-01-01` : `${a}-${pad(m + 1)}-01`;
}

export default {
  name: "ReplanteoView",
  props: ["obraId", "version"],

  setup() {
    return { toast: useToast() };
  },

  data() {
    return {
      cargando: true,
      errorCarga: "",
      ctx: null,
      motivo: "tiempo",
      mesHasta: "",
      corteManual: "",
      valores: {},
      adicionales: [],
      nuevo: this.adicionalVacio(),
      errorAdicional: "",
      busqueda: "",
      soloConSaldo: true,
      guardando: false,
      errorGuardar: "",
    };
  },

  computed: {
    editando() { return this.version !== undefined && this.version !== null && this.version !== ""; },
    editable() { return !this.editando || this.ctx?.version?.editable !== false; },
    bloqueado() { return !!this.ctx?.bloqueo; },
    soloLectura() { return !this.editable || this.bloqueado; },
    admiteAdicionales() { return this.motivo === "adicional_item" || this.motivo === "ambos"; },

    fechaCorte() { return this.ctx?.fecha_corte || this.corteManual || ""; },

    // El primer período arranca el día siguiente al corte y cierra a fin de ese
    // mes; los siguientes son meses completos.
    primerMes() {
      if (!this.fechaCorte) return "";
      return diaSiguiente(this.fechaCorte).slice(0, 7);
    },

    meses() {
      if (!this.fechaCorte || !this.mesHasta || this.mesHasta < this.primerMes) return [];
      const lista = [];
      let [a, m] = this.primerMes.split("-").map(Number);
      const [aFin, mFin] = this.mesHasta.split("-").map(Number);
      const desdePrimero = diaSiguiente(this.fechaCorte);
      while (a < aFin || (a === aFin && m <= mFin)) {
        const clave = `${a}-${pad(m)}`;
        lista.push({
          clave,
          etiqueta: `${MESES[m - 1]} ${String(a).slice(2)}`,
          fecha_desde: lista.length === 0 ? desdePrimero : `${clave}-01`,
          fecha_hasta: `${clave}-${pad(ultimoDia(a, m))}`,
        });
        m++; if (m > 12) { m = 1; a++; }
        if (lista.length > 60) break; // un replanteo de más de 5 años es un error de tipeo
      }
      return lista;
    },

    filas() {
      if (!this.ctx) return [];
      const pliego = this.ctx.items.map((i) => ({
        ...i,
        clave: `id:${i.id}`,
        esNuevo: false,
      }));
      const nuevos = this.adicionales.map((a) => ({
        clave: `clave:${a.clave}`,
        claveAdicional: a.clave,
        numeroItem: a.numeroItem || "A·",
        descripcionItem: a.descripcionItem,
        unidadMedida: a.unidadMedida,
        costoParcial: Number(a.cantidad) * Number(a.costoUnitario),
        avance_real: 0,
        disponible: 100,
        origen: "adicional",
        esNuevo: true,
      }));
      return [...pliego, ...nuevos];
    },

    filasVisibles() {
      const q = this.busqueda.trim().toLowerCase();
      return this.filas.filter((f) => {
        if (this.soloConSaldo && f.disponible <= 0 && !f.esNuevo && !(this.planificadoDe(f) > 0)) return false;
        if (!q) return true;
        return String(f.numeroItem).toLowerCase().includes(q) || String(f.descripcionItem).toLowerCase().includes(q);
      });
    },

    columnas() { return 6 + this.meses.length + (this.soloLectura ? 0 : 1); },

    totalAdicionales() {
      return this.adicionales.reduce((s, a) => s + Number(a.cantidad || 0) * Number(a.costoUnitario || 0), 0);
    },
    presupuestoNuevo() { return Number(this.ctx?.presupuesto_total || 0) + this.totalAdicionales; },
    incrementoPresupuesto() {
      const base = Number(this.ctx?.presupuesto_total || 0);
      return base ? r2((this.totalAdicionales / base) * 100) : 0;
    },

    // Avance real de la obra, medido contra el presupuesto NUEVO: si entran
    // adicionales, el mismo trabajo hecho pesa menos sobre el total.
    avanceBase() {
      const total = this.presupuestoNuevo;
      if (!total) return 0;
      return r2(this.filas.reduce((s, f) => s + (Math.min(100, f.avance_real) / 100) * f.costoParcial, 0) / total * 100);
    },

    incidenciaMes() {
      const total = this.presupuestoNuevo;
      const out = {};
      for (const m of this.meses) {
        out[m.clave] = total
          ? r2(this.filas.reduce((s, f) => s + (Number(this.valores[f.clave]?.[m.clave] || 0) / 100) * f.costoParcial, 0) / total * 100)
          : 0;
      }
      return out;
    },
    totalPlanificadoObra() { return r2(this.meses.reduce((s, m) => s + this.incidenciaMes[m.clave], 0)); },
    acumuladoMes() {
      let ac = this.avanceBase;
      const out = {};
      for (const m of this.meses) { ac += this.incidenciaMes[m.clave]; out[m.clave] = r2(ac); }
      return out;
    },
    finalObra() { return r2(this.avanceBase + this.totalPlanificadoObra); },

    itemsExcedidos() { return this.filas.filter((f) => this.quedaDe(f) < -0.009); },
    hayAlgoPlanificado() { return this.filas.some((f) => this.planificadoDe(f) > 0); },
    puedeGuardar() {
      return !this.bloqueado && this.fechaCorte && this.meses.length
        && this.hayAlgoPlanificado && !this.itemsExcedidos.length;
    },
    claseCierre() {
      if (this.itemsExcedidos.length) return "cierre-error";
      return this.finalObra >= 99.9 ? "cierre-ok" : "cierre-aviso";
    },
  },

  watch: {
    // Si se achica el rango, lo cargado en los meses que quedaron afuera se
    // descarta, para que lo que se ve sea exactamente lo que se guarda.
    meses(lista) {
      const vigentes = new Set(lista.map((m) => m.clave));
      for (const fila of Object.values(this.valores)) {
        for (const clave of Object.keys(fila)) if (!vigentes.has(clave)) delete fila[clave];
      }
    },
    motivo(valor) {
      if (valor === "tiempo" && this.adicionales.length) {
        for (const a of this.adicionales) delete this.valores[`clave:${a.clave}`];
        this.adicionales = [];
      }
    },
  },

  async mounted() {
    await this.cargar();
  },

  methods: {
    adicionalVacio() {
      return { numeroItem: "", descripcionItem: "", unidadMedida: "", cantidad: null, costoUnitario: null };
    },

    async cargar() {
      this.cargando = true;
      this.errorCarga = "";
      try {
        const q = this.editando ? `?version=${this.version}` : "";
        const { data } = await api.get(`/obras/${this.obraId}/replanteos/contexto${q}`);
        this.ctx = data;
        const valores = {};
        for (const i of data.items) valores[`id:${i.id}`] = {};

        if (this.editando && data.version) {
          this.motivo = data.version.motivo || "tiempo";
          for (const mes of data.version.meses) {
            const clave = mes.fecha_desde.slice(0, 7);
            for (const it of mes.items) {
              if (!valores[`id:${it.pliego_item_id}`]) valores[`id:${it.pliego_item_id}`] = {};
              valores[`id:${it.pliego_item_id}`][clave] = it.porcentaje;
            }
          }
          const ultimo = data.version.meses[data.version.meses.length - 1];
          this.mesHasta = ultimo ? ultimo.fecha_desde.slice(0, 7) : "";
        } else {
          if (!data.fecha_corte) {
            const hoy = new Date();
            this.corteManual = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
          }
          const primero = diaSiguiente(data.fecha_corte || this.corteManual).slice(0, 7);
          const finPlan = (data.plan_vigente_hasta || "").slice(0, 7);
          this.mesHasta = finPlan && finPlan > primero ? finPlan : primero;
        }
        this.valores = valores;
      } catch (e) {
        this.errorCarga = e.response?.data?.message || "No se pudo cargar la información del replanteo.";
      } finally {
        this.cargando = false;
      }
    },

    setValor(filaClave, mesClave, texto) {
      if (!this.valores[filaClave]) this.valores[filaClave] = {};
      if (texto === "" || texto === null) { delete this.valores[filaClave][mesClave]; return; }
      const n = Math.max(0, Math.min(100, Number(texto)));
      this.valores[filaClave][mesClave] = Number.isFinite(n) ? n : 0;
    },

    planificadoDe(f) {
      const fila = this.valores[f.clave] || {};
      return r2(this.meses.reduce((s, m) => s + Number(fila[m.clave] || 0), 0));
    },
    quedaDe(f) { return r2(f.disponible - this.planificadoDe(f)); },

    // Reparte lo que queda en partes iguales; el último mes se lleva el
    // redondeo, para que sume exacto.
    repartir(f) {
      const queda = this.quedaDe(f);
      const libres = this.meses;
      if (queda <= 0 || !libres.length) return;
      const parte = Math.floor((queda / libres.length) * 100) / 100;
      let asignado = 0;
      libres.forEach((m, i) => {
        const actual = Number(this.valores[f.clave]?.[m.clave] || 0);
        const extra = i === libres.length - 1 ? r2(queda - asignado) : parte;
        asignado = r2(asignado + extra);
        this.setValor(f.clave, m.clave, r2(actual + extra));
      });
    },

    claseFila(f) {
      const q = this.quedaDe(f);
      if (q < -0.009) return "fila-excedida";
      if (f.esNuevo) return "fila-nueva";
      if (f.disponible > 0 && Math.abs(q) <= 0.009) return "fila-completa";
      if (f.disponible <= 0) return "fila-terminada";
      return "";
    },

    agregarAdicional() {
      this.errorAdicional = "";
      const a = this.nuevo;
      if (!a.descripcionItem.trim()) { this.errorAdicional = "Escribí la descripción del ítem."; return; }
      if (!(Number(a.cantidad) > 0)) { this.errorAdicional = "La cantidad tiene que ser mayor a 0."; return; }
      if (!(Number(a.costoUnitario) > 0)) { this.errorAdicional = "El costo unitario tiene que ser mayor a 0."; return; }
      const numero = a.numeroItem.trim();
      if (numero && this.filas.some((f) => String(f.numeroItem).toLowerCase() === numero.toLowerCase())) {
        this.errorAdicional = `Ya hay un ítem ${numero}.`; return;
      }
      const clave = `n${Date.now()}${Math.floor(Math.random() * 1000)}`;
      this.adicionales.push({ ...a, numeroItem: numero, descripcionItem: a.descripcionItem.trim(), clave });
      this.valores[`clave:${clave}`] = {};
      this.nuevo = this.adicionalVacio();
    },

    quitarAdicional(filaClave) {
      const clave = filaClave.replace("clave:", "");
      this.adicionales = this.adicionales.filter((a) => a.clave !== clave);
      delete this.valores[filaClave];
    },

    payload() {
      const meses = this.meses
        .map((m) => ({
          fecha_desde: m.fecha_desde,
          fecha_hasta: m.fecha_hasta,
          items: this.filas
            .map((f) => ({ f, p: Number(this.valores[f.clave]?.[m.clave] || 0) }))
            .filter(({ p }) => p > 0)
            .map(({ f, p }) => (f.esNuevo ? { clave: f.claveAdicional, porcentaje: p } : { pliego_item_id: f.id, porcentaje: p })),
        }))
        .filter((m) => m.items.length);
      return {
        motivo: this.motivo,
        fecha_corte: this.fechaCorte,
        meses,
        adicionales: this.admiteAdicionales
          ? this.adicionales.map((a) => ({
              clave: a.clave, numeroItem: a.numeroItem, descripcionItem: a.descripcionItem,
              unidadMedida: a.unidadMedida, cantidad: a.cantidad, costoUnitario: a.costoUnitario,
            }))
          : [],
      };
    },

    async guardar() {
      this.errorGuardar = "";
      if (!this.puedeGuardar) return;
      this.guardando = true;
      try {
        const cuerpo = this.payload();
        const { data } = this.editando
          ? await api.put(`/obras/${this.obraId}/replanteos/${this.version}`, cuerpo)
          : await api.post(`/obras/${this.obraId}/replanteos`, cuerpo);
        this.toast.success(data.message || "Replanteo guardado");
        this.volver();
      } catch (e) {
        this.errorGuardar = e.response?.data?.message || "No se pudo guardar el replanteo.";
      } finally {
        this.guardando = false;
      }
    },

    async borrar() {
      const ok = window.confirm(
        `¿Borrar el replanteo ${this.version} completo?\n\nVuelve a regir el plan anterior. Esto no se puede deshacer.`
      );
      if (!ok) return;
      this.guardando = true;
      try {
        const { data } = await api.delete(`/obras/${this.obraId}/replanteos/${this.version}`);
        let texto = data.message || "Replanteo borrado";
        if (data.adicionales_en_pliego) {
          texto += `. Los ${data.adicionales_en_pliego} ítem(s) adicional(es) siguen en el pliego: si no corresponden, borralos desde ahí.`;
        }
        this.toast.success(texto, { timeout: 8000 });
        this.volver();
      } catch (e) {
        this.errorGuardar = e.response?.data?.message || "No se pudo borrar el replanteo.";
      } finally {
        this.guardando = false;
      }
    },

    volver() {
      this.$router.push({ name: "ProyeccionObra", params: { obraId: this.obraId } });
    },

    num(n) { return Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    pct(n) { return `${this.num(n)}%`; },
    monto(n) { return Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    fecha(f) { const [a, m, d] = String(f).slice(0, 10).split("-"); return `${d}/${m}/${a}`; },
  },
};
</script>

<style scoped>
.replanteo-view { padding: 20px; color: #e5e7eb; }

.cabecera { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.eyebrow { margin: 0; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: #fb923c; font-weight: 700; }
.titulo { margin: 4px 0 6px; font-size: 1.45rem; color: #f8fafc; display: flex; align-items: center; gap: 10px; }
.bajada { margin: 0; max-width: 70ch; color: #94a3b8; font-size: 0.88rem; line-height: 1.5; }

.estado { padding: 30px; text-align: center; color: #94a3b8; }
.mensaje-error { background: #3b1219; border: 1px solid #7f1d1d; color: #fecaca; padding: 10px 14px; border-radius: 8px; margin: 12px 0; font-weight: 600; }
.aviso-historia { background: rgba(148, 163, 184, 0.08); border: 1px solid #334155; color: #cbd5e1; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 0.88rem; }
.panel-bloqueo { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; background: rgba(248, 113, 113, 0.08); border: 1px solid rgba(248, 113, 113, 0.45); color: #fecaca; padding: 12px 16px; border-radius: 10px; margin-bottom: 14px; }
.panel-bloqueo strong { color: #fca5a5; }
.panel-bloqueo p { margin: 4px 0 0; font-size: 0.88rem; line-height: 1.5; max-width: 80ch; }
.btn-ir { background: #b91c1c; color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.btn-ir:hover { filter: brightness(1.1); }
.panel-aviso { background: rgba(251, 191, 36, 0.07); border: 1px solid rgba(251, 191, 36, 0.4); color: #fcd34d; padding: 10px 14px; border-radius: 10px; margin-bottom: 14px; font-size: 0.88rem; line-height: 1.5; }

.tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 16px; }
.tarjeta { background: #0b1120; border: 1px solid #1f2a44; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 5px; }
.t-label { font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.t-valor { font-size: 1.35rem; font-weight: 800; color: #f8fafc; font-variant-numeric: tabular-nums; }
.t-sub { font-size: 0.78rem; color: #94a3b8; }
.t-mas { color: #fb923c; }
.rango { display: flex; align-items: center; gap: 8px; color: #cbd5e1; }
.rango-desde { font-weight: 700; color: #f8fafc; }

.input { padding: 7px 10px; border-radius: 6px; border: 1px solid #374151; background: #020617; color: #e5e7eb; font-size: 0.88rem; }
.input:focus { outline: 2px solid #fb923c; outline-offset: 1px; }
.input:disabled { opacity: 0.6; }
.input-mes { min-width: 150px; }

.panel-adicionales { background: #0f172a; border: 1px solid rgba(251, 146, 60, 0.35); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
.panel-adicionales h3 { margin: 0 0 4px; font-size: 0.95rem; color: #fb923c; }
.panel-texto { margin: 0 0 12px; font-size: 0.8rem; color: #94a3b8; line-height: 1.5; max-width: 90ch; }
.fila-form { display: flex; flex-wrap: wrap; gap: 8px; }
.w-num { width: 110px; } .w-desc { flex: 1; min-width: 200px; } .w-uni { width: 90px; } .w-costo { width: 140px; }
.btn-agregar { padding: 7px 14px; background: #fb923c; color: #1c1917; border: none; border-radius: 6px; font-weight: 800; cursor: pointer; }
.error-linea { color: #fca5a5; font-size: 0.82rem; margin: 8px 0 0; }

.herramientas { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 8px; }
.buscador { flex: 1; min-width: 240px; max-width: 420px; }
.toggle { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: #cbd5e1; cursor: pointer; }
.contador { font-size: 0.8rem; color: #64748b; margin-left: auto; }

.grilla-wrap { overflow: auto; max-height: 62vh; border: 1px solid #1f2a44; border-radius: 10px; }
.grilla { border-collapse: separate; border-spacing: 0; font-size: 0.82rem; min-width: 100%; }
.grilla th, .grilla td { border-bottom: 1px solid #1f2a44; padding: 5px 8px; white-space: nowrap; background: #0b1120; }
.grilla thead th { position: sticky; top: 0; z-index: 3; background: #111a33; color: #cbd5e1; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
.grilla tfoot td { position: sticky; bottom: 0; z-index: 3; background: #111a33; }
.grilla tfoot tr:first-child td { bottom: 31px; }

.col-fija { position: sticky; z-index: 2; }
.grilla thead .col-fija, .grilla tfoot .col-fija { z-index: 4; }
.col-num { left: 0; min-width: 62px; font-weight: 700; color: #f8fafc; }
.col-desc { left: 62px; min-width: 260px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; border-right: 1px solid #334155; }
.col-dato { text-align: right; color: #94a3b8; font-variant-numeric: tabular-nums; min-width: 64px; }
.col-mes { text-align: center; min-width: 84px; }
.col-plan { color: #e5e7eb; font-weight: 700; }
.col-queda { font-weight: 700; }
.col-accion { min-width: 74px; text-align: center; }

.celda { width: 72px; padding: 4px 6px; border-radius: 5px; border: 1px solid #263349; background: #020617; color: #e5e7eb; text-align: right; font-variant-numeric: tabular-nums; }
.celda:focus { outline: 2px solid #fb923c; outline-offset: 0; }
.celda-llena { border-color: rgba(251, 146, 60, 0.55); background: rgba(251, 146, 60, 0.08); }
.celda:disabled { opacity: 0.25; }

.fila-excedida td { background: #2a0f14; }
.fila-excedida .col-queda { color: #f87171; }
.fila-completa .col-queda { color: #4ade80; }
.fila-nueva td { background: #1c1408; }
.fila-terminada td { color: #475569; }

.chip { display: inline-block; font-size: 0.66rem; font-weight: 700; padding: 1px 7px; border-radius: 999px; margin-left: 6px; vertical-align: middle; }
.chip-nuevo { background: rgba(251, 146, 60, 0.2); color: #fb923c; }
.chip-adicional { background: rgba(96, 165, 250, 0.16); color: #93c5fd; }
.chip-historia { background: rgba(148, 163, 184, 0.18); color: #cbd5e1; font-size: 0.72rem; }
.quitar { background: none; border: none; color: #f87171; cursor: pointer; margin-left: 4px; }
.btn-mini { font-size: 0.72rem; padding: 3px 8px; border-radius: 999px; border: 1px solid #334155; background: transparent; color: #cbd5e1; cursor: pointer; }
.btn-mini:hover { border-color: #fb923c; color: #fb923c; }

.pie-label { font-weight: 700; color: #cbd5e1; text-align: right; }
.pie-valor { text-align: center; font-weight: 700; color: #e5e7eb; font-variant-numeric: tabular-nums; }
.pie-acum { text-align: center; font-weight: 800; color: #fb923c; font-variant-numeric: tabular-nums; }
.vacio { text-align: center; padding: 20px; color: #64748b; font-style: italic; }

.cierre { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding: 12px 16px; border-radius: 10px; border: 1px solid; }
.cierre-ok { background: rgba(74, 222, 128, 0.06); border-color: rgba(74, 222, 128, 0.35); }
.cierre-aviso { background: rgba(251, 191, 36, 0.06); border-color: rgba(251, 191, 36, 0.35); }
.cierre-error { background: rgba(248, 113, 113, 0.07); border-color: rgba(248, 113, 113, 0.45); }
.cierre-texto { display: flex; flex-direction: column; gap: 3px; font-size: 0.9rem; }
.linea-ok { color: #86efac; } .linea-aviso { color: #fcd34d; } .linea-error { color: #fca5a5; }
.cierre-botones { display: flex; gap: 10px; }

.btn-guardar { background: #166534; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 0.95rem; font-weight: 700; }
.btn-guardar:hover:not(:disabled) { filter: brightness(1.12); }
.btn-guardar:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-borrar { background: transparent; color: #fca5a5; border: 1px solid #7f1d1d; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: 700; }
.btn-borrar:hover:not(:disabled) { background: #3b1219; }
.btn-sec { background: transparent; border: 1px solid #334155; color: #cbd5e1; padding: 8px 14px; border-radius: 8px; cursor: pointer; }
.btn-sec:hover { border-color: #94a3b8; }
</style>

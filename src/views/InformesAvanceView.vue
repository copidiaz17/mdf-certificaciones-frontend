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

        <!-- ── Fotos, antes de guardar ─────────────────────────────── -->
        <div class="campo">
          <label>
            Fotos <small>(opcional)</small>
            <span v-if="porSubir.length" class="fotos-cuenta">{{ porSubir.length }}</span>
          </label>

          <label class="btn-elegir">
            <input type="file" accept="image/*" multiple @change="elegirFotos" hidden />
            📷 Elegir fotos
          </label>

          <small class="ayuda" v-if="!porSubir.length">
            Las fotos se suben cuando se guarda el informe. También se pueden
            agregar después.
          </small>

          <div v-if="porSubir.length" class="por-subir">
            <p class="chico">
              Escribí qué se ve en cada una. Dentro de seis meses, una foto sin
              texto es un muro que nadie sabe cuál es.
            </p>
            <div v-for="(f, i) in porSubir" :key="i" class="por-subir-fila">
              <img :src="f.previa" alt="" class="previa-mini" />
              <div class="por-subir-datos">
                <span class="nombre-archivo">{{ f.archivo.name }}</span>
                <input
                  type="text" v-model="f.epigrafe" maxlength="300"
                  placeholder="Sector B, losa terminada"
                />
              </div>
              <button class="btn-quitar" @click="quitarPorSubir(i)" title="Quitar">✕</button>
            </div>
          </div>
        </div>

        <button class="btn-guardar" :disabled="guardando" @click="guardar">
          <template v-if="guardando">{{ pasoGuardado || "Guardando…" }}</template>
          <template v-else-if="porSubir.length">
            Guardar informe con {{ porSubir.length }} foto(s)
          </template>
          <template v-else>Guardar informe</template>
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
              <span v-if="inf.fotos" class="tiene-fotos">📷 {{ inf.fotos }}</span>
              <span v-else class="sin-fotos">sin fotos</span>
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

        <!-- ── Fotos ─────────────────────────────────────────────── -->
        <div class="fotos-bloque">
          <div class="fotos-cabecera">
            <h4>
              Fotos
              <span v-if="abierto.fotos && abierto.fotos.length" class="fotos-cuenta">
                {{ abierto.fotos.length }}
              </span>
            </h4>
            <label v-if="authStore.canModify" class="btn-subir">
              <input type="file" accept="image/*" multiple @change="elegirFotos" hidden />
              {{ subiendo ? "Subiendo…" : "📷 Agregar fotos" }}
            </label>
          </div>

          <p v-if="!(abierto.fotos && abierto.fotos.length) && !porSubir.length" class="vacio">
            Todavía no hay fotos. Un informe que dice «se hormigonó el sector B»
            no prueba nada; la foto del sector B hormigonado, sí.
          </p>

          <!-- Elegidas, esperando su epígrafe -->
          <div v-if="porSubir.length" class="por-subir">
            <p class="chico">
              Escribí qué se ve en cada una. Dentro de seis meses, una foto sin
              texto es un muro que nadie sabe cuál es.
            </p>
            <div v-for="(f, i) in porSubir" :key="i" class="por-subir-fila">
              <img :src="f.previa" alt="" class="previa-mini" />
              <div class="por-subir-datos">
                <span class="nombre-archivo">{{ f.archivo.name }}</span>
                <input
                  type="text" v-model="f.epigrafe" maxlength="300"
                  placeholder="Sector B, losa terminada"
                />
              </div>
              <button class="btn-quitar" @click="quitarPorSubir(i)" title="Quitar">✕</button>
            </div>
            <div class="por-subir-botones">
              <button class="btn-subir" :disabled="subiendo" @click="subirFotos">
                {{ subiendo ? "Subiendo…" : "Subir " + porSubir.length + " foto(s)" }}
              </button>
              <button class="btn-cancelar-fotos" @click="cancelarSubida">Cancelar</button>
            </div>
          </div>

          <!-- Las que ya están -->
          <div v-if="abierto.fotos && abierto.fotos.length" class="grilla-fotos">
            <figure v-for="f in abierto.fotos" :key="f.id" class="foto">
              <a :href="f.url" target="_blank" rel="noopener">
                <img :src="f.miniatura || f.url" :alt="f.epigrafe || 'Foto del informe'" loading="lazy" />
              </a>
              <figcaption>
                <span v-if="f.epigrafe">{{ f.epigrafe }}</span>
                <span v-else class="sin-epigrafe">Sin epígrafe</span>
                <small v-if="f.subidaPor">{{ f.subidaPor.nombre }}</small>
              </figcaption>
              <div v-if="authStore.canModify" class="foto-acciones">
                <button @click="editarEpigrafe(f)">Epígrafe</button>
                <button class="peligro" @click="borrarFoto(f)">Borrar</button>
              </div>
            </figure>
          </div>
        </div>

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
      porSubir: [],
      subiendo: false,
      pasoGuardado: "",
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

    // Guarda el informe y, si hay fotos elegidas, las sube en el mismo paso.
    //
    // Son dos llamadas y no una porque las fotos necesitan un informe al que
    // colgarse, y todavía no existe. Se hace en este orden a propósito: el
    // informe es lo que no se puede perder; las fotos, si fallan, se pueden
    // volver a subir sin rehacer nada.
    async guardar() {
      this.guardando = true;
      this.pasoGuardado = "Guardando el informe…";
      let creado = null;
      try {
        const { data } = await api.post(`/obras/${this.obraId}/informes-avance`, {
          fecha_desde: this.form.fecha_desde,
          fecha_hasta: this.form.fecha_hasta,
          titulo: this.form.titulo,
          observaciones: this.form.observaciones,
        });
        creado = data;
      } catch (e) {
        this.toast.error(e?.response?.data?.error || "No se pudo guardar el informe");
        this.guardando = false;
        this.pasoGuardado = "";
        return;
      }

      // El informe ya está a salvo. Lo que siga puede fallar sin llevárselo.
      let fotosOk = true;
      if (this.porSubir.length && creado?.id) {
        this.pasoGuardado = `Subiendo ${this.porSubir.length} foto(s)…`;
        fotosOk = await this.subirFotos(creado.id);
      }

      if (fotosOk) {
        this.toast.success(creado.message || "Informe guardado");
        this.form.titulo = "";
        this.form.observaciones = "";
        this.vista = null;
      } else {
        // Las fotos siguen elegidas: se reintentan desde el informe abierto,
        // sin volver a armar nada. Perderlas en silencio sería lo peor que
        // podría pasar acá — son las que se sacaron en obra.
        this.toast.warning(
          "El informe se guardó, pero las fotos no se subieron. Quedaron elegidas: " +
          "probá de nuevo desde el informe, abajo."
        );
      }

      await this.traerInformes();
      // Se abre solo: es donde se ven las fotos y donde se agregan más.
      if (creado?.id) await this.abrir(creado.id);

      this.guardando = false;
      this.pasoGuardado = "";
    },

    async abrir(id) {
      try {
        const { data } = await api.get(`/obras/${this.obraId}/informes-avance/${id}`);
        this.abierto = data;
      } catch (e) {
        this.toast.error(e?.response?.data?.message || "No se pudo abrir el informe");
      }
    },

    elegirFotos(e) {
      const archivos = Array.from(e.target.files || []);
      // La vista previa es local: no se sube nada hasta apretar Subir, así se
      // escribe el epígrafe ANTES y no después, cuando ya nadie se acuerda.
      for (const archivo of archivos) {
        this.porSubir.push({ archivo, epigrafe: "", previa: URL.createObjectURL(archivo) });
      }
      e.target.value = "";
    },

    quitarPorSubir(i) {
      URL.revokeObjectURL(this.porSubir[i].previa);
      this.porSubir.splice(i, 1);
    },

    cancelarSubida() {
      for (const f of this.porSubir) URL.revokeObjectURL(f.previa);
      this.porSubir = [];
    },

    /**
     * Sube las fotos elegidas a un informe.
     *
     * Recibe el id porque se usa en dos momentos: al guardar un informe nuevo
     * —cuando todavía no hay ninguno abierto— y desde uno ya emitido.
     *
     * Devuelve si salió bien, para que quien la llama decida qué decir: al
     * guardar no alcanza con un cartel de error, porque el informe SÍ se
     * guardó y hay que aclararlo.
     */
    async subirFotos(informeId) {
      const id = informeId || this.abierto?.id;
      if (!this.porSubir.length || !id) return true;
      this.subiendo = true;
      try {
        const fd = new FormData();
        for (const f of this.porSubir) {
          fd.append("fotos", f.archivo);
          fd.append("epigrafes", f.epigrafe || "");
        }
        const { data } = await api.post(
          "/obras/" + this.obraId + "/informes-avance/" + id + "/fotos",
          fd,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        // El mensaje del servidor avisa cuáles quedaron sin epígrafe.
        if (!informeId) this.toast.success(data.message || "Fotos subidas");
        this.cancelarSubida();
        await this.abrir(id);
        return true;
      } catch (e) {
        // Al guardar, el aviso lo da `guardar()`: acá saldrían dos carteles.
        if (!informeId) {
          this.toast.error(e?.response?.data?.message || "No se pudieron subir las fotos");
        }
        return false;
      } finally {
        this.subiendo = false;
      }
    },

    async editarEpigrafe(f) {
      const texto = prompt("¿Qué se ve en esta foto?", f.epigrafe || "");
      if (texto === null) return;
      try {
        await api.put(
          "/obras/" + this.obraId + "/informes-avance/" + this.abierto.id + "/fotos/" + f.id,
          { epigrafe: texto }
        );
        await this.abrir(this.abierto.id);
      } catch (e) {
        this.toast.error(e?.response?.data?.message || "No se pudo cambiar el epígrafe");
      }
    },

    async borrarFoto(f) {
      const detalle = f.epigrafe ? "\n\n" + f.epigrafe : "";
      if (!confirm("¿Borrar esta foto?" + detalle)) return;
      try {
        await api.delete(
          "/obras/" + this.obraId + "/informes-avance/" + this.abierto.id + "/fotos/" + f.id
        );
        await this.abrir(this.abierto.id);
      } catch (e) {
        this.toast.error(e?.response?.data?.message || "No se pudo borrar la foto");
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
.tiene-fotos { margin-left: 8px; opacity: 1; }
/* "Sin fotos" es un aviso suave, no un error: hay informes que no las llevan. */
.sin-fotos { margin-left: 8px; font-style: italic; opacity: 0.6; }
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

/* ── Fotos ──────────────────────────────────────────────────────────── */
.fotos-bloque { margin: 18px 0; }
.fotos-cabecera {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px; margin-bottom: 10px;
}
.fotos-cabecera h4 { margin: 0; }
.fotos-cuenta {
  margin-left: 6px; background: rgba(148,163,184,.3);
  border-radius: 999px; padding: 1px 9px; font-size: .78rem;
}
.btn-subir {
  padding: 7px 16px; border: none; border-radius: 8px;
  background: #1d4ed8; color: #eff6ff; font-weight: 700;
  cursor: pointer; font-size: .88rem;
}
.btn-subir:disabled { opacity: .5; cursor: not-allowed; }
.btn-cancelar-fotos {
  padding: 7px 16px; border: 1px solid rgba(148,163,184,.45);
  border-radius: 8px; background: transparent; color: inherit; cursor: pointer;
}

.por-subir {
  border: 1px dashed rgba(148,163,184,.5); border-radius: 10px;
  padding: 12px; margin-bottom: 14px;
}
.por-subir-fila { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
.previa-mini { width: 56px; height: 56px; object-fit: cover; border-radius: 6px; flex: none; }
.por-subir-datos { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.nombre-archivo {
  font-size: .74rem; opacity: .6; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.por-subir-datos input {
  padding: 7px 10px; border-radius: 8px;
  border: 1px solid rgba(148,163,184,.45);
  background: rgba(15,23,42,.35); color: inherit; font: inherit;
}
.btn-quitar {
  border: none; background: transparent; color: inherit;
  font-size: 1.1rem; cursor: pointer; opacity: .6; flex: none;
}
.btn-quitar:hover { opacity: 1; }
.por-subir-botones { display: flex; gap: 10px; margin-top: 10px; }

.grilla-fotos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.foto { margin: 0; border: 1px solid rgba(148,163,184,.25); border-radius: 10px; overflow: hidden; }
.foto img { width: 100%; height: 140px; object-fit: cover; display: block; }
.foto figcaption {
  padding: 8px 10px; font-size: .84rem; line-height: 1.45;
  display: flex; flex-direction: column; gap: 2px;
}
.foto figcaption small { opacity: .6; font-size: .72rem; }
.sin-epigrafe { opacity: .5; font-style: italic; }
.foto-acciones { display: flex; border-top: 1px solid rgba(148,163,184,.2); }
.foto-acciones button {
  flex: 1; padding: 6px; border: none; background: transparent;
  color: inherit; cursor: pointer; font-size: .78rem;
}
.foto-acciones button:hover { background: rgba(148,163,184,.15); }
.foto-acciones .peligro { color: #f87171; }
.btn-elegir {
  display: inline-block; align-self: flex-start;
  padding: 7px 16px; border: 1px dashed rgba(148,163,184,.55);
  border-radius: 8px; cursor: pointer; font-size: .88rem; font-weight: 600;
}
.btn-elegir:hover { border-color: #1d4ed8; }
</style>

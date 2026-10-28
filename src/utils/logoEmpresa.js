// El logo de la empresa (config/empresa.js) listo para meter en un PDF o en un
// Excel: como imagen embebida y con su proporción, así no se deforma (el de
// Falube es cuadrado y el de MDF, apaisado). Si no carga, el papel sale igual.
import { EMPRESA } from "../config/empresa.js";

let enMemoria;

export async function cargarLogo(url = EMPRESA.logo) {
  if (enMemoria && enMemoria.url === url) return enMemoria.logo;
  let logo = null;
  try {
    const blob = await (await fetch(url)).blob();
    const dataUrl = await new Promise((ok, mal) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = mal;
      r.readAsDataURL(blob);
    });
    const { ancho, alto } = await new Promise((ok, mal) => {
      const img = new Image();
      img.onload = () => ok({ ancho: img.naturalWidth, alto: img.naturalHeight });
      img.onerror = mal;
      img.src = dataUrl;
    });
    logo = { dataUrl, ancho, alto, formato: blob.type.includes("png") ? "PNG" : "JPEG" };
  } catch {
    logo = null;
  }
  enMemoria = { url, logo };
  return logo;
}

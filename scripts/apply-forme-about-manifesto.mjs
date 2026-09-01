import { copyFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const ROOT = new URL("../", import.meta.url);
const PUBLIC = new URL("../public/", import.meta.url);
const NUXT = new URL("../public/_nuxt/", import.meta.url);
const ABOUT_BUNDLE = new URL(
  "../public/_nuxt/about.a3e1edf1.js",
  import.meta.url,
);
const FORME_ABOUT_BUNDLE = new URL(
  "../public/_nuxt/about.forme-f18.js",
  import.meta.url,
);
const DEFAULT_BUNDLE = new URL(
  "../public/_nuxt/default.4cd10699.js",
  import.meta.url,
);
const SCENE_BUNDLE = new URL(
  "../public/_nuxt/stickerPhysics.ce31be14.js",
  import.meta.url,
);
const FORME_SCENE_BUNDLE = new URL(
  "../public/_nuxt/stickerPhysics.forme-f18.js",
  import.meta.url,
);
const COMPAT_SCENE_BUNDLES = [
  new URL("../public/_nuxt/stickerPhysics.forme-f13.js", import.meta.url),
  new URL("../public/_nuxt/stickerPhysics.forme-f15.js", import.meta.url),
  FORME_SCENE_BUNDLE,
];
const ABOUT_HTML = new URL(
  "../public/savoir-exact/about/original-about.html",
  import.meta.url,
);
const FORME_MODEL_SOURCE = new URL("../../forme_F_3.glb", import.meta.url);
const FORME_MODEL_PUBLIC = new URL("../public/models/forme_F_3.glb", import.meta.url);
const FORME_MODEL_WEB = "/models/forme_F_web.glb?v=forme-f16";
const FORME_SCENE_MODEL = "/models/star2-forme.glb?v=forme-f18";
const SOCIAL_IMAGE_URL =
  "https://forme.gallery/forme-social-instagram-v1.gif";
const SOCIAL_IMAGE_URL_ESCAPED = SOCIAL_IMAGE_URL.replaceAll("/", "\\u002F");
const LEGACY_SOCIAL_IMAGE_URL =
  "https://images.prismic.io/savoir-faire/a9fc8a41-050a-4407-9b5a-a4b8b53489e7_SavoirFaire.gif?auto=compress,format";
const LEGACY_SOCIAL_IMAGE_URL_ESCAPED = LEGACY_SOCIAL_IMAGE_URL.replaceAll(
  "/",
  "\\u002F",
);

const FORME_RED = "#ff0000";
const FORME_RED_MUTED = "#a60000";
const APP_CTA_STYLE = `<style id="forme-app-cta-styles">
.l__layout{background-color:#ff0000!important}
.l__loader,.l__preloader{display:none!important}
.container{opacity:1!important}
.l__menu{display:none!important}
.play__audio[data-v-db972e77],.play__audio--tilt[data-v-db972e77]{
  bottom:auto!important;
  height:4.7rem!important;
  left:auto!important;
  right:3.6rem!important;
  top:2.1rem!important;
  width:14rem!important;
}
.play__audio--background[data-v-db972e77]{display:none!important}
.play__audio--content[data-v-db972e77]{inset:0!important}
.play__audio--pause[data-v-db972e77],
.play__audio--start-over[data-v-db972e77],
.marquee__border[data-v-db972e77]{display:none!important}
.play__audio img[data-v-db972e77]{
  height:1.7rem!important;
  margin-right:.65rem!important;
  width:1.7rem!important;
}
.play__audio span[data-v-db972e77]{
  font-size:1.5rem!important;
  white-space:nowrap;
}
@media only screen and (max-width:767px){
  .play__audio[data-v-db972e77],.play__audio--tilt[data-v-db972e77]{
    right:1.5rem!important;
    top:1.9rem!important;
    width:13rem!important;
  }
}
</style>`;
const APP_CTA_SCRIPT = `<script id="forme-app-cta-behavior">
(()=>{
  const destination="/closet";
  const prepare=()=>{
    const cta=document.querySelector(".play__audio");
    if(!cta){
      window.setTimeout(prepare,50);
      return;
    }
    cta.setAttribute("role","link");
    cta.setAttribute("tabindex","0");
    cta.setAttribute("aria-label","Ir al app");
    const icon=cta.querySelector("img");
    if(icon){
      icon.setAttribute("alt","");
      icon.setAttribute("aria-hidden","true");
    }
    cta.addEventListener("keydown",(event)=>{
      if(event.key!=="Enter"&&event.key!==" ")return;
      event.preventDefault();
      window.location.assign(destination);
    },true);
  };
  document.addEventListener("click",(event)=>{
    if(!event.target.closest?.(".play__audio,.play__audio--tilt"))return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    window.location.assign(destination);
  },true);
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",prepare,{once:true});
  }else{
    prepare();
  }
})();
</script>`;

const sections = [
  [
    "Nadie",
    "te",
    "enseña",
    "a",
    "leer",
    "tu",
    "propio",
    "<i>closet.</i>",
  ],
  [
    "Formé®",
    "nace",
    "de",
    "una",
    "<i>certeza:</i>",
    "tu",
    "closet",
    "ya",
    "cuenta",
    "<i>quién</i>",
    "<i>eres.</i>",
    "Ahí",
    "está",
    "la",
    "persona",
    "que",
    "eras,",
    "la",
    "que",
    "quisiste",
    "ser",
    "y",
    "la",
    "que",
    "eres",
    "hoy.",
    "Cada",
    "prenda,",
    "una",
    "<i>decisión.</i>",
    "Cada",
    "combinación,",
    "una",
    "<i>versión</i>",
    "<i>de</i>",
    "<i>ti.</i>",
  ],
  [
    "Tu",
    "estilo",
    "no",
    "es",
    "lo",
    "que",
    "compras.",
    "Es",
    "lo",
    "que",
    "repites,",
    "lo",
    "que",
    "guardas",
    "y",
    "lo",
    "que",
    "siempre",
    "funciona.",
    "Eso",
    "tiene",
    "un",
    "nombre:",
    "<i>identidad.</i>",
  ],
  [
    "Formé®",
    "convierte",
    "lo",
    "que",
    "tienes",
    "en",
    "una",
    "<i>galería</i>",
    "<i>tuya:</i>",
    "limpia,",
    "ordenada",
    "y",
    "lista",
    "para",
    "ser",
    "leída.",
    "Cada",
    "prenda",
    "en",
    "su",
    "lugar.",
    "Cada",
    "look,",
    "una",
    "<i>posibilidad.</i>",
  ],
  [
    "Combina",
    "libremente.",
    "Guarda",
    "lo",
    "que",
    "funciona.",
    "Descubre",
    "qué",
    "repites",
    "y",
    "qué",
    "nunca",
    "tocas.",
    "Pídele",
    "al",
    "asistente",
    "opciones",
    "para",
    "mañana,",
    "para",
    "una",
    "cena",
    "o",
    "para",
    "toda",
    "la",
    "semana.",
    "Siempre",
    "con",
    "una",
    "explicación",
    "de",
    "por",
    "qué",
    "<i>funcionan.</i>",
  ],
  [
    "Con",
    "el",
    "tiempo,",
    "Formé®",
    "<i>aprende.</i>",
    "No",
    "de",
    "tendencias:",
    "<i>de</i>",
    "<i>ti.</i>",
    "Aprende",
    "de",
    "lo",
    "que",
    "guardas,",
    "de",
    "lo",
    "que",
    "rechazas",
    "y",
    "de",
    "lo",
    "que",
    "reservas",
    "para",
    "cuando",
    "importa.",
  ],
  [
    "Descubrirse",
    "no",
    "es",
    "una",
    "revelación.",
    "Es",
    "un",
    "<i>diálogo</i>",
    "entre",
    "quien",
    "ya",
    "eres",
    "y",
    "quien",
    "todavía",
    "estás",
    "construyendo.",
    "Tu",
    "closet",
    "es",
    "donde",
    "ese",
    "<i>diálogo</i>",
    "ocurre.",
  ],
  [
    "No",
    "es",
    "consumo.",
    "Es",
    "<i>continuidad.</i>",
    "Formé®.",
    "Porque",
    "algunas",
    "cosas",
    "merecen",
    "<i>durar</i>",
    "<i>más</i>",
    "que",
    "una",
    "moda.",
  ],
];

const plain = (token) =>
  token.replaceAll("<i>", "").replaceAll("</i>", "").replaceAll("<sup>", "").replaceAll("</sup>", "");

const allTokens = sections.flat();
const weights = allTokens.map((token) => {
  const word = plain(token);
  const punctuationPause = /[.!?:]$/.test(word) ? 0.45 : /[,]$/.test(word) ? 0.18 : 0;
  return 0.75 + Math.min(word.length, 12) * 0.055 + punctuationPause;
});
const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
const startAt = 2.2;
const endAt = 69.8;
let elapsedWeight = 0;
const times = weights.map((weight) => {
  const time = startAt + (elapsedWeight / totalWeight) * (endAt - startAt);
  elapsedWeight += weight;
  return time.toFixed(3);
});

function buildCaptions(maxLineCharacters) {
  const captions = [];
  let tokenIndex = 0;

  sections.forEach((section, sectionIndex) => {
    let lineLength = 0;

    section.forEach((token, wordIndex) => {
      const word = plain(token);
      const nextLength = lineLength === 0 ? word.length : lineLength + 1 + word.length;

      if (lineLength > 0 && nextLength > maxLineCharacters) {
        captions.push({ content: "<br />", linebreak: false });
        lineLength = 0;
      }

      captions.push({
        content: token,
        startTime: times[tokenIndex],
        ...(wordIndex === 0 && sectionIndex > 0 ? { offset: true } : {}),
      });

      lineLength = lineLength === 0 ? word.length : lineLength + 1 + word.length;
      tokenIndex += 1;
    });

    captions.push({
      content: "<br />",
      startTime:
        sectionIndex === sections.length - 1
          ? "72.000"
          : times[tokenIndex - 1],
      linebreak: true,
    });
  });

  return captions;
}

function findArrayEnd(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }

    if (character === "[") depth += 1;
    if (character === "]") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }

  throw new Error("No se encontró el cierre del arreglo de captions.");
}

function replaceCaptionArray(source, marker, captions) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`No se encontró ${marker} en el bundle.`);
  }

  const start = markerIndex + marker.length;
  const end = findArrayEnd(source, start);
  return `${source.slice(0, start)}${JSON.stringify(captions)}${source.slice(end)}`;
}

function writeUpdated(url, update) {
  const current = readFileSync(url, "utf8");
  const next = update(current);
  if (next !== current) writeFileSync(url, next);
}

const desktopCaptions = buildCaptions(48);
const mobileCaptions = buildCaptions(25);
const modelLoaderSetup =
  `this.loader=new L0,this.loader.load("${FORME_SCENE_MODEL}",async n=>{this.gltf=n,this.logoGroup.add(this.gltf.scene),this.TO_SCALE=ja(window.innerWidth,this.screenMin,this.screenMax,.048,.1,!0),this.gltf.scene.scale.setScalar(this.TO_SCALE),this.gltf.scene.position.set(0,0,1),this.material=e(),this.gltf.scene.traverse(a=>{a.layers.set(qa.REFRACTION_DISABLE),a.isMesh&&(a.material=this.material,a.material.envMap=this.texture,a.material.envMapIntensity=2,a.renderOrder=10,a.material.needsUpdate=!0)}),this.gltf.scene.position.z+=15;const i=this.gltf.scene.getObjectByName("Star"),t=()=>{this.mixer=new C0(this.gltf.scene),this.action=this.mixer.clipAction(this.gltf.animations[0]),this.action.play(),this.mixer.addEventListener("loop",a=>{this.action.paused=!0,setTimeout(()=>{this.action.paused=!1,this.action.play()},1500)}),this.animateLogoIn()};this.formeMark=i,new L0().load("${FORME_MODEL_WEB}",n=>{let e=null;n.scene.updateMatrixWorld(!0),n.scene.traverse(n=>{n.isMesh&&n.name==="F"&&(e=n)}),e&&i&&(i.geometry=e.geometry.clone(),i.geometry.applyMatrix4(e.matrixWorld),i.geometry.scale(156,156,156)),t()},void 0,t)})`;

writeUpdated(SCENE_BUNDLE, (source) => {
  let next = replaceCaptionArray(source, "const Tf=", desktopCaptions);
  next = replaceCaptionArray(next, ",Ef=", mobileCaptions);
  const modelSetupStart = next.indexOf("this.loader=new L0,");
  const modelSetupEnd = next.indexOf(",this.scene.add(this.logoGroup)", modelSetupStart);
  if (modelSetupStart === -1 || modelSetupEnd === -1) {
    throw new Error("No se encontró la configuración del modelo central.");
  }
  next =
    next.slice(0, modelSetupStart) +
    modelLoaderSetup +
    next.slice(modelSetupEnd);
  next = next
    .replace(
      "this.mixer&&this.mixer.update(n),this.formeMark&&this.action&&(this.formeMark.rotation.y=this.action.time/this.action.getClip().duration*Math.PI*2),this.render()",
      "this.mixer&&this.mixer.update(n),this.render()",
    )
    .replace(
      "this.mixer&&this.mixer.update(n),this.render()",
      "this.mixer&&this.mixer.update(n),this.render()",
    );
  return next
    .replaceAll(/#cdfd50/gi, FORME_RED)
    .replaceAll(/#a9d92e/gi, FORME_RED_MUTED);
});

copyFileSync(FORME_MODEL_SOURCE, FORME_MODEL_PUBLIC);
for (const bundle of COMPAT_SCENE_BUNDLES) {
  copyFileSync(SCENE_BUNDLE, bundle);
}

const textReplacements = [
  ["SavoirFaire©. Holistic creative studio based in NYC.", "Formé. Closet digital y asistente de estilo."],
  ["SavoirFaire&#169;. Holistic creative studio based in NYC.", "Formé. Closet digital y asistente de estilo."],
  [
    "SavoirFaire© is a holistic creative studio on a mission to help businesses make their vision a tangible reality: we bring brands to life, crafts best-in-class digital experiences and tell stories in meaningful ways.",
    "Formé convierte tu closet en una galería que puedes leer, combinar y entender. Aprende de lo que guardas, rechazas y vuelves a elegir.",
  ],
  ["Knowing by doing", "Tu closet ya habla"],
  ["Digital & Branding Design", "Closet digital"],
  ["Digital &amp; Branding Design", "Closet digital"],
  ["Photography & Film Production", "Asistente de estilo"],
  ["Photography &amp; Film Production", "Asistente de estilo"],
  ["Founded in 2020", "Formé"],
  ["Brooklyn, NY", "forme.gallery"],
  ["Our 60-second Pitch", "Ir al app"],
  ["Manifiesto Formé®", "Ir al app"],
  ["Manifiesto Formé", "Ir al app"],
  ["Start Over", "Repetir"],
  ["Pause", "Pausa"],
  ["This message will self destruct in", "Este manifiesto termina en"],
  ["Want to work with us?", "¿Listo para leer tu closet?"],
  ["Drop us a line.", "Abrir Formé."],
  ["Oops!", "Gira tu teléfono"],
  [
    "We didn’t plan for this... Please rotate your phone back to vertical.",
    "Esta experiencia funciona en vertical. Gira tu teléfono para continuar.",
  ],
  ["Credits", "Créditos"],
  [" Code by ", " Código original: "],
  ["SavoirFaire© 2023.", "Formé · 2026."],
  ["SavoirFaire©", "Formé"],
  ["Savoir Faire", "Formé"],
];

function applyTextAndColorReplacements(source) {
  let next = source;
  for (const [before, after] of textReplacements) {
    next = next.replaceAll(before, after);
  }
  return next
    .replaceAll(/Formé®?/g, "Formé®")
    .replaceAll(/#cdfd50/gi, FORME_RED)
    .replaceAll(/#a9d92e/gi, FORME_RED_MUTED)
    .replaceAll(/#f0442f/gi, FORME_RED)
    .replaceAll(/#b93223/gi, FORME_RED_MUTED);
}

function upsertHtmlTag(source, id, tag, block, beforeTag) {
  const expression = new RegExp(
    `<${tag} id="${id}">[\\s\\S]*?<\\/${tag}>`,
  );
  if (expression.test(source)) return source.replace(expression, block);
  return source.replace(beforeTag, `${block}${beforeTag}`);
}

for (const filename of readdirSync(NUXT)) {
  if (![".js", ".css", ".svg"].includes(extname(filename))) continue;
  const file = new URL(`../public/_nuxt/${filename}`, import.meta.url);
  writeUpdated(file, applyTextAndColorReplacements);
}

writeUpdated(DEFAULT_BUNDLE, (source) =>
  source
    .replace(
      'v(()=>{if(window.skipToContact){const l=document.querySelector(".l__loader");return l.style.display="none",w.setLoaded()}const e=',
      'v(()=>{const l=document.querySelector(".l__loader");l&&(l.style.display="none"),w.setLoaded();return;const e=',
    )
    .replace(
      'const u=()=>{if(window.skipToContact)return t.value.remove();const s=i.timeline',
      'const u=()=>{t.value.remove(),te().value=!0,i.set(".container",{opacity:1}),i.set(".l__menu",{scale:1});return;const s=i.timeline',
    ),
);

writeUpdated(ABOUT_BUNDLE, (source) =>
  applyTextAndColorReplacements(source)
    .replace(
      /(?:\.\/)?stickerPhysics\.(?:ce31be14|forme(?:-f\d+)?)\.js/,
      "./stickerPhysics.forme-f18.js",
    )
    .replace(/zt=\{href:"mailto:[^"]+"/, 'zt={href:"/closet"')
    .replace("window.stickerEngine||it(),Be()", "Be()")
    .replace(
      'Pe=()=>{d.paused()!==!1&&fe()},fe=()=>{E||(De(),_.value.stop(),window.removeEventListener("wheel",x),window.removeEventListener("touchmove",x),oe=!0,w("playover"),f.value="playover")}',
      'Pe=()=>{},fe=()=>{E||(oe=!0,w("playover"),f.value="playover")}',
    )
    .replaceAll('"five"', '"cinco"')
    .replaceAll('"four"', '"cuatro"')
    .replaceAll('"three"', '"tres"')
    .replaceAll('"two"', '"dos"')
    .replaceAll('"one"', '"uno"')
    .replaceAll('"zero"', '"cero"'),
);

copyFileSync(ABOUT_BUNDLE, FORME_ABOUT_BUNDLE);

writeUpdated(ABOUT_HTML, (source) => {
  let next = applyTextAndColorReplacements(source)
    .replace('<html  lang="en">', '<html lang="es">')
    .replace(/href="mailto:[^"]+"/g, 'href="/closet"')
    .replaceAll("five...", "cinco...")
    .replace(
      /\/_nuxt\/(?:about\.a3e1edf1|about\.forme-f\d+)\.js(?:\?v=forme-f\d+)?/g,
      "/_nuxt/about.forme-f18.js",
    )
    .replace(
      '/_nuxt/about.a3e1edf1.js?v=forme-f3" crossorigin',
      '/_nuxt/about.a3e1edf1.js?v=forme-f13" crossorigin',
    )
    .replace(
      '/_nuxt/about.a3e1edf1.js?v=forme-f4" crossorigin',
      '/_nuxt/about.a3e1edf1.js?v=forme-f13" crossorigin',
    )
    .replace(
      '/_nuxt/about.a3e1edf1.js?v=forme-f5" crossorigin',
      '/_nuxt/about.a3e1edf1.js?v=forme-f13" crossorigin',
    )
    .replace(
      '/_nuxt/about.a3e1edf1.js?v=forme-f6" crossorigin',
      '/_nuxt/about.a3e1edf1.js?v=forme-f13" crossorigin',
    )
    .replace(
      '/_nuxt/about.a3e1edf1.js?v=forme-f7" crossorigin',
      '/_nuxt/about.a3e1edf1.js?v=forme-f13" crossorigin',
    )
    .replace(
      '/_nuxt/about.a3e1edf1.js?v=forme-f8" crossorigin',
      '/_nuxt/about.a3e1edf1.js?v=forme-f13" crossorigin',
    )
    .replace(
      '/_nuxt/about.a3e1edf1.js?v=forme-f9" crossorigin',
      '/_nuxt/about.a3e1edf1.js?v=forme-f13" crossorigin',
    )
    .replace(
      '/_nuxt/about.a3e1edf1.js?v=forme-f10" crossorigin',
      '/_nuxt/about.a3e1edf1.js?v=forme-f13" crossorigin',
    )
    .replace(
      '/_nuxt/about.a3e1edf1.js?v=forme-f11" crossorigin',
      '/_nuxt/about.a3e1edf1.js?v=forme-f13" crossorigin',
    )
    .replace(
      '/_nuxt/about.a3e1edf1.js?v=forme-f12" crossorigin',
      '/_nuxt/about.a3e1edf1.js?v=forme-f13" crossorigin',
    );
  next = next
    .replaceAll(LEGACY_SOCIAL_IMAGE_URL, SOCIAL_IMAGE_URL)
    .replaceAll(LEGACY_SOCIAL_IMAGE_URL_ESCAPED, SOCIAL_IMAGE_URL_ESCAPED)
    .replace(
      /og_image:\{dimensions:\{width:\d+,height:\d+\}/,
      "og_image:{dimensions:{width:1600,height:900}",
    )
    .replace(
      /(og_image:\{.*?url:")[^"]+(")/,
      `$1${SOCIAL_IMAGE_URL_ESCAPED}$2`,
    )
    .replace(
      /<meta property="og:image" content="[^"]*">/i,
      `<meta property="og:image" content="${SOCIAL_IMAGE_URL}">`,
    )
    .replace(
      /<meta (?:property|name)="twitter:image" content="[^"]*">/i,
      `<meta property="twitter:image" content="${SOCIAL_IMAGE_URL}">`,
    )
    .replace(
      /<meta property="og:image:secure_url" content="[^"]*">/i,
      `<meta property="og:image:secure_url" content="${SOCIAL_IMAGE_URL}">`,
    );
  next = next
    .replace(/\n?<meta property="og:image:secure_url" content="[^"]*">/i, "")
    .replace(/\n?<meta property="og:image:type" content="[^"]*">/i, "")
    .replace(/\n?<meta property="og:image:width" content="[^"]*">/i, "")
    .replace(/\n?<meta property="og:image:height" content="[^"]*">/i, "")
    .replace(/\n?<meta property="og:image:alt" content="[^"]*">/i, "")
    .replace(/\n?<meta property="og:site_name" content="[^"]*">/i, "")
    .replace(/\n?<meta property="og:url" content="[^"]*">/i, "")
    .replace(/\n?<link rel="canonical" href="[^"]*">/i, "");
  next = next.replace(
    /(<link id="forme-model-preload"[^>]*href=")[^"]+("[^>]*>)/,
    `$1${FORME_MODEL_WEB}$2`,
  );
  if (!next.includes('id="forme-model-preload"')) {
    next = next.replace(
      "</head>",
      `<link id="forme-model-preload" rel="preload" as="fetch" type="model/gltf-binary" href="${FORME_MODEL_WEB}" crossorigin></head>`,
    );
  }
  next = upsertHtmlTag(
    next,
    "forme-app-cta-styles",
    "style",
    APP_CTA_STYLE,
    "</head>",
  );
  return upsertHtmlTag(
    next,
    "forme-app-cta-behavior",
    "script",
    APP_CTA_SCRIPT,
    "</body>",
  );
});

console.log(
  JSON.stringify(
    {
      root: ROOT.pathname,
      public: PUBLIC.pathname,
      desktopCaptions: desktopCaptions.length,
      mobileCaptions: mobileCaptions.length,
      words: allTokens.length,
      duration: 74,
    },
    null,
    2,
  ),
);

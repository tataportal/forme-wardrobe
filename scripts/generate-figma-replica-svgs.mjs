import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "design", "figma-replica");

const COLORS = {
  canvas: "#F1F1EC",
  surface: "#E7E8E3",
  ink: "#111310",
  muted: "#898A85",
  signal: "#E85B45",
  line: "#C9CAC4",
  white: "#FFFFFF",
};

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dataUri(relativePath) {
  const sourcePath = path.join(root, "public", relativePath);
  const sourceExtension = path.extname(sourcePath).slice(1);
  const convertedPath =
    sourceExtension === "webp"
      ? path.join(outDir, "assets", `${path.basename(sourcePath, ".webp")}.png`)
      : sourcePath;
  const absolutePath = fs.existsSync(convertedPath) ? convertedPath : sourcePath;
  const extension = path.extname(absolutePath).slice(1);
  const mime =
    extension === "png"
      ? "image/png"
      : extension === "jpg" || extension === "jpeg"
        ? "image/jpeg"
        : "image/webp";
  return `data:${mime};base64,${fs.readFileSync(absolutePath).toString("base64")}`;
}

function text(x, y, value, options = {}) {
  const {
    size = 14,
    weight = 400,
    fill = COLORS.ink,
    anchor = "start",
    tracking = 0,
    italic = false,
    opacity = 1,
  } = options;
  return `<text x="${x}" y="${y}" fill="${fill}" opacity="${opacity}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${tracking}"${italic ? ' font-style="italic"' : ""}>${esc(value)}</text>`;
}

function garment(x, y, width, height, href, alt) {
  return `
    <g aria-label="${esc(alt)}">
      <image x="${x}" y="${y}" width="${width}" height="${height}" href="${href}" preserveAspectRatio="xMidYMid meet" filter="url(#garmentShadow)"/>
    </g>`;
}

function defs() {
  return `
    <defs>
      <filter id="garmentShadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#111310" flood-opacity=".12"/>
      </filter>
      <filter id="softShadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#111310" flood-opacity=".10"/>
      </filter>
      <clipPath id="profileCircle"><circle cx="16" cy="16" r="16"/></clipPath>
    </defs>`;
}

function homeScreen(width, height, mobile = false) {
  const hero = dataUri("wardrobe/clean/015_DSC01797.webp");
  const nav = mobile
    ? `${text(120, 36, "Closet", { size: 11, weight: 600 })}${text(168, 36, "Canvas", { size: 11, weight: 600 })}${text(219, 36, "Asistente", { size: 11, weight: 600 })}`
    : `${text(640, 37, "Closet", { size: 12, weight: 600, anchor: "middle" })}${text(712, 37, "Canvas", { size: 12, weight: 600, anchor: "middle" })}${text(790, 37, "Asistente", { size: 12, weight: 600, anchor: "middle" })}`;

  if (mobile) {
    return `
      <rect width="${width}" height="${height}" fill="${COLORS.canvas}"/>
      <rect width="${width}" height="64" fill="${COLORS.signal}"/>
      ${text(0, 41, "FORMÉ", { size: 26, weight: 800 })}
      ${text(95, 25, "®", { size: 8, weight: 700 })}
      ${nav}
      ${text(0, 103, "CLOSET VISUAL Y ASISTENTE DE ESTILO", { size: 10, weight: 700, tracking: 1.1 })}
      ${text(0, 167, "Tu ropa ya", { size: 50, weight: 500, tracking: -2.6 })}
      ${text(0, 214, "sabe", { size: 50, weight: 300, tracking: -2.6, italic: true })}
      ${text(117, 214, "quién eres.", { size: 50, weight: 500, tracking: -2.6 })}
      ${text(0, 265, "Digitaliza lo que tienes, crea looks y entiende", { size: 15, weight: 400 })}
      ${text(0, 286, "mejor tu forma de vestir.", { size: 15, weight: 400 })}
      ${text(0, 326, "Abrir mi closet", { size: 14, weight: 700 })}
      ${garment(62, 423, 285, 340, hero, "Blazer gráfico negro digitalizado en Formé")}
    `;
  }

  return `
    <rect width="${width}" height="${height}" fill="${COLORS.canvas}"/>
    <rect width="${width}" height="64" fill="${COLORS.signal}"/>
    ${text(0, 42, "FORMÉ", { size: 28, weight: 800 })}
    ${text(99, 23, "®", { size: 8, weight: 700 })}
    ${nav}
    ${text(0, 286, "CLOSET VISUAL Y ASISTENTE DE ESTILO", { size: 11, weight: 700, tracking: 1.3 })}
    ${text(0, 413, "Tu ropa ya", { size: 124, weight: 500, tracking: -6.4 })}
    ${text(0, 533, "sabe", { size: 124, weight: 300, tracking: -6.4, italic: true })}
    ${text(257, 533, "quién eres.", { size: 124, weight: 500, tracking: -6.4 })}
    ${text(0, 612, "Digitaliza lo que tienes, crea looks y entiende mejor tu forma", { size: 17, weight: 400 })}
    ${text(0, 635, "de vestir.", { size: 17, weight: 400 })}
    ${text(0, 686, "Abrir mi closet", { size: 14, weight: 700 })}
    ${garment(855, 178, 510, 590, hero, "Blazer gráfico negro digitalizado en Formé")}
  `;
}

const closetItems = [
  ["wardrobe/clean/001_DSC01768.webp", "Chaqueta coach Daisy"],
  ["wardrobe/clean/002_DSC01771.webp", "Bomber WFP"],
  ["wardrobe/clean/003_DSC01773.webp", "Abrigo cruzado azul marino"],
  ["wardrobe/clean/004_DSC01775.webp", "Sobrecamisa de cuero con capucha"],
  ["wardrobe/clean/005_DSC01777.webp", "Chaqueta utilitaria"],
  ["wardrobe/clean/006_DSC01779.webp", "Blazer de cuero"],
  ["wardrobe/clean/007_DSC01781.webp", "Trench asimétrico"],
  ["wardrobe/clean/008_DSC01783.webp", "Chaqueta de cuello acolchado"],
  ["wardrobe/clean/009_DSC01785.webp", "Abrigo corto con cinturón"],
  ["wardrobe/clean/010_DSC01787.webp", "Bomber de cuero"],
].map(([src, alt]) => [dataUri(src), alt]);

function profile(x, y, size) {
  const href = dataUri("profile/tata.png");
  return `<g transform="translate(${x} ${y}) scale(${size / 32})"><image width="32" height="32" href="${href}" preserveAspectRatio="xMidYMid slice" clip-path="url(#profileCircle)"/></g>`;
}

function closetScreen(width, height, mobile = false) {
  const headerNav = mobile
    ? ""
    : `${text(640, 37, "Closet", { size: 12, weight: 700, anchor: "middle" })}${text(704, 37, "Canvas", { size: 12, weight: 600, fill: COLORS.muted, anchor: "middle" })}${text(772, 37, "Asistente", { size: 12, weight: 600, fill: COLORS.muted, anchor: "middle" })}`;
  const titleY = mobile ? 128 : 145;
  const titleSize = mobile ? 40 : 64;
  const images = [];

  if (mobile) {
    closetItems.slice(0, 6).forEach(([href, alt], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      images.push(garment(column * 190.5, 152 + row * 236.625, 184.5, 230.625, href, alt));
    });
  } else {
    closetItems.forEach(([href, alt], index) => {
      const column = index % 5;
      const row = Math.floor(index / 5);
      images.push(garment(column * 287, 172 + row * 356.25, 277, 346.25, href, alt));
    });
  }

  return `
    <rect width="${width}" height="${height}" fill="${COLORS.canvas}"/>
    ${text(0, 42, "FORMÉ", { size: mobile ? 26 : 28, weight: 800 })}
    ${text(mobile ? 95 : 99, 23, "®", { size: 8, weight: 700, fill: COLORS.signal })}
    ${headerNav}
    ${profile(mobile ? 343 : 1393, 16, 32)}
    ${text(0, titleY, "Closet/", { size: titleSize, weight: 600, tracking: mobile ? -2.2 : -3.3 })}
    ${text(mobile ? 119 : 189, titleY, "Looks", { size: titleSize, weight: 600, fill: COLORS.muted, tracking: mobile ? -2.2 : -3.3 })}
    ${text(mobile ? 228 : 362, mobile ? 127 : 145, "153", { size: 11, weight: 500, fill: COLORS.muted })}
    ${text(mobile ? 281 : 1326, mobile ? 121 : 139, "Filtrar", { size: 12, weight: 600 })}
    ${text(mobile ? 329 : 1380, mobile ? 121 : 139, "Agregar", { size: 12, weight: 700 })}
    ${images.join("")}
    ${
      mobile
        ? `
          <rect x="0" y="780" width="390" height="64" fill="${COLORS.canvas}" opacity=".96"/>
          ${text(58, 817, "Closet", { size: 11, weight: 700, anchor: "middle" })}
          ${text(195, 817, "Canvas", { size: 11, weight: 600, fill: COLORS.muted, anchor: "middle" })}
          ${text(328, 817, "Asistente", { size: 11, weight: 600, fill: COLORS.muted, anchor: "middle" })}
        `
        : ""
    }
  `;
}

function boardSvg(pageTitle, desktopContent, mobileContent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1930" height="1010" viewBox="0 0 1930 1010">
    ${defs()}
    <rect width="1930" height="1010" fill="#DADBD6"/>
    ${text(24, 32, `${pageTitle} / DESKTOP`, { size: 12, weight: 700, tracking: 1.4 })}
    ${text(1514, 32, `${pageTitle} / MOBILE`, { size: 12, weight: 700, tracking: 1.4 })}
    <svg x="24" y="54" width="1440" height="900" viewBox="0 0 1440 900">
      ${desktopContent}
    </svg>
    <svg x="1514" y="54" width="390" height="844" viewBox="0 0 390 844">
      ${mobileContent}
    </svg>
  </svg>`;
}

function homeFullDesktop() {
  const hero = dataUri("wardrobe/clean/015_DSC01797.webp");
  const coach = dataUri("wardrobe/clean/001_DSC01768.webp");
  const bomber = dataUri("wardrobe/clean/002_DSC01771.webp");
  const openLeather = dataUri("wardrobe/clean/004_DSC01775-open.webp");
  const tee = dataUri("wardrobe/imports/2026-07-18/017_DSC01950.webp");
  const pants = dataUri("wardrobe/imports/2026-07-18/082_DSC01905.webp");
  const sneakers = dataUri("wardrobe/imports/2026-07-18/049_DSC01993.webp");

  return `
    <rect width="1440" height="4800" fill="${COLORS.canvas}"/>

    <!-- 01 Hero -->
    <g id="hero">
      <rect width="1440" height="64" fill="${COLORS.signal}"/>
      ${text(0, 42, "FORMÉ", { size: 28, weight: 800 })}
      ${text(99, 23, "®", { size: 8, weight: 700 })}
      ${text(640, 37, "Closet", { size: 12, weight: 600, anchor: "middle" })}
      ${text(712, 37, "Canvas", { size: 12, weight: 600, anchor: "middle" })}
      ${text(790, 37, "Asistente", { size: 12, weight: 600, anchor: "middle" })}
      ${text(0, 286, "CLOSET VISUAL Y ASISTENTE DE ESTILO", { size: 11, weight: 700, tracking: 1.3 })}
      ${text(0, 413, "Tu ropa ya", { size: 124, weight: 500, tracking: -6.4 })}
      ${text(0, 533, "sabe", { size: 124, weight: 300, tracking: -6.4, italic: true })}
      ${text(257, 533, "quién eres.", { size: 124, weight: 500, tracking: -6.4 })}
      ${text(0, 612, "Digitaliza lo que tienes, crea looks y entiende mejor tu forma", { size: 17, weight: 400 })}
      ${text(0, 635, "de vestir.", { size: 17, weight: 400 })}
      ${text(0, 686, "Abrir mi closet", { size: 14, weight: 700 })}
      ${garment(855, 178, 510, 590, hero, "Blazer gráfico negro digitalizado en Formé")}
    </g>

    <!-- 02 Product premise -->
    <g id="premise">
      <rect y="900" width="1440" height="600" fill="${COLORS.ink}"/>
      ${text(64, 982, "01 / LEER", { size: 11, weight: 700, tracking: 1.8, fill: COLORS.white })}
      ${text(64, 1135, "Tu closet no está vacío.", { size: 76, weight: 500, tracking: -3.8, fill: COLORS.white })}
      ${text(64, 1227, "Está sin leer.", { size: 76, weight: 300, tracking: -3.8, fill: COLORS.white, italic: true })}
      ${text(930, 1125, "Formé reconoce lo que tienes,", { size: 22, weight: 400, fill: COLORS.white })}
      ${text(930, 1156, "cómo lo combinas y qué termina", { size: 22, weight: 400, fill: COLORS.white })}
      ${text(930, 1187, "repitiéndose.", { size: 22, weight: 400, fill: COLORS.white })}
      ${text(930, 1282, "Tu ropa deja de ser inventario.", { size: 14, weight: 500, fill: "#AEB0AA" })}
      ${text(930, 1307, "Se convierte en contexto.", { size: 14, weight: 500, fill: "#AEB0AA" })}
    </g>

    <!-- 03 Closet -->
    <g id="closet">
      <rect y="1500" width="1440" height="950" fill="${COLORS.canvas}"/>
      ${text(64, 1590, "MI CLOSET / 153 PRENDAS", { size: 11, weight: 700, tracking: 1.6 })}
      ${text(64, 1720, "Todo lo que tienes,", { size: 74, weight: 500, tracking: -3.8 })}
      ${text(64, 1803, "a la vista.", { size: 74, weight: 300, tracking: -3.8, italic: true })}
      ${garment(20, 1850, 260, 390, coach, "Chaqueta coach")}
      ${garment(300, 1850, 260, 390, bomber, "Bomber negra")}
      ${garment(580, 1850, 260, 390, tee, "T-shirt blanca")}
      ${garment(860, 1850, 260, 390, pants, "Pantalón azul")}
      ${garment(1140, 1850, 260, 390, sneakers, "Sneakers blancas y azules")}
      ${text(64, 2370, "No carpetas. No listas. Tu closet completo, visible.", { size: 16, weight: 500, fill: COLORS.muted })}
      ${text(1376, 2370, "Explorar mi closet ↗", { size: 14, weight: 700, anchor: "end" })}
    </g>

    <!-- 04 Canvas -->
    <g id="canvas">
      <rect y="2450" width="1440" height="950" fill="${COLORS.surface}"/>
      ${text(64, 2540, "02 / CANVAS", { size: 11, weight: 700, tracking: 1.8 })}
      ${text(64, 2700, "Prueba antes", { size: 78, weight: 500, tracking: -4 })}
      ${text(64, 2792, "de vestirte.", { size: 78, weight: 300, tracking: -4, italic: true })}
      ${text(64, 2880, "Combina, reemplaza y guarda.", { size: 19, weight: 400 })}
      ${text(64, 2907, "Sin perder una mañana frente al espejo.", { size: 19, weight: 400 })}
      ${text(64, 3000, "Abrir canvas ↗", { size: 14, weight: 700 })}
      ${garment(880, 2590, 310, 388, tee, "T-shirt blanca en canvas")}
      ${garment(875, 2940, 320, 400, pants, "Pantalón azul en canvas")}
      ${garment(914, 3260, 250, 128, sneakers, "Sneakers en canvas")}
      ${garment(760, 2500, 550, 690, openLeather, "Sobrecamisa de cuero abierta en canvas")}
    </g>

    <!-- 05 Assistant -->
    <g id="assistant">
      <rect y="3400" width="1440" height="700" fill="${COLORS.signal}"/>
      ${text(64, 3490, "03 / ASISTENTE", { size: 11, weight: 700, tracking: 1.8 })}
      ${text(64, 3650, "Pregúntale a tu", { size: 78, weight: 500, tracking: -4 })}
      ${text(64, 3742, "propio closet.", { size: 78, weight: 300, tracking: -4, italic: true })}
      ${text(64, 3890, "“¿Qué me pongo para una cena casual?”", { size: 34, weight: 500 })}
      ${text(880, 3570, "Empieza con el pantalón azul.", { size: 22, weight: 600 })}
      ${text(880, 3610, "La camiseta blanca baja el contraste;", { size: 18, weight: 400 })}
      ${text(880, 3640, "la sobrecamisa de cuero lo mantiene", { size: 18, weight: 400 })}
      ${text(880, 3670, "intencional sin verse demasiado formal.", { size: 18, weight: 400 })}
      ${text(880, 3770, "Basado en tus prendas, tus looks", { size: 13, weight: 600, fill: "#73291F" })}
      ${text(880, 3793, "guardados y lo que no quieres usar.", { size: 13, weight: 600, fill: "#73291F" })}
    </g>

    <!-- 06 Final -->
    <g id="final">
      <rect y="4100" width="1440" height="700" fill="${COLORS.ink}"/>
      ${text(64, 4200, "FORMÉ®", { size: 16, weight: 800, fill: COLORS.white })}
      ${text(64, 4350, "Usa más.", { size: 92, weight: 500, tracking: -4.8, fill: COLORS.white })}
      ${text(64, 4450, "Compra mejor.", { size: 92, weight: 500, tracking: -4.8, fill: COLORS.white })}
      ${text(64, 4550, "Vístete como tú.", { size: 92, weight: 300, tracking: -4.8, fill: COLORS.white, italic: true })}
      ${text(64, 4660, "Crear mi closet ↗", { size: 16, weight: 700, fill: COLORS.signal })}
      ${text(1376, 4660, "Closet   Canvas   Asistente", { size: 13, weight: 600, fill: "#AEB0AA", anchor: "end" })}
      ${text(1376, 4745, "forme.gallery", { size: 12, weight: 600, fill: COLORS.white, anchor: "end" })}
    </g>
  `;
}

function homeFullMobile() {
  const hero = dataUri("wardrobe/clean/015_DSC01797.webp");
  const coach = dataUri("wardrobe/clean/001_DSC01768.webp");
  const bomber = dataUri("wardrobe/clean/002_DSC01771.webp");
  const openLeather = dataUri("wardrobe/clean/004_DSC01775-open.webp");
  const tee = dataUri("wardrobe/imports/2026-07-18/017_DSC01950.webp");
  const pants = dataUri("wardrobe/imports/2026-07-18/082_DSC01905.webp");
  const sneakers = dataUri("wardrobe/imports/2026-07-18/049_DSC01993.webp");

  return `
    <rect width="390" height="4600" fill="${COLORS.canvas}"/>

    <g id="hero-mobile">
      <rect width="390" height="64" fill="${COLORS.signal}"/>
      ${text(0, 41, "FORMÉ", { size: 26, weight: 800 })}
      ${text(95, 25, "®", { size: 8, weight: 700 })}
      ${text(120, 36, "Closet", { size: 11, weight: 600 })}
      ${text(168, 36, "Canvas", { size: 11, weight: 600 })}
      ${text(219, 36, "Asistente", { size: 11, weight: 600 })}
      ${text(0, 103, "CLOSET VISUAL Y ASISTENTE DE ESTILO", { size: 10, weight: 700, tracking: 1.1 })}
      ${text(0, 167, "Tu ropa ya", { size: 50, weight: 500, tracking: -2.6 })}
      ${text(0, 214, "sabe", { size: 50, weight: 300, tracking: -2.6, italic: true })}
      ${text(117, 214, "quién eres.", { size: 50, weight: 500, tracking: -2.6 })}
      ${text(0, 265, "Digitaliza lo que tienes, crea looks y entiende", { size: 15, weight: 400 })}
      ${text(0, 286, "mejor tu forma de vestir.", { size: 15, weight: 400 })}
      ${text(0, 326, "Abrir mi closet", { size: 14, weight: 700 })}
      ${garment(62, 423, 285, 340, hero, "Blazer gráfico negro digitalizado en Formé")}
    </g>

    <g id="premise-mobile">
      <rect y="844" width="390" height="556" fill="${COLORS.ink}"/>
      ${text(20, 910, "01 / LEER", { size: 10, weight: 700, tracking: 1.5, fill: COLORS.white })}
      ${text(20, 1015, "Tu closet no", { size: 45, weight: 500, tracking: -2.2, fill: COLORS.white })}
      ${text(20, 1065, "está vacío.", { size: 45, weight: 500, tracking: -2.2, fill: COLORS.white })}
      ${text(20, 1125, "Está sin leer.", { size: 45, weight: 300, tracking: -2.2, fill: COLORS.white, italic: true })}
      ${text(20, 1220, "Formé reconoce lo que tienes,", { size: 17, weight: 400, fill: COLORS.white })}
      ${text(20, 1244, "cómo lo combinas y qué termina", { size: 17, weight: 400, fill: COLORS.white })}
      ${text(20, 1268, "repitiéndose.", { size: 17, weight: 400, fill: COLORS.white })}
      ${text(20, 1340, "Tu ropa deja de ser inventario.", { size: 13, weight: 500, fill: "#AEB0AA" })}
      ${text(20, 1360, "Se convierte en contexto.", { size: 13, weight: 500, fill: "#AEB0AA" })}
    </g>

    <g id="closet-mobile">
      <rect y="1400" width="390" height="1100" fill="${COLORS.canvas}"/>
      ${text(20, 1470, "MI CLOSET / 153 PRENDAS", { size: 10, weight: 700, tracking: 1.4 })}
      ${text(20, 1560, "Todo lo que tienes,", { size: 42, weight: 500, tracking: -2.2 })}
      ${text(20, 1610, "a la vista.", { size: 42, weight: 300, tracking: -2.2, italic: true })}
      ${garment(0, 1650, 190, 260, coach, "Chaqueta coach")}
      ${garment(200, 1650, 190, 260, bomber, "Bomber negra")}
      ${garment(0, 1910, 190, 260, tee, "T-shirt blanca")}
      ${garment(200, 1910, 190, 260, pants, "Pantalón azul")}
      ${garment(0, 2170, 190, 260, sneakers, "Sneakers blancas y azules")}
      ${text(20, 2440, "Tu closet completo, visible.", { size: 14, weight: 500, fill: COLORS.muted })}
      ${text(370, 2440, "Explorar ↗", { size: 13, weight: 700, anchor: "end" })}
    </g>

    <g id="canvas-mobile">
      <rect y="2500" width="390" height="950" fill="${COLORS.surface}"/>
      ${text(20, 2570, "02 / CANVAS", { size: 10, weight: 700, tracking: 1.5 })}
      ${text(20, 2660, "Prueba antes", { size: 46, weight: 500, tracking: -2.4 })}
      ${text(20, 2712, "de vestirte.", { size: 46, weight: 300, tracking: -2.4, italic: true })}
      ${text(20, 2780, "Combina, reemplaza y guarda.", { size: 16, weight: 400 })}
      ${text(20, 2803, "Sin perder una mañana.", { size: 16, weight: 400 })}
      ${garment(116, 2815, 160, 200, tee, "T-shirt blanca en canvas")}
      ${garment(112, 3010, 166, 208, pants, "Pantalón azul en canvas")}
      ${garment(133, 3190, 124, 70, sneakers, "Sneakers en canvas")}
      ${garment(58, 2780, 280, 350, openLeather, "Sobrecamisa abierta en canvas")}
      ${text(20, 3390, "Abrir canvas ↗", { size: 13, weight: 700 })}
    </g>

    <g id="assistant-mobile">
      <rect y="3450" width="390" height="600" fill="${COLORS.signal}"/>
      ${text(20, 3520, "03 / ASISTENTE", { size: 10, weight: 700, tracking: 1.5 })}
      ${text(20, 3610, "Pregúntale a tu", { size: 43, weight: 500, tracking: -2.2 })}
      ${text(20, 3660, "propio closet.", { size: 43, weight: 300, tracking: -2.2, italic: true })}
      ${text(20, 3760, "“¿Qué me pongo para", { size: 24, weight: 500 })}
      ${text(20, 3790, "una cena casual?”", { size: 24, weight: 500 })}
      ${text(20, 3880, "Empieza con el pantalón azul.", { size: 17, weight: 700 })}
      ${text(20, 3910, "La camiseta blanca baja el contraste;", { size: 14, weight: 400 })}
      ${text(20, 3932, "la sobrecamisa lo mantiene intencional.", { size: 14, weight: 400 })}
      ${text(20, 3990, "Basado en tu closet y preferencias.", { size: 12, weight: 600, fill: "#73291F" })}
    </g>

    <g id="final-mobile">
      <rect y="4050" width="390" height="550" fill="${COLORS.ink}"/>
      ${text(20, 4120, "FORMÉ®", { size: 14, weight: 800, fill: COLORS.white })}
      ${text(20, 4240, "Usa más.", { size: 50, weight: 500, tracking: -2.5, fill: COLORS.white })}
      ${text(20, 4300, "Compra mejor.", { size: 50, weight: 500, tracking: -2.5, fill: COLORS.white })}
      ${text(20, 4360, "Vístete como tú.", { size: 50, weight: 300, tracking: -2.5, fill: COLORS.white, italic: true })}
      ${text(20, 4460, "Crear mi closet ↗", { size: 15, weight: 700, fill: COLORS.signal })}
      ${text(20, 4550, "forme.gallery", { size: 12, weight: 600, fill: "#AEB0AA" })}
    </g>
  `;
}

function fullHomeBoardSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1930" height="4910" viewBox="0 0 1930 4910">
    ${defs()}
    <rect width="1930" height="4910" fill="#DADBD6"/>
    ${text(24, 32, "PORTADA COMPLETA / DESKTOP", { size: 12, weight: 700, tracking: 1.4 })}
    ${text(1514, 32, "PORTADA COMPLETA / MOBILE", { size: 12, weight: 700, tracking: 1.4 })}
    <svg x="24" y="54" width="1440" height="4800" viewBox="0 0 1440 4800">
      ${homeFullDesktop()}
    </svg>
    <svg x="1514" y="54" width="390" height="4600" viewBox="0 0 390 4600">
      ${homeFullMobile()}
    </svg>
  </svg>`;
}

function homeRefinedDesktop() {
  const hero = dataUri("wardrobe/clean/015_DSC01797.webp");
  const coach = dataUri("wardrobe/clean/001_DSC01768.webp");
  const bomber = dataUri("wardrobe/clean/002_DSC01771.webp");
  const navyCoat = dataUri("wardrobe/clean/003_DSC01773.webp");
  const openLeather = dataUri("wardrobe/clean/004_DSC01775-open.webp");
  const tee = dataUri("wardrobe/imports/2026-07-18/017_DSC01950.webp");
  const pants = dataUri("wardrobe/imports/2026-07-18/082_DSC01905.webp");
  const sneakers = dataUri("wardrobe/imports/2026-07-18/049_DSC01993.webp");

  return `
    <rect width="1440" height="4800" fill="${COLORS.canvas}"/>

    <!-- Hero: preserve the approved product language -->
    <g id="hero">
      <rect width="1440" height="64" fill="${COLORS.signal}"/>
      ${text(0, 42, "FORMÉ", { size: 28, weight: 800 })}
      ${text(99, 23, "®", { size: 8, weight: 700 })}
      ${text(640, 37, "Closet", { size: 12, weight: 600, anchor: "middle" })}
      ${text(712, 37, "Canvas", { size: 12, weight: 600, anchor: "middle" })}
      ${text(790, 37, "Asistente", { size: 12, weight: 600, anchor: "middle" })}
      ${text(0, 286, "CLOSET VISUAL Y ASISTENTE DE ESTILO", { size: 11, weight: 700, tracking: 1.3 })}
      ${text(0, 413, "Tu ropa ya", { size: 124, weight: 500, tracking: -6.4 })}
      ${text(0, 533, "sabe", { size: 124, weight: 300, tracking: -6.4, italic: true })}
      ${text(257, 533, "quién eres.", { size: 124, weight: 500, tracking: -6.4 })}
      ${text(0, 612, "Digitaliza lo que tienes, crea looks y entiende mejor tu forma", { size: 17, weight: 400 })}
      ${text(0, 635, "de vestir.", { size: 17, weight: 400 })}
      ${text(0, 686, "Abrir mi closet", { size: 14, weight: 700 })}
      ${garment(855, 178, 510, 590, hero, "Blazer gráfico negro digitalizado en Formé")}
    </g>

    <!-- Closet: a single editorial field, no cards -->
    <g id="closet-story">
      ${text(64, 1060, "Todo tu closet.", { size: 82, weight: 500, tracking: -4.2 })}
      ${text(64, 1152, "Sin carpetas. Sin listas.", { size: 82, weight: 300, tracking: -4.2, italic: true })}
      ${text(64, 1220, "Cada prenda completa, limpia y en el mismo lugar.", { size: 17, weight: 400, fill: COLORS.muted })}
      ${text(58, 1600, "153", { size: 480, weight: 500, tracking: -26, fill: "#E1E2DD" })}
      ${garment(20, 1290, 265, 390, coach, "Chaqueta coach")}
      ${garment(285, 1360, 270, 395, bomber, "Bomber negra")}
      ${garment(560, 1235, 250, 370, tee, "T-shirt blanca")}
      ${garment(815, 1285, 260, 410, pants, "Pantalón azul")}
      ${garment(1060, 1455, 340, 250, sneakers, "Sneakers blancas y azules")}
      ${text(64, 1815, "153 prendas. Una sola vista.", { size: 14, weight: 700 })}
      ${text(1376, 1815, "Filtra cuando lo necesites.", { size: 14, weight: 500, fill: COLORS.muted, anchor: "end" })}
    </g>

    <!-- Canvas: the product becomes the composition -->
    <g id="canvas-story">
      <rect y="1940" width="1440" height="1180" fill="${COLORS.surface}"/>
      ${text(64, 2085, "Un canvas.", { size: 88, weight: 500, tracking: -4.6 })}
      ${text(64, 2182, "Más posibilidades.", { size: 88, weight: 300, tracking: -4.6, italic: true })}
      ${text(64, 2255, "Añade una base, cambia una capa y guarda lo que funciona.", { size: 17, weight: 400, fill: COLORS.muted })}
      ${garment(615, 2240, 210, 263, tee, "T-shirt blanca en canvas")}
      ${garment(600, 2480, 240, 350, pants, "Pantalón azul en canvas")}
      ${garment(625, 2775, 210, 130, sneakers, "Sneakers blancas y azules en canvas")}
      ${garment(510, 2170, 420, 525, openLeather, "Sobrecamisa de cuero abierta en canvas")}
      ${garment(65, 2470, 250, 340, navyCoat, "Alternativa de abrigo")}
      ${garment(1125, 2410, 250, 340, bomber, "Alternativa bomber")}
      ${text(64, 2910, "CAMBIA LA CAPA", { size: 11, weight: 700, tracking: 1.4, fill: COLORS.signal })}
      ${text(1376, 2910, "GUARDA EL LOOK", { size: 11, weight: 700, tracking: 1.4, fill: COLORS.signal, anchor: "end" })}
    </g>

    <!-- Assistant: one question, one reasoned answer -->
    <g id="assistant-story">
      ${text(64, 3310, "¿Qué me pongo para", { size: 90, weight: 500, tracking: -4.8, fill: COLORS.signal })}
      ${text(64, 3410, "una cena casual?", { size: 90, weight: 300, tracking: -4.8, fill: COLORS.signal, italic: true })}
      ${text(860, 3570, "Empieza con el pantalón azul.", { size: 24, weight: 700 })}
      ${text(860, 3612, "La camiseta blanca baja el contraste y la", { size: 18, weight: 400 })}
      ${text(860, 3640, "sobrecamisa mantiene el look intencional.", { size: 18, weight: 400 })}
      ${text(860, 3705, "Basado en tu closet y tus preferencias.", { size: 13, weight: 600, fill: COLORS.muted })}
      ${garment(64, 3510, 160, 220, tee, "Recomendación camiseta")}
      ${garment(225, 3480, 175, 255, pants, "Recomendación pantalón")}
      ${garment(395, 3540, 180, 135, sneakers, "Recomendación calzado")}
      ${garment(565, 3485, 235, 295, openLeather, "Recomendación sobrecamisa abierta")}
    </g>

    <!-- Final: quiet close, same theme -->
    <g id="final">
      ${text(64, 4150, "Empieza por", { size: 108, weight: 500, tracking: -5.8 })}
      ${text(64, 4265, "lo que ya tienes.", { size: 108, weight: 300, tracking: -5.8, italic: true })}
      ${text(64, 4360, "Tu closet es suficiente para comenzar.", { size: 18, weight: 400, fill: COLORS.muted })}
      ${text(64, 4430, "Abrir mi closet", { size: 16, weight: 700, fill: COLORS.signal })}
      ${garment(925, 3940, 530, 670, hero, "Blazer gráfico de cierre")}
      ${text(64, 4735, "FORMÉ®", { size: 18, weight: 800 })}
      ${text(1376, 4735, "forme.gallery", { size: 13, weight: 600, fill: COLORS.muted, anchor: "end" })}
    </g>
  `;
}

function homeRefinedMobile() {
  const hero = dataUri("wardrobe/clean/015_DSC01797.webp");
  const coach = dataUri("wardrobe/clean/001_DSC01768.webp");
  const bomber = dataUri("wardrobe/clean/002_DSC01771.webp");
  const navyCoat = dataUri("wardrobe/clean/003_DSC01773.webp");
  const openLeather = dataUri("wardrobe/clean/004_DSC01775-open.webp");
  const tee = dataUri("wardrobe/imports/2026-07-18/017_DSC01950.webp");
  const pants = dataUri("wardrobe/imports/2026-07-18/082_DSC01905.webp");
  const sneakers = dataUri("wardrobe/imports/2026-07-18/049_DSC01993.webp");

  return `
    <rect width="390" height="4600" fill="${COLORS.canvas}"/>

    <g id="hero-mobile">
      <rect width="390" height="64" fill="${COLORS.signal}"/>
      ${text(0, 41, "FORMÉ", { size: 26, weight: 800 })}
      ${text(95, 25, "®", { size: 8, weight: 700 })}
      ${text(120, 36, "Closet", { size: 11, weight: 600 })}
      ${text(168, 36, "Canvas", { size: 11, weight: 600 })}
      ${text(219, 36, "Asistente", { size: 11, weight: 600 })}
      ${text(0, 103, "CLOSET VISUAL Y ASISTENTE DE ESTILO", { size: 10, weight: 700, tracking: 1.1 })}
      ${text(0, 167, "Tu ropa ya", { size: 50, weight: 500, tracking: -2.6 })}
      ${text(0, 214, "sabe", { size: 50, weight: 300, tracking: -2.6, italic: true })}
      ${text(117, 214, "quién eres.", { size: 50, weight: 500, tracking: -2.6 })}
      ${text(0, 265, "Digitaliza lo que tienes, crea looks y entiende", { size: 15, weight: 400 })}
      ${text(0, 286, "mejor tu forma de vestir.", { size: 15, weight: 400 })}
      ${text(0, 326, "Abrir mi closet", { size: 14, weight: 700 })}
      ${garment(62, 423, 285, 340, hero, "Blazer gráfico negro digitalizado en Formé")}
    </g>

    <g id="closet-story-mobile">
      ${text(20, 965, "Todo tu closet.", { size: 44, weight: 500, tracking: -2.3 })}
      ${text(20, 1018, "Sin carpetas.", { size: 44, weight: 300, tracking: -2.3, italic: true })}
      ${text(20, 1068, "Sin listas.", { size: 44, weight: 300, tracking: -2.3, italic: true })}
      ${text(20, 1120, "Cada prenda completa y en el mismo lugar.", { size: 14, weight: 400, fill: COLORS.muted })}
      ${text(16, 1390, "153", { size: 205, weight: 500, tracking: -12, fill: "#E1E2DD" })}
      ${garment(0, 1170, 190, 250, coach, "Chaqueta coach")}
      ${garment(200, 1180, 190, 250, bomber, "Bomber negra")}
      ${garment(0, 1415, 190, 240, tee, "T-shirt blanca")}
      ${garment(200, 1415, 190, 250, pants, "Pantalón azul")}
      ${garment(75, 1635, 240, 145, sneakers, "Sneakers blancas y azules")}
      ${text(20, 1810, "153 prendas. Una sola vista.", { size: 13, weight: 700 })}
    </g>

    <g id="canvas-story-mobile">
      <rect y="1900" width="390" height="1180" fill="${COLORS.surface}"/>
      ${text(20, 2000, "Un canvas.", { size: 48, weight: 500, tracking: -2.5 })}
      ${text(20, 2055, "Más posibilidades.", { size: 48, weight: 300, tracking: -2.5, italic: true })}
      ${text(20, 2110, "Cambia una capa. Guarda lo que funciona.", { size: 14, weight: 400, fill: COLORS.muted })}
      ${garment(125, 2160, 140, 175, tee, "T-shirt blanca en canvas")}
      ${garment(120, 2325, 150, 210, pants, "Pantalón azul en canvas")}
      ${garment(135, 2500, 120, 70, sneakers, "Sneakers en canvas")}
      ${garment(85, 2120, 220, 275, openLeather, "Sobrecamisa abierta en canvas")}
      ${garment(5, 2660, 155, 220, navyCoat, "Alternativa abrigo")}
      ${garment(230, 2640, 155, 220, bomber, "Alternativa bomber")}
      ${text(20, 2940, "CAMBIA LA CAPA", { size: 10, weight: 700, tracking: 1.2, fill: COLORS.signal })}
      ${text(370, 2940, "GUARDA EL LOOK", { size: 10, weight: 700, tracking: 1.2, fill: COLORS.signal, anchor: "end" })}
    </g>

    <g id="assistant-story-mobile">
      ${text(20, 3230, "¿Qué me pongo", { size: 40, weight: 500, tracking: -2.1, fill: COLORS.signal })}
      ${text(20, 3278, "para una cena casual?", { size: 40, weight: 300, tracking: -2.1, fill: COLORS.signal, italic: true })}
      ${garment(5, 3400, 82, 112, tee, "Recomendación camiseta")}
      ${garment(88, 3388, 90, 130, pants, "Recomendación pantalón")}
      ${garment(178, 3390, 105, 132, openLeather, "Recomendación sobrecamisa abierta")}
      ${garment(282, 3420, 100, 75, sneakers, "Recomendación calzado")}
      ${text(20, 3610, "Empieza con el pantalón azul.", { size: 17, weight: 700 })}
      ${text(20, 3640, "La camiseta baja el contraste y la", { size: 14, weight: 400 })}
      ${text(20, 3662, "sobrecamisa mantiene el look intencional.", { size: 14, weight: 400 })}
      ${text(20, 3725, "Basado en tu closet y preferencias.", { size: 12, weight: 600, fill: COLORS.muted })}
    </g>

    <g id="final-mobile">
      ${text(20, 3970, "Empieza por", { size: 53, weight: 500, tracking: -2.8 })}
      ${text(20, 4030, "lo que ya tienes.", { size: 53, weight: 300, tracking: -2.8, italic: true })}
      ${text(20, 4090, "Tu closet es suficiente para comenzar.", { size: 14, weight: 400, fill: COLORS.muted })}
      ${text(20, 4140, "Abrir mi closet", { size: 14, weight: 700, fill: COLORS.signal })}
      ${garment(80, 4180, 300, 345, hero, "Blazer gráfico de cierre")}
      ${text(20, 4565, "FORMÉ®", { size: 14, weight: 800 })}
      ${text(370, 4565, "forme.gallery", { size: 11, weight: 600, fill: COLORS.muted, anchor: "end" })}
    </g>
  `;
}

function refinedHomeBoardSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1930" height="4910" viewBox="0 0 1930 4910">
    ${defs()}
    <rect width="1930" height="4910" fill="#DADBD6"/>
    ${text(24, 32, "PORTADA / DESKTOP", { size: 12, weight: 700, tracking: 1.4 })}
    ${text(1514, 32, "PORTADA / MOBILE", { size: 12, weight: 700, tracking: 1.4 })}
    <svg x="24" y="54" width="1440" height="4800" viewBox="0 0 1440 4800">
      ${homeRefinedDesktop()}
    </svg>
    <svg x="1514" y="54" width="390" height="4600" viewBox="0 0 390 4600">
      ${homeRefinedMobile()}
    </svg>
  </svg>`;
}

function homeDirectionFramesSvg() {
  const hero = dataUri("wardrobe/clean/015_DSC01797.webp");
  const coach = dataUri("wardrobe/clean/001_DSC01768.webp");
  const bomber = dataUri("wardrobe/clean/002_DSC01771.webp");
  const navyCoat = dataUri("wardrobe/clean/003_DSC01773.webp");
  const openLeather = dataUri("wardrobe/clean/004_DSC01775-open.webp");
  const tee = dataUri("wardrobe/imports/2026-07-18/017_DSC01950.webp");
  const pants = dataUri("wardrobe/imports/2026-07-18/082_DSC01905.webp");
  const sneakers = dataUri("wardrobe/imports/2026-07-18/049_DSC01993.webp");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="3040" height="1000" viewBox="0 0 3040 1000">
    ${defs()}
    <rect width="3040" height="1000" fill="#DADBD6"/>
    ${text(40, 34, "HOME / 01 — IDENTIDAD", { size: 12, weight: 700, tracking: 1.5 })}
    ${text(1560, 34, "HOME / 02 — PRODUCTO EN USO", { size: 12, weight: 700, tracking: 1.5 })}

    <!-- Keyframe 01: identity -->
    <svg x="40" y="60" width="1440" height="900" viewBox="0 0 1440 900">
      <rect width="1440" height="900" fill="${COLORS.canvas}"/>
      <rect width="1440" height="64" fill="${COLORS.signal}"/>
      ${text(0, 42, "FORMÉ", { size: 28, weight: 800 })}
      ${text(99, 23, "®", { size: 8, weight: 700 })}
      ${text(640, 37, "Closet", { size: 12, weight: 600, anchor: "middle" })}
      ${text(712, 37, "Canvas", { size: 12, weight: 600, anchor: "middle" })}
      ${text(790, 37, "Asistente", { size: 12, weight: 600, anchor: "middle" })}
      ${text(56, 218, "CLOSET VISUAL Y ASISTENTE DE ESTILO", { size: 11, weight: 700, tracking: 1.3 })}
      ${text(48, 370, "Tu ropa ya", { size: 128, weight: 500, tracking: -6.8 })}
      ${text(48, 492, "sabe", { size: 128, weight: 300, tracking: -6.8, italic: true })}
      ${text(313, 492, "quién eres.", { size: 128, weight: 500, tracking: -6.8 })}
      ${text(56, 580, "Digitaliza lo que tienes. Crea looks. Entiende lo que repites.", { size: 17, weight: 400 })}
      ${text(56, 650, "Abrir mi closet", { size: 14, weight: 700 })}
      <g transform="rotate(-3 1090 440)">
        ${garment(838, 112, 540, 675, hero, "Blazer gráfico negro digitalizado en Formé")}
      </g>
      ${text(1390, 780, "01", { size: 240, weight: 500, fill: "#DEDFDA", anchor: "end", tracking: -12 })}
      ${text(1390, 828, "SCROLL PARA LEER TU CLOSET ↓", { size: 10, weight: 700, tracking: 1.4, anchor: "end" })}
      <rect x="0" y="876" width="1440" height="24" fill="${COLORS.ink}"/>
      <rect x="0" y="876" width="420" height="24" fill="${COLORS.signal}"/>
    </svg>

    <!-- Keyframe 02: product in use -->
    <svg x="1560" y="60" width="1440" height="900" viewBox="0 0 1440 900">
      <rect width="1440" height="900" fill="${COLORS.ink}"/>
      <rect x="0" y="0" width="356" height="900" fill="${COLORS.canvas}"/>
      ${text(24, 42, "FORMÉ", { size: 26, weight: 800 })}
      ${text(116, 23, "®", { size: 8, weight: 700, fill: COLORS.signal })}
      ${text(24, 104, "CLOSET / 153", { size: 11, weight: 700, tracking: 1.4 })}
      ${garment(15, 118, 158, 225, coach, "Chaqueta coach completa")}
      ${garment(180, 118, 158, 225, bomber, "Bomber completa")}
      ${garment(15, 350, 158, 225, navyCoat, "Abrigo completo")}
      ${garment(180, 350, 158, 225, tee, "Camiseta completa")}
      ${garment(15, 582, 158, 225, pants, "Pantalón completo")}
      ${garment(180, 620, 158, 160, sneakers, "Calzado completo")}
      ${text(24, 862, "SELECCIONA UNA PRENDA →", { size: 10, weight: 700, tracking: 1.3, fill: COLORS.signal })}

      ${text(408, 118, "Arrastra.", { size: 72, weight: 500, tracking: -3.6, fill: COLORS.white })}
      ${text(408, 198, "Mezcla.", { size: 72, weight: 300, tracking: -3.6, fill: COLORS.white, italic: true })}
      ${text(408, 278, "Guarda.", { size: 72, weight: 500, tracking: -3.6, fill: COLORS.white })}
      ${text(408, 322, "La interfaz desaparece. El look queda.", { size: 15, weight: 400, fill: "#AEB0AA" })}

      ${garment(750, 205, 185, 230, tee, "Camiseta en canvas")}
      ${garment(740, 410, 205, 290, pants, "Pantalón en canvas")}
      ${garment(770, 655, 150, 88, sneakers, "Calzado en canvas")}
      ${garment(662, 165, 360, 450, openLeather, "Sobrecamisa abierta en canvas")}

      ${garment(1090, 205, 230, 300, navyCoat, "Alternativa abrigo")}
      ${garment(1115, 520, 205, 275, bomber, "Alternativa bomber")}
      ${text(1080, 840, "CAMBIA LA CAPA", { size: 10, weight: 700, tracking: 1.3, fill: COLORS.signal })}

      <rect x="356" y="804" width="1084" height="96" fill="${COLORS.signal}"/>
      ${text(390, 862, "¿QUÉ ME PONGO HOY?", { size: 32, weight: 700 })}
      ${text(1398, 862, "PREGÚNTALE A TU CLOSET →", { size: 11, weight: 700, tracking: 1.3, anchor: "end" })}
    </svg>
  </svg>`;
}

function homeFinalDesktop() {
  const hero = dataUri("wardrobe/clean/015_DSC01797.webp");
  const coach = dataUri("wardrobe/clean/001_DSC01768.webp");
  const bomber = dataUri("wardrobe/clean/002_DSC01771.webp");
  const navyCoat = dataUri("wardrobe/clean/003_DSC01773.webp");
  const openLeather = dataUri("wardrobe/clean/004_DSC01775-open.webp");
  const tee = dataUri("wardrobe/imports/2026-07-18/017_DSC01950.webp");
  const pants = dataUri("wardrobe/imports/2026-07-18/082_DSC01905.webp");
  const sneakers = dataUri("wardrobe/imports/2026-07-18/049_DSC01993.webp");

  return `
    <rect width="1440" height="6500" fill="${COLORS.canvas}"/>

    <!-- 01 / HERO -->
    <g id="home-hero">
      <rect width="1440" height="920" fill="${COLORS.signal}"/>
      ${text(48, 47, "FORMÉ", { size: 30, weight: 800, tracking: -1.8 })}
      ${text(153, 28, "®", { size: 8, weight: 700 })}
      ${text(650, 43, "Closet", { size: 12, weight: 700, anchor: "middle" })}
      ${text(720, 43, "Canvas", { size: 12, weight: 700, anchor: "middle" })}
      ${text(800, 43, "Asistente", { size: 12, weight: 700, anchor: "middle" })}
      ${text(1392, 43, "Entrar ↗", { size: 12, weight: 700, anchor: "end" })}
      <line x1="48" y1="72" x2="1392" y2="72" stroke="${COLORS.ink}" stroke-width="1" opacity=".28"/>

      ${text(56, 166, "CLOSET VISUAL + ASISTENTE DE ESTILO", { size: 11, weight: 700, tracking: 1.7 })}
      ${text(56, 337, "TU ROPA YA", { size: 128, weight: 600, tracking: -7.4 })}
      ${text(56, 463, "SABE", { size: 128, weight: 300, tracking: -7.4, italic: true })}
      ${text(370, 463, "QUIÉN ERES.", { size: 106, weight: 600, tracking: -6 })}
      ${text(60, 555, "Digitaliza lo que tienes, crea looks y entiende", { size: 19, weight: 500 })}
      ${text(60, 583, "mejor tu forma de vestir.", { size: 19, weight: 500 })}
      <rect x="56" y="635" width="184" height="50" rx="25" fill="${COLORS.ink}"/>
      ${text(148, 666, "ABRIR MI CLOSET ↗", { size: 11, weight: 700, tracking: 1.1, fill: COLORS.white, anchor: "middle" })}
      ${text(270, 666, "VER CÓMO FUNCIONA ↓", { size: 11, weight: 700, tracking: 1.1 })}

      <g transform="rotate(-4 1178 450)">
        ${garment(970, 104, 420, 686, hero, "Blazer gráfico negro digitalizado en Formé")}
      </g>
      ${text(1366, 790, "01", { size: 210, weight: 700, fill: "#D94F3D", anchor: "end", tracking: -10 })}

      <line x1="56" y1="846" x2="1392" y2="846" stroke="${COLORS.ink}" stroke-width="1" opacity=".32"/>
      ${text(56, 883, "01  DIGITALIZA", { size: 10, weight: 700, tracking: 1.4 })}
      ${text(535, 883, "02  COMBINA", { size: 10, weight: 700, tracking: 1.4 })}
      ${text(1002, 883, "03  ENTIENDE", { size: 10, weight: 700, tracking: 1.4 })}
      <rect x="56" y="903" width="448" height="4" fill="${COLORS.ink}"/>
      <rect x="504" y="903" width="888" height="4" fill="#C84635"/>
    </g>

    <!-- 02 / BRAND THESIS -->
    <g id="home-thesis">
      <rect y="920" width="1440" height="740" fill="${COLORS.ink}"/>
      ${text(56, 1008, "EL PUNTO DE PARTIDA", { size: 11, weight: 700, tracking: 1.8, fill: COLORS.signal })}
      ${text(56, 1164, "EL ESTILO NO ES", { size: 86, weight: 600, tracking: -4.8, fill: COLORS.white })}
      ${text(56, 1256, "LO QUE COMPRAS.", { size: 86, weight: 600, tracking: -4.8, fill: COLORS.white })}
      ${text(56, 1362, "ES LO QUE", { size: 86, weight: 300, tracking: -4.8, fill: COLORS.white, italic: true })}
      ${text(433, 1362, "REPITES.", { size: 86, weight: 600, tracking: -4.8, fill: COLORS.signal })}

      ${text(938, 1138, "Formé convierte tu ropa en un sistema vivo:", { size: 18, weight: 500, fill: COLORS.white })}
      ${text(938, 1170, "lo que tienes, lo que guardas, lo que evitas", { size: 18, weight: 500, fill: COLORS.white })}
      ${text(938, 1202, "y lo que terminas eligiendo.", { size: 18, weight: 500, fill: COLORS.white })}
      <line x1="938" y1="1260" x2="1392" y2="1260" stroke="#5D5F5A" stroke-width="1"/>
      ${text(938, 1306, "NO MÁS INVENTARIO", { size: 10, weight: 700, tracking: 1.5, fill: "#9D9F99" })}
      ${text(938, 1358, "Contexto para decidir mejor.", { size: 22, weight: 500, fill: COLORS.white })}
      ${text(56, 1557, "LO QUE YA EXISTE EN TU CLOSET ES SUFICIENTE PARA EMPEZAR.", { size: 11, weight: 700, tracking: 1.5, fill: "#9D9F99" })}
      ${text(1392, 1557, "02 / 07", { size: 11, weight: 700, tracking: 1.5, fill: "#9D9F99", anchor: "end" })}
    </g>

    <!-- 03 / CLOSET -->
    <g id="home-closet">
      <rect y="1660" width="1440" height="1260" fill="${COLORS.canvas}"/>
      ${text(56, 1750, "01 / MI CLOSET", { size: 11, weight: 700, tracking: 1.8, fill: COLORS.signal })}
      ${text(56, 1882, "TODO LO QUE TIENES.", { size: 76, weight: 600, tracking: -4.2 })}
      ${text(56, 1965, "UNA SOLA VISTA.", { size: 76, weight: 300, tracking: -4.2, italic: true })}
      ${text(970, 1882, "Cada prenda completa, limpia y en el mismo lugar.", { size: 17, weight: 500 })}
      ${text(970, 1910, "Los filtros aparecen cuando los necesitas.", { size: 17, weight: 500, fill: COLORS.muted })}

      <rect x="40" y="2050" width="1360" height="716" rx="22" fill="#E7E8E3"/>
      <rect x="40" y="2050" width="1360" height="72" rx="22" fill="#DCDD D7"/>
      <rect x="40" y="2100" width="1360" height="22" fill="#DCDDD7"/>
      ${text(68, 2094, "Closet/", { size: 27, weight: 700, tracking: -1.4 })}
      ${text(157, 2094, "Looks", { size: 27, weight: 500, fill: COLORS.muted, tracking: -1.4 })}
      ${text(261, 2093, "153", { size: 10, weight: 700, tracking: 1.1, fill: COLORS.muted })}
      ${text(1282, 2092, "FILTRAR", { size: 10, weight: 700, tracking: 1.1, anchor: "end" })}
      ${text(1372, 2092, "AGREGAR", { size: 10, weight: 700, tracking: 1.1, fill: COLORS.signal, anchor: "end" })}

      ${garment(58, 2140, 220, 420, coach, "Chaqueta coach completa")}
      ${garment(282, 2140, 220, 420, bomber, "Bomber completa")}
      ${garment(506, 2140, 220, 420, navyCoat, "Abrigo azul completo")}
      ${garment(730, 2140, 220, 420, tee, "Camiseta blanca completa")}
      ${garment(954, 2140, 220, 420, pants, "Pantalón azul completo")}
      ${garment(1178, 2140, 204, 420, sneakers, "Sneakers completas")}

      ${text(68, 2615, "Chaqueta coach Daisy", { size: 13, weight: 700 })}
      ${text(292, 2615, "Bomber WFP", { size: 13, weight: 700 })}
      ${text(516, 2615, "Abrigo azul marino", { size: 13, weight: 700 })}
      ${text(740, 2615, "T-shirt blanca", { size: 13, weight: 700 })}
      ${text(964, 2615, "Jeans rectos", { size: 13, weight: 700 })}
      ${text(1188, 2615, "Sneakers Forum", { size: 13, weight: 700 })}

      <rect x="282" y="2654" width="220" height="44" rx="22" fill="${COLORS.ink}"/>
      ${text(392, 2681, "AÑADIR AL CANVAS  +", { size: 10, weight: 700, tracking: .8, fill: COLORS.white, anchor: "middle" })}
      ${text(56, 2844, "153 PRENDAS. TODAS VISIBLES.", { size: 11, weight: 700, tracking: 1.5 })}
      ${text(1392, 2844, "ABRIR MI CLOSET ↗", { size: 11, weight: 700, tracking: 1.5, anchor: "end" })}
    </g>

    <!-- 04 / CANVAS -->
    <g id="home-canvas">
      <rect y="2920" width="1440" height="1300" fill="${COLORS.ink}"/>
      ${text(56, 3010, "02 / CANVAS", { size: 11, weight: 700, tracking: 1.8, fill: COLORS.signal })}
      ${text(56, 3148, "PRUÉBALO", { size: 82, weight: 600, tracking: -4.6, fill: COLORS.white })}
      ${text(56, 3238, "ANTES DE", { size: 82, weight: 600, tracking: -4.6, fill: COLORS.white })}
      ${text(56, 3328, "VESTIRTE.", { size: 82, weight: 300, tracking: -4.6, fill: COLORS.white, italic: true })}
      ${text(60, 3420, "Añade una base. Cambia una capa.", { size: 18, weight: 500, fill: "#B9BBB5" })}
      ${text(60, 3448, "Guarda lo que realmente funciona.", { size: 18, weight: 500, fill: "#B9BBB5" })}
      ${text(60, 3542, "SELECCIONA", { size: 10, weight: 700, tracking: 1.4, fill: COLORS.signal })}
      ${text(180, 3542, "→", { size: 15, weight: 700, fill: COLORS.signal })}
      ${text(220, 3542, "REEMPLAZA", { size: 10, weight: 700, tracking: 1.4, fill: COLORS.signal })}
      ${text(342, 3542, "→", { size: 15, weight: 700, fill: COLORS.signal })}
      ${text(382, 3542, "GUARDA", { size: 10, weight: 700, tracking: 1.4, fill: COLORS.signal })}

      <rect x="530" y="3024" width="862" height="1060" rx="24" fill="#D7D8D3"/>
      <rect x="530" y="3024" width="190" height="1060" rx="24" fill="#C9CAC4"/>
      <rect x="702" y="3024" width="18" height="1060" fill="#C9CAC4"/>
      ${text(554, 3070, "PRENDAS / 153", { size: 10, weight: 700, tracking: 1.3 })}
      ${text(554, 3110, "ABRIGOS", { size: 10, weight: 700, tracking: 1.2, fill: COLORS.muted })}
      ${garment(548, 3145, 150, 190, coach, "Chaqueta alternativa")}
      ${garment(548, 3350, 150, 190, bomber, "Bomber alternativa")}
      ${garment(548, 3555, 150, 190, navyCoat, "Abrigo alternativo")}
      ${text(554, 4012, "ARRASTRA PARA AÑADIR", { size: 9, weight: 700, tracking: 1.1, fill: COLORS.muted })}

      <rect x="744" y="3070" width="608" height="896" fill="#EEEFEA"/>
      ${text(766, 3106, "ÁREA DEL LOOK", { size: 9, weight: 700, tracking: 1.2, fill: COLORS.muted })}
      <line x1="766" y1="3124" x2="1330" y2="3124" stroke="#D4D5D0" stroke-width="1"/>
      ${garment(945, 3180, 210, 262, tee, "Camiseta blanca en canvas")}
      ${garment(930, 3415, 240, 336, pants, "Pantalón azul en canvas")}
      ${garment(955, 3690, 190, 118, sneakers, "Sneakers en canvas")}
      ${garment(820, 3105, 480, 600, openLeather, "Sobrecamisa abierta para layering")}
      <rect x="806" y="3100" width="496" height="616" fill="none" stroke="${COLORS.signal}" stroke-width="1.5" stroke-dasharray="8 8" opacity=".75"/>
      <circle cx="806" cy="3100" r="8" fill="${COLORS.signal}"/>
      <circle cx="1302" cy="3100" r="8" fill="${COLORS.signal}"/>
      <circle cx="806" cy="3716" r="8" fill="${COLORS.signal}"/>
      <circle cx="1302" cy="3716" r="8" fill="${COLORS.signal}"/>

      <rect x="744" y="3984" width="608" height="70" fill="${COLORS.ink}"/>
      ${text(772, 4026, "GUARDAR LOOK", { size: 10, weight: 700, tracking: 1.1, fill: COLORS.white })}
      ${text(931, 4026, "DUPLICAR", { size: 10, weight: 700, tracking: 1.1, fill: "#AEB0AA" })}
      ${text(1051, 4026, "MEZCLAR", { size: 10, weight: 700, tracking: 1.1, fill: COLORS.signal })}
      ${text(1235, 4026, "COMPARTIR ↗", { size: 10, weight: 700, tracking: 1.1, fill: "#AEB0AA" })}
      ${text(60, 4125, "EL CANVAS NO INVENTA TU ESTILO. TE DEJA VERLO.", { size: 11, weight: 700, tracking: 1.4, fill: "#8E908B" })}
    </g>

    <!-- 05 / ASSISTANT -->
    <g id="home-assistant">
      <rect y="4220" width="1440" height="860" fill="${COLORS.signal}"/>
      ${text(56, 4310, "03 / ASISTENTE", { size: 11, weight: 700, tracking: 1.8 })}
      ${text(56, 4468, "“¿QUÉ ME PONGO", { size: 76, weight: 600, tracking: -4.2 })}
      ${text(56, 4552, "PARA UNA CENA", { size: 76, weight: 600, tracking: -4.2 })}
      ${text(56, 4636, "CASUAL?”", { size: 76, weight: 300, tracking: -4.2, italic: true })}
      ${text(60, 4734, "Pregunta como hablas. Formé responde", { size: 18, weight: 500 })}
      ${text(60, 4762, "con prendas que realmente tienes.", { size: 18, weight: 500 })}

      <rect x="790" y="4308" width="602" height="620" rx="22" fill="${COLORS.ink}"/>
      ${text(826, 4362, "RECOMENDACIÓN / CENA CASUAL", { size: 10, weight: 700, tracking: 1.4, fill: COLORS.signal })}
      ${text(826, 4444, "Empieza con el pantalón azul.", { size: 24, weight: 700, fill: COLORS.white })}
      ${text(826, 4490, "La camiseta blanca baja el contraste;", { size: 17, weight: 500, fill: "#CFD1CB" })}
      ${text(826, 4518, "la sobrecamisa de cuero mantiene el look", { size: 17, weight: 500, fill: "#CFD1CB" })}
      ${text(826, 4546, "intencional sin hacerlo demasiado formal.", { size: 17, weight: 500, fill: "#CFD1CB" })}
      ${garment(812, 4590, 118, 148, tee, "Camiseta recomendada")}
      ${garment(930, 4582, 126, 158, pants, "Pantalón recomendado")}
      ${garment(1050, 4570, 160, 200, openLeather, "Sobrecamisa recomendada")}
      ${garment(1210, 4625, 154, 104, sneakers, "Sneakers recomendadas")}
      <line x1="826" y1="4806" x2="1356" y2="4806" stroke="#42443F" stroke-width="1"/>
      ${text(826, 4852, "BASADO EN", { size: 9, weight: 700, tracking: 1.3, fill: "#8E908B" })}
      ${text(918, 4852, "TU CLOSET + TUS LOOKS + TUS RESTRICCIONES", { size: 9, weight: 700, tracking: 1.3, fill: COLORS.white })}
      ${text(56, 5010, "NO ES RANDOM. PUEDE EXPLICAR CADA ELECCIÓN.", { size: 11, weight: 700, tracking: 1.4 })}
      ${text(1392, 5010, "PREGUNTAR AL ASISTENTE ↗", { size: 11, weight: 700, tracking: 1.4, anchor: "end" })}
    </g>

    <!-- 06 / LOOP -->
    <g id="home-loop">
      <rect y="5080" width="1440" height="700" fill="${COLORS.canvas}"/>
      ${text(56, 5170, "UN SISTEMA QUE APRENDE CONTIGO", { size: 11, weight: 700, tracking: 1.8, fill: COLORS.signal })}
      ${text(56, 5304, "DIGITALIZA.", { size: 68, weight: 600, tracking: -3.8 })}
      ${text(465, 5304, "COMBINA.", { size: 68, weight: 300, tracking: -3.8, italic: true })}
      ${text(815, 5304, "ENTIENDE.", { size: 68, weight: 600, tracking: -3.8 })}
      ${text(1160, 5304, "REPITE.", { size: 68, weight: 300, tracking: -3.8, italic: true })}
      <line x1="56" y1="5362" x2="1392" y2="5362" stroke="${COLORS.ink}" stroke-width="1"/>
      <circle cx="56" cy="5362" r="7" fill="${COLORS.signal}"/>
      <circle cx="465" cy="5362" r="7" fill="${COLORS.ink}"/>
      <circle cx="815" cy="5362" r="7" fill="${COLORS.ink}"/>
      <circle cx="1160" cy="5362" r="7" fill="${COLORS.ink}"/>

      ${text(56, 5450, "01 / SUBE TU ROPA", { size: 10, weight: 700, tracking: 1.3 })}
      ${text(56, 5490, "La convertimos en prendas limpias", { size: 15, weight: 500 })}
      ${text(56, 5514, "y listas para usar.", { size: 15, weight: 500 })}
      ${text(493, 5450, "02 / CREA LOOKS", { size: 10, weight: 700, tracking: 1.3 })}
      ${text(493, 5490, "Combina en el canvas y guarda", { size: 15, weight: 500 })}
      ${text(493, 5514, "solo lo que funciona.", { size: 15, weight: 500 })}
      ${text(848, 5450, "03 / AFINA TU PERFIL", { size: 10, weight: 700, tracking: 1.3 })}
      ${text(848, 5490, "Marca gustos, límites y aquello", { size: 15, weight: 500 })}
      ${text(848, 5514, "que nunca usarías.", { size: 15, weight: 500 })}
      ${text(1218, 5450, "04 / DECIDE MEJOR", { size: 10, weight: 700, tracking: 1.3 })}
      ${text(1218, 5490, "Recibe opciones propias,", { size: 15, weight: 500 })}
      ${text(1218, 5514, "no outfits genéricos.", { size: 15, weight: 500 })}
      ${text(56, 5705, "FORMÉ LEE TU CLOSET. TÚ SIGUES TENIENDO LA ÚLTIMA PALABRA.", { size: 11, weight: 700, tracking: 1.5, fill: COLORS.muted })}
    </g>

    <!-- 07 / FINAL -->
    <g id="home-final">
      <rect y="5780" width="1440" height="720" fill="${COLORS.ink}"/>
      ${text(56, 5870, "FORMÉ®", { size: 17, weight: 800, tracking: -.8, fill: COLORS.white })}
      ${text(56, 6030, "EMPIEZA POR", { size: 88, weight: 600, tracking: -4.8, fill: COLORS.white })}
      ${text(56, 6125, "LO QUE YA TIENES.", { size: 88, weight: 300, tracking: -4.8, fill: COLORS.white, italic: true })}
      ${text(60, 6204, "Tu closet es suficiente para comenzar.", { size: 18, weight: 500, fill: "#B8BAB4" })}
      <rect x="56" y="6250" width="194" height="52" rx="26" fill="${COLORS.signal}"/>
      ${text(153, 6282, "CREAR MI CLOSET ↗", { size: 11, weight: 700, tracking: 1.1, fill: COLORS.ink, anchor: "middle" })}
      ${garment(930, 5785, 500, 650, hero, "Blazer gráfico de cierre")}
      <line x1="56" y1="6418" x2="1392" y2="6418" stroke="#4B4D48" stroke-width="1"/>
      ${text(56, 6460, "forme.gallery", { size: 11, weight: 700, tracking: 1.2, fill: COLORS.white })}
      ${text(1392, 6460, "CLOSET   CANVAS   ASISTENTE", { size: 10, weight: 700, tracking: 1.3, fill: "#92948E", anchor: "end" })}
    </g>
  `.replace("#DCDD D7", "#DCDDD7");
}

function homeFinalMobile() {
  const hero = dataUri("wardrobe/clean/015_DSC01797.webp");
  const coach = dataUri("wardrobe/clean/001_DSC01768.webp");
  const bomber = dataUri("wardrobe/clean/002_DSC01771.webp");
  const navyCoat = dataUri("wardrobe/clean/003_DSC01773.webp");
  const openLeather = dataUri("wardrobe/clean/004_DSC01775-open.webp");
  const tee = dataUri("wardrobe/imports/2026-07-18/017_DSC01950.webp");
  const pants = dataUri("wardrobe/imports/2026-07-18/082_DSC01905.webp");
  const sneakers = dataUri("wardrobe/imports/2026-07-18/049_DSC01993.webp");

  return `
    <rect width="390" height="6350" fill="${COLORS.canvas}"/>

    <g id="home-hero-mobile">
      <rect width="390" height="840" fill="${COLORS.signal}"/>
      ${text(20, 40, "FORMÉ", { size: 25, weight: 800, tracking: -1.4 })}
      ${text(110, 24, "®", { size: 7, weight: 700 })}
      ${text(370, 37, "MENÚ", { size: 10, weight: 700, tracking: 1.2, anchor: "end" })}
      <line x1="20" y1="62" x2="370" y2="62" stroke="${COLORS.ink}" stroke-width="1" opacity=".28"/>
      ${text(20, 108, "CLOSET VISUAL + ASISTENTE DE ESTILO", { size: 9, weight: 700, tracking: 1.2 })}
      ${text(20, 200, "TU ROPA YA", { size: 53, weight: 600, tracking: -3 })}
      ${text(20, 258, "SABE", { size: 53, weight: 300, tracking: -3, italic: true })}
      ${text(160, 258, "QUIÉN", { size: 53, weight: 600, tracking: -3 })}
      ${text(20, 316, "ERES.", { size: 53, weight: 600, tracking: -3 })}
      ${text(20, 365, "Digitaliza lo que tienes, crea looks", { size: 15, weight: 500 })}
      ${text(20, 388, "y entiende mejor tu forma de vestir.", { size: 15, weight: 500 })}
      <rect x="20" y="421" width="168" height="46" rx="23" fill="${COLORS.ink}"/>
      ${text(104, 450, "ABRIR MI CLOSET ↗", { size: 10, weight: 700, tracking: .8, fill: COLORS.white, anchor: "middle" })}
      <g transform="rotate(-4 224 635)">
        ${garment(92, 470, 285, 356, hero, "Blazer gráfico digitalizado en Formé")}
      </g>
      ${text(20, 812, "01  DIGITALIZA", { size: 9, weight: 700, tracking: 1.1 })}
      ${text(370, 812, "SCROLL ↓", { size: 9, weight: 700, tracking: 1.1, anchor: "end" })}
    </g>

    <g id="home-thesis-mobile">
      <rect y="840" width="390" height="660" fill="${COLORS.ink}"/>
      ${text(20, 905, "EL PUNTO DE PARTIDA", { size: 9, weight: 700, tracking: 1.3, fill: COLORS.signal })}
      ${text(20, 1005, "EL ESTILO NO ES", { size: 43, weight: 600, tracking: -2.3, fill: COLORS.white })}
      ${text(20, 1055, "LO QUE COMPRAS.", { size: 43, weight: 600, tracking: -2.3, fill: COLORS.white })}
      ${text(20, 1122, "ES LO QUE", { size: 43, weight: 300, tracking: -2.3, fill: COLORS.white, italic: true })}
      ${text(20, 1172, "REPITES.", { size: 43, weight: 600, tracking: -2.3, fill: COLORS.signal })}
      ${text(20, 1260, "Formé convierte tu ropa en un sistema vivo:", { size: 15, weight: 500, fill: COLORS.white })}
      ${text(20, 1284, "lo que tienes, lo que guardas, lo que evitas", { size: 15, weight: 500, fill: COLORS.white })}
      ${text(20, 1308, "y lo que terminas eligiendo.", { size: 15, weight: 500, fill: COLORS.white })}
      <line x1="20" y1="1360" x2="370" y2="1360" stroke="#555752" stroke-width="1"/>
      ${text(20, 1400, "NO MÁS INVENTARIO", { size: 9, weight: 700, tracking: 1.2, fill: "#969892" })}
      ${text(20, 1440, "Contexto para decidir mejor.", { size: 20, weight: 500, fill: COLORS.white })}
    </g>

    <g id="home-closet-mobile">
      <rect y="1500" width="390" height="1300" fill="${COLORS.canvas}"/>
      ${text(20, 1570, "01 / MI CLOSET", { size: 9, weight: 700, tracking: 1.3, fill: COLORS.signal })}
      ${text(20, 1660, "TODO LO QUE", { size: 45, weight: 600, tracking: -2.5 })}
      ${text(20, 1712, "TIENES.", { size: 45, weight: 600, tracking: -2.5 })}
      ${text(20, 1772, "UNA SOLA VISTA.", { size: 45, weight: 300, tracking: -2.5, italic: true })}
      ${text(20, 1820, "Cada prenda completa, limpia y en su lugar.", { size: 14, weight: 500 })}

      <rect x="12" y="1865" width="366" height="812" rx="18" fill="#E7E8E3"/>
      ${text(28, 1914, "Closet/", { size: 24, weight: 700, tracking: -1.2 })}
      ${text(105, 1914, "Looks", { size: 24, weight: 500, fill: COLORS.muted, tracking: -1.2 })}
      ${text(362, 1907, "153", { size: 9, weight: 700, fill: COLORS.muted, anchor: "end" })}
      ${garment(16, 1940, 174, 260, coach, "Chaqueta coach completa")}
      ${garment(200, 1940, 174, 260, bomber, "Bomber completa")}
      ${garment(16, 2205, 174, 260, tee, "Camiseta blanca completa")}
      ${garment(200, 2205, 174, 260, pants, "Pantalón completo")}
      ${garment(100, 2450, 190, 150, sneakers, "Sneakers completas")}
      <rect x="200" y="2590" width="174" height="42" rx="21" fill="${COLORS.ink}"/>
      ${text(287, 2616, "AÑADIR AL CANVAS +", { size: 9, weight: 700, tracking: .7, fill: COLORS.white, anchor: "middle" })}
      ${text(20, 2744, "153 PRENDAS. TODAS VISIBLES.", { size: 9, weight: 700, tracking: 1.2 })}
    </g>

    <g id="home-canvas-mobile">
      <rect y="2800" width="390" height="1350" fill="${COLORS.ink}"/>
      ${text(20, 2870, "02 / CANVAS", { size: 9, weight: 700, tracking: 1.3, fill: COLORS.signal })}
      ${text(20, 2960, "PRUÉBALO", { size: 47, weight: 600, tracking: -2.6, fill: COLORS.white })}
      ${text(20, 3014, "ANTES DE", { size: 47, weight: 600, tracking: -2.6, fill: COLORS.white })}
      ${text(20, 3068, "VESTIRTE.", { size: 47, weight: 300, tracking: -2.6, fill: COLORS.white, italic: true })}
      ${text(20, 3120, "Añade una base. Cambia una capa.", { size: 14, weight: 500, fill: "#B8BAB4" })}
      ${text(20, 3142, "Guarda lo que funciona.", { size: 14, weight: 500, fill: "#B8BAB4" })}

      <rect x="12" y="3200" width="366" height="820" rx="18" fill="#D7D8D3"/>
      <rect x="12" y="3200" width="86" height="820" rx="18" fill="#C9CAC4"/>
      <rect x="80" y="3200" width="18" height="820" fill="#C9CAC4"/>
      ${text(24, 3232, "PRENDAS", { size: 8, weight: 700, tracking: 1 })}
      ${garment(18, 3260, 72, 105, coach, "Chaqueta alternativa")}
      ${garment(18, 3375, 72, 105, bomber, "Bomber alternativa")}
      ${garment(18, 3490, 72, 105, navyCoat, "Abrigo alternativo")}

      <rect x="110" y="3230" width="250" height="680" fill="#EEEFEA"/>
      ${text(124, 3255, "ÁREA DEL LOOK", { size: 7, weight: 700, tracking: .9, fill: COLORS.muted })}
      ${garment(182, 3290, 106, 132, tee, "Camiseta en canvas")}
      ${garment(174, 3410, 122, 170, pants, "Pantalón en canvas")}
      ${garment(188, 3550, 95, 62, sneakers, "Sneakers en canvas")}
      ${garment(126, 3250, 218, 272, openLeather, "Sobrecamisa abierta para layering")}
      <rect x="124" y="3248" width="222" height="278" fill="none" stroke="${COLORS.signal}" stroke-width="1" stroke-dasharray="5 5"/>
      <rect x="110" y="3855" width="250" height="55" fill="${COLORS.ink}"/>
      ${text(126, 3888, "GUARDAR", { size: 8, weight: 700, tracking: .9, fill: COLORS.white })}
      ${text(201, 3888, "MEZCLAR", { size: 8, weight: 700, tracking: .9, fill: COLORS.signal })}
      ${text(344, 3888, "COMPARTIR", { size: 8, weight: 700, tracking: .9, fill: "#9D9F99", anchor: "end" })}
      ${text(20, 4090, "SELECCIONA → REEMPLAZA → GUARDA", { size: 9, weight: 700, tracking: 1.1, fill: COLORS.signal })}
    </g>

    <g id="home-assistant-mobile">
      <rect y="4150" width="390" height="850" fill="${COLORS.signal}"/>
      ${text(20, 4220, "03 / ASISTENTE", { size: 9, weight: 700, tracking: 1.3 })}
      ${text(20, 4315, "“¿QUÉ ME", { size: 44, weight: 600, tracking: -2.4 })}
      ${text(20, 4365, "PONGO PARA", { size: 44, weight: 600, tracking: -2.4 })}
      ${text(20, 4415, "UNA CENA", { size: 44, weight: 600, tracking: -2.4 })}
      ${text(20, 4465, "CASUAL?”", { size: 44, weight: 300, tracking: -2.4, italic: true })}
      <rect x="12" y="4520" width="366" height="360" rx="18" fill="${COLORS.ink}"/>
      ${text(32, 4560, "RECOMENDACIÓN", { size: 8, weight: 700, tracking: 1.1, fill: COLORS.signal })}
      ${text(32, 4610, "Empieza con el pantalón azul.", { size: 18, weight: 700, fill: COLORS.white })}
      ${text(32, 4642, "La camiseta baja el contraste;", { size: 13, weight: 500, fill: "#CFD1CB" })}
      ${text(32, 4663, "la sobrecamisa mantiene el look", { size: 13, weight: 500, fill: "#CFD1CB" })}
      ${text(32, 4684, "intencional sin hacerlo formal.", { size: 13, weight: 500, fill: "#CFD1CB" })}
      ${garment(28, 4715, 74, 93, tee, "Camiseta recomendada")}
      ${garment(104, 4710, 78, 98, pants, "Pantalón recomendado")}
      ${garment(180, 4700, 100, 125, openLeather, "Sobrecamisa recomendada")}
      ${garment(278, 4732, 80, 58, sneakers, "Sneakers recomendadas")}
      ${text(32, 4850, "TU CLOSET + TUS LOOKS + TUS LÍMITES", { size: 8, weight: 700, tracking: .9, fill: "#9D9F99" })}
      ${text(20, 4955, "NO ES RANDOM. EXPLICA CADA ELECCIÓN.", { size: 9, weight: 700, tracking: 1.1 })}
    </g>

    <g id="home-loop-mobile">
      <rect y="5000" width="390" height="650" fill="${COLORS.canvas}"/>
      ${text(20, 5070, "UN SISTEMA QUE APRENDE CONTIGO", { size: 9, weight: 700, tracking: 1.2, fill: COLORS.signal })}
      ${text(20, 5160, "DIGITALIZA.", { size: 41, weight: 600, tracking: -2.2 })}
      ${text(20, 5208, "COMBINA.", { size: 41, weight: 300, tracking: -2.2, italic: true })}
      ${text(20, 5256, "ENTIENDE.", { size: 41, weight: 600, tracking: -2.2 })}
      ${text(20, 5304, "REPITE.", { size: 41, weight: 300, tracking: -2.2, italic: true })}
      <line x1="20" y1="5350" x2="370" y2="5350" stroke="${COLORS.ink}" stroke-width="1"/>
      ${text(20, 5395, "01 / SUBE TU ROPA", { size: 9, weight: 700, tracking: 1.1 })}
      ${text(20, 5420, "Prendas limpias y listas para usar.", { size: 13, weight: 500 })}
      ${text(20, 5460, "02 / CREA LOOKS", { size: 9, weight: 700, tracking: 1.1 })}
      ${text(20, 5485, "Combina y guarda lo que funciona.", { size: 13, weight: 500 })}
      ${text(20, 5525, "03 / DECIDE MEJOR", { size: 9, weight: 700, tracking: 1.1 })}
      ${text(20, 5550, "Opciones propias, no genéricas.", { size: 13, weight: 500 })}
      ${text(20, 5615, "TÚ SIGUES TENIENDO LA ÚLTIMA PALABRA.", { size: 9, weight: 700, tracking: 1.1, fill: COLORS.muted })}
    </g>

    <g id="home-final-mobile">
      <rect y="5650" width="390" height="700" fill="${COLORS.ink}"/>
      ${text(20, 5720, "FORMÉ®", { size: 14, weight: 800, fill: COLORS.white })}
      ${text(20, 5820, "EMPIEZA POR", { size: 46, weight: 600, tracking: -2.4, fill: COLORS.white })}
      ${text(20, 5872, "LO QUE YA", { size: 46, weight: 300, tracking: -2.4, fill: COLORS.white, italic: true })}
      ${text(20, 5924, "TIENES.", { size: 46, weight: 300, tracking: -2.4, fill: COLORS.white, italic: true })}
      ${text(20, 5970, "Tu closet es suficiente para comenzar.", { size: 14, weight: 500, fill: "#B8BAB4" })}
      <rect x="20" y="6000" width="170" height="46" rx="23" fill="${COLORS.signal}"/>
      ${text(105, 6029, "CREAR MI CLOSET ↗", { size: 10, weight: 700, tracking: .8, fill: COLORS.ink, anchor: "middle" })}
      ${garment(118, 6030, 270, 300, hero, "Blazer gráfico de cierre")}
      ${text(20, 6320, "forme.gallery", { size: 9, weight: 700, tracking: 1.1, fill: COLORS.white })}
    </g>
  `;
}

function finalHomeBoardSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1930" height="6610" viewBox="0 0 1930 6610">
    ${defs()}
    <rect width="1930" height="6610" fill="#DADBD6"/>
    ${text(24, 32, "HOME COMPLETO / DESKTOP", { size: 12, weight: 700, tracking: 1.4 })}
    ${text(1514, 32, "HOME COMPLETO / MOBILE", { size: 12, weight: 700, tracking: 1.4 })}
    <svg x="24" y="54" width="1440" height="6500" viewBox="0 0 1440 6500">
      ${homeFinalDesktop()}
    </svg>
    <svg x="1514" y="54" width="390" height="6350" viewBox="0 0 390 6350">
      ${homeFinalMobile()}
    </svg>
  </svg>`;
}

function designSystemSvg() {
  const swatches = [
    ["Canvas", COLORS.canvas, "#F1F1EC"],
    ["Surface", COLORS.surface, "#E7E8E3"],
    ["Ink", COLORS.ink, "#111310"],
    ["Muted", COLORS.muted, "#898A85"],
    ["Signal", COLORS.signal, "#E85B45"],
    ["Line", COLORS.line, "#C9CAC4"],
  ];
  const swatchMarkup = swatches
    .map(([name, color, hex], index) => {
      const x = 64 + index * 210;
      return `
        <rect x="${x}" y="188" width="168" height="168" fill="${color}"/>
        ${text(x, 384, name, { size: 14, weight: 700 })}
        ${text(x, 406, hex, { size: 12, weight: 500, fill: COLORS.muted })}`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1024" viewBox="0 0 1440 1024">
    <rect width="1440" height="1024" fill="${COLORS.canvas}"/>
    ${text(64, 72, "FORMÉ®", { size: 28, weight: 800 })}
    ${text(64, 132, "DESIGN SYSTEM / V1", { size: 12, weight: 700, tracking: 1.8 })}
    ${swatchMarkup}
    ${text(64, 500, "Tipografía", { size: 15, weight: 700 })}
    ${text(64, 594, "Tu ropa ya sabe quién eres.", { size: 64, weight: 500, tracking: -3.2 })}
    ${text(64, 654, "Helvetica Neue — Display 64 / 500", { size: 13, weight: 500, fill: COLORS.muted })}
    ${text(64, 724, "Closet visual y asistente de estilo", { size: 18, weight: 400 })}
    ${text(64, 756, "Body 18 / 400 · Labels 12 / 700 · Tracking editorial", { size: 13, weight: 500, fill: COLORS.muted })}
    ${text(64, 840, "Principios", { size: 15, weight: 700 })}
    ${text(64, 884, "La prenda siempre visible. La interfaz aparece cuando hace falta.", { size: 24, weight: 500 })}
    ${text(64, 925, "Sin marcos decorativos · Sin repetición · Acciones en hover o gesto · Señal coral solo para intención", { size: 14, weight: 500, fill: COLORS.muted })}
  </svg>`;
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "00-design-system.svg"), designSystemSvg());
fs.writeFileSync(
  path.join(outDir, "01-portada-desktop-mobile.svg"),
  finalHomeBoardSvg(),
);
fs.writeFileSync(
  path.join(outDir, "02-closet-desktop-mobile.svg"),
  boardSvg("CLOSET", closetScreen(1440, 900), closetScreen(390, 844, true)),
);

console.log(`Generated Figma import files in ${outDir}`);

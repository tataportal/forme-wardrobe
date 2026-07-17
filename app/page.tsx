"use client";

import {
  CSSProperties,
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { classifyGarment, formeBasics, Garment, starterGarments } from "./garments";

type View = "wardrobe" | "studio";
type WardrobePanel = "closet" | "looks" | "assistant";
type ClosetMode = "browse" | "upload";
type StudioLibraryFilter = "all" | "outerwear" | "tops" | "bottoms" | "footwear" | "accessories";
type CanvasPiece = {
  instanceId: string;
  garmentId: string;
  variant: "closed" | "open";
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z: number;
};

type DragSession = {
  instanceId: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
};

type PointerTrack = {
  instanceId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  startedAt: number;
};

type PinchSession = {
  instanceId: string;
  pointerIds: [number, number];
  startDistance: number;
  startScale: number;
  startAngle: number;
  startRotation: number;
};

type TransformHandleSession = {
  instanceId: string;
  pointerId: number;
  mode: "scale" | "rotate";
  centerX: number;
  centerY: number;
  startDistance: number;
  startAngle: number;
  startScale: number;
  startRotation: number;
};

type MarqueeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type MarqueeSession = {
  pointerId: number;
  startX: number;
  startY: number;
  canvasRect: DOMRect;
  moved: boolean;
};

type WardrobeFilters = {
  category: string;
  colorFamily: string;
  tone: string;
  material: string;
  finish: string;
  silhouette: string;
};

type FilterKey = keyof WardrobeFilters;
type FilterOptions = Record<FilterKey, string[]> & { tonesByColor: Record<string, string[]> };
type GarmentDraft = Pick<Garment, "id" | "name" | "category" | "colorFamily" | "tone" | "material" | "finish" | "silhouette"> & {
  brand: string;
  tags: string[];
  isPublic: boolean;
};

type StoredGarmentEdit = Omit<GarmentDraft, "id">;
type ApiGarment = Omit<GarmentDraft, "id"> & {
  id: string;
  favorite?: boolean;
  isPublic?: boolean;
  deleted?: boolean;
  status: Garment["status"];
  image?: string;
  generatedImage?: string;
  generatedOpenImage?: string;
  originalImage?: string;
  openImage?: string;
  quality?: "low" | "medium";
  qaStatus?: "pending" | "passed" | "review";
  qaNotes?: string;
};
type WardrobeProfile = {
  name: string;
  handle: string;
  bio: string;
  avatarUrl?: string | null;
  profilePublic: boolean;
  discoverable: boolean;
  showCloset: boolean;
  showLooks: boolean;
  isOwner?: boolean;
};
type ProfileDraft = Pick<WardrobeProfile, "name" | "handle" | "bio" | "profilePublic" | "discoverable" | "showCloset" | "showLooks">;
type SessionStatus = "checking" | "guest" | "authenticated";
type BillingCycle = "monthly" | "annual";
type PricingPlan = {
  id: "free" | "personal" | "club";
  name: string;
  monthlyPrice: number;
  description: string;
  features: string[];
  recommended?: boolean;
};
type UploadStatus = "ready" | "uploading" | "processing" | "done" | "waiting" | "failed";
type UploadItem = {
  id: string;
  file: File;
  preview: string;
  name: string;
  category: Garment["category"];
  status: UploadStatus;
  garmentId?: string;
  error?: string;
};

type SavedLook = {
  id: string;
  name: string;
  isPublic?: boolean;
  items: CanvasPiece[];
  createdAt?: string;
  updatedAt?: string;
};

type WeeklyOccasion = "daily" | "work" | "dinner" | "event" | "weekend";
type WeeklyPlanEntry = {
  date: string;
  outfitId: string;
  occasion: WeeklyOccasion;
  worn: boolean;
  createdAt?: string;
  updatedAt?: string;
};
type WeekDay = {
  key: string;
  shortLabel: string;
  dayNumber: string;
  fullLabel: string;
  isToday: boolean;
};

type StyleCode = "casual" | "smart" | "formal" | "experimental";
type StyleMoment = "day" | "night";
type StyleOccasion = "daily" | "work" | "dinner" | "event";
type StylingStrategy = "balanced" | "contrast" | "statement" | "minimal" | "layered";
type StylingRecommendation = {
  id: string;
  strategy: StylingStrategy;
  signature: string;
  title: string;
  name: string;
  reason: string;
  items: CanvasPiece[];
};
type AssistantIntent = "outfit" | "underused" | "favorites" | "experimental" | "missing";
type AssistantFollowup = {
  id: string;
  label: string;
  detail: string;
  occasion: StyleOccasion;
  code: StyleCode;
  moment: StyleMoment;
  intent: AssistantIntent;
  focus: string;
};
type AssistantPreset = {
  id: string;
  label: string;
  detail: string;
  followup: string;
  options: AssistantFollowup[];
};
type AssistantAnswer = {
  question: string;
  followup: string;
  eyebrow: string;
  title: string;
  summary: string;
  signals: string[];
  intent: AssistantIntent;
};
type StyleAudience = "hombre" | "mujer";
type StyleFamilyId = "classic" | "minimal" | "relaxed" | "tailored" | "preppy" | "streetwear" | "sporty" | "utility" | "romantic" | "bohemian" | "rebel" | "avant_garde";
type StyleFeedbackReason = "color" | "silhouette" | "combination" | "formality" | "expression" | "fit" | "footwear" | "specific";
type StyleFamilyRating = {
  family: StyleFamilyId;
  affinity: number;
  blocked: boolean;
  reason: StyleFeedbackReason | null;
};
type StyleProfile = {
  audience: StyleAudience;
  exploration: number;
  completed: boolean;
  completedAt?: string | null;
  ratings: StyleFamilyRating[];
};
type LookIteration = {
  id: string;
  title: string;
  detail: string;
  items: CanvasPiece[];
};

const emptyFilters: WardrobeFilters = {
  category: "All",
  colorFamily: "All",
  tone: "All",
  material: "All",
  finish: "All",
  silhouette: "All",
};

const garmentEditsStorageKey = "forme-garment-edits-v1";
const demoLooksStorageKey = "forme-demo-looks-v1";
const demoWeekStorageKey = "forme-demo-week-v1";
const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
const operationalSiteUrl = "https://forme.gallery/";
const currentOutfitId = "current-look";
const maxBatchFiles = 15;
const discountedBatchThreshold = 5;
const maxUploadBytes = 20 * 1024 * 1024;
const annualDiscount = 0.1;
const pricingPlans: PricingPlan[] = [
  {
    id: "free",
    name: "Libre",
    monthlyPrice: 0,
    description: "Para conocer tu closet y empezar a combinar.",
    features: ["Hasta 15 prendas", "5 looks guardados", "Canvas y básicos Formé", "Perfil compartible"],
  },
  {
    id: "personal",
    name: "Personal",
    monthlyPrice: 5.99,
    description: "Para vestir mejor con lo que ya tienes.",
    features: ["Hasta 75 prendas", "15 prendas nuevas al mes", "Looks y planificación semanal", "Asistente según tu estilo y closet"],
    recommended: true,
  },
  {
    id: "club",
    name: "Club",
    monthlyPrice: 11.99,
    description: "Para closets grandes y una lectura más profunda.",
    features: ["Hasta 250 prendas", "40 prendas nuevas al mes", "3 reprocesos en calidad media", "Prioridad, análisis e insights avanzados"],
  },
];
const uploadStatusLabels: Record<UploadStatus, string> = {
  ready: "LISTA",
  uploading: "SUBIENDO",
  processing: "PREPARANDO",
  done: "LISTA",
  waiting: "EN ESPERA",
  failed: "REVISAR",
};

const styleCodeLabels: Record<StyleCode, string> = { casual: "Casual", smart: "Pulido", formal: "Formal", experimental: "Experimental" };
const styleMomentLabels: Record<StyleMoment, string> = { day: "Día", night: "Noche" };
const styleOccasionLabels: Record<StyleOccasion, string> = { daily: "Diario", work: "Trabajo", dinner: "Cena", event: "Evento" };
const weeklyOccasionLabels: Record<WeeklyOccasion, string> = { daily: "Diario", work: "Trabajo", dinner: "Cena", event: "Evento", weekend: "Fin de semana" };
const stylingStrategyLabels: Record<StylingStrategy, string> = { balanced: "Seguro", contrast: "Contraste", statement: "Protagonista", minimal: "Esencial", layered: "Capas" };
const assistantPresets: AssistantPreset[] = [
  {
    id: "today",
    label: "¿Qué me pongo hoy?",
    detail: "Una respuesta rápida con lo que ya tienes.",
    followup: "¿Cómo será tu día?",
    options: [
      { id: "today-work", label: "Trabajo", detail: "Pulido, sin verse rígido", occasion: "work", code: "smart", moment: "day", intent: "outfit", focus: "un día de trabajo" },
      { id: "today-casual", label: "Día casual", detail: "Cómodo y fácil de repetir", occasion: "daily", code: "casual", moment: "day", intent: "outfit", focus: "un día casual" },
      { id: "today-dinner", label: "Cena", detail: "Más intención para la noche", occasion: "dinner", code: "smart", moment: "night", intent: "outfit", focus: "una cena" },
      { id: "today-event", label: "Evento", detail: "Una opción con mayor presencia", occasion: "event", code: "formal", moment: "night", intent: "outfit", focus: "un evento" },
    ],
  },
  {
    id: "week",
    label: "¿Qué uso esta semana?",
    detail: "Cinco opciones para guardar y repetir.",
    followup: "¿Qué domina tu semana?",
    options: [
      { id: "week-office", label: "Oficina", detail: "Bases repetibles con capas pulidas", occasion: "work", code: "smart", moment: "day", intent: "outfit", focus: "una semana de oficina" },
      { id: "week-mixed", label: "Semana mixta", detail: "Del día a una salida", occasion: "daily", code: "smart", moment: "day", intent: "outfit", focus: "una semana con planes mixtos" },
      { id: "week-night", label: "Más planes de noche", detail: "Opciones con más presencia", occasion: "dinner", code: "smart", moment: "night", intent: "outfit", focus: "una semana con planes de noche" },
      { id: "week-casual", label: "Todo casual", detail: "Comodidad con proporción", occasion: "daily", code: "casual", moment: "day", intent: "outfit", focus: "una semana casual" },
    ],
  },
  {
    id: "rotation",
    label: "Quiero usar más lo que tengo",
    detail: "Prioriza prendas que ya son tuyas, pero aparecen poco.",
    followup: "¿Qué quieres recuperar?",
    options: [
      { id: "rotation-forgotten", label: "Piezas olvidadas", detail: "Lo que casi no aparece en tus looks", occasion: "daily", code: "casual", moment: "day", intent: "underused", focus: "recuperar piezas poco usadas" },
      { id: "rotation-favorites", label: "Mis favoritas", detail: "Nuevas combinaciones alrededor de ellas", occasion: "daily", code: "smart", moment: "day", intent: "favorites", focus: "volver a tus favoritas" },
      { id: "rotation-new", label: "Algo que aún no usé", detail: "Una entrada fácil para una pieza nueva", occasion: "daily", code: "experimental", moment: "day", intent: "underused", focus: "estrenar una pieza del closet" },
      { id: "rotation-safe", label: "Una base segura", detail: "Repetir mejor, sin complicarlo", occasion: "daily", code: "casual", moment: "day", intent: "outfit", focus: "construir una base segura" },
    ],
  },
  {
    id: "explore",
    label: "Quiero probar algo distinto",
    detail: "Se aleja de tus repeticiones sin dejar de parecerte a ti.",
    followup: "¿Qué quieres mover primero?",
    options: [
      { id: "explore-color", label: "Más color", detail: "Un acento fuera de tu base habitual", occasion: "daily", code: "experimental", moment: "day", intent: "experimental", focus: "introducir más color" },
      { id: "explore-shape", label: "Otra silueta", detail: "Cambiar proporción antes que comprar", occasion: "event", code: "experimental", moment: "night", intent: "experimental", focus: "probar otra silueta" },
      { id: "explore-polished", label: "Más pulido", detail: "Dar más intención a lo cotidiano", occasion: "work", code: "formal", moment: "day", intent: "experimental", focus: "verte más pulido" },
      { id: "explore-relaxed", label: "Más relajado", detail: "Volumen y comodidad con intención", occasion: "daily", code: "casual", moment: "day", intent: "experimental", focus: "verte más relajado" },
    ],
  },
  {
    id: "missing",
    label: "¿Qué falta en mi closet?",
    detail: "Lee huecos reales antes de sugerirte comprar algo.",
    followup: "¿Qué quieres resolver?",
    options: [
      { id: "missing-combinations", label: "Más combinaciones", detail: "Piezas que multiplican opciones", occasion: "daily", code: "casual", moment: "day", intent: "missing", focus: "crear más combinaciones" },
      { id: "missing-work", label: "Trabajo", detail: "Cobertura para días pulidos", occasion: "work", code: "smart", moment: "day", intent: "missing", focus: "vestirte para trabajo" },
      { id: "missing-night", label: "Noche", detail: "Opciones para cena y evento", occasion: "dinner", code: "smart", moment: "night", intent: "missing", focus: "tener más opciones de noche" },
      { id: "missing-weather", label: "Entretiempo", detail: "Capas ligeras fáciles de combinar", occasion: "daily", code: "casual", moment: "day", intent: "missing", focus: "resolver el entretiempo" },
    ],
  },
];
const styleFamilyMeta: Array<{ id: StyleFamilyId; label: string; description: string; file: string }> = [
  { id: "classic", label: "Clásico", description: "Piezas atemporales, líneas claras y combinaciones que sobreviven a cualquier temporada.", file: "01-clasico.webp" },
  { id: "minimal", label: "Minimalista", description: "Paleta contenida, pocos elementos y proporciones precisas sin ruido visual.", file: "02-minimalista.webp" },
  { id: "relaxed", label: "Relajado", description: "Capas cómodas, volúmenes suaves y prendas fáciles de repetir en la vida diaria.", file: "03-relajado.webp" },
  { id: "tailored", label: "Sastrero", description: "Estructura, pantalones definidos y capas pulidas sin necesidad de verse rígido.", file: "04-sastrero.webp" },
  { id: "preppy", label: "Preppy", description: "Códigos colegiales, tejidos limpios y una formalidad joven y ordenada.", file: "05-preppy.webp" },
  { id: "streetwear", label: "Streetwear", description: "Siluetas amplias, gráficos y referencias urbanas con más presencia visual.", file: "06-streetwear.webp" },
  { id: "sporty", label: "Deportivo", description: "Prendas técnicas y cómodas llevadas fuera del entrenamiento como parte del look.", file: "07-deportivo.webp" },
  { id: "utility", label: "Utilitario", description: "Bolsillos, capas funcionales y materiales resistentes con una intención práctica.", file: "08-utilitario.webp" },
  { id: "romantic", label: "Romántico", description: "Texturas suaves, curvas y detalles delicados que aportan ligereza o contraste.", file: "09-romantico.webp" },
  { id: "bohemian", label: "Bohemio", description: "Capas sueltas, textura y mezcla de materiales con una lectura más orgánica.", file: "10-bohemio.webp" },
  { id: "rebel", label: "Rebelde", description: "Cuero, oscuridad y piezas con actitud que rompen la pulcritud del conjunto.", file: "11-rebelde.webp" },
  { id: "avant_garde", label: "Vanguardista", description: "Proporciones inesperadas y prendas protagonistas que exploran otra silueta.", file: "12-vanguardista.webp" },
];
const styleFeedbackLabels: Record<StyleFeedbackReason, string> = {
  color: "Color",
  silhouette: "Silueta",
  combination: "Combinación",
  formality: "Formalidad",
  expression: "Expresión",
  fit: "Ajuste",
  footwear: "Calzado",
  specific: "Prenda específica",
};
const filterLabels: Array<{ key: FilterKey; label: string }> = [
  { key: "category", label: "Tipo" },
  { key: "colorFamily", label: "Color" },
  { key: "tone", label: "Tono" },
  { key: "material", label: "Material" },
  { key: "finish", label: "Acabado" },
  { key: "silhouette", label: "Corte" },
];

const valueTranslations: Record<string, string> = {
  All: "Todos",
  Outerwear: "Abrigos",
  Tops: "Prendas superiores",
  Bottoms: "Pantalones",
  Tailoring: "Sastrería",
  Footwear: "Calzado",
  Accessories: "Accesorios",
  Black: "Negro",
  Blue: "Azul",
  Brown: "Marrón",
  Green: "Verde",
  Grey: "Gris",
  White: "Blanco",
  Other: "Otro",
  "Red / orange": "Rojo / naranja",
  "Black / Green": "Negro / verde",
  "Brown / Black": "Marrón / negro",
  Cream: "Crema",
  "Dark brown": "Marrón oscuro",
  "Denim blue": "Azul denim",
  Ivory: "Marfil",
  "Light blue": "Celeste",
  Navy: "Azul marino",
  "Optic white": "Blanco óptico",
  Orange: "Naranja",
  "Pitch black": "Negro intenso",
  "Red / Blue": "Rojo / azul",
  Sage: "Verde salvia",
  Stone: "Piedra",
  "Tan / camel": "Tostado / camel",
  "Washed black": "Negro lavado",
  Custom: "Personalizado",
  Unclassified: "Sin clasificar",
  Cotton: "Algodón",
  Fleece: "Polar",
  Knit: "Punto",
  Leather: "Cuero",
  Acetate: "Acetato",
  Shearling: "Borrego",
  "Technical nylon": "Nylon técnico",
  "Transparent shell": "Material transparente",
  "Wool blend": "Mezcla de lana",
  Glossy: "Brillante",
  "Low sheen": "Semimate",
  Matte: "Mate",
  Textured: "Texturizado",
  Transparent: "Transparente",
  Cropped: "Corto",
  Draped: "Drapeado",
  Longline: "Largo",
  Oversized: "Oversize",
  Regular: "Regular",
  Relaxed: "Relajado",
};

const garmentNameTranslations: Record<string, string> = {
  "Daisy Coach Jacket": "Chaqueta coach Daisy",
  "WFP Bomber": "Bomber WFP",
  "Navy Peacoat": "Abrigo cruzado azul marino",
  "Leather Hooded Shirt": "Sobrecamisa de cuero con capucha",
  "Utility Field Jacket": "Chaqueta utilitaria",
  "Leather Blazer": "Blazer de cuero",
  "Asymmetric Trench": "Trench asimétrico",
  "Padded Collar Jacket": "Chaqueta de cuello acolchado",
  "Belted Short Coat": "Abrigo corto con cinturón",
  "Leather Bomber": "Bomber de cuero",
  "Single-Breasted Blazer": "Blazer de un botón",
  "Track Shell": "Chaqueta técnica deportiva",
  "Leather Sports Bomber": "Bomber deportiva de cuero",
  "Drawcord Bomber": "Bomber con cordones",
  "Graphic Tailored Blazer": "Blazer gráfico sastre",
  "Camel Wrap Coat": "Abrigo envolvente camel",
  "Funnel-Neck Cape": "Capa de cuello alto",
  "Leather Hooded Bomber": "Bomber de cuero con capucha",
  "Leather Zip Blouson": "Blusón de cuero",
  "Long Black Trench": "Trench negro largo",
  "Lightweight Shell": "Chaqueta técnica ligera",
  "Tiger Fleece": "Polar de tigre",
  "Graphic Varsity Jacket": "Varsity gráfica",
  "Essentials Crewneck": "Sudadera Essentials",
  "Fur-Trim Leather Bomber": "Bomber de cuero con pelo",
  "Tan Coach Jacket": "Chaqueta coach tostada",
  "Hooded Field Parka": "Parka de campo con capucha",
  "Open-Knit Sweater": "Jersey de punto abierto",
  "Sage Puffer": "Puffer verde salvia",
  "Kimono Blazer": "Blazer kimono",
  "Embroidered Cape Coat": "Abrigo capa bordado",
  "Greige Technical Shell": "Chaqueta técnica greige",
  "Brown Shearling Coat": "Abrigo de borrego marrón",
  "Floral Fleece": "Polar floral",
  "Embroidered Coach Jacket": "Chaqueta coach bordada",
  "Technical Long Parka": "Parka técnica larga",
  "Transparent Rain Shell": "Impermeable transparente",
  "Cape Coat": "Abrigo capa",
  "Ivory Collarless Jacket": "Chaqueta marfil sin cuello",
  "Light Denim Jacket": "Chaqueta denim clara",
  "Draped Wool Poncho": "Poncho de lana drapeado",
  "Frog-Closure Jacket": "Chaqueta de cierres chinos",
  "Contrast-Piped Shirt": "Camisa con vivos en contraste",
  "Draped Black Shirt": "Camisa negra drapeada",
  "Human Made Jacket": "Chaqueta Human Made",
  "MA-1 Bomber": "Bomber MA-1",
  "Toggle Jacket": "Chaqueta con alamares",
  "White Track Shell": "Chaqueta deportiva blanca",
  "Ivory Technical Shell": "Chaqueta técnica marfil",
  "Cropped Double Blazer": "Blazer cruzado corto",
  "Classic Straight Jeans": "Jeans rectos clásicos",
  "Washed Black Jeans": "Jeans negros lavados",
  "Wide-Leg Trousers": "Pantalón de pierna ancha",
  "Pleated Chinos": "Chinos con pinzas",
  "Basic White Tee": "Camiseta blanca básica",
  "Oversized Black Tee": "Camiseta negra oversize",
  "Blue Long-Sleeve Shirt": "Camisa azul de manga larga",
  "Black Short-Sleeve Shirt": "Camisa negra de manga corta",
  "White Leather Sneakers": "Zapatillas blancas",
  "Black Leather Shoes": "Zapatos negros de cuero",
  "Brown Leather Shoes": "Zapatos marrones de cuero",
  "Black Pumps": "Tacones negros",
  "Black Cap": "Gorra negra",
  "Black Beanie": "Beanie negro",
  "Black Rectangular Sunglasses": "Lentes negros rectangulares",
  "Black Tote": "Tote negro",
};

const translateValue = (value: string) => valueTranslations[value] ?? value;
const translateGarmentName = (name: string) => garmentNameTranslations[name] ?? name;

const matchFilters = (garment: Garment, filters: WardrobeFilters) => filterLabels.every(({ key }) => filters[key] === "All" || garment[key] === filters[key]);

function AttributeFilters({ value, options, compact = false, onChange, onReset }: {
  value: WardrobeFilters;
  options: FilterOptions;
  compact?: boolean;
  onChange: (key: FilterKey, next: string) => void;
  onReset: () => void;
}) {
  const activeCount = Object.values(value).filter((item) => item !== "All").length;
  return (
    <div className={`attribute-filters ${compact ? "compact" : ""}`} aria-label="Filtrar prendas">
      {filterLabels.map(({ key, label }) => {
        const values = key === "tone" && value.colorFamily !== "All" ? options.tonesByColor[value.colorFamily] ?? [] : options[key];
        return (
          <label key={key}>{label}
            <select value={value[key]} onChange={(event) => onChange(key, event.target.value)}>
              <option value="All">Todos</option>
              {values.map((item) => <option value={item} key={item}>{translateValue(item)}</option>)}
            </select>
          </label>
        );
      })}
      <button type="button" className="reset-filters" disabled={activeCount === 0} onClick={onReset}>LIMPIAR {activeCount > 0 ? `(${activeCount})` : ""}</button>
    </div>
  );
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (path: string) => `${basePath}${path}`;
const imageSrc = (path: string) => (path.startsWith("/") ? asset(path) : path);
const cleanCanvasImage = (path: string) => path.startsWith("/wardrobe/cutouts/")
  ? path.replace("/wardrobe/cutouts/", "/wardrobe/clean/")
  : path;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeDegrees = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

async function processingFileFor(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const maxEdge = 2048;
    const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas no disponible");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("No se pudo optimizar la foto");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-processing.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

async function whiteStudioCutout(sourceUrl: string): Promise<{ file: File; qaStatus: "passed" | "review"; qaNotes: string }> {
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo abrir la imagen generada.");
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No se pudo preparar la imagen.");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const width = canvas.width;
  const height = canvas.height;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const isStudioWhite = (index: number) => {
    const offset = index * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return Math.min(r, g, b) >= 244 && Math.max(r, g, b) - Math.min(r, g, b) <= 18;
  };
  const seed = (index: number) => {
    if (!visited[index] && isStudioWhite(index)) {
      visited[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < width; x += 1) { seed(x); seed((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y += 1) { seed(y * width); seed(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) seed(index - 1);
    if (x + 1 < width) seed(index + 1);
    if (y > 0) seed(index - width);
    if (y + 1 < height) seed(index + width);
  }
  for (let index = 0; index < total; index += 1) if (visited[index]) data[index * 4 + 3] = 0;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let foreground = 0;
  for (let index = 0; index < total; index += 1) {
    if (data[index * 4 + 3] < 24) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    foreground += 1;
  }
  context.putImageData(image, 0, 0);
  const coverage = foreground / total;
  const marginX = Math.min(minX, width - 1 - maxX) / width;
  const marginY = Math.min(minY, height - 1 - maxY) / height;
  const needsReview = foreground === 0 || coverage < 0.055 || coverage > 0.82 || marginX < 0.012 || marginY < 0.012;
  const qaNotes = needsReview
    ? "La silueta quedó demasiado cerca del borde o con una proporción inusual."
    : "Silueta completa, márgenes correctos y fondo exterior transparente.";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo guardar la imagen.");
  return { file: new File([blob], "cutout.png", { type: "image/png" }), qaStatus: needsReview ? "review" : "passed", qaNotes };
}
const apiPayload = (garment: Garment | GarmentDraft) => ({
  name: garment.name.trim() || "Prenda sin nombre",
  brand: garment.brand ?? "",
  category: garment.category,
  colorFamily: garment.colorFamily,
  tone: garment.tone,
  material: garment.material,
  finish: garment.finish,
  silhouette: garment.silhouette,
  favorite: "favorite" in garment ? Boolean(garment.favorite) : false,
  isPublic: Boolean(garment.isPublic),
  tags: garment.tags ?? [],
});

function mergeApiGarments(current: Garment[], updates: ApiGarment[]): Garment[] {
  const hidden = new Set(updates.filter((item) => item.deleted).map((item) => item.id));
  const byId = new Map(current.filter((item) => !hidden.has(item.id)).map((item) => [item.id, item]));
  for (const item of updates) {
    if (item.deleted) continue;
    const existing = byId.get(item.id);
    const image = item.image || item.originalImage || existing?.image;
    if (!image) continue;
    byId.set(item.id, {
      ...(existing ?? {}),
      ...item,
      id: item.id,
      image,
      color: item.tone,
      status: item.status,
    } as Garment);
  }
  const orderedIds = [
    ...updates.filter((item) => !item.deleted && !starterGarments.some((starter) => starter.id === item.id)).map((item) => item.id),
    ...current.map((item) => item.id),
  ];
  return [...new Set(orderedIds)].map((id) => byId.get(id)).filter((item): item is Garment => Boolean(item));
}
const layerBase = (category: Garment["category"]) => {
  if (category === "Bottoms") return 1000;
  if (category === "Tops") return 2000;
  if (category === "Outerwear" || category === "Tailoring") return 3000;
  if (category === "Footwear") return 4000;
  return 5000;
};
const defaultPlacement = (garment: Garment) => {
  if (garment.category === "Footwear") return { x: 50, y: 87, scale: 0.34 };
  if (garment.category === "Accessories") {
    if (garment.id.includes("sunglasses")) return { x: 50, y: 17.5, scale: 0.14 };
    if (garment.id.includes("tote")) return { x: 74, y: 58, scale: 0.28 };
    return { x: 50, y: 10.5, scale: 0.22 };
  }
  if (garment.category === "Bottoms") {
    const scale = garment.silhouette === "Oversized" ? 0.55 : garment.silhouette === "Relaxed" ? 0.57 : 0.59;
    return { x: 50, y: 66.5, scale };
  }
  if (garment.category === "Tops") {
    const scale = garment.silhouette === "Oversized"
      ? 0.43
      : garment.silhouette === "Longline"
        ? 0.45
        : garment.silhouette === "Relaxed"
          ? 0.46
          : 0.48;
    return { x: 50, y: garment.silhouette === "Longline" ? 34 : 31.5, scale };
  }
  const outerPreset: Record<string, { y: number; scale: number }> = {
    Cropped: { y: 30.5, scale: 0.56 },
    Longline: { y: 38, scale: 0.46 },
    Oversized: { y: 34, scale: 0.49 },
    Draped: { y: 34.5, scale: 0.49 },
    Relaxed: { y: 32.5, scale: 0.51 },
    Regular: { y: 32, scale: 0.52 },
  };
  return { x: 50, ...(outerPreset[garment.silhouette] ?? outerPreset.Regular) };
};

const roundedScale = (scale: number) => Math.round(scale * 1000) / 1000;

function recommendationOuterPlacement(garment: Garment) {
  const placement = defaultPlacement(garment);
  const searchable = searchableGarment(garment);

  if (/funnel-neck cape|cape coat|poncho/.test(searchable)) {
    return { ...placement, y: placement.y - 1, scale: roundedScale(placement.scale * 1.18) };
  }
  if (/puffer/.test(searchable)) {
    return { ...placement, y: placement.y - 1, scale: roundedScale(placement.scale * 1.12) };
  }
  return placement;
}

function recommendationTopPlacement(top: Garment, outer: Garment) {
  const placement = defaultPlacement(top);
  const outerText = searchableGarment(outer);

  if (/funnel-neck cape|cape coat|poncho/.test(outerText)) {
    return { ...placement, y: placement.y + 0.75, scale: roundedScale(placement.scale * 0.88) };
  }
  if (/puffer/.test(outerText)) {
    return { ...placement, y: placement.y + 0.5, scale: roundedScale(placement.scale * 0.92) };
  }
  return placement;
}

function normalizedCanvasPiece(piece: CanvasPiece, garment?: Garment): CanvasPiece {
  if (garment?.category !== "Bottoms" || piece.scale < 0.66) return piece;
  return { ...piece, scale: Math.round(piece.scale * 0.81 * 1000) / 1000 };
}

const initialCanvas: CanvasPiece[] = [
  { instanceId: "initial-bottom", garmentId: "bottom-blue-jeans", variant: "closed", x: 50, y: 66.5, scale: 0.59, rotation: 0, z: 1001 },
  { instanceId: "initial-tee", garmentId: "top-basic-white-tee", variant: "closed", x: 50, y: 31.5, scale: 0.48, rotation: 0, z: 2001 },
  { instanceId: "initial-jacket", garmentId: "archive-002", variant: "open", x: 50, y: 32.5, scale: 0.51, rotation: 0, z: 3001 },
];

const initialDemoCanvas: CanvasPiece[] = [
  { instanceId: "demo-bottom", garmentId: "bottom-blue-jeans", variant: "closed", x: 50, y: 66.5, scale: 0.59, rotation: 0, z: 1001 },
  { instanceId: "demo-top", garmentId: "top-basic-white-tee", variant: "closed", x: 50, y: 31.5, scale: 0.48, rotation: 0, z: 2001 },
  { instanceId: "demo-shoes", garmentId: "footwear-white-sneakers", variant: "closed", x: 50, y: 87, scale: 0.34, rotation: 0, z: 4001 },
  { instanceId: "demo-glasses", garmentId: "accessory-black-sunglasses", variant: "closed", x: 50, y: 17.5, scale: 0.14, rotation: 0, z: 5001 },
  { instanceId: "demo-tote", garmentId: "accessory-black-tote", variant: "closed", x: 74, y: 58, scale: 0.28, rotation: 0, z: 5002 },
];

const stylingNeutralFamilies = new Set(["Black", "White", "Grey", "Brown", "Blue"]);

function searchableGarment(garment: Garment) {
  return `${garment.name} ${garment.material} ${garment.finish} ${garment.tone} ${garment.tags?.join(" ") ?? ""}`.toLocaleLowerCase();
}

function contextGarmentScore(garment: Garment, code: StyleCode, moment: StyleMoment, occasion: StyleOccasion) {
  const searchable = searchableGarment(garment);
  let score = 0;

  if (code === "formal") {
    if (garment.category === "Tailoring") score += 12;
    if (/trouser|chino|shirt|blazer|coat|peacoat|draped|piped/.test(searchable)) score += 7;
    if (/tee|jeans|fleece|puffer|parka|track/.test(searchable)) score -= 7;
  } else if (code === "smart") {
    if (garment.category === "Tailoring") score += 7;
    if (/shirt|blazer|trouser|chino|leather|knit|denim/.test(searchable)) score += 4;
    if (/fleece|track/.test(searchable)) score -= 3;
  } else if (code === "experimental") {
    if (/graphic|embroidered|transparent|draped|kimono|cape|poncho|varsity|funnel/.test(searchable)) score += 9;
    if (["Textured", "Glossy", "Transparent"].includes(garment.finish)) score += 5;
    if (["Oversized", "Draped", "Cropped"].includes(garment.silhouette)) score += 4;
  } else {
    if (/jeans|tee|bomber|puffer|crewneck|sweater|fleece|coach|parka/.test(searchable)) score += 7;
    if (["Cotton", "Denim", "Technical nylon", "Knit", "Fleece"].includes(garment.material)) score += 3;
    if (garment.category === "Tailoring") score -= 3;
  }

  if (occasion === "work") {
    if (garment.category === "Tailoring" || /shirt|trouser|chino|coat/.test(searchable)) score += 6;
    if (/graphic|fleece|transparent|track/.test(searchable)) score -= 5;
  } else if (occasion === "dinner") {
    if (/leather|draped|blazer|knit/.test(searchable) || garment.finish === "Low sheen") score += 5;
  } else if (occasion === "event") {
    if (garment.category === "Tailoring" || /graphic|embroidered|cape|kimono|blazer/.test(searchable)) score += 6;
  } else if (/denim|tee|coach|bomber|chino/.test(searchable)) {
    score += 4;
  }

  if (moment === "night") {
    if (["Black", "Blue", "Grey"].includes(garment.colorFamily)) score += 4;
    if (["Leather", "Wool blend"].includes(garment.material) || ["Glossy", "Low sheen"].includes(garment.finish)) score += 3;
  } else {
    if (["White", "Blue", "Brown", "Green", "Grey"].includes(garment.colorFamily)) score += 3;
    if (["Matte", "Textured"].includes(garment.finish)) score += 2;
  }

  return score;
}

function paletteScore(top: Garment, bottom: Garment, outer: Garment, strategy: StylingStrategy) {
  const baseIsNeutral = stylingNeutralFamilies.has(top.colorFamily) && stylingNeutralFamilies.has(bottom.colorFamily);
  const sameBase = top.colorFamily === bottom.colorFamily;
  const outerIsNeutral = stylingNeutralFamilies.has(outer.colorFamily);
  let score = baseIsNeutral ? 5 : 0;
  if (sameBase) score += 2;
  if (outer.colorFamily === top.colorFamily || outer.colorFamily === bottom.colorFamily) score += 3;
  if (baseIsNeutral && !outerIsNeutral) score += strategy === "contrast" || strategy === "statement" ? 8 : 2;
  if (!baseIsNeutral && !outerIsNeutral && outer.colorFamily !== top.colorFamily && outer.colorFamily !== bottom.colorFamily) score -= 5;
  return score;
}

function silhouetteScore(top: Garment, bottom: Garment, outer: Garment) {
  const wideBottom = ["Oversized", "Relaxed", "Draped"].includes(bottom.silhouette);
  const largeOuter = ["Oversized", "Longline", "Draped"].includes(outer.silhouette);
  let score = 0;
  if (largeOuter && !wideBottom) score += 5;
  if (wideBottom && ["Cropped", "Regular"].includes(outer.silhouette)) score += 5;
  if (wideBottom && largeOuter) score -= 5;
  if (top.silhouette === "Regular" && (wideBottom || largeOuter)) score += 3;
  if (outer.openImage) score += 2;
  return score;
}

function strategyScore(top: Garment, bottom: Garment, outer: Garment, strategy: StylingStrategy) {
  const outerText = searchableGarment(outer);
  if (strategy === "balanced") {
    return (stylingNeutralFamilies.has(outer.colorFamily) ? 6 : 0)
      + (["Matte", "Low sheen"].includes(outer.finish) ? 3 : 0)
      + (outer.category === "Tailoring" && /jeans|denim/.test(searchableGarment(bottom)) ? 2 : 0);
  }
  if (strategy === "contrast") {
    return (outer.colorFamily !== top.colorFamily && outer.colorFamily !== bottom.colorFamily ? 6 : 0)
      + (outer.material !== top.material ? 3 : 0)
      + (outer.category === "Tailoring" && /jeans|denim/.test(searchableGarment(bottom)) ? 5 : 0);
  }
  if (strategy === "minimal") {
    return (stylingNeutralFamilies.has(top.colorFamily) && stylingNeutralFamilies.has(bottom.colorFamily) && stylingNeutralFamilies.has(outer.colorFamily) ? 8 : 0)
      + (["Matte", "Low sheen"].includes(outer.finish) ? 4 : 0)
      + (["Regular", "Relaxed"].includes(top.silhouette) ? 3 : 0)
      + (outer.colorFamily === top.colorFamily || outer.colorFamily === bottom.colorFamily ? 3 : 0);
  }
  if (strategy === "layered") {
    return (outer.openImage ? 7 : 0)
      + (outer.material !== top.material ? 5 : 0)
      + (["Relaxed", "Oversized", "Longline"].includes(outer.silhouette) ? 4 : 0)
      + (/shirt|knit|tee|crewneck/.test(searchableGarment(top)) ? 3 : 0);
  }
  return (/graphic|embroidered|transparent|cape|kimono|varsity|funnel/.test(outerText) ? 9 : 0)
    + (["Textured", "Glossy", "Transparent"].includes(outer.finish) ? 6 : 0)
    + (["Oversized", "Draped", "Cropped"].includes(outer.silhouette) ? 4 : 0)
    + (stylingNeutralFamilies.has(top.colorFamily) && stylingNeutralFamilies.has(bottom.colorFamily) ? 4 : 0);
}

function stylingReason(strategy: StylingStrategy, top: Garment, bottom: Garment, outer: Garment, occasion: StyleOccasion, moment: StyleMoment) {
  const topName = translateGarmentName(top.name);
  const bottomName = translateGarmentName(bottom.name);
  const outerName = translateGarmentName(outer.name);
  const context = `${styleOccasionLabels[occasion].toLocaleLowerCase()} de ${styleMomentLabels[moment].toLocaleLowerCase()}`;
  if (strategy === "balanced") return `${topName} y ${bottomName} construyen una base limpia; ${outerName} mantiene la paleta y equilibra el volumen. Es la opción más fácil de llevar para ${context}.`;
  if (strategy === "contrast") return `${outerName} introduce contraste de color o material sobre la base de ${topName} y ${bottomName}. Las siluetas no compiten, así que el look se siente intencional para ${context}.`;
  if (strategy === "minimal") return `${topName}, ${bottomName} y ${outerName} mantienen una paleta tranquila. La proporción evita que el look se vea plano y funciona como uniforme para ${context}.`;
  if (strategy === "layered") return `${outerName} se usa abierto para dejar visible ${topName}; ${bottomName} sostiene la silueta. La diferencia de materiales le da profundidad sin perder claridad para ${context}.`;
  return `${outerName} funciona como pieza protagonista. ${topName} y ${bottomName} permanecen contenidos para dejarle el foco sin perder proporción; funciona especialmente bien para ${context}.`;
}

function stableTextScore(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function coreRecommendationSignature(top: Garment, bottom: Garment, outer: Garment): string {
  return [top.id, bottom.id, outer.id].sort().join(":");
}

function savedLookCoreSignature(look: SavedLook, garmentById: Map<string, Garment>): string {
  return look.items
    .map((item) => garmentById.get(item.garmentId))
    .filter((item): item is Garment => Boolean(item) && ["Tops", "Bottoms", "Outerwear", "Tailoring"].includes(item.category))
    .map((item) => item.id)
    .sort()
    .join(":");
}

function complementScore(garment: Garment, selected: Garment[], code: StyleCode, moment: StyleMoment, occasion: StyleOccasion) {
  const selectedColors = new Set(selected.map((item) => item.colorFamily));
  let score = contextGarmentScore(garment, code, moment, occasion);
  if (stylingNeutralFamilies.has(garment.colorFamily)) score += 5;
  if (selectedColors.has(garment.colorFamily)) score += 4;
  if (garment.category === "Footwear" && ["Leather", "Cotton"].includes(garment.material)) score += 2;
  return score;
}

function matchesStyleFamily(garment: Garment, family: StyleFamilyId): boolean {
  const searchable = searchableGarment(garment);
  if (family === "classic") return /shirt|chino|trouser|coat|peacoat|leather shoe|loafer|straight/.test(searchable) || garment.category === "Tailoring";
  if (family === "minimal") return stylingNeutralFamilies.has(garment.colorFamily) && garment.finish !== "Graphic" && !/graphic|embroidered|floral|varsity/.test(searchable);
  if (family === "relaxed") return ["Relaxed", "Oversized", "Longline"].includes(garment.silhouette) || /tee|denim|jeans|fleece|puffer|knit/.test(searchable);
  if (family === "tailored") return garment.category === "Tailoring" || /blazer|trouser|pleated|coat|peacoat|piped/.test(searchable);
  if (family === "preppy") return /oxford|shirt|chino|knit|crewneck|peacoat|loafer|pleated/.test(searchable);
  if (family === "streetwear") return /graphic|varsity|bomber|coach|oversized|sneaker|track/.test(searchable);
  if (family === "sporty") return /track|technical|shell|puffer|sneaker|nylon/.test(searchable);
  if (family === "utility") return /field|parka|cargo|utility|technical|pocket|shell/.test(searchable);
  if (family === "romantic") return /ivory|draped|wrap|cape|cream|soft|pumps/.test(searchable) || garment.silhouette === "Draped";
  if (family === "bohemian") return /embroidered|floral|shearling|fleece|textured|brown|camel|poncho/.test(searchable);
  if (family === "rebel") return /leather|black|graphic|distressed|biker/.test(searchable) || garment.finish === "Glossy";
  return /asymmetric|transparent|draped|kimono|cape|poncho|cropped|funnel/.test(searchable) || ["Draped", "Cropped"].includes(garment.silhouette);
}

function stylePreferenceScore(garment: Garment, profile?: StyleProfile | null): number {
  if (!profile?.completed || !profile.ratings.length) return 0;
  let score = 0;
  for (const rating of profile.ratings) {
    if (!matchesStyleFamily(garment, rating.family)) continue;
    score += rating.blocked ? -30 : (rating.affinity - 50) / 6;
  }
  const experimental = matchesStyleFamily(garment, "avant_garde") || matchesStyleFamily(garment, "rebel") || matchesStyleFamily(garment, "streetwear");
  if (experimental) score += (profile.exploration - 35) / 8;
  return score;
}

function buildStylingRecommendations(
  garments: Garment[],
  code: StyleCode,
  moment: StyleMoment,
  occasion: StyleOccasion,
  excludedSignatures: Set<string> = new Set(),
  styleProfile?: StyleProfile | null,
  priorityGarmentIds: Set<string> = new Set(),
): StylingRecommendation[] {
  const bottoms = garments.filter((item) => item.category === "Bottoms");
  const tops = garments.filter((item) => item.category === "Tops");
  const outerLayers = garments.filter((item) => item.category === "Outerwear" || item.category === "Tailoring");
  if (!bottoms.length || !tops.length || !outerLayers.length) return [];
  const footwear = garments.filter((item) => item.category === "Footwear");
  const accessories = garments.filter((item) => item.category === "Accessories");
  const strategies: StylingStrategy[] = ["balanced", "contrast", "statement", "minimal", "layered"];
  const garmentUse = new Map<string, number>();
  const selectedSignatures = new Set<string>();
  const usedComplements = new Set<string>();

  return strategies.flatMap((strategy, recommendationIndex) => {
    const candidates = bottoms.flatMap((bottom) => tops.flatMap((top) => outerLayers.map((outer) => ({
      bottom,
      top,
      outer,
      signature: coreRecommendationSignature(top, bottom, outer),
      score: contextGarmentScore(bottom, code, moment, occasion)
        + contextGarmentScore(top, code, moment, occasion)
        + contextGarmentScore(outer, code, moment, occasion)
        + stylePreferenceScore(bottom, styleProfile)
        + stylePreferenceScore(top, styleProfile)
        + stylePreferenceScore(outer, styleProfile)
        + (priorityGarmentIds.has(bottom.id) ? 18 : 0)
        + (priorityGarmentIds.has(top.id) ? 18 : 0)
        + (priorityGarmentIds.has(outer.id) ? 18 : 0)
        + paletteScore(top, bottom, outer, strategy)
        + silhouetteScore(top, bottom, outer)
        + strategyScore(top, bottom, outer, strategy),
    }))));
    const effectiveScore = (candidate: typeof candidates[number]) => candidate.score
      - (garmentUse.get(candidate.bottom.id) ?? 0) * 11
      - (garmentUse.get(candidate.top.id) ?? 0) * 11
      - (garmentUse.get(candidate.outer.id) ?? 0) * 14
      + stableTextScore(`${strategy}:${candidate.signature}`) % 100 / 1000;
    candidates.sort((a, b) => effectiveScore(b) - effectiveScore(a) || a.signature.localeCompare(b.signature));
    const choice = candidates.find((candidate) => !excludedSignatures.has(candidate.signature) && !selectedSignatures.has(candidate.signature))
      ?? candidates.find((candidate) => !selectedSignatures.has(candidate.signature))
      ?? candidates[0];
    if (!choice) return [];
    selectedSignatures.add(choice.signature);
    for (const garment of [choice.bottom, choice.top, choice.outer]) garmentUse.set(garment.id, (garmentUse.get(garment.id) ?? 0) + 1);

    const selectedBase = [choice.top, choice.bottom, choice.outer];
    const rankComplement = (pool: Garment[]) => [...pool].sort((a, b) => {
      const aScore = complementScore(a, selectedBase, code, moment, occasion) + stylePreferenceScore(a, styleProfile) + (priorityGarmentIds.has(a.id) ? 14 : 0) - (usedComplements.has(a.id) ? 10 : 0);
      const bScore = complementScore(b, selectedBase, code, moment, occasion) + stylePreferenceScore(b, styleProfile) + (priorityGarmentIds.has(b.id) ? 14 : 0) - (usedComplements.has(b.id) ? 10 : 0);
      return bScore - aScore || a.id.localeCompare(b.id);
    })[0];
    const shoe = rankComplement(footwear);
    if (shoe) usedComplements.add(shoe.id);
    const accessory = rankComplement(accessories.filter((item) => item.id !== shoe?.id));
    if (accessory) usedComplements.add(accessory.id);
    const bottomPlacement = defaultPlacement(choice.bottom);
    const topPlacement = recommendationTopPlacement(choice.top, choice.outer);
    const outerPlacement = recommendationOuterPlacement(choice.outer);
    const items: CanvasPiece[] = [
      { instanceId: `${strategy}-bottom`, garmentId: choice.bottom.id, variant: "closed", ...bottomPlacement, rotation: 0, z: layerBase(choice.bottom.category) + 1 },
      { instanceId: `${strategy}-top`, garmentId: choice.top.id, variant: "closed", ...topPlacement, rotation: 0, z: layerBase(choice.top.category) + 1 },
      { instanceId: `${strategy}-outer`, garmentId: choice.outer.id, variant: choice.outer.openImage ? "open" : "closed", ...outerPlacement, rotation: 0, z: layerBase(choice.outer.category) + 1 },
      ...(shoe ? [{ instanceId: `${strategy}-shoe`, garmentId: shoe.id, variant: "closed" as const, ...defaultPlacement(shoe), rotation: 0, z: layerBase(shoe.category) + 1 }] : []),
      ...(accessory ? [{ instanceId: `${strategy}-accessory`, garmentId: accessory.id, variant: "closed" as const, ...defaultPlacement(accessory), rotation: 0, z: layerBase(accessory.category) + 1 }] : []),
    ];
    return [{
      id: `${strategy}-${recommendationIndex}-${choice.signature}`,
      strategy,
      signature: choice.signature,
      title: stylingStrategyLabels[strategy],
      name: `${styleOccasionLabels[occasion]} · ${styleCodeLabels[code]} · ${stylingStrategyLabels[strategy]}`,
      reason: stylingReason(strategy, choice.top, choice.bottom, choice.outer, occasion, moment),
      items,
    }];
  });
}

function buildDemoRecommendations(code: StyleCode, moment: StyleMoment, occasion: StyleOccasion): StylingRecommendation[] {
  const byId = new Map(formeBasics.map((item) => [item.id, item]));
  const dressy = code === "formal" || code === "smart" || occasion === "work" || occasion === "dinner";
  const recipes = [
    {
      id: "balanced" as StylingStrategy,
      title: "Seguro",
      name: `${styleOccasionLabels[occasion]} · ${styleCodeLabels[code]} · Base limpia`,
      reason: dressy
        ? "La camisa azul y el pantalón negro crean una base ordenada; los zapatos marrones suavizan el contraste sin volverla rígida."
        : "La camiseta blanca, el denim recto y las zapatillas blancas mantienen una proporción simple y fácil de repetir.",
      ids: dressy
        ? ["top-blue-long-sleeve-shirt", "bottom-black-trouser", "footwear-brown-leather-shoes", "accessory-black-tote"]
        : ["top-basic-white-tee", "bottom-blue-jeans", "footwear-white-sneakers", "accessory-black-cap"],
    },
    {
      id: "contrast" as StylingStrategy,
      title: "Contraste",
      name: `${styleMomentLabels[moment]} · Contraste controlado`,
      reason: "El top negro contiene la parte superior, mientras el denim azul y el calzado oscuro separan los volúmenes con claridad.",
      ids: ["top-black-short-sleeve-shirt", "bottom-blue-jeans", "footwear-black-leather-shoes", "accessory-black-sunglasses"],
    },
    {
      id: "statement" as StylingStrategy,
      title: "Protagonista",
      name: `${styleCodeLabels[code]} · Monocromo`,
      reason: "La silueta negra conecta top, pantalón y accesorios. El tacón estiliza la base y el tote mantiene el look funcional.",
      ids: ["top-oversized-black-tee", "bottom-black-trouser", "footwear-black-pumps", "accessory-black-tote", "accessory-black-sunglasses"],
    },
    {
      id: "minimal" as StylingStrategy,
      title: "Esencial",
      name: `${styleOccasionLabels[occasion]} · Uniforme claro`,
      reason: "La camisa azul, el chino piedra y las zapatillas blancas forman un uniforme ligero con contraste bajo y piezas fáciles de repetir.",
      ids: ["top-blue-long-sleeve-shirt", "bottom-stone-chino", "footwear-white-sneakers", "accessory-black-sunglasses"],
    },
    {
      id: "layered" as StylingStrategy,
      title: "Capas",
      name: `${styleMomentLabels[moment]} · Base oscura`,
      reason: "La camiseta negra y el denim lavado construyen una base tonal; los zapatos marrones y la gorra hacen que se vea menos deportiva sin perder comodidad.",
      ids: ["top-oversized-black-tee", "bottom-black-jeans", "footwear-brown-leather-shoes", "accessory-black-cap"],
    },
  ];

  return recipes.map((recipe) => ({
    id: `demo-${recipe.id}`,
    strategy: recipe.id,
    signature: [...recipe.ids].sort().join(":"),
    title: recipe.title,
    name: recipe.name,
    reason: recipe.reason,
    items: recipe.ids.flatMap((id, index) => {
      const garment = byId.get(id);
      if (!garment) return [];
      const placement = defaultPlacement(garment);
      return [{
        instanceId: `demo-${recipe.id}-${id}`,
        garmentId: id,
        variant: "closed" as const,
        ...placement,
        rotation: 0,
        z: layerBase(garment.category) + index + 1,
      }];
    }),
  }));
}

const iterationProfiles = [
  { id: "clean", title: "Limpio", outer: /collarless|coach|field|shell/, footwear: /white|sneaker/, accessory: /tote/ },
  { id: "contrast", title: "Contraste", outer: /puffer|fleece|tan|camel|sage|denim/, footwear: /black leather/, accessory: /sunglasses/ },
  { id: "statement", title: "Protagonista", outer: /graphic|embroidered|cape|poncho|transparent|varsity/, footwear: /pump|black/, accessory: /sunglasses|beanie/ },
  { id: "tailored", title: "Pulido", outer: /blazer|coat|trench|leather/, footwear: /brown|black leather/, accessory: /tote/ },
  { id: "relaxed", title: "Relajado", outer: /parka|puffer|coach|fleece|bomber|blouson/, footwear: /sneaker/, accessory: /cap|beanie/ },
] as const;

function buildLookIterations(garments: Garment[], current: CanvasPiece[]): LookIteration[] {
  const byId = new Map(garments.map((item) => [item.id, item]));
  const fixed = current.filter((piece) => {
    const garment = byId.get(piece.garmentId);
    return garment?.category === "Tops" || garment?.category === "Bottoms";
  });
  const hasTop = fixed.some((piece) => byId.get(piece.garmentId)?.category === "Tops");
  const hasBottom = fixed.some((piece) => byId.get(piece.garmentId)?.category === "Bottoms");
  if (!hasTop || !hasBottom) return [];

  const baseColors = new Set(fixed.map((piece) => byId.get(piece.garmentId)?.colorFamily).filter(Boolean));
  const outerwear = garments.filter((item) => item.category === "Outerwear" || item.category === "Tailoring");
  const footwear = garments.filter((item) => item.category === "Footwear");
  const accessories = garments.filter((item) => item.category === "Accessories");
  const usedOuter = new Set<string>();
  const usedFootwear = new Set<string>();
  const usedAccessories = new Set<string>();

  return iterationProfiles.map((profile, profileIndex) => {
    const rankedOuter = [...outerwear].sort((a, b) => {
      const score = (garment: Garment) => {
        const text = searchableGarment(garment);
        let value = profile.outer.test(text) ? 20 : 0;
        if (profile.id === "contrast" && !baseColors.has(garment.colorFamily)) value += 8;
        if (profile.id === "statement" && ["Textured", "Glossy", "Transparent"].includes(garment.finish)) value += 6;
        if (profile.id === "tailored" && garment.category === "Tailoring") value += 9;
        if (profile.id === "clean" && stylingNeutralFamilies.has(garment.colorFamily)) value += 5;
        if (profile.id === "relaxed" && ["Relaxed", "Oversized"].includes(garment.silhouette)) value += 5;
        return value;
      };
      return score(b) - score(a) || a.id.localeCompare(b.id);
    });
    const outer = rankedOuter.find((item) => !usedOuter.has(item.id)) ?? rankedOuter[profileIndex % Math.max(rankedOuter.length, 1)];
    if (outer) usedOuter.add(outer.id);

    const rankedFootwear = [...footwear].sort((a, b) => {
      const aMatch = profile.footwear.test(searchableGarment(a)) ? 1 : 0;
      const bMatch = profile.footwear.test(searchableGarment(b)) ? 1 : 0;
      return bMatch - aMatch || a.id.localeCompare(b.id);
    });
    const shoe = rankedFootwear.find((item) => !usedFootwear.has(item.id)) ?? rankedFootwear[profileIndex % Math.max(rankedFootwear.length, 1)];
    if (shoe) usedFootwear.add(shoe.id);
    const rankedAccessories = [...accessories].sort((a, b) => {
      const aMatch = profile.accessory.test(searchableGarment(a)) ? 1 : 0;
      const bMatch = profile.accessory.test(searchableGarment(b)) ? 1 : 0;
      return bMatch - aMatch || a.id.localeCompare(b.id);
    });
    const accessory = rankedAccessories.find((item) => !usedAccessories.has(item.id)) ?? rankedAccessories[profileIndex % Math.max(rankedAccessories.length, 1)];
    if (accessory) usedAccessories.add(accessory.id);

    const additions = [outer, shoe, accessory].filter((item): item is Garment => Boolean(item));
    const items: CanvasPiece[] = [
      ...fixed.map((piece) => ({ ...piece, instanceId: `iterate-${profile.id}-${piece.instanceId}` })),
      ...additions.map((garment, index) => {
        const placement = garment.category === "Outerwear" || garment.category === "Tailoring"
          ? recommendationOuterPlacement(garment)
          : defaultPlacement(garment);
        return {
          instanceId: `iterate-${profile.id}-${garment.id}`,
          garmentId: garment.id,
          variant: garment.openImage ? "open" as const : "closed" as const,
          ...placement,
          rotation: 0,
          z: layerBase(garment.category) + index + 1,
        };
      }),
    ];
    const detail = [outer, shoe, accessory].filter((item): item is Garment => Boolean(item)).map((item) => translateGarmentName(item.name)).join(" · ");
    return { id: profile.id, title: profile.title, detail, items };
  });
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildWeekDays(anchor: Date): WeekDay[] {
  const today = localDateKey(anchor);
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const weekday = monday.getDay() || 7;
  monday.setDate(monday.getDate() - weekday + 1);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      key: localDateKey(date),
      shortLabel: new Intl.DateTimeFormat("es-PE", { weekday: "short" }).format(date).replace(".", "").toLocaleUpperCase(),
      dayNumber: String(date.getDate()).padStart(2, "0"),
      fullLabel: new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long" }).format(date),
      isToday: localDateKey(date) === today,
    };
  });
}

function countGarments(garments: Garment[], value: (garment: Garment) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const garment of garments) counts.set(value(garment), (counts.get(value(garment)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function buildAssistantAnswer({
  preset,
  followup,
  profile,
  styleProfile,
  garments,
  savedLooks,
  weeklyPlan,
  demoMode,
}: {
  preset: AssistantPreset;
  followup: AssistantFollowup;
  profile: WardrobeProfile;
  styleProfile: StyleProfile | null;
  garments: Garment[];
  savedLooks: SavedLook[];
  weeklyPlan: WeeklyPlanEntry[];
  demoMode: boolean;
}): AssistantAnswer {
  const categoryCounts = countGarments(garments, (garment) => garment.category);
  const colorCounts = countGarments(garments, (garment) => garment.colorFamily);
  const materialCounts = countGarments(garments, (garment) => garment.material);
  const essentialCategories: Garment["category"][] = ["Tops", "Bottoms", "Outerwear", "Footwear", "Accessories"];
  const missingCategories = essentialCategories.filter((category) => !categoryCounts.some(([name, count]) => name === category && count > 0));
  const topStyles = styleProfile?.ratings.length
    ? styleFamilyMeta
      .map((family) => ({ ...family, rating: styleProfile.ratings.find((rating) => rating.family === family.id) }))
      .filter((family) => family.rating && !family.rating.blocked)
      .sort((a, b) => (b.rating?.affinity ?? 0) - (a.rating?.affinity ?? 0))
      .slice(0, 2)
      .map((family) => family.label)
    : [];
  const name = demoMode ? "" : profile.name.split(" ")[0];
  const salutation = name ? `${name}, ` : "";
  const dominantCategory = categoryCounts[0]?.[0];
  const dominantColor = colorCounts[0]?.[0];
  const dominantMaterial = materialCounts[0]?.[0];
  const usedGarmentIds = new Set(savedLooks.flatMap((look) => look.items.map((item) => item.garmentId)));
  const underusedCount = garments.filter((garment) => !usedGarmentIds.has(garment.id)).length;

  let title = `${salutation}te propongo cinco opciones.`;
  let summary = `Todas parten de ${followup.focus} y de prendas que ya tienes.`;
  if (followup.intent === "underused") {
    title = `${salutation}hay ${underusedCount} piezas que todavía pueden entrar en rotación.`;
    summary = `Voy a priorizar prendas que aparecen poco o nunca en tus ${savedLooks.length} ${savedLooks.length === 1 ? "look guardado" : "looks guardados"}, manteniendo una base fácil de usar.`;
  } else if (followup.intent === "favorites") {
    const favoriteCount = garments.filter((garment) => garment.favorite).length;
    title = `${salutation}vamos a construir alrededor de tus favoritas.`;
    summary = `Parto de ${favoriteCount || "las"} piezas marcadas como favoritas y cambio sus acompañantes para que no termines repitiendo el mismo look.`;
  } else if (followup.intent === "experimental") {
    title = `${salutation}podemos probar algo nuevo sin dejar de parecerte.`;
    summary = `Voy a cambiar una variable por vez —color, proporción o capa— para ${followup.focus}.`;
  } else if (followup.intent === "missing") {
    title = missingCategories.length
      ? `${salutation}el hueco principal está en ${missingCategories.slice(0, 2).map((category) => translateValue(category).toLocaleLowerCase()).join(" y ")}.`
      : `${salutation}no falta una categoría completa; falta balancear lo que ya tienes.`;
    summary = missingCategories.length
      ? `Antes de comprar, prueba esa categoría con los básicos Formé y mira si realmente te da más opciones para ${followup.focus}.`
      : `${translateValue(dominantCategory ?? "tu categoría principal")} es lo que más se repite. Para ${followup.focus}, te serviría más sumar otra categoría que otra versión de lo mismo.`;
  }

  return {
    question: preset.label,
    followup: followup.label,
    eyebrow: "PARA TI",
    title,
    summary,
    intent: followup.intent,
    signals: [
      demoMode ? "Esta es una muestra; al entrar usaremos tu propio closet." : `${profile.name}, estas opciones parten de tus preferencias guardadas.`,
      topStyles.length ? `${topStyles.join(" y ")} son las direcciones que más te representan.` : "Calibra tu estilo para afinar estas opciones.",
      garments.length ? `Tu base combina ${translateValue(dominantColor ?? "varios colores").toLocaleLowerCase()} con ${translateValue(dominantMaterial ?? "materiales mixtos").toLocaleLowerCase()}.` : "Añade prendas para recibir opciones de tu propio closet.",
      underusedCount > 0 ? `${underusedCount} prendas todavía no aparecen en tus looks guardados.` : `${savedLooks.length} looks guardados y ${weeklyPlan.length} días planeados.`,
    ],
  };
}

function versatilityScore(garment: Garment): number {
  let score = garment.favorite ? 3 : 0;
  if (["Black", "White", "Grey", "Blue", "Brown"].includes(garment.colorFamily)) score += 4;
  if (["Regular", "Relaxed"].includes(garment.silhouette)) score += 3;
  if (["Matte", "Low sheen"].includes(garment.finish)) score += 2;
  if (["Tops", "Bottoms", "Footwear"].includes(garment.category)) score += 2;
  if (["ready", "ghosted"].includes(garment.status)) score += 1;
  return score;
}

function centeredLookPreviewItems(look: SavedLook, garmentById: Map<string, Garment>) {
  const items = look.items.flatMap((piece) => {
    const garment = garmentById.get(piece.garmentId);
    if (!garment) return [];
    return [{ piece: normalizedCanvasPiece(piece, garment), garment }];
  });
  if (!items.length) return items;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const { piece } of items) {
    const radians = piece.rotation * Math.PI / 180;
    const cosine = Math.abs(Math.cos(radians));
    const sine = Math.abs(Math.sin(radians));
    const halfWidth = 38 * piece.scale;
    const halfHeight = 47.5 * piece.scale;
    const rotatedHalfWidth = cosine * halfWidth + sine * halfHeight;
    const rotatedHalfHeight = sine * halfWidth + cosine * halfHeight;
    const centerY = piece.y * 1.5;
    minX = Math.min(minX, piece.x - rotatedHalfWidth);
    maxX = Math.max(maxX, piece.x + rotatedHalfWidth);
    minY = Math.min(minY, centerY - rotatedHalfHeight);
    maxY = Math.max(maxY, centerY + rotatedHalfHeight);
  }

  const boundsWidth = Math.max(1, maxX - minX);
  const boundsHeight = Math.max(1, maxY - minY);
  const fit = Math.min(1.15, 88 / boundsWidth, 132 / boundsHeight);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return items.map(({ piece, garment }) => ({
    garment,
    piece: {
      ...piece,
      x: 50 + (piece.x - centerX) * fit,
      y: 50 + ((piece.y * 1.5 - centerY) * fit) / 1.5,
      scale: piece.scale * fit,
    },
  }));
}

function LookPreview({ look, garmentById }: { look: SavedLook; garmentById: Map<string, Garment> }) {
  const previewItems = centeredLookPreviewItems(look, garmentById);
  return (
    <div className="saved-look-preview" aria-hidden="true">
      {previewItems.map(({ piece, garment }) => {
        const source = piece.variant === "open" && garment.openImage ? garment.openImage : garment.image;
        return <img
          key={piece.instanceId}
          src={imageSrc(cleanCanvasImage(source))}
          alt=""
          style={{
            left: `${piece.x}%`,
            top: `${piece.y}%`,
            zIndex: piece.z,
            transform: `translate(-50%, -50%) rotate(${piece.rotation}deg) scale(${piece.scale})`,
          }}
        />;
      })}
    </div>
  );
}

type ShareImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function loadShareImage(sourceUrl: string): Promise<ShareImage> {
  const response = await fetch(sourceUrl, { cache: "force-cache" });
  if (!response.ok) throw new Error("No se pudo preparar una de las prendas.");
  const blob = await response.blob();
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const objectUrl = URL.createObjectURL(blob);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("No se pudo preparar una de las prendas."));
    element.src = objectUrl;
  });
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(objectUrl) };
}

function storyFileName(name: string) {
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `forme-${slug || "look"}-story.png`;
}

async function createInstagramStoryBlob(look: SavedLook, garmentById: Map<string, Garment>): Promise<Blob> {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este dispositivo no pudo crear la historia.");

  context.fillStyle = "#d9d5cc";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(17,17,15,.13)";
  for (let x = 46; x < width; x += 28) {
    for (let y = 46; y < height; y += 28) {
      context.beginPath();
      context.arc(x, y, 1.25, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.fillStyle = "#11110f";
  context.font = "600 24px Arial, sans-serif";
  context.letterSpacing = "5px";
  context.fillText("FORMÉ® / LOOK GUARDADO", 72, 92);
  context.font = "400 72px Georgia, serif";
  context.letterSpacing = "-2px";
  context.fillText(look.name, 72, 185, width - 144);

  const artboard = { x: 92, y: 266, width: 896, height: 1344 };
  context.fillStyle = "rgba(248,247,242,.42)";
  context.fillRect(artboard.x, artboard.y, artboard.width, artboard.height);
  context.strokeStyle = "rgba(17,17,15,.42)";
  context.lineWidth = 2;
  context.strokeRect(artboard.x, artboard.y, artboard.width, artboard.height);

  const previewItems = centeredLookPreviewItems(look, garmentById).sort((a, b) => a.piece.z - b.piece.z);
  const loaded = await Promise.all(previewItems.map(async ({ piece, garment }) => {
    const source = piece.variant === "open" && garment.openImage ? garment.openImage : garment.image;
    return { piece, image: await loadShareImage(imageSrc(cleanCanvasImage(source))) };
  }));
  try {
    for (const { piece, image } of loaded) {
      const boxWidth = artboard.width * .76 * piece.scale;
      const boxHeight = boxWidth * 1.25;
      const contain = Math.min(boxWidth / image.width, boxHeight / image.height);
      const drawWidth = image.width * contain;
      const drawHeight = image.height * contain;
      const centerX = artboard.x + artboard.width * piece.x / 100;
      const centerY = artboard.y + artboard.height * piece.y / 100;
      context.save();
      context.translate(centerX, centerY);
      context.rotate(piece.rotation * Math.PI / 180);
      context.shadowColor = "rgba(17,17,15,.12)";
      context.shadowBlur = 22;
      context.shadowOffsetY = 12;
      context.drawImage(image.source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      context.restore();
    }
  } finally {
    loaded.forEach(({ image }) => image.close());
  }

  context.fillStyle = "#11110f";
  context.font = "400 46px Georgia, serif";
  context.letterSpacing = "-1px";
  context.fillText("Vístete con lo que ya tienes.", 72, 1738);
  context.font = "600 19px Arial, sans-serif";
  context.letterSpacing = "4px";
  context.fillText(`${look.items.length} ${look.items.length === 1 ? "PIEZA" : "PIEZAS"}  ·  FORME.GALLERY`, 72, 1793);
  context.fillStyle = "#e83b25";
  context.fillRect(72, 1840, 128, 8);

  const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!result) throw new Error("No se pudo exportar la historia.");
  return result;
}

function WeeklyPlanView({
  weekDays,
  entries,
  selectedDate,
  savedLooks,
  garmentById,
  busy,
  onSelectDate,
  onAssign,
  onRemove,
  onToggleWorn,
  onOpenLook,
  onAutoPlan,
  onCreateLook,
}: {
  weekDays: WeekDay[];
  entries: WeeklyPlanEntry[];
  selectedDate: string;
  savedLooks: SavedLook[];
  garmentById: Map<string, Garment>;
  busy: boolean;
  onSelectDate: (date: string) => void;
  onAssign: (date: string, lookId: string, occasion: WeeklyOccasion) => void;
  onRemove: (date: string) => void;
  onToggleWorn: (entry: WeeklyPlanEntry) => void;
  onOpenLook: (look: SavedLook) => void;
  onAutoPlan: () => void;
  onCreateLook: () => void;
}) {
  const selectedEntry = entries.find((entry) => entry.date === selectedDate);
  const selectedLook = selectedEntry ? savedLooks.find((look) => look.id === selectedEntry.outfitId) : undefined;
  const selectedDay = weekDays.find((day) => day.key === selectedDate) ?? weekDays[0];
  const plannedCount = weekDays.filter((day) => entries.some((entry) => entry.date === day.key)).length;
  const [occasion, setOccasion] = useState<WeeklyOccasion>("daily");

  useEffect(() => {
    // Keep the planner form aligned with the selected day or saved entry.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOccasion(selectedEntry?.occasion ?? (selectedDay?.shortLabel === "SÁB" || selectedDay?.shortLabel === "DOM" ? "weekend" : "daily"));
  }, [selectedEntry?.occasion, selectedDay?.key, selectedDay?.shortLabel]);

  return (
    <section className="week-view">
      <div className="app-section-heading week-heading">
        <div><h2>Tu semana</h2><span>Deja listo qué vas a usar cada día.</span></div>
        <div className="week-heading-actions">
          <div className="week-progress"><strong>{plannedCount}/7</strong><span>DÍAS LISTOS</span><i style={{ "--progress": `${plannedCount / 7 * 100}%` } as CSSProperties} /></div>
          <button className="week-auto-plan" type="button" onClick={onAutoPlan} disabled={busy || savedLooks.length === 0}>{busy ? "ORGANIZANDO…" : plannedCount ? "REPLANEAR SEMANA ↻" : "PLANEAR SEMANA →"}</button>
        </div>
      </div>

      <div className="week-strip" role="tablist" aria-label="Días de la semana">
        {weekDays.map((day) => {
          const entry = entries.find((item) => item.date === day.key);
          const look = entry ? savedLooks.find((item) => item.id === entry.outfitId) : undefined;
          return <button type="button" role="tab" aria-selected={selectedDate === day.key} className={`${selectedDate === day.key ? "active" : ""} ${entry ? "planned" : ""} ${entry?.worn ? "worn" : ""}`} onClick={() => onSelectDate(day.key)} key={day.key}>
            <div className="week-strip-preview">{look ? <LookPreview look={look} garmentById={garmentById} /> : <span>＋</span>}</div>
            <span>{day.shortLabel}{day.isToday ? " · HOY" : ""}</span>
            <strong>{day.dayNumber}</strong>
            <small>{look ? look.name : "Sin look"}</small>
          </button>;
        })}
      </div>

      <div className="week-workspace">
        <section className="day-plan-card">
          <div className="day-plan-header"><span>{selectedDay?.fullLabel.toLocaleUpperCase()}</span>{selectedEntry && <b>{selectedEntry.worn ? "USADO ✓" : weeklyOccasionLabels[selectedEntry.occasion]}</b>}</div>
          {selectedLook && selectedEntry ? <>
            <button type="button" className="day-look-preview" onClick={() => onOpenLook(selectedLook)} aria-label={`Abrir ${selectedLook.name} en el canvas`}>
              <LookPreview look={selectedLook} garmentById={garmentById} />
              <span>ABRIR EN CANVAS ↗</span>
            </button>
            <div className="day-look-meta"><div><p>LOOK DEL DÍA</p><h3>{selectedLook.name}</h3><span>{selectedLook.items.length} piezas · {weeklyOccasionLabels[selectedEntry.occasion]}</span></div><button type="button" onClick={() => onToggleWorn(selectedEntry)}>{selectedEntry.worn ? "DESMARCAR" : "YA LO USÉ ✓"}</button></div>
            <button className="week-remove" type="button" onClick={() => onRemove(selectedDate)}>QUITAR DEL DÍA</button>
          </> : <div className="day-plan-empty"><span>＋</span><h3>Aún no elegiste un look</h3><p>Elige uno de tus looks guardados o crea uno nuevo.</p><button type="button" onClick={onCreateLook}>CREAR UN LOOK →</button></div>}
        </section>

        <aside className="week-look-library">
          <div className="week-library-heading"><div><p>TUS LOOKS</p><h3>Cambia el look de {selectedDay?.shortLabel}</h3></div></div>
          <div className="occasion-row" aria-label="Ocasión">
            {(Object.keys(weeklyOccasionLabels) as WeeklyOccasion[]).map((option) => <button type="button" className={occasion === option ? "active" : ""} onClick={() => setOccasion(option)} key={option}>{weeklyOccasionLabels[option]}</button>)}
          </div>
          <div className="week-look-grid">
            {savedLooks.map((look) => <button type="button" className={selectedEntry?.outfitId === look.id ? "active" : ""} onClick={() => onAssign(selectedDate, look.id, occasion)} disabled={busy} key={look.id}>
              <LookPreview look={look} garmentById={garmentById} />
              <span><strong>{look.name}</strong><small>{look.items.length} PIEZAS</small></span>
            </button>)}
            {savedLooks.length === 0 && <div className="week-library-empty"><p>Guarda tu primer look para empezar a planear.</p><button type="button" onClick={onCreateLook}>IR AL CANVAS →</button></div>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function WardrobeInsightsView({
  garments,
  savedLooks,
  entries,
  weekDays,
  onOpenGarment,
  onGoToLooks,
  onGoToPieces,
}: {
  garments: Garment[];
  savedLooks: SavedLook[];
  entries: WeeklyPlanEntry[];
  weekDays: WeekDay[];
  onOpenGarment: (garment: Garment) => void;
  onGoToLooks: () => void;
  onGoToPieces: () => void;
}) {
  const categoryCounts = countGarments(garments, (garment) => garment.category);
  const colorCounts = countGarments(garments, (garment) => garment.colorFamily);
  const materialCounts = countGarments(garments, (garment) => garment.material);
  const essentialCategories = ["Tops", "Bottoms", "Outerwear", "Footwear", "Accessories"];
  const presentEssentials = essentialCategories.filter((category) => categoryCounts.some(([name, count]) => name === category && count > 0)).length;
  const readyCount = garments.filter((garment) => ["ready", "ghosted"].includes(garment.status)).length;
  const readyRatio = garments.length ? readyCount / garments.length : 0;
  const wardrobeScore = Math.round(presentEssentials / essentialCategories.length * 65 + readyRatio * 20 + Math.min(savedLooks.length, 3) / 3 * 15);
  const weekKeys = new Set(weekDays.map((day) => day.key));
  const plannedEntries = entries.filter((entry) => weekKeys.has(entry.date));
  const wornEntries = plannedEntries.filter((entry) => entry.worn);
  const topColorCount = colorCounts[0]?.[1] ?? 0;
  const dominantColorShare = garments.length ? Math.round(topColorCount / garments.length * 100) : 0;
  const maxCategoryCount = Math.max(...categoryCounts.map(([, count]) => count), 1);
  const versatileGarments = [...garments].sort((a, b) => versatilityScore(b) - versatilityScore(a) || a.name.localeCompare(b.name)).slice(0, 4);
  const missingCategory = essentialCategories.find((category) => !categoryCounts.some(([name, count]) => name === category && count > 0));
  const insights = [
    colorCounts.length > 0
      ? `${translateValue(colorCounts[0][0])} concentra ${dominantColorShare}% de tu paleta. ${dominantColorShare > 45 ? "Úsalo como base y rota acentos para que los looks no se sientan repetidos." : "La paleta está suficientemente repartida para crear contraste sin comprar más."}`
      : "Añade prendas para construir una lectura real de tu paleta.",
    missingCategory
      ? `Hay espacio para sumar ${translateValue(missingCategory).toLocaleLowerCase()}. Una pieza de esa categoría te daría más opciones que repetir otra de las que ya tienes.`
      : "Ya tienes las categorías necesarias para armar looks completos con lo que hay en tu closet.",
    savedLooks.length > 0
      ? `Tienes ${savedLooks.length} ${savedLooks.length === 1 ? "look guardado" : "looks guardados"}. Planificar la semana hará visible cuáles piezas sí rotas y cuáles se quedan quietas.`
      : "Aún no hay looks guardados. Empieza con una base simple y usa Mezclar para probar cinco direcciones.",
  ];

  return (
    <section className="insights-view">
      <div className="app-section-heading insights-heading"><div><h2>Lo que dice tu closet</h2><span>Patrones útiles para vestirte mejor con lo que ya tienes.</span></div><button type="button" onClick={onGoToPieces}>VER PRENDAS →</button></div>
      <div className="insights-dashboard">
        <article className="wardrobe-score-card">
          <div className="score-ring" style={{ "--score": `${wardrobeScore * 3.6}deg` } as CSSProperties}><span><strong>{wardrobeScore}</strong><small>/100</small></span></div>
          <div><p>QUÉ TAN FÁCIL ES ARMAR LOOKS</p><h3>{wardrobeScore >= 80 ? "Tienes muchas opciones" : wardrobeScore >= 55 ? "Tienes una buena base" : "Aún faltan algunas bases"}</h3><span>Sube cuando cubres más categorías y guardas looks que puedes repetir.</span></div>
        </article>
        <div className="insight-metric-grid">
          <article><span>PRENDAS</span><strong>{garments.length}</strong><small>{readyCount} listas para usar</small></article>
          <article><span>SEMANA</span><strong>{plannedEntries.length}/7</strong><small>{wornEntries.length} marcadas como usadas</small></article>
          <article><span>LOOKS</span><strong>{savedLooks.length}</strong><button type="button" onClick={onGoToLooks}>VER GUARDADOS →</button></article>
        </div>
      </div>

      <div className="insight-content-grid">
        <section className="composition-panel">
          <div className="insight-panel-heading"><h3>Tus categorías</h3></div>
          <div className="composition-list">{categoryCounts.map(([category, count]) => <div key={category}><span>{translateValue(category)}</span><i><b style={{ width: `${count / maxCategoryCount * 100}%` }} /></i><strong>{count}</strong></div>)}</div>
        </section>
        <section className="palette-panel">
          <div className="insight-panel-heading"><h3>Colores y materiales</h3></div>
          <div className="palette-list">{colorCounts.slice(0, 5).map(([color, count], index) => <span key={color}><i className={`palette-swatch palette-${color.toLocaleLowerCase().replace(/[^a-z]+/g, "-")}`} />{translateValue(color)}<small>{count}</small>{index === 0 && <b>BASE</b>}</span>)}</div>
          <div className="material-list">{materialCounts.slice(0, 5).map(([material, count]) => <span key={material}>{translateValue(material)} <b>{count}</b></span>)}</div>
        </section>
      </div>

      <section className="insight-notes">
        <div className="insight-panel-heading"><h3>Qué probar ahora</h3></div>
        <div>{insights.map((insight, index) => <article key={insight}><span>0{index + 1}</span><p>{insight}</p></article>)}</div>
      </section>

      <section className="versatile-section">
        <div className="insight-panel-heading"><h3>Tus prendas más versátiles</h3><span>Son las que combinan con más cosas de tu closet.</span></div>
        <div className="versatile-grid">{versatileGarments.map((garment) => <button type="button" onClick={() => onOpenGarment(garment)} key={garment.id}><img src={imageSrc(garment.image)} alt={translateGarmentName(garment.name)} /><span><strong>{translateGarmentName(garment.name)}</strong><small>{translateValue(garment.tone)} · {translateValue(garment.silhouette)}</small></span></button>)}</div>
      </section>
    </section>
  );
}

function ClosetGarmentGrid({
  garments,
  emptyLabel,
  onOpen,
  onAdd,
  onFavorite,
  onResetFilters,
}: {
  garments: Garment[];
  emptyLabel: string;
  onOpen: (garment: Garment) => void;
  onAdd: (garment: Garment) => void;
  onFavorite: (garment: Garment) => void;
  onResetFilters: () => void;
}) {
  return <div className="garment-grid">
    {garments.map((item) => <article className="garment-card" key={item.id}>
      <div className="image-wrap">
        <img src={imageSrc(item.image)} alt={translateGarmentName(item.name)} loading="lazy" />
        {(["queued", "processing", "uploaded", "batch_staged", "batch_processing", "cutout_pending"] as Garment["status"][]).includes(item.status) && <span className="processing-badge">PREPARANDO PRENDA</span>}
        {item.status === "failed" && <span className="processing-badge failed">NECESITA REVISIÓN</span>}
        <button className="card-detail-open" onClick={() => onOpen(item)} aria-label={`${item.collection === "forme" ? "Probar" : "Editar"} ${translateGarmentName(item.name)}`}><span>{item.collection === "forme" ? "PROBAR EN CANVAS ↗" : "EDITAR ↗"}</span></button>
        {item.collection !== "forme" && <button className={`heart ${item.favorite ? "active" : ""}`} onClick={() => onFavorite(item)} aria-label={`${item.favorite ? "Quitar de" : "Añadir a"} favoritas: ${translateGarmentName(item.name)}`}>♥</button>}
        <button className="card-studio-add" onClick={() => onAdd(item)}>AÑADIR AL CANVAS <span>＋</span></button>
      </div>
      <button className="card-meta" onClick={() => onOpen(item)} aria-label={`${item.collection === "forme" ? "Probar" : "Editar"} ${translateGarmentName(item.name)}`}><span><strong>{translateGarmentName(item.name)}</strong><small>{item.collection === "forme" ? "FORMÉ · " : item.brand ? `${item.brand} · ` : ""}{translateValue(item.category)} · {translateValue(item.tone)}</small></span><b>↗</b></button>
    </article>)}
    {garments.length === 0 && <div className="filter-empty">{emptyLabel}<button onClick={onResetFilters}>LIMPIAR FILTROS</button></div>}
  </div>;
}

function StyleOnboarding({ profile, saving, dismissible, onClose, onSave }: {
  profile: StyleProfile | null;
  saving: boolean;
  dismissible: boolean;
  onClose: () => void;
  onSave: (profile: StyleProfile) => Promise<void>;
}) {
  const [stage, setStage] = useState<"intro" | "audience" | "families" | "result">(profile?.completed ? "result" : "intro");
  const [audience, setAudience] = useState<StyleAudience>(profile?.audience ?? "hombre");
  const [exploration, setExploration] = useState(profile?.exploration ?? 35);
  const [familyIndex, setFamilyIndex] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [ratings, setRatings] = useState<Record<StyleFamilyId, StyleFamilyRating>>(() => Object.fromEntries(
    styleFamilyMeta.map((family) => [family.id, profile?.ratings.find((rating) => rating.family === family.id) ?? { family: family.id, affinity: 50, blocked: false, reason: null }]),
  ) as Record<StyleFamilyId, StyleFamilyRating>);

  const family = styleFamilyMeta[familyIndex];
  const rating = family ? ratings[family.id] : null;
  const rankedFamilies = styleFamilyMeta
    .map((item) => ({ ...item, ...ratings[item.id] }))
    .filter((item) => !item.blocked)
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, 3);
  const updateRating = (next: Partial<StyleFamilyRating>) => {
    if (!family) return;
    setRatings((current) => ({ ...current, [family.id]: { ...current[family.id], ...next } }));
  };
  const continueFamily = () => {
    if (familyIndex + 1 < styleFamilyMeta.length) setFamilyIndex((index) => index + 1);
    else setStage("result");
  };
  const goBack = () => {
    if (stage === "audience") setStage("intro");
    else if (stage === "families" && familyIndex === 0) setStage("audience");
    else if (stage === "families") setFamilyIndex((index) => Math.max(0, index - 1));
    else if (stage === "result") { setStage("families"); setFamilyIndex(styleFamilyMeta.length - 1); }
  };
  const submitProfile = async () => {
    setSaveError("");
    try {
      await onSave({ audience, exploration, completed: true, ratings: styleFamilyMeta.map((item) => ratings[item.id]) });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar tu perfil.");
    }
  };
  const skipCalibration = async () => {
    if (profile?.completed) {
      onClose();
      return;
    }
    setSaveError("");
    try {
      await onSave({ audience, exploration, completed: true, ratings: [] });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo omitir la calibración.");
    }
  };

  return <div className="style-onboarding-backdrop" role="dialog" aria-modal="true" aria-label="Calibrar mi estilo">
    <section className={`style-onboarding stage-${stage}`}>
      <header className="style-onboarding-header">
        <div className="style-onboarding-nav-start">
          {stage === "intro"
            ? <strong>FORMÉ®</strong>
            : <button type="button" onClick={goBack}>← VOLVER</button>}
        </div>
        <strong className="style-onboarding-nav-title">TU ESTILO</strong>
        <div className="style-onboarding-nav-end">
          {stage === "intro"
            ? <button className="style-skip-intro" type="button" disabled={saving} onClick={() => void skipCalibration()}>{saving ? "SALIENDO…" : "SALTAR"}</button>
            : null}
          {dismissible && stage !== "intro" && <button className="style-close" type="button" onClick={onClose} aria-label="Cerrar preferencias de estilo">×</button>}
        </div>
      </header>

      {stage === "intro" && <div className="style-onboarding-intro">
        <div className="style-intro-visual" aria-hidden="true">
          <img src={asset("/onboarding/style-families/hombre/12-vanguardista.webp")} alt="" />
          <img src={asset("/onboarding/style-families/mujer/11-rebelde.webp")} alt="" />
        </div>
        <div className="style-intro-copy">
          <p>ANTES DE EMPEZAR</p>
          <h1>Queremos<br />conocerte.</h1>
          <span>Dinos qué te atrae, qué prefieres evitar y cuánto quieres experimentar. Formé lo irá afinando contigo.</span>
        </div>
        <div className="style-intro-footer">
          <p><span>PUEDES CAMBIARLO CUANDO QUIERAS</span></p>
          <button className="style-primary-action" type="button" onClick={() => setStage("audience")}><span>EMPEZAR</span><b>→</b></button>
        </div>
      </div>}

      {stage === "audience" && <div className="style-onboarding-audience">
        <p>PUNTO DE PARTIDA</p>
        <h1>¿Por dónde empezamos?</h1>
        <span>Elige qué tipo de looks quieres ver primero. Esto no limita las prendas que podrás usar.</span>
        <div className="style-audience-options">
          {(["hombre", "mujer"] as StyleAudience[]).map((option) => <button key={option} type="button" className={audience === option ? "active" : ""} onClick={() => setAudience(option)}>
            <small>{option === "hombre" ? "LOOKS MASCULINOS" : "LOOKS FEMENINOS"}</small><strong>{option === "hombre" ? "Hombre" : "Mujer"}</strong><b>{audience === option ? "✓" : "→"}</b>
          </button>)}
        </div>
        <button className="style-primary-action" type="button" onClick={() => setStage("families")}><span>CONTINUAR</span><b>→</b></button>
      </div>}

      {stage === "families" && family && rating && <div className="style-family-stage">
        <div className="style-family-copy">
          <p>DIRECCIÓN DE ESTILO</p>
          <h1>{family.label}</h1>
          <span>{family.description}</span>
          <div className="style-family-progress" aria-hidden="true"><b style={{ width: `${((familyIndex + 1) / styleFamilyMeta.length) * 100}%` }} /></div>
        </div>
        <div className="style-family-card">
          <img src={asset(`/onboarding/style-families/${audience}/${family.file}`)} alt={`Look de estilo ${family.label}`} />
        </div>
        <div className="style-rating-panel">
          <div className="style-rating-value"><span>¿CUÁNTO SE PARECE A TI?</span><strong>{rating.blocked ? "FUERA" : `${rating.affinity}%`}</strong></div>
          <input type="range" min="0" max="100" step="5" value={rating.blocked ? 0 : rating.affinity} disabled={rating.blocked} onChange={(event) => updateRating({ affinity: Number(event.target.value), blocked: false })} aria-label={`Afinidad con ${family.label}`} />
          <div className="style-rating-labels"><span>NADA</span><span>MUCHO</span></div>
          {(rating.affinity <= 25 || rating.blocked) && <div className="style-feedback-reasons">
            <p>¿QUÉ CAMBIARÍAS?</p>
            <div>{(Object.keys(styleFeedbackLabels) as StyleFeedbackReason[]).map((reason) => <button type="button" key={reason} className={rating.reason === reason ? "active" : ""} onClick={() => updateRating({ reason })}>{styleFeedbackLabels[reason]}</button>)}</div>
          </div>}
          <div className="style-rating-actions">
            <button type="button" className={rating.blocked ? "blocked" : ""} onClick={() => updateRating({ blocked: !rating.blocked, affinity: rating.blocked ? 50 : 0 })}>{rating.blocked ? "VOLVER A INCLUIR" : "NO RECOMENDAR"}</button>
            <button className="style-primary-action" type="button" onClick={continueFamily}><span>{familyIndex + 1 === styleFamilyMeta.length ? "VER MI LECTURA" : "SIGUIENTE"}</span><b>→</b></button>
          </div>
        </div>
      </div>}

      {stage === "result" && <div className="style-onboarding-result">
        <p>TU PUNTO DE PARTIDA</p>
        <h1>Tu estilo empieza acá.</h1>
        <span>Esto no es una definición. Es una primera lectura que se irá afinando con los looks que guardes, descartes y realmente uses.</span>
        <div className="style-result-ranking">
          {rankedFamilies.map((item, index) => <article key={item.id}><span>0{index + 1}</span><strong>{item.label}</strong><b>{item.affinity}%</b></article>)}
        </div>
        <div className="style-exploration-control">
          <div><span>¿CUÁNTO QUIERES EXPERIMENTAR?</span><strong>{exploration}%</strong></div>
          <input type="range" min="0" max="100" step="5" value={exploration} onChange={(event) => setExploration(Number(event.target.value))} aria-label="Cuánto quiero experimentar" />
          <div><small>QUIERO LO FAMILIAR</small><small>SORPRÉNDEME</small></div>
        </div>
        {saveError && <p className="style-save-error" role="alert">{saveError}</p>}
        <button className="style-primary-action" type="button" disabled={saving} onClick={() => void submitProfile()}><span>{saving ? "GUARDANDO…" : profile?.completed ? "GUARDAR" : "ENTRAR A MI CLOSET"}</span><b>{saving ? "" : "→"}</b></button>
      </div>}
    </section>
  </div>;
}

export default function Home() {
  const [demoMode, setDemoMode] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [view, setView] = useState<View>("wardrobe");
  const [wardrobePanel, setWardrobePanel] = useState<WardrobePanel>("closet");
  const [closetMode, setClosetMode] = useState<ClosetMode>("browse");
  const [studioLibraryFilter, setStudioLibraryFilter] = useState<StudioLibraryFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [garments, setGarments] = useState(formeBasics);
  const [archiveFilters, setArchiveFilters] = useState<WardrobeFilters>(emptyFilters);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [wardrobeError, setWardrobeError] = useState("");
  const [profile, setProfile] = useState<WardrobeProfile>({
    name: "Tata",
    handle: "@tataportal",
    bio: "",
    profilePublic: false,
    discoverable: false,
    showCloset: false,
    showLooks: false,
  });
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [canvasPieces, setCanvasPieces] = useState(initialDemoCanvas);
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlanEntry[]>([]);
  const [selectedPlanDate, setSelectedPlanDate] = useState("");
  const [planningWeek, setPlanningWeek] = useState(false);
  const [activeOutfitId, setActiveOutfitId] = useState<string | null>(null);
  const [activeLookName, setActiveLookName] = useState("Demo Formé");
  const [styleCode, setStyleCode] = useState<StyleCode>("casual");
  const [styleMoment, setStyleMoment] = useState<StyleMoment>("day");
  const [styleOccasion, setStyleOccasion] = useState<StyleOccasion>("daily");
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [styleOnboardingOpen, setStyleOnboardingOpen] = useState(false);
  const [savingStyleProfile, setSavingStyleProfile] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [studioReturnPanel, setStudioReturnPanel] = useState<WardrobePanel>("closet");
  const [stylingRecommendations, setStylingRecommendations] = useState<StylingRecommendation[]>([]);
  const [assistantPresetId, setAssistantPresetId] = useState("");
  const [assistantFollowupId, setAssistantFollowupId] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState<AssistantAnswer | null>(null);
  const [recommendationHistory, setRecommendationHistory] = useState<string[]>([]);
  const [lookIterations, setLookIterations] = useState<LookIteration[]>([]);
  const [activeIterationIndex, setActiveIterationIndex] = useState(-1);
  const [selectedId, setSelectedId] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const [saved, setSaved] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [savedLooksOpen, setSavedLooksOpen] = useState(false);
  const [garmentDraft, setGarmentDraft] = useState<GarmentDraft | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [garmentSaved, setGarmentSaved] = useState(false);
  const [garmentSaveError, setGarmentSaveError] = useState("");
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [sharingLookId, setSharingLookId] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const snapshotFrameRef = useRef<HTMLDivElement>(null);
  const dragSession = useRef<DragSession | null>(null);
  const pointerTracks = useRef(new Map<number, PointerTrack>());

  const pinchSession = useRef<PinchSession | null>(null);
  const transformHandleSession = useRef<TransformHandleSession | null>(null);
  const marqueeSession = useRef<MarqueeSession | null>(null);
  const finalizingCutouts = useRef(new Set<string>());
  const [weekAnchor] = useState(() => new Date());

  const garmentById = useMemo(() => new Map(garments.map((item) => [item.id, item])), [garments]);
  const weekDays = useMemo(() => buildWeekDays(weekAnchor), [weekAnchor]);
  const filterOptions = useMemo<FilterOptions>(() => {
    const unique = (key: FilterKey) => Array.from(new Set(garments.map((item) => item[key]))).sort();
    const tonesByColor = garments.reduce<Record<string, string[]>>((result, item) => {
      result[item.colorFamily] = Array.from(new Set([...(result[item.colorFamily] ?? []), item.tone])).sort();
      return result;
    }, {});
    return {
      category: unique("category"),
      colorFamily: unique("colorFamily"),
      tone: unique("tone"),
      material: unique("material"),
      finish: unique("finish"),
      silhouette: unique("silhouette"),
      tonesByColor,
    };
  }, [garments]);
  const personalGarments = garments.filter((item) => item.collection !== "forme");
  const sharedBasics = garments.filter((item) => item.collection === "forme");
  const insightGarments = demoMode ? sharedBasics : personalGarments;
  const visiblePersonalGarments = personalGarments.filter((item) => matchFilters(item, archiveFilters));
  const visibleFormeBasics = sharedBasics.filter((item) => matchFilters(item, archiveFilters));
  const assistantGarments = useMemo(() => {
    if (demoMode || personalGarments.length === 0) return sharedBasics;
    const categories = new Set(personalGarments.map((item) => item.category));
    const fallbackBasics = sharedBasics.filter((item) => !categories.has(item.category));
    return [...personalGarments, ...fallbackBasics];
  }, [demoMode, personalGarments, sharedBasics]);
  const matchesStudioLibraryFilter = (item: Garment) => {
    if (studioLibraryFilter === "outerwear") return item.category === "Outerwear" || item.category === "Tailoring";
    if (studioLibraryFilter === "tops") return item.category === "Tops";
    if (studioLibraryFilter === "bottoms") return item.category === "Bottoms";
    if (studioLibraryFilter === "footwear") return item.category === "Footwear";
    if (studioLibraryFilter === "accessories") return item.category === "Accessories";
    return true;
  };
  const studioPersonalGarments = personalGarments.filter(matchesStudioLibraryFilter);
  const studioBasicGarments = sharedBasics.filter(matchesStudioLibraryFilter);
  const studioGarments = [...studioPersonalGarments, ...studioBasicGarments];
  const selectedPiece = canvasPieces.find((item) => item.instanceId === selectedId);
  const selectedGarment = selectedPiece ? garmentById.get(selectedPiece.garmentId) : undefined;
  const selectedGroupIdSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const activeLookIteration = activeIterationIndex >= 0 ? lookIterations[activeIterationIndex] : undefined;
  const canIterate = canvasPieces.some((piece) => garmentById.get(piece.garmentId)?.category === "Tops")
    && canvasPieces.some((piece) => garmentById.get(piece.garmentId)?.category === "Bottoms");
  const archiveFilterCount = Object.values(archiveFilters).filter((item) => item !== "All").length;
  const editingGarment = garmentDraft ? garmentById.get(garmentDraft.id) : undefined;
  const uploadRetryableCount = uploadItems.filter((item) => item.status === "ready" || item.status === "failed").length;
  const uploadFinishedCount = uploadItems.filter((item) => item.status === "done" || item.status === "waiting" || item.status === "failed").length;
  const editorTones = garmentDraft
    ? Array.from(new Set([garmentDraft.tone, ...(filterOptions.tonesByColor[garmentDraft.colorFamily] ?? [])])).filter(Boolean)
    : [];
  const profileImage = profile.avatarUrl || asset("/profile/tata.png");
  const profileImageClass = `profile-photo${profile.avatarUrl ? "" : " local-profile"}`;
  const profileTopStyles = styleProfile?.completed
    ? styleFamilyMeta
      .map((family) => ({ ...family, rating: styleProfile.ratings.find((rating) => rating.family === family.id) }))
      .filter((family) => family.rating && !family.rating.blocked)
      .sort((a, b) => (b.rating?.affinity ?? 0) - (a.rating?.affinity ?? 0))
      .slice(0, 3)
    : [];
  const selectedAssistantPreset = assistantPresets.find((preset) => preset.id === assistantPresetId);
  const assistantProfileReady = Boolean(styleProfile?.ratings.length);
  const assistantClosetCategories = new Set(assistantGarments.map((garment) => garment.category));
  const assistantClosetReady = personalGarments.length >= 8
    && assistantClosetCategories.has("Tops")
    && assistantClosetCategories.has("Bottoms")
    && (assistantClosetCategories.has("Outerwear") || assistantClosetCategories.has("Tailoring"));
  const assistantDataGaps = [
    demoMode ? "Entra para recibir recomendaciones con tus prendas y preferencias." : "",
    !demoMode && !assistantProfileReady ? "Cuéntanos qué te gusta para ajustar las recomendaciones a ti." : "",
    !demoMode && !assistantClosetReady ? "Añade al menos ocho prendas —incluyendo una parte de arriba, un pantalón y una capa— para recomendarte looks completos." : "",
  ].filter(Boolean);

  useEffect(() => {
    if (!selectedPlanDate && weekDays.length) setSelectedPlanDate(weekDays.find((day) => day.isToday)?.key ?? weekDays[0].key);
  }, [selectedPlanDate, weekDays]);

  useEffect(() => {
    if (isStaticDemo) window.location.replace(operationalSiteUrl);
  }, []);

  useEffect(() => {
    if (!isStaticDemo) {
      let active = true;
      const loadAccount = async () => {
        const sessionResponse = await fetch("/api/session", { cache: "no-store" });
        if (sessionResponse.status === 401 || sessionResponse.status === 403) {
          if (!active) return;
          setDemoMode(true);
          setSessionStatus("guest");
          try {
            const storedLooks = localStorage.getItem(demoLooksStorageKey);
            setSavedLooks(storedLooks ? JSON.parse(storedLooks) as SavedLook[] : []);
          } catch {
            setSavedLooks([]);
          }
          try {
            const storedWeek = localStorage.getItem(demoWeekStorageKey);
            setWeeklyPlan(storedWeek ? JSON.parse(storedWeek) as WeeklyPlanEntry[] : []);
          } catch {
            setWeeklyPlan([]);
          }
          setWardrobeError("");
          return;
        }
        if (!sessionResponse.ok) throw new Error("No se pudo revisar tu sesión.");
        const session = await sessionResponse.json() as { user: WardrobeProfile };
        const batchesReady = fetch("/api/batches/status", { cache: "no-store" }).catch(() => null);
        const [wardrobeResponse, outfitsResponse, weekResponse, styleProfileResponse] = await Promise.all([
          batchesReady.then(() => fetch("/api/wardrobe", { cache: "no-store" })),
          fetch("/api/outfits", { cache: "no-store" }),
          fetch("/api/week", { cache: "no-store" }),
          fetch("/api/style-profile", { cache: "no-store" }),
        ]);
        if (!wardrobeResponse.ok) throw new Error((await wardrobeResponse.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo abrir tu armario.");
        const wardrobe = await wardrobeResponse.json() as { garments: ApiGarment[] };
        const outfits = outfitsResponse.ok
          ? await outfitsResponse.json() as { outfits: SavedLook[] }
          : { outfits: [] };
        const week = weekResponse.ok
          ? await weekResponse.json() as { entries: WeeklyPlanEntry[] }
          : { entries: [] };
        const loadedStyleProfile = styleProfileResponse.ok
          ? (await styleProfileResponse.json() as { profile: StyleProfile }).profile
          : { audience: "hombre" as const, exploration: 35, completed: false, ratings: [] };
        if (!active) return;
        const baseGarments = session.user.isOwner ? starterGarments : formeBasics;
        const loadedGarments = mergeApiGarments(baseGarments, wardrobe.garments);
        const loadedGarmentById = new Map(loadedGarments.map((item) => [item.id, item]));
        const normalizedLooks = outfits.outfits.map((look) => ({
          ...look,
          items: look.items.map((item) => normalizedCanvasPiece(item, loadedGarmentById.get(item.garmentId))),
        }));
        setDemoMode(false);
        setSessionStatus("authenticated");
        setGarments(loadedGarments);
        setProfile(session.user);
        setSavedLooks(normalizedLooks);
        setWeeklyPlan(week.entries);
        setStyleProfile(loadedStyleProfile);
        setStyleOnboardingOpen(!loadedStyleProfile.completed);
        setWardrobePanel("closet");
        void Promise.all(wardrobe.garments.map((item) => finalizePendingCutouts(item))).catch(() => null);
        const savedLook = normalizedLooks.find((outfit) => outfit.id === currentOutfitId);
        if (savedLook?.items.length) {
          setCanvasPieces(savedLook.items);
          setActiveOutfitId(savedLook.id);
          setActiveLookName(savedLook.name);
          setSaved(true);
        } else {
          setCanvasPieces(session.user.isOwner ? initialCanvas : initialDemoCanvas);
          setActiveOutfitId(null);
          setActiveLookName("Nuevo look");
          setSaved(false);
        }
        setWardrobeError("");
      };
      void loadAccount().catch((error: unknown) => {
        if (!active) return;
        setSessionStatus("guest");
        setWardrobeError(error instanceof Error ? error.message : "No se pudo abrir tu armario.");
      });
      return () => { active = false; };
    }
    try {
      const stored = localStorage.getItem(garmentEditsStorageKey);
      if (!stored) return;
      const edits = JSON.parse(stored) as Record<string, StoredGarmentEdit>;
      const frame = window.requestAnimationFrame(() => {
        setGarments((items) => items.map((item) => edits[item.id] ? { ...item, ...edits[item.id], color: edits[item.id].tone } : item));
      });
      return () => window.cancelAnimationFrame(frame);
    } catch {
      // A malformed local edit should never block the wardrobe.
    }
  // The initial hydration intentionally runs once; pending cutouts are idempotent and guarded by a ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!garmentDraft) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGarmentDraft(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [garmentDraft]);

  useEffect(() => {
    if (!profileOpen) return;
    setProfileDraft({
      name: profile.name,
      handle: profile.handle,
      bio: profile.bio,
      profilePublic: profile.profilePublic,
      discoverable: profile.discoverable,
      showCloset: profile.showCloset,
      showLooks: profile.showLooks,
    });
    setProfileSaveError("");
    setProfileSaved(false);
    const closeProfileOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    window.addEventListener("keydown", closeProfileOnEscape);
    return () => window.removeEventListener("keydown", closeProfileOnEscape);
  }, [profileOpen]);

  useEffect(() => {
    if (!pricingOpen) return;
    const closePricingOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPricingOpen(false);
    };
    window.addEventListener("keydown", closePricingOnEscape);
    return () => window.removeEventListener("keydown", closePricingOnEscape);
  }, [pricingOpen]);

  function updateArchiveFilter(key: FilterKey, next: string) {
    setArchiveFilters((current) => ({ ...current, [key]: next, ...(key === "colorFamily" ? { tone: "All" } : {}) }));
  }

  function beginGoogleSignIn() {
    window.location.assign("/auth/google/start?return_to=%2F");
  }

  async function saveStyleCalibration(nextProfile: StyleProfile) {
    setSavingStyleProfile(true);
    setWardrobeError("");
    try {
      const response = await fetch("/api/style-profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextProfile),
      });
      const result = await response.json().catch(() => null) as { profile?: StyleProfile; error?: string } | null;
      if (!response.ok || !result?.profile) throw new Error(result?.error || "No se pudo guardar tu perfil de estilo.");
      setStyleProfile(result.profile);
      setStyleOnboardingOpen(false);
      if (styleProfile?.completed) setProfileOpen(true);
      else {
        setWardrobePanel("closet");
        setView("wardrobe");
      }
      setStylingRecommendations([]);
      setRecommendationHistory([]);
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo guardar tu perfil de estilo.");
      throw error;
    } finally {
      setSavingStyleProfile(false);
    }
  }

  function updateProfileDraft<Key extends keyof ProfileDraft>(key: Key, value: ProfileDraft[Key]) {
    setProfileDraft((current) => current ? { ...current, [key]: value } : current);
    setProfileSaved(false);
    setProfileSaveError("");
  }

  async function saveAccountSettings() {
    if (!profileDraft || savingProfile) return;
    setSavingProfile(true);
    setProfileSaveError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profileDraft),
      });
      const result = await response.json().catch(() => null) as { profile?: WardrobeProfile; error?: string } | null;
      if (!response.ok || !result?.profile) throw new Error(result?.error || "No se pudo guardar tu perfil.");
      setProfile(result.profile);
      setProfileDraft({
        name: result.profile.name,
        handle: result.profile.handle,
        bio: result.profile.bio,
        profilePublic: result.profile.profilePublic,
        discoverable: result.profile.discoverable,
        showCloset: result.profile.showCloset,
        showLooks: result.profile.showLooks,
      });
      setProfileSaved(true);
    } catch (error) {
      setProfileSaveError(error instanceof Error ? error.message : "No se pudo guardar tu perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveExplorationPreference(next: number) {
    if (!styleProfile) return;
    const normalized = Math.max(0, Math.min(100, Math.round(next / 5) * 5));
    const nextProfile = { ...styleProfile, exploration: normalized };
    setStyleProfile(nextProfile);
    try {
      const response = await fetch("/api/style-profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextProfile),
      });
      const result = await response.json().catch(() => null) as { profile?: StyleProfile; error?: string } | null;
      if (!response.ok || !result?.profile) throw new Error(result?.error || "No se pudo guardar cuánto quieres experimentar.");
      setStyleProfile(result.profile);
      setStylingRecommendations([]);
      setRecommendationHistory([]);
    } catch (error) {
      setProfileSaveError(error instanceof Error ? error.message : "No se pudo guardar cuánto quieres experimentar.");
    }
  }

  async function sharePublicProfile() {
    if (!profile.profilePublic) {
      setProfileSaveError("Activa tu perfil público antes de compartirlo.");
      return;
    }
    const url = `${window.location.origin}/${profile.handle}`;
    try {
      if (navigator.share) await navigator.share({ title: `${profile.name} en Formé`, text: `Mira mi closet en Formé`, url });
      else await navigator.clipboard.writeText(url);
      setProfileSaved(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setProfileSaveError("No se pudo compartir el perfil.");
    }
  }

  async function toggleOutfitVisibility(look: SavedLook) {
    const nextPublic = !look.isPublic;
    setSavedLooks((looks) => looks.map((item) => item.id === look.id ? { ...item, isPublic: nextPublic } : item));
    try {
      const response = await fetch(`/api/outfits/${encodeURIComponent(look.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: look.name, items: look.items, isPublic: nextPublic }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo cambiar la visibilidad del look.");
    } catch (error) {
      setSavedLooks((looks) => looks.map((item) => item.id === look.id ? look : item));
      setWardrobeError(error instanceof Error ? error.message : "No se pudo cambiar la visibilidad del look.");
    }
  }

  function openGarmentEditor(item: Garment) {
    setGarmentDraft({
      id: item.id,
      name: translateGarmentName(item.name),
      brand: item.brand ?? "",
      category: item.category,
      colorFamily: item.colorFamily,
      tone: item.tone,
      material: item.material,
      finish: item.finish,
      silhouette: item.silhouette,
      tags: item.tags ?? [],
      isPublic: Boolean(item.isPublic),
    });
    setTagInput("");
    setGarmentSaved(false);
    setGarmentSaveError("");
  }

  function updateGarmentDraft<Key extends keyof GarmentDraft>(key: Key, next: GarmentDraft[Key]) {
    setGarmentDraft((current) => current ? { ...current, [key]: next } : current);
    setGarmentSaved(false);
    setGarmentSaveError("");
  }

  function addDraftTag() {
    const next = tagInput.trim().replace(/^#/, "");
    if (!next || !garmentDraft) return;
    if (!garmentDraft.tags.some((tag) => tag.toLocaleLowerCase() === next.toLocaleLowerCase())) {
      updateGarmentDraft("tags", [...garmentDraft.tags, next]);
    }
    setTagInput("");
  }

  function handleTagKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addDraftTag();
  }

  async function saveGarmentDraft() {
    if (!garmentDraft) return;
    const { id, ...edit } = garmentDraft;
    const normalized = { ...edit, name: edit.name.trim() || "Prenda sin nombre" };
    setGarments((items) => items.map((item) => item.id === id
      ? { ...item, ...normalized, color: edit.tone }
      : item));
    setGarmentSaveError("");
    if (isStaticDemo) {
      try {
        const stored = JSON.parse(localStorage.getItem(garmentEditsStorageKey) ?? "{}") as Record<string, StoredGarmentEdit>;
        localStorage.setItem(garmentEditsStorageKey, JSON.stringify({ ...stored, [id]: normalized }));
      } catch {
        // The edit still works for the current session if storage is unavailable.
      }
      setGarmentSaved(true);
      return;
    }
    try {
      const current = garments.find((item) => item.id === id);
      const response = await fetch(`/api/garments/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...normalized, favorite: current?.favorite ?? false }),
      });
      const result = await response.json().catch(() => null) as { garment?: ApiGarment; error?: string } | null;
      if (!response.ok || !result?.garment) throw new Error(result?.error || "No se pudieron guardar los cambios.");
      setGarments((items) => mergeApiGarments(items, [result.garment as ApiGarment]));
      setGarmentSaved(true);
    } catch (error) {
      setGarmentSaveError(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    }
  }

  async function toggleFavorite(item: Garment) {
    const next = { ...item, favorite: !item.favorite };
    setGarments((items) => items.map((garment) => garment.id === item.id ? next : garment));
    if (isStaticDemo) return;
    try {
      const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(apiPayload(next)),
      });
      if (!response.ok) throw new Error();
    } catch {
      setGarments((items) => items.map((garment) => garment.id === item.id ? item : garment));
      setWardrobeError("No se pudo actualizar Favoritas.");
    }
  }

  async function deleteGarment(item: Garment) {
    setGarments((items) => items.filter((garment) => garment.id !== item.id));
    setCanvasPieces((items) => items.filter((piece) => piece.garmentId !== item.id));
    setGarmentDraft(null);
    if (isStaticDemo) return;
    try {
      const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(apiPayload(item)),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo eliminar la prenda.");
    } catch (error) {
      setGarments((items) => [item, ...items]);
      setWardrobeError(error instanceof Error ? error.message : "No se pudo eliminar la prenda.");
    }
  }

  function openWardrobe(panel?: WardrobePanel) {
    const targetPanel = panel ?? (view === "studio" ? studioReturnPanel : wardrobePanel);
    setView("wardrobe");
    setWardrobePanel(targetPanel);
    setClosetMode("browse");
    setLibraryOpen(false);
    setSavedLooksOpen(false);
    setProfileOpen(false);
  }

  function openStudio(returnPanel: WardrobePanel = wardrobePanel) {
    setStudioReturnPanel(returnPanel);
    setProfileOpen(false);
    setView("studio");
  }

  async function finalizeCutoutVariant(item: ApiGarment, outputVariant: "closed" | "open"): Promise<ApiGarment> {
    const source = outputVariant === "open" ? item.generatedOpenImage : item.generatedImage;
    if (!source) return item;
    const lock = `${item.id}:${outputVariant}:${source}`;
    if (finalizingCutouts.current.has(lock)) return item;
    finalizingCutouts.current.add(lock);
    try {
      const cutout = await whiteStudioCutout(imageSrc(source));
      const body = new FormData();
      body.append("file", cutout.file);
      body.append("outputVariant", outputVariant);
      body.append("qaStatus", cutout.qaStatus);
      body.append("qaNotes", cutout.qaNotes);
      const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}/cutout`, { method: "POST", body });
      const result = await response.json().catch(() => null) as { garment?: ApiGarment; error?: string } | null;
      if (!response.ok || !result?.garment) throw new Error(result?.error || "No se pudo terminar la imagen.");
      setGarments((items) => mergeApiGarments(items, [result.garment as ApiGarment]));
      return result.garment;
    } finally {
      finalizingCutouts.current.delete(lock);
    }
  }

  async function finalizePendingCutouts(item: ApiGarment): Promise<ApiGarment> {
    if (item.status !== "cutout_pending") return item;
    let current = item;
    if (current.generatedImage && !current.image) current = await finalizeCutoutVariant(current, "closed");
    if (current.generatedOpenImage && !current.openImage) current = await finalizeCutoutVariant(current, "open");
    return current;
  }

  function resetUpload() {
    uploadItems.forEach((item) => {
      if (item.preview.startsWith("blob:") && !(isStaticDemo && item.status === "done")) URL.revokeObjectURL(item.preview);
    });
    setUploadItems([]);
    if (fileInput.current) fileInput.current.value = "";
    setUploadError("");
  }

  function acceptFiles(source: FileList | File[] | undefined) {
    const incoming = Array.from(source ?? []);
    if (!incoming.length) return;
    const existing = new Set(uploadItems.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
    const images = incoming.filter((item) => item.type.startsWith("image/") && item.size <= maxUploadBytes && !existing.has(`${item.name}:${item.size}:${item.lastModified}`));
    const remaining = Math.max(0, maxBatchFiles - uploadItems.length);
    const accepted = images.slice(0, remaining).map<UploadItem>((next) => ({
      id: crypto.randomUUID(),
      file: next,
      preview: URL.createObjectURL(next),
      name: next.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      category: "Outerwear",
      status: "ready",
    }));
    setUploadItems((items) => [...items, ...accepted]);
    if (fileInput.current) fileInput.current.value = "";

    const oversized = incoming.filter((item) => item.type.startsWith("image/") && item.size > maxUploadBytes).length;
    const invalid = incoming.filter((item) => !item.type.startsWith("image/")).length;
    const overflow = Math.max(0, images.length - remaining);
    const notices = [
      oversized ? `${oversized} ${oversized === 1 ? "foto supera" : "fotos superan"} 20 MB` : "",
      invalid ? `${invalid} ${invalid === 1 ? "archivo no es una imagen" : "archivos no son imágenes"}` : "",
      overflow ? `puedes subir hasta ${maxBatchFiles} prendas a la vez` : "",
    ].filter(Boolean);
    setUploadError(notices.join(" · "));
  }

  function updateUploadItem(id: string, patch: Partial<UploadItem>) {
    setUploadItems((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function removeUploadItem(id: string) {
    const item = uploadItems.find((candidate) => candidate.id === id);
    if (item?.preview.startsWith("blob:")) URL.revokeObjectURL(item.preview);
    setUploadItems((items) => items.filter((candidate) => candidate.id !== id));
    setUploadError("");
  }

  async function ghostGarments() {
    const pending = uploadItems.filter((item) => item.status === "ready" || item.status === "failed");
    if (!pending.length) return;
    setUploadingBatch(true);
    setUploadError("");
    pending.forEach((item) => updateUploadItem(item.id, { status: "uploading", error: undefined }));

    if (isStaticDemo) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      pending.forEach((item) => updateUploadItem(item.id, { status: "processing" }));
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const created = pending.map<Garment>((item) => {
        const custom = { name: item.name || "Prenda sin nombre", category: item.category, color: "Custom" };
        return { id: crypto.randomUUID(), ...custom, ...classifyGarment(custom), image: item.preview, status: "ghosted" };
      });
      setGarments((items) => [...created, ...items]);
      pending.forEach((item) => updateUploadItem(item.id, { status: "done" }));
      setUploadingBatch(false);
      return;
    }

    const remote = new Map<string, string>();
    const useDiscountedBatch = pending.length >= discountedBatchThreshold && pending.every((item) => !item.garmentId);
    let failedCount = 0;
    let waitingCount = 0;
    for (const item of pending) {
      try {
        if (item.garmentId) {
          const retryResponse = await fetch(`/api/garments/${encodeURIComponent(item.garmentId)}/retry`, { method: "POST" });
          const retryResult = await retryResponse.json().catch(() => null) as { job?: { status?: string }; error?: string } | null;
          if (!retryResponse.ok) throw new Error(retryResult?.error || "No se pudo volver a preparar la imagen.");
          if (retryResult?.job?.status === "waiting_for_key") {
            waitingCount += 1;
            updateUploadItem(item.id, { status: "waiting", error: "Se procesará cuando esté disponible" });
          } else {
            remote.set(item.id, item.garmentId);
            updateUploadItem(item.id, { status: "processing", error: undefined });
          }
          continue;
        }
        const custom = { name: item.name || "Prenda sin nombre", category: item.category, color: "Custom" };
        const attributes = classifyGarment(custom);
        const processingFile = await processingFileFor(item.file);
        const body = new FormData();
        body.append("file", processingFile);
        body.append("original", item.file);
        if (useDiscountedBatch) body.append("processingMode", "batch");
        body.append("name", custom.name);
        body.append("category", item.category);
        body.append("colorFamily", attributes.colorFamily);
        body.append("tone", attributes.tone);
        body.append("material", attributes.material);
        body.append("finish", attributes.finish);
        body.append("silhouette", attributes.silhouette);
        const response = await fetch("/api/upload", { method: "POST", body });
        const result = await response.json().catch(() => null) as { garment?: ApiGarment; job?: { status?: string }; error?: string } | null;
        if (!response.ok || !result?.garment) throw new Error(result?.error || "No se pudo cargar la prenda.");
        setGarments((items) => mergeApiGarments(items, [result.garment as ApiGarment]));
        if (result.job?.status === "waiting_for_key") {
          waitingCount += 1;
          updateUploadItem(item.id, { status: "waiting", garmentId: result.garment.id, error: "Se procesará cuando esté disponible" });
        } else {
          remote.set(item.id, result.garment.id);
          updateUploadItem(item.id, { status: "processing", garmentId: result.garment.id });
        }
      } catch (error) {
        failedCount += 1;
        updateUploadItem(item.id, { status: "failed", error: error instanceof Error ? error.message : "No se pudo cargar" });
      }
    }

    if (useDiscountedBatch && remote.size > 1) {
      try {
        const batchResponse = await fetch("/api/batches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ garmentIds: [...remote.values()] }),
        });
        const batchResult = await batchResponse.json().catch(() => null) as { batch?: { status?: string }; fallback?: string; error?: string } | null;
        if (!batchResponse.ok) throw new Error(batchResult?.error || "No se pudieron procesar las prendas.");
        remote.forEach((_, localId) => updateUploadItem(localId, {
          status: "processing",
          error: batchResult?.fallback ? "Procesando ahora" : "Puede tardar hasta 24 h",
        }));
      } catch (error) {
        failedCount += remote.size;
        remote.forEach((_, localId) => updateUploadItem(localId, { status: "failed", error: error instanceof Error ? error.message : "No se pudieron procesar las prendas" }));
        remote.clear();
      }
    }

    let timedOut = false;
    const maxAttempts = useDiscountedBatch ? 15 : 90;
    for (let attempt = 0; attempt < maxAttempts && remote.size > 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, useDiscountedBatch ? 4000 : 2000));
      if (useDiscountedBatch && attempt % 3 === 0) await fetch("/api/batches/status", { cache: "no-store" }).catch(() => null);
      const checks = await Promise.all([...remote.entries()].map(async ([localId, garmentId]) => {
        try {
          const statusResponse = await fetch(`/api/garments/${encodeURIComponent(garmentId)}/status`, { cache: "no-store" });
          const statusResult = await statusResponse.json().catch(() => null) as { garment?: ApiGarment; job?: { status?: string; error?: string }; error?: string } | null;
          return { localId, statusResponse, statusResult };
        } catch {
          return { localId, statusResponse: null, statusResult: null };
        }
      }));
      for (const { localId, statusResponse, statusResult } of checks) {
        if (!statusResponse?.ok || !statusResult?.garment) continue;
        let updatedGarment = statusResult.garment;
        if (updatedGarment.status === "cutout_pending") {
          try { updatedGarment = await finalizePendingCutouts(updatedGarment); } catch { /* It will retry on the next status pass. */ }
        }
        setGarments((items) => mergeApiGarments(items, [updatedGarment as ApiGarment]));
        if (updatedGarment.status === "ready") {
          updateUploadItem(localId, { status: "done", error: undefined });
          remote.delete(localId);
        } else if (statusResult.job?.status === "failed" || statusResult.garment.status === "failed") {
          failedCount += 1;
          updateUploadItem(localId, { status: "failed", error: statusResult.job?.error || "No se pudo preparar la imagen" });
          remote.delete(localId);
        }
      }
    }
    if (remote.size > 0) {
      timedOut = true;
      remote.forEach((_, localId) => updateUploadItem(localId, { status: "processing", error: "Continúa en segundo plano" }));
    }
    if (failedCount) setUploadError(`${failedCount} ${failedCount === 1 ? "prenda necesita" : "prendas necesitan"} revisión.`);
    else if (waitingCount) setUploadError(waitingCount === 1 ? "La prenda quedó guardada y se procesará cuando el servicio esté disponible." : `${waitingCount} prendas quedaron guardadas y se procesarán cuando el servicio esté disponible.`);
    else if (timedOut) setUploadError("Las prendas siguen preparándose y aparecerán en tu closet al terminar.");
    setUploadingBatch(false);
  }

  function bringToFront(instanceId: string) {
    setCanvasPieces((items) => {
      const piece = items.find((item) => item.instanceId === instanceId);
      const garment = piece ? garmentById.get(piece.garmentId) : undefined;
      if (!piece || !garment) return items;
      const base = layerBase(garment.category);
      const top = Math.max(base, ...items.filter((item) => {
        const itemGarment = garmentById.get(item.garmentId);
        return itemGarment && layerBase(itemGarment.category) === base;
      }).map((item) => item.z)) + 1;
      return items.map((item) => item.instanceId === instanceId ? { ...item, z: top } : item);
    });
  }

  function addToCanvas(garmentId: string) {
    const existing = canvasPieces.find((item) => item.garmentId === garmentId);
    if (existing) {
      setSelectedId(existing.instanceId);
      setSelectedGroupIds([]);
      bringToFront(existing.instanceId);
      setSaved(false);
      return;
    }
    const garment = garmentById.get(garmentId);
    if (!garment) return;
    const instanceId = crypto.randomUUID();
    const placement = defaultPlacement(garment);
    setCanvasPieces((items) => {
      const base = layerBase(garment.category);
      const top = Math.max(base, ...items.filter((item) => {
        const itemGarment = garmentById.get(item.garmentId);
        return itemGarment && layerBase(itemGarment.category) === base;
      }).map((item) => item.z)) + 1;
      return [...items, {
        instanceId,
        garmentId,
        variant: garment.openImage ? "open" : "closed",
        x: placement.x,
        y: placement.y,
        scale: placement.scale,
        rotation: 0,
        z: top,
      }];
    });
    setSelectedId(instanceId);
    setSelectedGroupIds([]);
    setSaved(false);
  }

  function addAndOpenStudio(garmentId: string) {
    addToCanvas(garmentId);
    setActiveOutfitId(null);
    setActiveLookName("Nuevo look");
    openStudio("closet");
  }

  function startMoving(event: ReactPointerEvent<HTMLDivElement>, instanceId: string) {
    const canvas = canvasRef.current;
    const piece = canvasPieces.find((item) => item.instanceId === instanceId);
    if (!canvas || !piece) return;
    event.preventDefault();
    setSelectedGroupIds([]);
    setMarqueeRect(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    const track: PointerTrack = {
      instanceId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      startedAt: event.timeStamp,
    };
    const otherPointer = Array.from(pointerTracks.current.entries()).find(([, pointer]) => pointer.instanceId === instanceId);
    pointerTracks.current.set(event.pointerId, track);

    if (otherPointer && !pinchSession.current) {
      const [otherId, otherTrack] = otherPointer;
      otherTrack.moved = true;
      track.moved = true;
      pinchSession.current = {
        instanceId,
        pointerIds: [otherId, event.pointerId],
        startDistance: Math.hypot(event.clientX - otherTrack.x, event.clientY - otherTrack.y),
        startScale: piece.scale,
        startAngle: Math.atan2(event.clientY - otherTrack.y, event.clientX - otherTrack.x),
        startRotation: piece.rotation,
      };
      dragSession.current = null;
    } else if (!pinchSession.current) {
      dragSession.current = {
        instanceId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: piece.x,
        originY: piece.y,
        width: rect.width,
        height: rect.height,
      };
    } else {
      track.moved = true;
    }
    setSelectedId(instanceId);
    bringToFront(instanceId);
    setSaved(false);
  }

  function movePiece(event: ReactPointerEvent<HTMLDivElement>) {
    const track = pointerTracks.current.get(event.pointerId);
    if (!track) return;
    track.x = event.clientX;
    track.y = event.clientY;
    if (Math.hypot(track.x - track.startX, track.y - track.startY) > 8) track.moved = true;

    const pinch = pinchSession.current;
    if (pinch?.pointerIds.includes(event.pointerId)) {
      const first = pointerTracks.current.get(pinch.pointerIds[0]);
      const second = pointerTracks.current.get(pinch.pointerIds[1]);
      if (!first || !second || pinch.startDistance < 1) return;
      event.preventDefault();
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const scale = clamp(pinch.startScale * (distance / pinch.startDistance), 0.28, 1.35);
      const angle = Math.atan2(second.y - first.y, second.x - first.x);
      const rotation = pinch.startRotation + normalizeDegrees((angle - pinch.startAngle) * (180 / Math.PI));
      setCanvasPieces((items) => items.map((item) => item.instanceId === pinch.instanceId ? { ...item, scale, rotation } : item));
      setSaved(false);
      return;
    }

    const drag = dragSession.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const x = clamp(drag.originX + ((event.clientX - drag.startX) / drag.width) * 100, 4, 96);
    const y = clamp(drag.originY + ((event.clientY - drag.startY) / drag.height) * 100, 4, 96);
    setCanvasPieces((items) => items.map((item) => item.instanceId === drag.instanceId ? { ...item, x, y } : item));
  }

  function stopMoving(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const track = pointerTracks.current.get(event.pointerId);
    const pinch = pinchSession.current;
    const wasPinching = Boolean(pinch?.pointerIds.includes(event.pointerId));

    if (wasPinching && pinch) {
      const remainingId = pinch.pointerIds.find((pointerId) => pointerId !== event.pointerId);
      const remaining = remainingId === undefined ? undefined : pointerTracks.current.get(remainingId);
      if (remaining) remaining.moved = true;
      pinchSession.current = null;
    }
    if (dragSession.current?.pointerId === event.pointerId) dragSession.current = null;
    pointerTracks.current.delete(event.pointerId);

    if (!cancelled && !wasPinching && track && !track.moved) {
      const held = event.timeStamp - track.startedAt >= 500;
      const piece = canvasPieces.find((item) => item.instanceId === track.instanceId);
      const garment = piece ? garmentById.get(piece.garmentId) : undefined;
      if (held && garment?.openImage) {
        toggleVariant(track.instanceId);
      }
    }
  }

  function startMarqueeSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.pointerType === "touch" || window.innerWidth < 760) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".canvas-piece,button")) return;
    const canvasRect = event.currentTarget.getBoundingClientRect();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    marqueeSession.current = {
      pointerId: event.pointerId,
      startX: clamp(event.clientX, canvasRect.left, canvasRect.right),
      startY: clamp(event.clientY, canvasRect.top, canvasRect.bottom),
      canvasRect,
      moved: false,
    };
    setSelectedId("");
    setSelectedGroupIds([]);
    setMarqueeRect({ left: event.clientX - canvasRect.left, top: event.clientY - canvasRect.top, width: 0, height: 0 });
  }

  function moveMarqueeSelection(event: ReactPointerEvent<HTMLDivElement>) {
    const session = marqueeSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    const currentX = clamp(event.clientX, session.canvasRect.left, session.canvasRect.right);
    const currentY = clamp(event.clientY, session.canvasRect.top, session.canvasRect.bottom);
    const left = Math.min(session.startX, currentX);
    const top = Math.min(session.startY, currentY);
    const width = Math.abs(currentX - session.startX);
    const height = Math.abs(currentY - session.startY);
    if (width > 5 || height > 5) session.moved = true;
    setMarqueeRect({ left: left - session.canvasRect.left, top: top - session.canvasRect.top, width, height });
    const right = left + width;
    const bottom = top + height;
    const selected = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(".canvas-piece")).flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const intersects = rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom;
      return intersects && element.dataset.instanceId ? [element.dataset.instanceId] : [];
    });
    setSelectedGroupIds(selected);
  }

  function stopMarqueeSelection(event: ReactPointerEvent<HTMLDivElement>) {
    const session = marqueeSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (!session.moved) setSelectedGroupIds([]);
    marqueeSession.current = null;
    setMarqueeRect(null);
  }

  function startTransformHandle(event: ReactPointerEvent<HTMLButtonElement>, instanceId: string, mode: "scale" | "rotate") {
    const piece = canvasPieces.find((item) => item.instanceId === instanceId);
    const pieceElement = event.currentTarget.closest(".canvas-piece");
    if (!piece || !(pieceElement instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = pieceElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    transformHandleSession.current = {
      instanceId,
      pointerId: event.pointerId,
      mode,
      centerX,
      centerY,
      startDistance: Math.max(1, Math.hypot(event.clientX - centerX, event.clientY - centerY)),
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      startScale: piece.scale,
      startRotation: piece.rotation,
    };
    setSelectedId(instanceId);
    bringToFront(instanceId);
    setSaved(false);
  }

  function moveTransformHandle(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = transformHandleSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (session.mode === "scale") {
      const distance = Math.hypot(event.clientX - session.centerX, event.clientY - session.centerY);
      const scale = clamp(session.startScale * (distance / session.startDistance), 0.08, 1.35);
      setCanvasPieces((items) => items.map((item) => item.instanceId === session.instanceId ? { ...item, scale } : item));
    } else {
      const angle = Math.atan2(event.clientY - session.centerY, event.clientX - session.centerX);
      const rotation = normalizeDegrees(session.startRotation + (angle - session.startAngle) * 180 / Math.PI);
      setCanvasPieces((items) => items.map((item) => item.instanceId === session.instanceId ? { ...item, rotation } : item));
    }
    setSaved(false);
  }

  function stopTransformHandle(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (transformHandleSession.current?.pointerId === event.pointerId) transformHandleSession.current = null;
  }

  function toggleVariant(instanceId: string) {
    setCanvasPieces((items) => items.map((item) => item.instanceId === instanceId
      ? { ...item, variant: item.variant === "open" ? "closed" : "open" }
      : item));
    setSaved(false);
  }

  function updateSelected(patch: Partial<CanvasPiece>) {
    if (!selectedId) return;
    setCanvasPieces((items) => items.map((item) => item.instanceId === selectedId ? { ...item, ...patch } : item));
    setSaved(false);
  }

  function scaleSelected(delta: number) {
    if (!selectedPiece) return;
    updateSelected({ scale: clamp(selectedPiece.scale + delta, 0.24, 1.15) });
  }

  function rotateSelected(delta: number) {
    if (!selectedPiece) return;
    updateSelected({ rotation: selectedPiece.rotation + delta });
  }

  function sendSelected(direction: "front" | "back") {
    if (!selectedPiece || !selectedGarment) return;
    const base = layerBase(selectedGarment.category);
    const levels = canvasPieces.filter((item) => {
      const garment = garmentById.get(item.garmentId);
      return garment && layerBase(garment.category) === base;
    }).map((item) => item.z);
    updateSelected({ z: direction === "front" ? Math.max(base, ...levels) + 1 : Math.max(base, Math.min(...levels) - 1) });
  }

  function removePiece(instanceId: string) {
    setCanvasPieces((items) => items.filter((item) => item.instanceId !== instanceId));
    setSelectedId((current) => current === instanceId ? "" : current);
    setSelectedGroupIds((current) => current.filter((id) => id !== instanceId));
    setSaved(false);
  }

  function duplicatePiece(instanceId: string) {
    const source = canvasPieces.find((item) => item.instanceId === instanceId);
    if (!source) return;
    const instanceIdCopy = crypto.randomUUID();
    setCanvasPieces((items) => {
      const garment = garmentById.get(source.garmentId);
      const base = garment ? layerBase(garment.category) : source.z;
      const top = Math.max(base, ...items.filter((item) => {
        const itemGarment = garmentById.get(item.garmentId);
        return garment && itemGarment && layerBase(itemGarment.category) === base;
      }).map((item) => item.z)) + 1;
      return [...items, {
        ...source,
        instanceId: instanceIdCopy,
        x: clamp(source.x + 4, 4, 96),
        y: clamp(source.y + 4, 4, 96),
        z: top,
      }];
    });
    setSelectedId(instanceIdCopy);
    setSelectedGroupIds([]);
    setSaved(false);
  }

  function removeSelected() {
    if (selectedId) removePiece(selectedId);
  }

  function answerAssistantFollowup(preset: AssistantPreset, followup: AssistantFollowup) {
    setAssistantPresetId(preset.id);
    setAssistantFollowupId(followup.id);
    setStyleCode(followup.code);
    setStyleMoment(followup.moment);
    setStyleOccasion(followup.occasion);
    setAssistantAnswer(buildAssistantAnswer({
      preset,
      followup,
      profile,
      styleProfile,
      garments: personalGarments,
      savedLooks,
      weeklyPlan,
      demoMode,
    }));

    if (followup.intent === "missing") {
      setStylingRecommendations([]);
      setWardrobeError("");
      return;
    }

    const savedSignatures = savedLooks
      .map((look) => savedLookCoreSignature(look, garmentById))
      .filter(Boolean);
    const excludedSignatures = new Set([...recommendationHistory, ...savedSignatures]);
    const usedGarmentIds = new Set(savedLooks.flatMap((look) => look.items.map((item) => item.garmentId)));
    const priorityGarmentIds = new Set<string>();
    if (followup.intent === "underused") {
      personalGarments.filter((garment) => !usedGarmentIds.has(garment.id)).forEach((garment) => priorityGarmentIds.add(garment.id));
    } else if (followup.intent === "favorites") {
      personalGarments.filter((garment) => garment.favorite).forEach((garment) => priorityGarmentIds.add(garment.id));
    } else if (followup.intent === "experimental") {
      personalGarments.filter((garment) => {
        if (followup.id === "explore-color") return !["Black", "White", "Grey", "Brown", "Blue"].includes(garment.colorFamily);
        if (followup.id === "explore-polished") return garment.category === "Tailoring" || (garment.category === "Footwear" && garment.material === "Leather");
        if (followup.id === "explore-relaxed") return ["Relaxed", "Oversized", "Draped"].includes(garment.silhouette);
        return !["Regular", "Relaxed"].includes(garment.silhouette) || garment.finish === "Graphic";
      }).forEach((garment) => priorityGarmentIds.add(garment.id));
    }
    const next = demoMode
      ? buildDemoRecommendations(followup.code, followup.moment, followup.occasion)
      : buildStylingRecommendations(assistantGarments, followup.code, followup.moment, followup.occasion, excludedSignatures, styleProfile, priorityGarmentIds);
    if (!next.length) {
      setWardrobeError("Faltan prendas compatibles para crear esta recomendación.");
      return;
    }
    setStylingRecommendations(next);
    setRecommendationHistory((history) => [...new Set([...history, ...next.map((recommendation) => recommendation.signature)])].slice(-80));
    setWardrobeError("");
  }

  function repeatAssistantAnswer() {
    if (!selectedAssistantPreset) return;
    const followup = selectedAssistantPreset.options.find((option) => option.id === assistantFollowupId);
    if (followup) answerAssistantFollowup(selectedAssistantPreset, followup);
  }

  function iterateCurrentLook() {
    const next = buildLookIterations(garments, canvasPieces);
    if (!next.length) {
      setWardrobeError("Añade por lo menos un top y un pantalón para crear cinco variaciones.");
      return;
    }
    setLookIterations(next);
    openLookIteration(next[0], 0);
    setLibraryOpen(false);
    setSavedLooksOpen(false);
    setWardrobeError("");
  }

  function openLookIteration(iteration: LookIteration, index = lookIterations.findIndex((item) => item.id === iteration.id)) {
    setCanvasPieces(iteration.items.map((item) => ({ ...item, instanceId: crypto.randomUUID() })));
    setSelectedId("");
    setSelectedGroupIds([]);
    setActiveOutfitId(null);
    setActiveLookName(iteration.title);
    setActiveIterationIndex(Math.max(0, index));
    setSaved(false);
    setSavedLooksOpen(false);
    setWardrobeError("");
  }

  function stepLookIteration(direction: -1 | 1) {
    if (!lookIterations.length) return;
    const nextIndex = (activeIterationIndex + direction + lookIterations.length) % lookIterations.length;
    openLookIteration(lookIterations[nextIndex], nextIndex);
  }

  function closeLookIterations() {
    setLookIterations([]);
    setActiveIterationIndex(-1);
  }

  async function saveStylingRecommendation(recommendation: StylingRecommendation) {
    if (savingOutfit) return;
    const outfitId = `look-${crypto.randomUUID()}`;
    const lookName = `${recommendation.name} · ${String(savedLooks.length + 1).padStart(2, "0")}`;
    const items = recommendation.items.map((item) => ({ ...item, instanceId: crypto.randomUUID() }));
    setSavingOutfit(true);
    setWardrobeError("");
    try {
      if (!isStaticDemo && !demoMode) {
        const response = await fetch(`/api/outfits/${encodeURIComponent(outfitId)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: lookName, items }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo guardar la recomendación.");
      }
      const nextLook: SavedLook = { id: outfitId, name: lookName, items };
      setSavedLooks((looks) => {
        const nextLooks = [nextLook, ...looks];
        if (demoMode) localStorage.setItem(demoLooksStorageKey, JSON.stringify(nextLooks));
        return nextLooks;
      });
      setRecommendationHistory((history) => [...new Set([...history, recommendation.signature])].slice(-80));
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo guardar la recomendación.");
    } finally {
      setSavingOutfit(false);
    }
  }

  function openSavedLook(look: SavedLook) {
    setCanvasPieces(look.items.map((item) => normalizedCanvasPiece({ ...item }, garmentById.get(item.garmentId))));
    setSelectedId("");
    setSelectedGroupIds([]);
    setActiveOutfitId(look.id);
    setActiveLookName(look.name);
    setSaved(true);
    setLookIterations([]);
    setActiveIterationIndex(-1);
    setLibraryOpen(false);
    setSavedLooksOpen(false);
    // A saved look always belongs to the Looks archive. Even when it is opened
    // from the Canvas side panel, returning to the wardrobe should land there.
    openStudio("looks");
  }

  function persistDemoWeek(entries: WeeklyPlanEntry[]) {
    if (demoMode) localStorage.setItem(demoWeekStorageKey, JSON.stringify(entries));
  }

  async function assignLookToDate(date: string, outfitId: string, occasion: WeeklyOccasion) {
    if (!date || planningWeek) return;
    const nextEntry: WeeklyPlanEntry = { date, outfitId, occasion, worn: false };
    setPlanningWeek(true);
    setWardrobeError("");
    try {
      if (!isStaticDemo && !demoMode) {
        const response = await fetch(`/api/week/${encodeURIComponent(date)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nextEntry),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo planear ese día.");
      }
      setWeeklyPlan((entries) => {
        const next = [...entries.filter((entry) => entry.date !== date), nextEntry].sort((a, b) => a.date.localeCompare(b.date));
        persistDemoWeek(next);
        return next;
      });
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo planear ese día.");
    } finally {
      setPlanningWeek(false);
    }
  }

  async function removeLookFromDate(date: string) {
    if (!date || planningWeek) return;
    setPlanningWeek(true);
    setWardrobeError("");
    try {
      if (!isStaticDemo && !demoMode) {
        const response = await fetch(`/api/week/${encodeURIComponent(date)}`, { method: "DELETE" });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo liberar ese día.");
      }
      setWeeklyPlan((entries) => {
        const next = entries.filter((entry) => entry.date !== date);
        persistDemoWeek(next);
        return next;
      });
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo liberar ese día.");
    } finally {
      setPlanningWeek(false);
    }
  }

  async function togglePlannedLookWorn(entry: WeeklyPlanEntry) {
    if (planningWeek) return;
    const nextEntry = { ...entry, worn: !entry.worn };
    setPlanningWeek(true);
    setWardrobeError("");
    try {
      if (!isStaticDemo && !demoMode) {
        const response = await fetch(`/api/week/${encodeURIComponent(entry.date)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nextEntry),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo actualizar el día.");
      }
      setWeeklyPlan((entries) => {
        const next = entries.map((item) => item.date === entry.date ? nextEntry : item);
        persistDemoWeek(next);
        return next;
      });
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo actualizar el día.");
    } finally {
      setPlanningWeek(false);
    }
  }

  async function autoPlanCurrentWeek() {
    if (!savedLooks.length || planningWeek) {
      if (!savedLooks.length) {
        setWardrobeError("Guarda al menos un look antes de planear la semana.");
        setWardrobePanel("looks");
      }
      return;
    }
    const occasions: WeeklyOccasion[] = ["work", "work", "daily", "work", "dinner", "weekend", "weekend"];
    const nextWeek = weekDays.map((day, index) => ({
      date: day.key,
      outfitId: savedLooks[index % savedLooks.length].id,
      occasion: occasions[index],
      worn: false,
    }));
    setPlanningWeek(true);
    setWardrobeError("");
    try {
      if (!isStaticDemo && !demoMode) {
        const responses = await Promise.all(nextWeek.map((entry) => fetch(`/api/week/${encodeURIComponent(entry.date)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(entry),
        })));
        const failed = responses.find((response) => !response.ok);
        if (failed) throw new Error((await failed.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo completar la semana.");
      }
      setWeeklyPlan((entries) => {
        const weekKeys = new Set(weekDays.map((day) => day.key));
        const next = [...entries.filter((entry) => !weekKeys.has(entry.date)), ...nextWeek].sort((a, b) => a.date.localeCompare(b.date));
        persistDemoWeek(next);
        return next;
      });
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo completar la semana.");
    } finally {
      setPlanningWeek(false);
    }
  }

  function createLookFromWeek() {
    openStudio("looks");
    setLibraryOpen(true);
    setSavedLooksOpen(false);
  }

  async function deleteSavedLook(lookId: string) {
    setWardrobeError("");
    try {
      if (!isStaticDemo && !demoMode) {
        const response = await fetch(`/api/outfits/${encodeURIComponent(lookId)}`, { method: "DELETE" });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo eliminar el look.");
      }
      setSavedLooks((looks) => {
        const nextLooks = looks.filter((look) => look.id !== lookId);
        if (demoMode) localStorage.setItem(demoLooksStorageKey, JSON.stringify(nextLooks));
        return nextLooks;
      });
      setWeeklyPlan((entries) => {
        const next = entries.filter((entry) => entry.outfitId !== lookId);
        persistDemoWeek(next);
        return next;
      });
      if (activeOutfitId === lookId) {
        setActiveOutfitId(null);
        setActiveLookName("Nuevo look");
        setSaved(false);
      }
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo eliminar el look.");
    }
  }

  async function shareLook(look: SavedLook) {
    if (!look.items.length || sharingLookId) return;
    setSharingLookId(look.id);
    setShareNotice("");
    setWardrobeError("");
    try {
      const blob = await createInstagramStoryBlob(look, garmentById);
      const file = new File([blob], storyFileName(look.name), { type: "image/png" });
      const canUseNativeShare = typeof navigator.share === "function"
        && (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));
      if (canUseNativeShare) {
        try {
          await navigator.share({
            files: [file],
            title: `${look.name} · Formé`,
            text: "Mi look en Formé",
          });
          setShareNotice("Look listo. Elige Instagram o Stories en el menú de compartir.");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setShareNotice("Historia guardada. Ábrela desde Instagram Stories.");
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo compartir el look.");
    } finally {
      setSharingLookId(null);
    }
  }

  function currentSnapshotItems() {
    if (typeof window === "undefined" || window.innerWidth < 760) return canvasPieces.map((item) => ({ ...item }));
    const canvas = canvasRef.current;
    const frame = snapshotFrameRef.current;
    if (!canvas || !frame) return canvasPieces.map((item) => ({ ...item }));
    const frameRect = frame.getBoundingClientRect();
    if (frameRect.width < 1 || frameRect.height < 1) return canvasPieces.map((item) => ({ ...item }));
    const elements = new Map(Array.from(canvas.querySelectorAll<HTMLElement>(".canvas-piece")).flatMap((element) => element.dataset.instanceId ? [[element.dataset.instanceId, element] as const] : []));
    const savingSelection = selectedGroupIds.length > 0;
    const sourceItems = savingSelection
      ? canvasPieces.filter((item) => selectedGroupIdSet.has(item.instanceId))
      : canvasPieces.filter((item) => {
        const rect = elements.get(item.instanceId)?.getBoundingClientRect();
        return rect && rect.right >= frameRect.left && rect.left <= frameRect.right && rect.bottom >= frameRect.top && rect.top <= frameRect.bottom;
      });
    if (!sourceItems.length) return [];

    if (!savingSelection) {
      return sourceItems.map((item) => {
        const rect = elements.get(item.instanceId)?.getBoundingClientRect();
        if (!rect) return { ...item };
        return {
          ...item,
          x: ((rect.left + rect.width / 2 - frameRect.left) / frameRect.width) * 100,
          y: ((rect.top + rect.height / 2 - frameRect.top) / frameRect.height) * 100,
          scale: clamp(item.scale * (elements.get(item.instanceId)?.offsetWidth ?? frameRect.width * .76) / (frameRect.width * .76), .08, 1.35),
        };
      });
    }

    const rects = sourceItems.flatMap((item) => {
      const rect = elements.get(item.instanceId)?.getBoundingClientRect();
      return rect ? [{ item, rect }] : [];
    });
    if (!rects.length) return sourceItems.map((item) => ({ ...item }));
    const minX = Math.min(...rects.map(({ rect }) => rect.left));
    const maxX = Math.max(...rects.map(({ rect }) => rect.right));
    const minY = Math.min(...rects.map(({ rect }) => rect.top));
    const maxY = Math.max(...rects.map(({ rect }) => rect.bottom));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const fit = Math.min(1.15, frameRect.width * .88 / Math.max(1, maxX - minX), frameRect.height * .88 / Math.max(1, maxY - minY));
    return rects.map(({ item, rect }) => ({
      ...item,
      x: 50 + ((rect.left + rect.width / 2 - centerX) * fit / frameRect.width) * 100,
      y: 50 + ((rect.top + rect.height / 2 - centerY) * fit / frameRect.height) * 100,
      scale: clamp(item.scale * fit * (elements.get(item.instanceId)?.offsetWidth ?? frameRect.width * .76) / (frameRect.width * .76), .08, 1.35),
    }));
  }

  async function saveCurrentOutfit() {
    if (canvasPieces.length === 0) return;
    const itemsToSave = currentSnapshotItems();
    if (!itemsToSave.length) {
      setWardrobeError("Pon el look dentro del marco o selecciónalo arrastrando con el mouse.");
      return;
    }
    const savingSelection = selectedGroupIds.length > 0 && typeof window !== "undefined" && window.innerWidth >= 760;
    const outfitId = savingSelection ? `look-${crypto.randomUUID()}` : activeOutfitId ?? `look-${crypto.randomUUID()}`;
    const fallbackName = `Look ${String(savedLooks.length + 1).padStart(2, "0")}`;
    const lookName = savingSelection || activeLookName === "Nuevo look" || activeLookName === "Conjunto actual" ? fallbackName : activeLookName;
    setSavingOutfit(true);
    setWardrobeError("");
    try {
      if (!isStaticDemo && !demoMode) {
        const response = await fetch(`/api/outfits/${encodeURIComponent(outfitId)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: lookName, items: itemsToSave }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo guardar el conjunto.");
      }
      const nextLook: SavedLook = { id: outfitId, name: lookName, items: itemsToSave.map((item) => ({ ...item })) };
      setSavedLooks((looks) => {
        const nextLooks = [nextLook, ...looks.filter((look) => look.id !== outfitId)];
        if (demoMode) localStorage.setItem(demoLooksStorageKey, JSON.stringify(nextLooks));
        return nextLooks;
      });
      if (savingSelection) {
        setSelectedGroupIds([]);
        setSaved(false);
        setShareNotice(`${lookName} guardado. Selecciona otra prueba para continuar.`);
      } else {
        setActiveOutfitId(outfitId);
        setActiveLookName(lookName);
        setSaved(true);
      }
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo guardar el conjunto.");
    } finally {
      setSavingOutfit(false);
    }
  }

  async function duplicateCurrentOutfit() {
    if (canvasPieces.length === 0 || savingOutfit) return;
    const outfitId = `look-${crypto.randomUUID()}`;
    const lookName = `Look ${String(savedLooks.length + 1).padStart(2, "0")}`;
    const duplicatedPieces = canvasPieces.map((item) => ({ ...item, instanceId: crypto.randomUUID() }));
    setSavingOutfit(true);
    setWardrobeError("");
    try {
      if (!isStaticDemo && !demoMode) {
        const response = await fetch(`/api/outfits/${encodeURIComponent(outfitId)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: lookName, items: duplicatedPieces }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo duplicar el look.");
      }
      const nextLook: SavedLook = { id: outfitId, name: lookName, items: duplicatedPieces };
      setSavedLooks((looks) => {
        const nextLooks = [nextLook, ...looks];
        if (demoMode) localStorage.setItem(demoLooksStorageKey, JSON.stringify(nextLooks));
        return nextLooks;
      });
      setCanvasPieces(duplicatedPieces);
      setSelectedId("");
      setSelectedGroupIds([]);
      setActiveOutfitId(outfitId);
      setActiveLookName(lookName);
      setLookIterations([]);
      setActiveIterationIndex(-1);
      setSaved(true);
      setLibraryOpen(false);
      setSavedLooksOpen(true);
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo duplicar el look.");
    } finally {
      setSavingOutfit(false);
    }
  }

  async function retryProcessing(item: Garment, quality: "low" | "medium" = "low", outputVariant: "closed" | "open" = "closed") {
    setGarmentSaveError("");
    setGarments((items) => items.map((garment) => garment.id === item.id ? { ...garment, status: "queued" } : garment));
    try {
      const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}/retry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quality, outputVariant, presentation: outputVariant === "open" ? "open" : "closed" }),
      });
      const result = await response.json().catch(() => null) as { job?: { status?: string }; error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "No se pudo volver a preparar la imagen.");
      if (result?.job?.status === "waiting_for_key") throw new Error("El procesamiento no está disponible en este momento.");
      setGarmentDraft(null);
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusResponse = await fetch(`/api/garments/${encodeURIComponent(item.id)}/status`, { cache: "no-store" });
        const statusResult = await statusResponse.json().catch(() => null) as { garment?: ApiGarment; job?: { error?: string; status?: string } } | null;
        if (!statusResponse.ok || !statusResult?.garment) throw new Error("No se pudo revisar la imagen.");
        let updatedGarment = statusResult.garment;
        if (updatedGarment.status === "cutout_pending") updatedGarment = await finalizePendingCutouts(updatedGarment);
        setGarments((items) => mergeApiGarments(items, [updatedGarment as ApiGarment]));
        if (updatedGarment.status === "ready") return;
        if (updatedGarment.status === "failed") throw new Error(statusResult.job?.error || "La imagen no pudo prepararse.");
      }
    } catch (error) {
      setGarments((items) => items.map((garment) => garment.id === item.id ? { ...garment, status: "failed" } : garment));
      setWardrobeError(error instanceof Error ? error.message : "No se pudo volver a preparar la imagen.");
    }
  }

  if (isStaticDemo) {
    return <main className="static-redirect" aria-live="polite">
      <p>ABRIENDO FORMÉ</p>
      <h1>Tu armario continúa en la app operativa.</h1>
      <a href={operationalSiteUrl}>CONTINUAR →</a>
    </main>;
  }

  return (
    <main className={`site-shell view-${view}`}>
      {!demoMode && styleOnboardingOpen && <StyleOnboarding
        profile={styleProfile}
        saving={savingStyleProfile}
        dismissible={Boolean(styleProfile?.completed)}
        onClose={() => { setStyleOnboardingOpen(false); if (styleProfile?.completed) setProfileOpen(true); }}
        onSave={saveStyleCalibration}
      />}
      {!demoMode && profileOpen && <div className="profile-drawer-backdrop" role="presentation" onPointerDown={() => setProfileOpen(false)}>
        <aside className="profile-drawer" role="dialog" aria-modal="true" aria-label="Mi perfil" onPointerDown={(event) => event.stopPropagation()}>
          <header><span>MI PERFIL</span><button type="button" onClick={() => setProfileOpen(false)} aria-label="Cerrar perfil">×</button></header>
          <div className="profile-drawer-identity">
            <span className="profile-drawer-avatar"><img className={profileImageClass} src={profileImage} alt={`Foto de perfil de ${profile.name}`} /></span>
            <div><h2>{profile.name}</h2><small>{profile.handle}</small></div>
          </div>
          <div className="profile-drawer-stats">
            <p><strong>{personalGarments.length}</strong><span>Prendas</span></p>
            <p><strong>{savedLooks.length}</strong><span>Looks guardados</span></p>
            <p><strong>{weeklyPlan.length}</strong><span>Días planeados</span></p>
          </div>
          <section className="profile-style-summary">
            <p>TU ESTILO</p>
            <h3>{profileTopStyles.length ? profileTopStyles.map((family) => family.label).join(" · ") : "Todavía estamos conociéndote."}</h3>
            <span>{profileTopStyles.length
              ? "Estas son las direcciones que más aparecen en tus recomendaciones."
              : "Elige lo que te representa para recibir recomendaciones más tuyas."}</span>
            {profileTopStyles.length > 0 && <div className="profile-style-tags">{profileTopStyles.map((family) => <span key={family.id}>{family.label} <b>{family.rating?.affinity}%</b></span>)}</div>}
            <div className="profile-exploration">
              <div><span>CUÁNTO QUIERES EXPERIMENTAR</span><strong>{styleProfile?.exploration ?? 35}%</strong></div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={styleProfile?.exploration ?? 35}
                onChange={(event) => setStyleProfile((current) => current ? { ...current, exploration: Number(event.target.value) } : current)}
                onPointerUp={(event) => void saveExplorationPreference(Number(event.currentTarget.value))}
                onKeyUp={(event) => void saveExplorationPreference(Number(event.currentTarget.value))}
                onBlur={(event) => void saveExplorationPreference(Number(event.currentTarget.value))}
                aria-label="Cuánto quiero experimentar"
              />
              <div className="profile-exploration-labels"><small>FAMILIAR</small><small>EXPERIMENTAL</small></div>
              <small>Controla cuánto se alejan las sugerencias de lo que ya usas.</small>
            </div>
            <button className="profile-recalibrate" type="button" onClick={() => { setProfileOpen(false); setStyleOnboardingOpen(true); }}><span>{styleProfile?.completed ? "REVISAR MI CALIBRACIÓN" : "CONFIGURAR MI ESTILO"}</span><b>→</b></button>
          </section>
          {profileDraft && <section className="profile-social-settings">
            <div className="profile-section-heading">
              <p>PERFIL PÚBLICO</p>
              <h3>Comparte solo lo que quieras.</h3>
              <span>Tu closet sigue siendo privado hasta que tú elijas qué mostrar.</span>
            </div>
            <div className="profile-public-fields">
              <label>NOMBRE PÚBLICO<input value={profileDraft.name} maxLength={60} onChange={(event) => updateProfileDraft("name", event.target.value)} /></label>
              <label>USUARIO<div className="profile-handle-input"><span>@</span><input value={profileDraft.handle.replace(/^@/, "")} maxLength={30} autoCapitalize="none" spellCheck={false} onChange={(event) => updateProfileDraft("handle", `@${event.target.value.replace(/^@/, "")}`)} /></div></label>
              <label className="profile-bio-field">BIO<textarea value={profileDraft.bio} maxLength={160} rows={3} placeholder="Una línea sobre tu estilo, tu closet o lo que estás buscando." onChange={(event) => updateProfileDraft("bio", event.target.value)} /></label>
            </div>
            <div className="profile-privacy-list">
              <label><span><strong>PERFIL PÚBLICO</strong><small>Crea una página compartible en Formé.</small></span><input type="checkbox" checked={profileDraft.profilePublic} onChange={(event) => setProfileDraft((current) => current ? {
                ...current,
                profilePublic: event.target.checked,
                ...(!event.target.checked ? { discoverable: false, showCloset: false, showLooks: false } : {}),
              } : current)} /></label>
              <label className={!profileDraft.profilePublic ? "disabled" : ""}><span><strong>MOSTRAR PRENDAS PUBLICADAS</strong><small>{personalGarments.filter((item) => item.isPublic).length} seleccionadas en tu closet.</small></span><input type="checkbox" disabled={!profileDraft.profilePublic} checked={profileDraft.showCloset} onChange={(event) => updateProfileDraft("showCloset", event.target.checked)} /></label>
              <label className={!profileDraft.profilePublic ? "disabled" : ""}><span><strong>MOSTRAR LOOKS PUBLICADOS</strong><small>{savedLooks.filter((look) => look.isPublic).length} seleccionados en Looks guardados.</small></span><input type="checkbox" disabled={!profileDraft.profilePublic} checked={profileDraft.showLooks} onChange={(event) => updateProfileDraft("showLooks", event.target.checked)} /></label>
              <label className={!profileDraft.profilePublic ? "disabled" : ""}><span><strong>APARECER EN BÚSQUEDAS</strong><small>Permite que otras personas te encuentren dentro de Formé.</small></span><input type="checkbox" disabled={!profileDraft.profilePublic} checked={profileDraft.discoverable} onChange={(event) => updateProfileDraft("discoverable", event.target.checked)} /></label>
            </div>
            <div className="profile-public-url"><span>forme.gallery/{profileDraft.handle || "@tuusuario"}</span><small>Marca prendas y looks como públicos desde sus fichas.</small></div>
            {profileSaveError && <p className="profile-save-error" role="alert">{profileSaveError}</p>}
            <div className="profile-social-actions">
              <button type="button" disabled={!profile.profilePublic} onClick={() => window.open(`/${profile.handle}`, "_blank", "noopener,noreferrer")}>VER PERFIL</button>
              <button type="button" disabled={!profile.profilePublic} onClick={() => void sharePublicProfile()}>COMPARTIR</button>
              <button className={profileSaved ? "saved" : ""} type="button" disabled={savingProfile} onClick={() => void saveAccountSettings()}>{savingProfile ? "GUARDANDO…" : profileSaved ? "GUARDADO ✓" : "GUARDAR PERFIL"}</button>
            </div>
          </section>}
        </aside>
      </div>}
      {!demoMode && pricingOpen && <div className="profile-drawer-backdrop" role="presentation" onPointerDown={() => setPricingOpen(false)}>
        <aside className="pricing-drawer" role="dialog" aria-modal="true" aria-label="Planes de Formé" onPointerDown={(event) => event.stopPropagation()}>
          <header><span>PLANES</span><button type="button" onClick={() => setPricingOpen(false)} aria-label="Cerrar planes">×</button></header>
          <div className="pricing-intro">
            <p>FORMÉ BETA</p>
            <h2>Un plan para cada closet.</h2>
            <span>Empieza gratis. Sube más prendas cuando Formé ya sea parte de tu rutina.</span>
          </div>
          <div className="pricing-cycle" aria-label="Frecuencia de pago">
            <button type="button" className={billingCycle === "monthly" ? "active" : ""} onClick={() => setBillingCycle("monthly")}>MENSUAL</button>
            <button type="button" className={billingCycle === "annual" ? "active" : ""} onClick={() => setBillingCycle("annual")}>ANUAL <b>−10%</b></button>
          </div>
          <div className="pricing-plan-list">
            {pricingPlans.map((plan) => {
              const annualTotal = plan.monthlyPrice * 12 * (1 - annualDiscount);
              const displayedMonthlyPrice = billingCycle === "annual" ? annualTotal / 12 : plan.monthlyPrice;
              return <article className={plan.recommended ? "recommended" : ""} key={plan.id}>
                <div className="pricing-plan-heading">
                  <div><p>{plan.recommended ? "RECOMENDADO" : plan.id === "free" ? "EMPIEZA AQUÍ" : "MÁS CAPACIDAD"}</p><h3>{plan.name}</h3></div>
                  <div className="pricing-plan-price"><strong>${displayedMonthlyPrice.toFixed(plan.monthlyPrice === 0 ? 0 : 2)}</strong><span>/ mes</span></div>
                </div>
                <p className="pricing-plan-description">{plan.description}</p>
                <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                {billingCycle === "annual" && plan.monthlyPrice > 0 && <small>US${annualTotal.toFixed(2)} al año</small>}
                <button type="button" disabled>{plan.id === "free" ? "INCLUIDO EN BETA" : "PRÓXIMAMENTE"}</button>
              </article>;
            })}
          </div>
          <p className="pricing-beta-note">Durante la beta no se harán cobros. Estos son los planes recomendados antes de activar pagos.</p>
        </aside>
      </div>}
      <header className="topbar">
        <div className="topbar-inner">
          <button className="wordmark" onClick={() => openWardrobe()} aria-label="Volver al armario">FORMÉ<span>®</span></button>
          <nav className="zone-nav" aria-label="Secciones principales">
            <button className={view === "wardrobe" ? "active" : ""} onClick={() => openWardrobe()}>Armario</button>
            <button className={view === "studio" ? "active" : ""} onClick={() => openStudio(wardrobePanel)}>Canvas</button>
          </nav>
          {demoMode
            ? <button className="google-login" onClick={beginGoogleSignIn} disabled={sessionStatus === "checking"}><span>G</span>{sessionStatus === "checking" ? "ENTRANDO…" : "ENTRAR CON GOOGLE"}</button>
            : <div className="topbar-account">
              <button className="pricing-entry" type="button" onClick={() => { setProfileOpen(false); setPricingOpen(true); }}>PLANES</button>
              <button className="avatar" onClick={() => { setPricingOpen(false); setProfileOpen(true); }} aria-label="Abrir mi perfil"><img className={profileImageClass} src={profileImage} alt="" /></button>
            </div>}
        </div>
      </header>

      {view === "wardrobe" && (
        <section className="content wardrobe-view">
          <section className="wardrobe-profile">
            <nav className="wardrobe-tabs" aria-label="Mi closet">
              <button className={wardrobePanel === "closet" ? "active" : ""} onClick={() => { setWardrobePanel("closet"); setClosetMode("browse"); }}>Mi closet</button>
              <button className={wardrobePanel === "looks" ? "active" : ""} onClick={() => setWardrobePanel("looks")}>Looks guardados</button>
              <button className={wardrobePanel === "assistant" ? "active" : ""} onClick={() => setWardrobePanel("assistant")}>Asistente</button>
            </nav>
            {wardrobePanel === "closet" && closetMode === "browse" && <div className="wardrobe-tab-actions">
              <button className={filtersOpen || archiveFilterCount > 0 ? "active" : ""} onClick={() => setFiltersOpen((open) => !open)}>Filtros{archiveFilterCount > 0 ? ` · ${archiveFilterCount}` : ""}</button>
              <button className="closet-add" onClick={demoMode ? beginGoogleSignIn : () => setClosetMode("upload")}>＋ Agregar</button>
            </div>}
          </section>
          {wardrobeError && <div className="app-message error" role="status">{wardrobeError}<button onClick={() => setWardrobeError("")} aria-label="Cerrar mensaje">×</button></div>}

          {wardrobePanel === "closet" && closetMode === "browse" ? (
            <section className="pieces-section">
              <div className={`wardrobe-catalog ${filtersOpen ? "filters-open" : ""}`}>
                <aside className={`filter-sidebar ${filtersOpen ? "open" : ""}`}>
                  <div className="filter-sidebar-header"><strong>Filtros</strong><button onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">×</button></div>
                  <AttributeFilters value={archiveFilters} options={filterOptions} onChange={updateArchiveFilter} onReset={() => setArchiveFilters(emptyFilters)} />
                </aside>
                <div className="catalog-results">
                  <section className="closet-group personal-group">
                    {personalGarments.length > 0
                      ? <ClosetGarmentGrid garments={visiblePersonalGarments} emptyLabel="NO HAY PRENDAS CON ESTOS FILTROS" onOpen={openGarmentEditor} onAdd={(item) => addAndOpenStudio(item.id)} onFavorite={toggleFavorite} onResetFilters={() => setArchiveFilters(emptyFilters)} />
                      : <div className="closet-empty-personal"><p>{demoMode ? "Entra para empezar tu propio closet." : "Tu closet todavía está vacío."}</p><button type="button" onClick={demoMode ? beginGoogleSignIn : () => setClosetMode("upload")}>{demoMode ? "ENTRAR CON GOOGLE →" : "AGREGAR PRIMERA PRENDA →"}</button></div>}
                  </section>
                  <section className="closet-group forme-group">
                    <div className="closet-group-heading"><div><h3>Básicos Formé</h3></div><span>{sharedBasics.length}</span></div>
                    <ClosetGarmentGrid garments={visibleFormeBasics} emptyLabel="NO HAY BÁSICOS CON ESTOS FILTROS" onOpen={(item) => addAndOpenStudio(item.id)} onAdd={(item) => addAndOpenStudio(item.id)} onFavorite={toggleFavorite} onResetFilters={() => setArchiveFilters(emptyFilters)} />
                  </section>
                </div>
              </div>
            </section>
          ) : wardrobePanel === "looks" ? (
            <section className="looks-view">
              <div className="saved-looks-heading">
                <div><h2>Looks guardados</h2></div>
                <span>{savedLooks.length} {savedLooks.length === 1 ? "LOOK" : "LOOKS"}</span>
              </div>
              {shareNotice && <div className="share-status-message" role="status">{shareNotice}<button type="button" onClick={() => setShareNotice("")} aria-label="Cerrar mensaje">×</button></div>}
              <div className="saved-looks-grid">
                {savedLooks.map((look) => (
                  <article className="saved-look-card" key={look.id}>
                    <button className="saved-look-open" type="button" onClick={() => openSavedLook(look)} aria-label={`Abrir ${look.name} en el canvas`}>
                      <LookPreview look={look} garmentById={garmentById} />
                      <span>ABRIR EN CANVAS ↗</span>
                    </button>
                    <div className="saved-look-meta">
                      <div><strong>{look.name}</strong><small>{look.items.length} PIEZAS</small></div>
                      <div className="saved-look-actions">
                        <button className={look.isPublic ? "visibility-toggle public" : "visibility-toggle"} type="button" onClick={() => void toggleOutfitVisibility(look)} aria-label={`${look.isPublic ? "Ocultar" : "Mostrar"} ${look.name} en mi perfil`}>{look.isPublic ? "PÚBLICO" : "PRIVADO"}</button>
                        <button className="share-look" type="button" disabled={Boolean(sharingLookId)} onClick={() => void shareLook(look)} aria-label={`Compartir ${look.name} en Instagram`}>{sharingLookId === look.id ? "PREPARANDO…" : "COMPARTIR ↗"}</button>
                        <button type="button" onClick={() => deleteSavedLook(look.id)} aria-label={`Eliminar ${look.name}`}>ELIMINAR</button>
                      </div>
                    </div>
                  </article>
                ))}
                {savedLooks.length === 0 && <div className="looks-empty"><p>Todavía no guardaste ningún look.</p><button type="button" onClick={() => openStudio("looks")}>CREAR UN LOOK →</button></div>}
              </div>
              <WeeklyPlanView
                weekDays={weekDays}
                entries={weeklyPlan}
                selectedDate={selectedPlanDate}
                savedLooks={savedLooks}
                garmentById={garmentById}
                busy={planningWeek}
                onSelectDate={setSelectedPlanDate}
                onAssign={(date, lookId, occasion) => void assignLookToDate(date, lookId, occasion)}
                onRemove={(date) => void removeLookFromDate(date)}
                onToggleWorn={(entry) => void togglePlannedLookWorn(entry)}
                onOpenLook={openSavedLook}
                onAutoPlan={() => void autoPlanCurrentWeek()}
                onCreateLook={createLookFromWeek}
              />
            </section>
          ) : wardrobePanel === "assistant" ? (
            <section className="assistant-view">
              <section className="assistant-dialogue">
                <div className="assistant-dialogue-copy">
                  <h2>¿Qué necesitas hoy?</h2>
                  <span>Elige una pregunta. Formé usa tu estilo y las prendas que ya tienes.</span>
                </div>
                {assistantDataGaps.length > 0 && <div className="assistant-data-readiness">
                    <div className="assistant-data-gap"><p>PUEDO SER MÁS PRECISO</p><span>{assistantDataGaps[0]}</span><div>
                      {demoMode && <button type="button" onClick={beginGoogleSignIn}>INICIAR SESIÓN →</button>}
                      {!demoMode && !assistantProfileReady && <button type="button" onClick={() => setStyleOnboardingOpen(true)}>CONFIGURAR MI ESTILO →</button>}
                      {!demoMode && assistantProfileReady && !assistantClosetReady && <button type="button" onClick={() => { setWardrobePanel("closet"); setClosetMode("upload"); }}>AGREGAR PRENDAS →</button>}
                    </div></div>
                </div>}

                <div className="assistant-question-flow">
                  <div className="assistant-preset-list">
                    <p>¿QUÉ NECESITAS?</p>
                    {assistantPresets.map((preset) => <button type="button" className={assistantPresetId === preset.id ? "active" : ""} onClick={() => { setAssistantPresetId(preset.id); setAssistantFollowupId(""); setAssistantAnswer(null); setStylingRecommendations([]); }} key={preset.id}>
                      <span><strong>{preset.label}</strong><small>{preset.detail}</small></span><b>→</b>
                    </button>)}
                  </div>

                  {selectedAssistantPreset && <div className="assistant-followup-list">
                    <p>{selectedAssistantPreset.followup.toLocaleUpperCase()}</p>
                    <div>{selectedAssistantPreset.options.map((option) => <button type="button" className={assistantFollowupId === option.id ? "active" : ""} onClick={() => answerAssistantFollowup(selectedAssistantPreset, option)} key={option.id}>
                      <strong>{option.label}</strong><small>{option.detail}</small>
                    </button>)}</div>
                  </div>}
                </div>
              </section>

              {assistantAnswer && <section className="assistant-response" aria-live="polite">
                <div className="assistant-response-copy"><p>{assistantAnswer.eyebrow}</p><h2>{assistantAnswer.title}</h2><span>{assistantAnswer.summary}</span><small>{assistantAnswer.question} · {assistantAnswer.followup}</small></div>
                <div className="assistant-response-signals">{assistantAnswer.signals.map((signal, index) => <article key={signal}><span>0{index + 1}</span><p>{signal}</p></article>)}</div>
                {assistantAnswer.intent === "missing" && <div className="assistant-response-actions">
                  {!assistantProfileReady && !demoMode && <button type="button" onClick={() => setStyleOnboardingOpen(true)}>CALIBRAR PARA AFINAR →</button>}
                  <button type="button" onClick={() => { setWardrobePanel("closet"); setClosetMode("browse"); }}>REVISAR MI CLOSET →</button>
                </div>}
              </section>}

              {stylingRecommendations.length > 0 && <section className="styling-results" aria-live="polite">
                <div className="styling-results-heading">
                  <div><p>PARA TI</p><h2>Elige los que sí usarías</h2></div>
                  <div className="styling-results-meta"><span>{styleOccasionLabels[styleOccasion]} · {styleCodeLabels[styleCode]} · {styleMomentLabels[styleMoment]}</span><button type="button" onClick={repeatAssistantAnswer}>MOSTRAR OTROS ↻</button></div>
                </div>
                <div className="styling-recommendation-grid">
                  {stylingRecommendations.map((recommendation, index) => {
                    const alreadySaved = savedLooks.some((look) => savedLookCoreSignature(look, garmentById) === recommendation.signature);
                    return <article className="styling-recommendation" key={recommendation.id}>
                      <LookPreview look={{ id: recommendation.id, name: recommendation.name, items: recommendation.items }} garmentById={garmentById} />
                      <div className="styling-recommendation-copy">
                        <span>0{index + 1} / {recommendation.title.toLocaleUpperCase()}</span>
                        <h3>{recommendation.name}</h3>
                        <p>{recommendation.reason}</p>
                        <button type="button" disabled={alreadySaved || savingOutfit} onClick={() => void saveStylingRecommendation(recommendation)}>{alreadySaved ? "GUARDADO ✓" : "GUARDAR COMO LOOK"} <b>{alreadySaved ? "" : "＋"}</b></button>
                      </div>
                    </article>;
                  })}
                </div>
              </section>}

              <WardrobeInsightsView
                garments={insightGarments}
                savedLooks={savedLooks}
                entries={weeklyPlan}
                weekDays={weekDays}
                onOpenGarment={(garment) => garment.collection === "forme" ? addAndOpenStudio(garment.id) : openGarmentEditor(garment)}
                onGoToLooks={() => setWardrobePanel("looks")}
                onGoToPieces={() => { setWardrobePanel("closet"); setClosetMode("browse"); }}
              />
            </section>
          ) : (
            <section className="upload-view">
              <div className="upload-heading"><div><h2>Añadir al closet</h2></div><button type="button" onClick={() => setClosetMode("browse")}>← VOLVER A PRENDAS</button></div>
              <div className="upload-layout">
                <label
                  className={`dropzone bulk-dropzone ${uploadItems.length ? "has-files" : ""} ${draggingUpload ? "dragging" : ""}`}
                  onDragEnter={(event: DragEvent) => { event.preventDefault(); setDraggingUpload(true); }}
                  onDragOver={(event: DragEvent) => event.preventDefault()}
                  onDragLeave={() => setDraggingUpload(false)}
                  onDrop={(event) => { event.preventDefault(); setDraggingUpload(false); acceptFiles(event.dataTransfer.files); }}
                >
                  <input ref={fileInput} type="file" accept="image/*" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => acceptFiles(event.target.files ?? undefined)} hidden />
                  {uploadItems.length > 0
                    ? <div className="upload-preview-grid">{uploadItems.map((item) => <img src={item.preview} alt="" key={item.id} />)}</div>
                    : <div className="dropzone-empty"><span className="upload-icon" aria-hidden="true">↑</span><h3>Arrastra tus fotos aquí</h3><p>o toca para seleccionar</p><small>HASTA {maxBatchFiles} PRENDAS · 20 MB C/U</small></div>}
                  {uploadItems.length > 0 && !uploadingBatch && <span className="replace-photo">AÑADIR MÁS · {uploadItems.length}/{maxBatchFiles}</span>}
                </label>
                <div className="intake-panel bulk-intake">
                  <div className="batch-heading"><span>TUS FOTOS</span><strong>{uploadItems.length ? `${uploadItems.length} ${uploadItems.length === 1 ? "PRENDA" : "PRENDAS"}` : "SIN PRENDAS"}</strong></div>
                  {uploadItems.length > 0
                    ? <div className="upload-queue">{uploadItems.map((item, index) => {
                      const editable = !uploadingBatch && (item.status === "ready" || item.status === "failed");
                      return <article className={`upload-item status-${item.status}`} key={item.id}>
                        <img className="upload-item-thumb" src={item.preview} alt="" />
                        <div className="upload-item-fields">
                          <label>NOMBRE<input disabled={!editable} value={item.name} onChange={(event) => updateUploadItem(item.id, { name: event.target.value })} placeholder={`Prenda ${index + 1}`} /></label>
                          <label>TIPO<select disabled={!editable} value={item.category} onChange={(event) => updateUploadItem(item.id, { category: event.target.value as Garment["category"] })}><option value="Outerwear">Abrigos</option><option value="Tops">Prendas superiores</option><option value="Bottoms">Pantalones</option><option value="Tailoring">Sastrería</option><option value="Footwear">Calzado</option><option value="Accessories">Accesorios</option></select></label>
                          <span className="upload-item-state">{uploadStatusLabels[item.status]}{item.error ? ` · ${item.error}` : ""}</span>
                        </div>
                        {editable && <button className="remove-upload-item" type="button" onClick={() => removeUploadItem(item.id)} aria-label={`Quitar ${item.name || `prenda ${index + 1}`}`}>×</button>}
                      </article>;
                    })}</div>
                    : <div className="queue-empty"><p>Selecciona varias fotos. Podrás corregir el nombre y el tipo antes de procesarlas.</p></div>}
                  {uploadError && <p className={`upload-status ${uploadItems.some((item) => item.status === "failed") ? "error" : ""}`}>{uploadError}</p>}
                  {uploadItems.length > 0 && uploadRetryableCount === 0 && !uploadingBatch
                    ? <button className="primary-action ready" onClick={() => { resetUpload(); setClosetMode("browse"); }}>VER EN MI CLOSET <span>→</span></button>
                    : <button className="primary-action" disabled={uploadRetryableCount === 0 || uploadingBatch} onClick={ghostGarments}>{uploadingBatch ? `PREPARANDO ${uploadFinishedCount} DE ${uploadItems.length}` : uploadItems.some((item) => item.status === "failed") ? `REINTENTAR ${uploadRetryableCount}` : `PROCESAR ${uploadRetryableCount} ${uploadRetryableCount === 1 ? "PRENDA" : "PRENDAS"}`}<span>→</span></button>}
                </div>
              </div>
            </section>
          )}
        </section>
      )}

      {view === "studio" && (
        <section className="content studio-view">
          <div className="studio-layout">
            <div className="canvas-column">
              <div className={`look-canvas ${libraryOpen ? "library-open" : ""} ${savedLooksOpen ? "saved-looks-open" : ""}`}>
                <div
                  className="look-artboard"
                  ref={canvasRef}
                  onPointerDown={startMarqueeSelection}
                  onPointerMove={moveMarqueeSelection}
                  onPointerUp={stopMarqueeSelection}
                  onPointerCancel={stopMarqueeSelection}
                >
                  <div className={`snapshot-frame ${selectedGroupIds.length ? "selection-active" : ""}`} ref={snapshotFrameRef} aria-hidden="true">
                    <span>{selectedGroupIds.length ? `${selectedGroupIds.length} ${selectedGroupIds.length === 1 ? "PIEZA SELECCIONADA" : "PIEZAS SELECCIONADAS"}` : "ESTO SE GUARDARÁ"}</span>
                  </div>
                  <p className="look-date">{activeLookName.toLocaleUpperCase()}</p>
                  <span className="canvas-hint desktop-hint">ARRASTRA SOBRE EL FONDO PARA SELECCIONAR VARIAS PRENDAS</span>
                  <span className="canvas-hint mobile-hint">TOCA UNA PRENDA PARA EDITARLA</span>
                  {canvasPieces.length === 0 && <button className="empty-canvas" onClick={() => setLibraryOpen(true)}>TU CANVAS ESTÁ VACÍO<br /><span>ABRIR ARMARIO ＋</span></button>}
                  {marqueeRect && <span className="canvas-marquee" aria-hidden="true" style={{ left: marqueeRect.left, top: marqueeRect.top, width: marqueeRect.width, height: marqueeRect.height }} />}
                  {canvasPieces.map((piece) => {
                    const garment = garmentById.get(piece.garmentId);
                    if (!garment) return null;
                    const pieceImage = piece.variant === "open" && garment.openImage ? garment.openImage : garment.image;
                    const canvasImage = cleanCanvasImage(pieceImage);
                    const expandedHitbox = garment.category === "Accessories" && (piece.scale <= 0.2 || garment.id.includes("sunglasses"));
                    const safeScale = Math.max(piece.scale, 0.08);
                    const pieceStyle = {
                      left: `${piece.x}%`,
                      top: `${piece.y}%`,
                      zIndex: piece.z,
                      transform: `translate(-50%, -50%) rotate(${piece.rotation}deg) scale(${piece.scale})`,
                      "--piece-outline-width": `${1.5 / safeScale}px`,
                      "--piece-handle-size": `${44 / safeScale}px`,
                      "--piece-handle-icon": `${18 / safeScale}px`,
                      "--piece-handle-half": `${-22 / safeScale}px`,
                      ...(expandedHitbox ? { "--piece-hitbox-inset": `-${24 / Math.max(piece.scale, 0.08)}px` } : {}),
                    } as CSSProperties;
                    return (
                      <div
                        className={`canvas-piece ${expandedHitbox ? "expanded-hitbox" : ""} ${selectedId === piece.instanceId ? "selected" : ""} ${selectedGroupIdSet.has(piece.instanceId) ? "group-selected" : ""}`}
                        key={piece.instanceId}
                        data-instance-id={piece.instanceId}
                        onPointerDown={(event) => startMoving(event, piece.instanceId)}
                        onPointerMove={movePiece}
                        onPointerUp={stopMoving}
                        onPointerCancel={(event) => stopMoving(event, true)}
                        style={pieceStyle}
                      >
                        <img src={imageSrc(canvasImage)} alt={translateGarmentName(garment.name)} draggable={false} />
                        {selectedId === piece.instanceId && <>
                          <span className="canvas-selection-box" aria-hidden="true" />
                          <button
                            type="button"
                            className="transform-handle duplicate-handle"
                            aria-label={`Duplicar ${translateGarmentName(garment.name)}`}
                            title="Duplicar"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => { event.stopPropagation(); duplicatePiece(piece.instanceId); }}
                          ><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1" /><path d="M16 8V5H5v11h3" /></svg></button>
                          <button
                            type="button"
                            className="transform-handle delete-handle"
                            aria-label={`Borrar ${translateGarmentName(garment.name)}`}
                            title="Borrar"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => { event.stopPropagation(); removePiece(piece.instanceId); }}
                          ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 14h8l1-14" /></svg></button>
                          <button
                            type="button"
                            className="transform-handle rotate-handle"
                            aria-label={`Rotar ${translateGarmentName(garment.name)}`}
                            onPointerDown={(event) => startTransformHandle(event, piece.instanceId, "rotate")}
                            onPointerMove={moveTransformHandle}
                            onPointerUp={stopTransformHandle}
                            onPointerCancel={stopTransformHandle}
                          ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V3M5 3h5M5.5 3.5A9 9 0 1 1 3 13" /><path d="m3 13-2-2m2 2 2-2" /></svg></button>
                          <button
                            type="button"
                            className="transform-handle scale-handle"
                            aria-label={`Escalar ${translateGarmentName(garment.name)}`}
                            onPointerDown={(event) => startTransformHandle(event, piece.instanceId, "scale")}
                            onPointerMove={moveTransformHandle}
                            onPointerUp={stopTransformHandle}
                            onPointerCancel={stopTransformHandle}
                          ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M10 7h7v7M14 17H7v-7" /></svg></button>
                        </>}
                      </div>
                    );
                  })}
                </div>
                {activeLookIteration && (
                  <section className="mix-canvas-navigator" aria-label="Navegar cinco variaciones del look" aria-live="polite">
                    <button type="button" className="mix-step previous" onClick={() => stepLookIteration(-1)} aria-label="Ver mezcla anterior">←</button>
                    <div className="mix-current-look">
                      <div className="mix-current-heading"><span>MEZCLA {String(activeIterationIndex + 1).padStart(2, "0")} / {String(lookIterations.length).padStart(2, "0")}</span><button type="button" onClick={closeLookIterations} aria-label="Cerrar mezclas">×</button></div>
                      <strong>{activeLookIteration.title}</strong>
                      <small>{activeLookIteration.detail}</small>
                      <div className="mix-progress" aria-hidden="true">{lookIterations.map((iteration, index) => <i className={index === activeIterationIndex ? "active" : ""} key={iteration.id} />)}</div>
                    </div>
                    <button type="button" className="mix-step next" onClick={() => stepLookIteration(1)} aria-label="Ver siguiente mezcla">→</button>
                  </section>
                )}
              </div>
            </div>

            <button className={`floating-panel-toggle library-panel-toggle ${libraryOpen ? "active" : ""} ${savedLooksOpen ? "concealed" : ""}`} onClick={() => setLibraryOpen((open) => { const next = !open; if (next) setSavedLooksOpen(false); return next; })} aria-expanded={libraryOpen} aria-label="Abrir panel de prendas">
              <span>PRENDAS</span><b>{libraryOpen ? "×" : "＋"}</b>
            </button>

            <aside className={`look-controls garment-library-panel ${libraryOpen ? "panel-open" : "panel-closed"}`} aria-label="Prendas y categorías">
              <div className="floating-panel-header"><span>{demoMode ? "BÁSICOS FORMÉ" : "ARMARIO"} / {String(studioGarments.length).padStart(2, "0")}</span><button onClick={() => setLibraryOpen(false)} aria-label="Cerrar armario">×</button></div>
              <div className="studio-library-filters" aria-label="Filtrar biblioteca del canvas">
                {([
                  ["all", "Todo"],
                  ["outerwear", "Abrigos"],
                  ["tops", "Tops"],
                  ["bottoms", "Pantalones"],
                  ["footwear", "Calzado"],
                  ["accessories", "Accesorios"],
                ] as [StudioLibraryFilter, string][]).map(([value, label]) => <button type="button" className={studioLibraryFilter === value ? "active" : ""} onClick={() => setStudioLibraryFilter(value)} key={value}>{label}</button>)}
              </div>
              {selectedPiece && selectedGarment && <>
                <div className="selected-readout">
                  <p>PIEZA SELECCIONADA</p>
                  <h3>{translateGarmentName(selectedGarment.name)}</h3>
                  <small>{translateValue(selectedGarment.category)}</small>
                  <button onClick={() => sendSelected("back")}>ENVIAR ATRÁS ↓</button>
                </div>
                <div className="canvas-tools" aria-label="Controles de la prenda seleccionada">
                  <button onClick={() => scaleSelected(-0.06)} aria-label="Reducir prenda"><span>−</span><em>TAMAÑO</em></button>
                  <button onClick={() => scaleSelected(0.06)} aria-label="Aumentar prenda"><span>＋</span><em>TAMAÑO</em></button>
                  <button onClick={() => rotateSelected(-8)} aria-label="Girar a la izquierda"><span>↺</span><em>GIRAR</em></button>
                  <button onClick={() => rotateSelected(8)} aria-label="Girar a la derecha"><span>↻</span><em>GIRAR</em></button>
                  <button onClick={() => sendSelected("front")} aria-label="Traer al frente"><span>↑</span><em>FRENTE</em></button>
                  <button onClick={removeSelected} className="remove-tool" aria-label="Quitar prenda"><span>×</span><em>QUITAR</em></button>
                </div>
              </>}
              <div className="sticker-tray-groups">
                {!demoMode && <section className="sticker-tray-section">
                  <div className="tray-heading"><h3>MIS PRENDAS</h3><p>{studioPersonalGarments.length}</p></div>
                  {studioPersonalGarments.length > 0
                    ? <div className="sticker-tray">{studioPersonalGarments.map((item) => (
                      <button key={item.id} onClick={() => addToCanvas(item.id)} aria-label={`Añadir ${translateGarmentName(item.name)} al canvas`}>
                        <img src={imageSrc(item.image)} alt="" loading="lazy" />
                        <span>{translateGarmentName(item.name)}</span>
                      </button>
                    ))}</div>
                    : <p className="sticker-tray-empty">No tienes prendas en esta categoría.</p>}
                </section>}
                <section className="sticker-tray-section forme-basics-section">
                  <div className="tray-heading"><h3>BÁSICOS FORMÉ</h3><p>{studioBasicGarments.length}</p></div>
                  {studioBasicGarments.length > 0
                    ? <div className="sticker-tray">{studioBasicGarments.map((item) => (
                      <button key={item.id} onClick={() => addToCanvas(item.id)} aria-label={`Añadir ${translateGarmentName(item.name)} al canvas`}>
                        <img src={imageSrc(item.image)} alt="" loading="lazy" />
                        <span>{translateGarmentName(item.name)}</span>
                      </button>
                    ))}</div>
                    : <p className="sticker-tray-empty">No hay básicos en esta categoría.</p>}
                </section>
              </div>

              <div className="library-utilities">
                <button className="clear-look" onClick={() => { setCanvasPieces([]); setSelectedId(""); setSelectedGroupIds([]); setActiveOutfitId(null); setActiveLookName("Nuevo look"); setSaved(false); closeLookIterations(); }}>VACIAR CANVAS</button>
              </div>
            </aside>

            <button className={`floating-panel-toggle saved-panel-toggle ${savedLooksOpen ? "active" : ""} ${libraryOpen ? "concealed" : ""}`} onClick={() => setSavedLooksOpen((open) => { const next = !open; if (next) setLibraryOpen(false); return next; })} aria-expanded={savedLooksOpen} aria-label="Abrir looks guardados">
              <span>LOOKS</span><b>{savedLooksOpen ? "×" : String(savedLooks.length).padStart(2, "0")}</b>
            </button>

            <aside className={`saved-looks-panel ${savedLooksOpen ? "panel-open" : "panel-closed"}`} aria-label="Looks guardados">
              <div className="floating-panel-header"><span>LOOKS GUARDADOS / {String(savedLooks.length).padStart(2, "0")}</span><button onClick={() => setSavedLooksOpen(false)} aria-label="Cerrar looks guardados">×</button></div>
              {savedLooks.length > 0
                ? <div className="saved-look-panel-list">{savedLooks.map((look) => (
                  <button type="button" className={`saved-look-panel-card ${activeOutfitId === look.id ? "active" : ""}`} onClick={() => openSavedLook(look)} key={look.id}>
                    <LookPreview look={look} garmentById={garmentById} />
                    <span><strong>{look.name}</strong><small>{look.items.length} {look.items.length === 1 ? "PIEZA" : "PIEZAS"}</small></span>
                  </button>
                ))}</div>
                : <div className="saved-look-panel-empty"><p>Todavía no guardaste ningún look.</p><small>Arma uno en el canvas y toca Guardar.</small></div>}
            </aside>

            {shareNotice && <div className="share-status-message" role="status">{shareNotice}<button type="button" onClick={() => setShareNotice("")} aria-label="Cerrar mensaje">×</button></div>}
            {wardrobeError && <div className="canvas-status-message" role="status">{wardrobeError}<button type="button" onClick={() => setWardrobeError("")} aria-label="Cerrar mensaje">×</button></div>}
            <nav className="canvas-action-bar" aria-label="Acciones del look">
              <button className={`save-look-action ${saved && selectedGroupIds.length === 0 ? "saved" : ""}`} disabled={canvasPieces.length === 0 || savingOutfit || (saved && selectedGroupIds.length === 0)} onClick={saveCurrentOutfit}><span>{savingOutfit ? "GUARDANDO…" : selectedGroupIds.length ? `GUARDAR ${selectedGroupIds.length} ${selectedGroupIds.length === 1 ? "PIEZA" : "PIEZAS"}` : saved ? "GUARDADO" : activeLookIteration ? "GUARDAR SELECCIÓN" : "GUARDAR LOOK"}</span><b>{saved && selectedGroupIds.length === 0 ? "✓" : "＋"}</b></button>
              <button disabled={canvasPieces.length === 0 || savingOutfit} onClick={duplicateCurrentOutfit}><span>DUPLICAR</span><b>＋</b></button>
              <button className="mix-look-action" onClick={iterateCurrentLook} disabled={!canIterate || savingOutfit}><span>MEZCLAR</span><b>5</b></button>
              <button className="share-look-action" disabled={canvasPieces.length === 0 || Boolean(sharingLookId)} onClick={() => void shareLook({ id: activeOutfitId ?? "current-share", name: activeLookName === "Nuevo look" ? "Mi look" : activeLookName, items: canvasPieces })}><span>{sharingLookId ? "PREPARANDO…" : "COMPARTIR"}</span><b>↗</b></button>
            </nav>
          </div>
        </section>
      )}

      {garmentDraft && editingGarment && (
        <div className="garment-editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setGarmentDraft(null); }}>
          <section className="garment-editor" role="dialog" aria-modal="true" aria-labelledby="garment-editor-title">
            <header className="garment-editor-header">
              <span>EDITAR PRENDA</span>
              <button type="button" onClick={() => setGarmentDraft(null)} aria-label="Cerrar ficha">×</button>
            </header>
            <div className="garment-editor-body">
              <div className="garment-editor-visual">
                <div className="garment-editor-image"><img src={imageSrc(editingGarment.image)} alt={garmentDraft.name} /></div>
                <div className="garment-tag-preview" aria-label="Etiquetas actuales">
                  {[garmentDraft.category, garmentDraft.tone, garmentDraft.material, garmentDraft.finish, garmentDraft.silhouette].map((tag) => <span key={tag}>{translateValue(tag)}</span>)}
                  {garmentDraft.tags.map((tag) => <span key={tag}>#{tag}</span>)}
                </div>
                <button className="editor-canvas-add" type="button" onClick={() => { addAndOpenStudio(editingGarment.id); setGarmentDraft(null); }}>AÑADIR AL CANVAS <span>＋</span></button>
              </div>

              <form className="garment-editor-form" onSubmit={(event) => { event.preventDefault(); saveGarmentDraft(); }}>
                <div className="garment-editor-intro">
                  <h2 id="garment-editor-title">{garmentDraft.name || "Prenda sin nombre"}</h2>
                  <span>Edita lo que necesites y guarda los cambios.</span>
                </div>
                <div className="garment-editor-fields">
                  <label className="field-wide">NOMBRE<input value={garmentDraft.name} onChange={(event) => updateGarmentDraft("name", event.target.value)} /></label>
                  <label>MARCA<input value={garmentDraft.brand} onChange={(event) => updateGarmentDraft("brand", event.target.value)} placeholder="Sin marca" /></label>
                  <label>TIPO<select value={garmentDraft.category} onChange={(event) => updateGarmentDraft("category", event.target.value as Garment["category"])}>{filterOptions.category.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  <label>COLOR<select value={garmentDraft.colorFamily} onChange={(event) => { const next = event.target.value; updateGarmentDraft("colorFamily", next); updateGarmentDraft("tone", filterOptions.tonesByColor[next]?.[0] ?? "Unclassified"); }}>{filterOptions.colorFamily.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  <label>TONO<select value={garmentDraft.tone} onChange={(event) => updateGarmentDraft("tone", event.target.value)}>{editorTones.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  <label>MATERIAL<select value={garmentDraft.material} onChange={(event) => updateGarmentDraft("material", event.target.value)}>{filterOptions.material.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  <label>ACABADO<select value={garmentDraft.finish} onChange={(event) => updateGarmentDraft("finish", event.target.value)}>{filterOptions.finish.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  <label>CORTE<select value={garmentDraft.silhouette} onChange={(event) => updateGarmentDraft("silhouette", event.target.value)}>{filterOptions.silhouette.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                </div>

                <div className="custom-tag-editor">
                  <div><span>ETIQUETAS</span><small>Agrega tu propia forma de organizarla.</small></div>
                  {garmentDraft.tags.length > 0 && <div className="custom-tag-list">{garmentDraft.tags.map((tag) => <button type="button" key={tag} onClick={() => updateGarmentDraft("tags", garmentDraft.tags.filter((item) => item !== tag))}>#{tag}<span>×</span></button>)}</div>}
                  <div className="tag-input-row"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={handleTagKeyDown} placeholder="viaje, noche, favorito…" /><button type="button" onClick={addDraftTag} disabled={!tagInput.trim()}>AÑADIR ＋</button></div>
                </div>

                <label className="item-public-toggle">
                  <span><strong>MOSTRAR EN MI PERFIL</strong><small>Solo aparecerá si también activas la sección de prendas en tu perfil público.</small></span>
                  <input type="checkbox" checked={garmentDraft.isPublic} onChange={(event) => updateGarmentDraft("isPublic", event.target.checked)} />
                </label>

                {editingGarment.originalImage && !isStaticDemo && <details className="processing-options">
                  <summary>MEJORAR IMAGEN</summary>
                  <div>
                    <p>Si la imagen no se parece a tu prenda, puedes generarla otra vez.</p>
                    <div className="processing-option-actions">
                      <button type="button" onClick={() => retryProcessing(editingGarment, "medium", "closed")}>GENERAR DE NUEVO</button>
                      {editingGarment.category === "Outerwear" && !editingGarment.openImage && <button type="button" onClick={() => retryProcessing(editingGarment, "low", "open")}>CREAR VERSIÓN ABIERTA</button>}
                      {editingGarment.category === "Outerwear" && editingGarment.openImage && <button type="button" onClick={() => retryProcessing(editingGarment, "medium", "open")}>GENERAR ABIERTA DE NUEVO</button>}
                    </div>
                  </div>
                </details>}

                <div className="garment-editor-actions">
                  <button type="button" className="delete-garment" onClick={() => deleteGarment(editingGarment)}>ELIMINAR</button>
                  {(editingGarment.status === "failed" || editingGarment.status === "uploaded") && !isStaticDemo && <button type="button" onClick={() => retryProcessing(editingGarment)}>REPROCESAR</button>}
                  {garmentSaveError && <span className="garment-save-error">{garmentSaveError}</span>}
                  <button type="button" onClick={() => setGarmentDraft(null)}>CANCELAR</button>
                  <button type="submit" className={garmentSaved ? "saved" : ""}>{garmentSaved ? "GUARDADO ✓" : "GUARDAR CAMBIOS"}</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      <nav className="mobile-nav" aria-label="Secciones principales">
        <button className={view === "wardrobe" ? "active" : ""} onClick={() => openWardrobe()}><span>▦</span>Armario</button>
        <button className={view === "studio" ? "active" : ""} onClick={() => openStudio(wardrobePanel)}><span>◫</span>Canvas</button>
      </nav>
    </main>
  );
}

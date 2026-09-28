"use client";

import Link from "next/link";

import {
  Fragment,
  CSSProperties,
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  classifyGarment,
  formeBasics,
  Garment,
  GarmentPhotoRole,
  garmentPhotoFor,
  garmentTypesByCategory,
  starterGarments,
} from "./garments";
import { garmentRegion, lengthOptions, type LengthOverride } from "../shared/garment-proportions";
import { processingFileFor, uploadFileAccept, uploadFileError, uploadFingerprint } from "./garment-upload";
import { FormeAppHeader, FormeMobileNav } from "./forme-app-shell";
import { productFeatures } from "./product-features";
import { FormeMenu } from "./forme-menu";
import { GarmentViewControls, useGarmentGridSize } from "./garment-view-controls";
import { FormeDialog } from "./forme-dialog";
import { CanvasHistory, snapshotLook, sameDocument, readCanvasDraft, type CanvasDocument } from "./canvas-document";
import { moveCanvasLayer } from "./canvas-layers";
import { applyGarmentReplacements, availableMixGarments, randomGarmentReplacements, randomLookGarments } from "./canvas-random";
import { CanvasPieceOverlay } from "./canvas-piece-overlay";
import { topCanvasPieceAtPoint, visibleGarmentBounds } from "./canvas-overlay-bounds";
import { CanvasGestures, type GesturePoint } from "./canvas-gestures";
import { fitLookPreview } from "./look-preview";
import { LookActionIcon } from "./look-action-icon";
import { ProductOnboarding } from "./product-onboarding";
import { prepareCanvasGarment, garmentLayout, layoutAnchorY, replacementPlacement, manualCanvasScaleMultiplier, slotPlacement, REFERENCE_FRAME, type LayoutFrame } from "./garment-layout";

type View = "wardrobe" | "studio";
type CanvasSizePlatform = "mobile" | "desktop";
type WardrobePanel = "closet" | "looks" | "assistant";
type ClosetMode = "browse" | "upload";
type StudioLibraryFilter = "all" | "outerwear" | "tops" | "bottoms" | "footwear" | "accessories" | "one-pieces";
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

type TransformHandleSession = {
  instanceId: string;
  pointerId: number;
  mode: "scale" | "rotate";
  centerX: number;
  centerY: number;
  startDistance: number;
  startAngle: number;
  startScale: number;
  lastScale?: number;
  startRotation: number;
  startX: number;
  startY: number;
  moved: boolean;
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
  garmentType: string;
  colorFamily: string;
  tone: string;
  material: string;
  finish: string;
  silhouette: string;
};

type FilterKey = keyof WardrobeFilters;
type FilterOptions = Record<FilterKey, string[]> & { tonesByColor: Record<string, string[]> };
type GarmentDraft = Pick<Garment, "id" | "name" | "category" | "garmentType" | "colorFamily" | "tone" | "material" | "finish" | "silhouette" | "lengthOverride"> & {
  description: string;
  brand: string;
  tags: string[];
  isPublic: boolean;
};

type ApiGarment = Omit<GarmentDraft, "id"> & {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  anatomy?: Garment["anatomy"];
  recognitionStatus?: Garment["recognitionStatus"];
  metadataStatus?: Garment["metadataStatus"];
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
  id?: string;
  name: string;
  handle: string;
  bio: string;
  avatarUrl?: string | null;
  joinedAt?: string;
  isTester?: boolean;
  credits?: number;
  referralCode?: string | null;
  referralCount?: number;
  referralCredits?: number;
  onboardingCompleted?: boolean;
  profilePublic: boolean;
  discoverable: boolean;
  showCloset: boolean;
  showLooks: boolean;
  includeFormeBasics: boolean;
  isOwner?: boolean;
};
type ProfileDraft = Pick<WardrobeProfile, "name" | "handle" | "bio" | "profilePublic" | "discoverable" | "showCloset" | "showLooks" | "includeFormeBasics">;
type SessionStatus = "checking" | "guest" | "authenticated";
export type WardrobeRoute = "closet" | "looks" | "canvas" | "perfil" | "ajustes" | "asistente";
type UploadStatus = "ready" | "uploading" | "processing" | "done" | "waiting" | "review" | "failed";
type UploadItem = {
  id: string;
  file: File;
  processingFile: File;
  preview: string;
  name: string;
  status: UploadStatus;
  garmentId?: string;
  error?: string;
};
type IntakeBatchSummary = {
  clientId: string;
  status: "uploading" | "processing" | "review" | "ready";
  expected: number;
  pending: number;
  uploaded: number;
  processing: number;
  passed: number;
  review: number;
  failed: number;
};

type SavedLook = {
  id: string;
  name: string;
  isPublic?: boolean;
  items: CanvasPiece[];
  createdAt?: string;
  updatedAt?: string;
};

type ShareLabelMode = "name" | "name-brand" | "none";
type ShareTarget =
  | { kind: "look"; look: SavedLook }
  | { kind: "garment"; garment: Garment }
  | { kind: "closet"; garments: Garment[] };
type ShareTemplateOptions = {
  labelMode: ShareLabelMode;
  includeHandle: boolean;
  includeGarmentList: boolean;
};

type ClosetReading = {
  categories: Array<[string, number]>;
  colors: Array<[string, number]>;
  materials: Array<[string, number]>;
  usedCount: number;
  unusedCount: number;
  mostUsed: Array<{ garment: Garment; count: number }>;
  visualGarments: Garment[];
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
const emptyFilters: WardrobeFilters = {
  category: "All",
  garmentType: "All",
  colorFamily: "All",
  tone: "All",
  material: "All",
  finish: "All",
  silhouette: "All",
};

const demoLooksStorageKey = "forme-demo-looks-v1";
const demoWeekStorageKey = "forme-demo-week-v1";
const sessionProfileStorageKey = "forme-session-profile-v1";
const sessionProfileMaxAge = 12 * 60 * 60 * 1000;
const currentOutfitId = "current-look";
const discountedBatchThreshold = 5;
const uploadStatusLabels: Record<UploadStatus, string> = {
  ready: "Por añadir",
  uploading: "Subiendo…",
  processing: "Preparando…",
  done: "Lista",
  waiting: "En espera",
  review: "Necesita revisión",
  failed: "No se pudo preparar",
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
  { id: "rebel", label: "Rebelde", description: "Cuero, oscuridad y piezas con actitud que rompen una composición demasiado pulcra.", file: "11-rebelde.webp" },
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
  { key: "category", label: "Categoría" },
  { key: "garmentType", label: "Tipo" },
  { key: "colorFamily", label: "Color" },
  { key: "tone", label: "Tono" },
  { key: "material", label: "Material" },
  { key: "finish", label: "Acabado" },
  { key: "silhouette", label: "Corte" },
];

const starterBrandSuggestions = [
  "Balenciaga",
  "Loewe",
  "Nike",
  "Adidas",
  "Prada",
  "Uniqlo",
  "COS",
  "Zara",
];
const starterColorSuggestions = [
  "Black",
  "White",
  "Grey",
  "Blue",
  "Brown",
  "Green",
  "Red / orange",
  "Multicolor",
  "Other",
];
const starterMaterialSuggestions = [
  "Cotton",
  "Denim",
  "Leather",
  "Wool blend",
  "Technical nylon",
  "Knit",
  "Fleece",
  "Shearling",
  "Acetate",
  "Transparent shell",
];

function autocompleteOptions(values: Array<string | undefined>, starters: string[]) {
  const options = new Map<string, { value: string; count: number; starterIndex: number }>();
  values.forEach((rawValue) => {
    const value = rawValue?.trim();
    if (!value) return;
    const key = value.toLocaleLowerCase();
    const current = options.get(key);
    options.set(key, current
      ? { ...current, count: current.count + 1 }
      : { value, count: 1, starterIndex: Number.MAX_SAFE_INTEGER });
  });
  starters.forEach((value, starterIndex) => {
    const key = value.toLocaleLowerCase();
    if (!options.has(key)) options.set(key, { value, count: 0, starterIndex });
  });
  return Array.from(options.values())
    .sort((a, b) => b.count - a.count || a.starterIndex - b.starterIndex || a.value.localeCompare(b.value))
    .map((option) => option.value);
}

function canonicalAutocompleteValue(value: string, options: string[]) {
  const trimmed = value.trim();
  return options.find((option) => option.toLocaleLowerCase() === trimmed.toLocaleLowerCase()) ?? trimmed;
}

const valueTranslations: Record<string, string> = {
  All: "Todos",
  Outerwear: "Abrigos",
  Tops: "Prendas superiores",
  Bottoms: "Pantalones y faldas",
  Tailoring: "Sastrería",
  Footwear: "Calzado",
  Accessories: "Accesorios",
  "T-shirt": "Polo / camiseta",
  Shirt: "Camisa",
  Sweater: "Chompa",
  Sweatshirt: "Polera",
  Hoodie: "Hoodie",
  Top: "Top",
  Jacket: "Chaqueta",
  Coat: "Abrigo",
  Parka: "Parka",
  Bomber: "Bomber",
  Cape: "Capa",
  Poncho: "Poncho",
  "Suit Jacket": "Saco",
  Blazer: "Blazer",
  Jeans: "Jeans",
  Trousers: "Pantalón",
  Chinos: "Chinos",
  Skirt: "Falda",
  Shorts: "Shorts",
  Sneakers: "Zapatillas",
  Shoes: "Zapatos",
  Boots: "Botas",
  Heels: "Tacos",
  Sandals: "Sandalias",
  Bag: "Bolso",
  Hat: "Gorro / sombrero",
  Glasses: "Lentes",
  Accessory: "Accesorio",
  "One-pieces": "Vestidos y enterizos",
  Dress: "Vestido", Jumpsuit: "Enterizo", Overalls: "Overol", Belt: "Cinturón", Scarf: "Bufanda / pañuelo",
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
  Relaxed: "Holgado",
  Boxy: "Recto y amplio",
  Structured: "Estructurado",
  Graphic: "Estampado",
  Smooth: "Liso",
  Shiny: "Brillante",
  Synthetic: "Sintético",
  Polyester: "Poliéster",
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

const extraTranslations: Record<string, string> = { "Lightweight woven": "Tejido ligero", Pink: "Rosa", Yellow: "Amarillo", Black: "Negro", Amber: "Ámbar", Light: "Claro", Dark: "Oscuro", Straight: "Recto", Orange: "Naranja", Purple: "Morado", Red: "Rojo", Green: "Verde", Blue: "Azul", White: "Blanco", Grey: "Gris", Gray: "Gris", Brown: "Marrón", Navy: "Azul marino", Silver: "Plata", Gold: "Dorado", Multicolor: "Multicolor", Regular: "Regular", Slim: "Entallado", Relaxed: "Holgado", Oversized: "Amplio", Cropped: "Corto", Fitted: "Ajustado", Cotton: "Algodón", Wool: "Lana", Leather: "Cuero", Other: "Otro" };
const translateValue = (value: string) => valueTranslations[value] ?? extraTranslations[value] ?? value.split(/([ /-]+)/).map(part => valueTranslations[part] ?? extraTranslations[part] ?? part).join("");
const searchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
const matchesSearch = (item: Garment, query: string) => searchText([translateGarmentName(item.name), item.brand, translateValue(item.category), translateValue(item.colorFamily), translateValue(item.garmentType), ...(item.tags ?? [])].join(" ")).includes(searchText(query));
const translateGarmentName = (name: string) => garmentNameTranslations[name] ?? name;
const canonicalTranslatedAutocompleteValue = (value: string, options: string[]) => {
  const trimmed = value.trim();
  return options.find((option) => (
    option.toLocaleLowerCase() === trimmed.toLocaleLowerCase()
    || translateValue(option).toLocaleLowerCase() === trimmed.toLocaleLowerCase()
  )) ?? trimmed;
};

function readCachedSessionProfile(): WardrobeProfile | null {
  try {
    const stored = sessionStorage.getItem(sessionProfileStorageKey);
    if (!stored) return null;
    const cached = JSON.parse(stored) as { profile?: WardrobeProfile; cachedAt?: number };
    if (!cached.profile || typeof cached.cachedAt !== "number" || Date.now() - cached.cachedAt > sessionProfileMaxAge) {
      sessionStorage.removeItem(sessionProfileStorageKey);
      return null;
    }
    return cached.profile;
  } catch {
    return null;
  }
}

function cacheSessionProfile(profile: WardrobeProfile) {
  try {
    sessionStorage.setItem(sessionProfileStorageKey, JSON.stringify({ profile, cachedAt: Date.now() }));
  } catch {
    // The live session remains the source of truth when browser storage is unavailable.
  }
}

function clearCachedSessionProfile() {
  try {
    sessionStorage.removeItem(sessionProfileStorageKey);
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

function profileDraftFrom(profile: WardrobeProfile): ProfileDraft {
  return {
    name: profile.name,
    handle: profile.handle,
    bio: profile.bio,
    profilePublic: profile.profilePublic,
    discoverable: profile.discoverable,
    showCloset: profile.showCloset,
    showLooks: profile.showLooks,
    includeFormeBasics: profile.includeFormeBasics === true,
  };
}

const matchFilters = (garment: Garment, filters: WardrobeFilters) => filterLabels.every(({ key }) => filters[key] === "All" || garment[key] === filters[key]);

function AttributeFilters({ value, options, compact = false, onChange, onReset }: {
  value: WardrobeFilters;
  options: FilterOptions;
  compact?: boolean;
  onChange: (key: FilterKey, next: string) => void;
  onReset: () => void;
}) {
  const activeCount = Object.values(value).filter((item) => item !== "All").length;
  const field = ({ key, label }: typeof filterLabels[number]) => {
    const values = key === "tone" && value.colorFamily !== "All" ? options.tonesByColor[value.colorFamily] ?? [] : options[key];
    return <label key={key}>{label}<select value={value[key]} onChange={event => onChange(key, event.target.value)}>
      <option value="All">Todos</option>{values.map(item => <option value={item} key={item}>{translateValue(item)}</option>)}
    </select></label>;
  };
  return <div className={`attribute-filters ${compact ? "compact" : ""}`} aria-label="Filtrar prendas">
    <div className="filter-fields">{filterLabels.filter(item => ["category", "colorFamily"].includes(item.key)).map(field)}</div>
    <details className="advanced-filters"><summary>Más filtros{activeCount > 0 ? ` · ${activeCount} activos` : ""}</summary>
      <div className="filter-fields">{filterLabels.filter(item => !["category", "colorFamily"].includes(item.key)).map(field)}</div>
    </details>
    <button type="button" className="reset-filters" disabled={activeCount === 0} onClick={onReset}>Limpiar filtros{activeCount > 0 ? ` (${activeCount})` : ""}</button>
  </div>;
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (path: string) => `${basePath}${path}`;
const imageSrc = (path: string) => (path.startsWith("/") ? asset(path) : path);
const cleanCanvasImage = (path: string) => path;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeDegrees = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

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
  lengthOverride: garment.lengthOverride ?? null,
  name: garment.name.trim() || "Prenda sin nombre",
  description: garment.description ?? "",
  brand: garment.brand ?? "",
  category: garment.category,
  garmentType: garment.garmentType,
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
    if (item.deleted || !garmentTypesByCategory[item.category]) continue;
    const existing = byId.get(item.id);
    const image = item.image || (item.qaStatus === "passed" ? item.generatedImage : undefined) || item.originalImage || existing?.image;
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
  if (category === "Tops" || category === "One-pieces") return 2000;
  if (category === "Outerwear" || category === "Tailoring") return 3000;
  if (category === "Footwear") return 4000;
  return 5000;
};
const lowerBodyAnchor = { x: 50, y: 61.5 } as const;
const currentCanvasSizePlatform = (): CanvasSizePlatform => typeof window !== "undefined" && window.matchMedia("(max-width: 699px)").matches ? "mobile" : "desktop";
function currentLayoutFrame(): LayoutFrame {
  // Portrait document coordinates are independent of screen size and open panels.
  return REFERENCE_FRAME;
}

const defaultPlacement = (garment: Garment, variant: "closed" | "open" = garment.openImage ? "open" : "closed", frame = currentLayoutFrame()) => slotPlacement(garment, variant, frame);


function recommendationOuterPlacement(garment: Garment) {
  return defaultPlacement(garment);
}

function recommendationTopPlacement(top: Garment, _outer: Garment) {
  return defaultPlacement(top, "closed");
}

function normalizedCanvasPiece(piece: CanvasPiece, _garment?: Garment): CanvasPiece {
  // Saved coordinates are user-owned. Slot placement applies to new pieces,
  // never as a scale/position migration when an existing look is opened.
  return piece;
}

function initialSlotPiece(piece: CanvasPiece): CanvasPiece {
  const garment = starterGarments.find(item => item.id === piece.garmentId);
  return garment ? { ...piece, ...defaultPlacement(garment, piece.variant, REFERENCE_FRAME) } : piece;
}

const initialCanvas = ([
  { instanceId: "initial-bottom", garmentId: "bottom-blue-jeans", variant: "closed", ...lowerBodyAnchor, scale: 0.59, rotation: 0, z: 1001 },
  { instanceId: "initial-tee", garmentId: "top-basic-white-tee", variant: "closed", x: 50, y: 34, scale: 0.48, rotation: 0, z: 2001 },
  { instanceId: "initial-jacket", garmentId: "archive-002", variant: "open", x: 50, y: 34, scale: 0.51, rotation: 0, z: 3001 },
] as CanvasPiece[]).map(initialSlotPiece);

const initialDemoCanvas = ([
  { instanceId: "demo-bottom", garmentId: "bottom-blue-jeans", variant: "closed", ...lowerBodyAnchor, scale: 0.59, rotation: 0, z: 1001 },
  { instanceId: "demo-top", garmentId: "top-basic-white-tee", variant: "closed", x: 50, y: 34, scale: 0.48, rotation: 0, z: 2001 },
  { instanceId: "demo-shoes", garmentId: "footwear-white-sneakers", variant: "closed", x: 50, y: 86, scale: 0.34, rotation: 0, z: 4001 },
  { instanceId: "demo-glasses", garmentId: "accessory-black-sunglasses", variant: "closed", x: 50, y: 17.5, scale: 0.14, rotation: 0, z: 5001 },
  { instanceId: "demo-tote", garmentId: "accessory-black-tote", variant: "closed", x: 74, y: 58, scale: 0.28, rotation: 0, z: 5002 },
] as CanvasPiece[]).map(initialSlotPiece);

const stylingNeutralFamilies = new Set(["Black", "White", "Grey", "Brown", "Blue"]);

function searchableGarment(garment: Garment) {
  return `${garment.name} ${garment.material} ${garment.finish} ${garment.tone} ${garment.tags?.join(" ") ?? ""}`.toLocaleLowerCase();
}

function garmentMatchesAudience(garment: Garment, audience?: StyleAudience): boolean {
  if (audience !== "hombre") return true;
  const searchable = searchableGarment(garment);
  if (garment.category === "Footwear" && /pump|high heel|stiletto|tac[oó]n/.test(searchable)) return false;
  if (garment.category === "Tops" && /baby tee|bustier|corset/.test(searchable)) return false;
  if (garment.category === "Bottoms" && /skirt|falda/.test(searchable)) return false;
  return true;
}

function lookMatchesAudience(look: SavedLook, garmentById: Map<string, Garment>, audience?: StyleAudience): boolean {
  return look.items.every((item) => {
    const garment = garmentById.get(item.garmentId);
    return !garment || garmentMatchesAudience(garment, audience);
  });
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
    .filter((item): item is Garment => item !== undefined && ["Tops", "Bottoms", "Outerwear", "Tailoring"].includes(item.category))
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
  avoidedGarmentIds: Set<string> = new Set(),
): StylingRecommendation[] {
  const eligibleGarments = garments.filter((item) => garmentMatchesAudience(item, styleProfile?.audience));
  const bottoms = eligibleGarments.filter((item) => item.category === "Bottoms");
  const tops = eligibleGarments.filter((item) => item.category === "Tops");
  const outerLayers = eligibleGarments.filter((item) => item.category === "Outerwear" || item.category === "Tailoring");
  if (!bottoms.length || !tops.length || !outerLayers.length) return [];
  const footwear = eligibleGarments.filter((item) => item.category === "Footwear");
  const accessories = eligibleGarments.filter((item) => item.category === "Accessories");
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
      - (garmentUse.get(candidate.bottom.id) ?? 0) * 18
      - (garmentUse.get(candidate.top.id) ?? 0) * 18
      - (garmentUse.get(candidate.outer.id) ?? 0) * 22
      + stableTextScore(`${strategy}:${candidate.signature}`) % 100 / 1000;
    candidates.sort((a, b) => effectiveScore(b) - effectiveScore(a) || a.signature.localeCompare(b.signature));
    const usesAvoidedGarment = (candidate: typeof candidates[number]) => (
      avoidedGarmentIds.has(candidate.bottom.id)
      || avoidedGarmentIds.has(candidate.top.id)
      || avoidedGarmentIds.has(candidate.outer.id)
    );
    const choice = candidates.find((candidate) => !usesAvoidedGarment(candidate) && !excludedSignatures.has(candidate.signature) && !selectedSignatures.has(candidate.signature))
      ?? candidates.find((candidate) => !usesAvoidedGarment(candidate) && !selectedSignatures.has(candidate.signature))
      ?? candidates.find((candidate) => !excludedSignatures.has(candidate.signature) && !selectedSignatures.has(candidate.signature))
      ?? candidates.find((candidate) => !selectedSignatures.has(candidate.signature))
      ?? candidates[0];
    if (!choice) return [];
    selectedSignatures.add(choice.signature);
    for (const garment of [choice.bottom, choice.top, choice.outer]) garmentUse.set(garment.id, (garmentUse.get(garment.id) ?? 0) + 1);

    const selectedBase = [choice.top, choice.bottom, choice.outer];
    const rankComplement = (pool: Garment[]) => {
      const unusedFresh = pool.filter((item) => !usedComplements.has(item.id) && !avoidedGarmentIds.has(item.id));
      const unused = pool.filter((item) => !usedComplements.has(item.id));
      const rankedPool = unusedFresh.length ? unusedFresh : unused.length ? unused : pool;
      return [...rankedPool].sort((a, b) => {
        const aScore = complementScore(a, selectedBase, code, moment, occasion) + stylePreferenceScore(a, styleProfile) + (priorityGarmentIds.has(a.id) ? 14 : 0) - (usedComplements.has(a.id) ? 10 : 0);
        const bScore = complementScore(b, selectedBase, code, moment, occasion) + stylePreferenceScore(b, styleProfile) + (priorityGarmentIds.has(b.id) ? 14 : 0) - (usedComplements.has(b.id) ? 10 : 0);
        return bScore - aScore || a.id.localeCompare(b.id);
      })[0];
    };
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

function utcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildWeekDays(anchor: Date): WeekDay[] {
  const limaParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(anchor);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(limaParts.find((item) => item.type === type)?.value ?? 0);
  const limaToday = new Date(Date.UTC(part("year"), part("month") - 1, part("day"), 12));
  const today = utcDateKey(limaToday);
  const monday = new Date(limaToday);
  const weekday = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - weekday + 1);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return {
      key: utcDateKey(date),
      shortLabel: new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", weekday: "short" }).format(date).replace(".", "").toLocaleUpperCase(),
      dayNumber: String(date.getUTCDate()).padStart(2, "0"),
      fullLabel: new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(date),
      isToday: utcDateKey(date) === today,
    };
  });
}

function countGarments(garments: Garment[], value: (garment: Garment) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const garment of garments) counts.set(value(garment), (counts.get(value(garment)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const closetSwatches: Record<string, string> = {
  Black: "#171817", White: "#efefea", Grey: "#9b9d9a", Gray: "#9b9d9a", Blue: "#405f8b",
  Navy: "#26354d", Brown: "#765743", Green: "#60755d", Red: "#a43d32", Orange: "#c86935",
  Pink: "#c78e9c", Purple: "#76658d", Yellow: "#c6a844", Cream: "#ded7c7", Multicolor: "conic-gradient(#405f8b,#a43d32,#c6a844,#60755d,#405f8b)",
  "Red / orange": "linear-gradient(135deg,#a43d32 0 50%,#c86935 50%)", "Other": "#b8b6ae",
};

function closetSwatch(color: string) {
  return closetSwatches[color] ?? closetSwatches[color.split(" / ")[0]] ?? "#b8b6ae";
}

function buildClosetReading(garments: Garment[], looks: SavedLook[]): ClosetReading {
  const categories = countGarments(garments, garment => garment.category);
  const colors = countGarments(garments, garment => garment.colorFamily);
  const materials = countGarments(garments, garment => garment.material);
  const usage = new Map<string, number>();
  for (const look of looks) for (const item of look.items) usage.set(item.garmentId, (usage.get(item.garmentId) ?? 0) + 1);
  const usedCount = garments.filter(garment => usage.has(garment.id)).length;
  const mostUsed = garments
    .flatMap(garment => usage.has(garment.id) ? [{ garment, count: usage.get(garment.id)! }] : [])
    .sort((a, b) => b.count - a.count || translateGarmentName(a.garment.name).localeCompare(translateGarmentName(b.garment.name), "es"))
    .slice(0, 4);
  const mostUsedGarments = mostUsed.map(item => item.garment);
  const visualGarments = [...mostUsedGarments, ...garments.filter(garment => !usage.has(garment.id))].slice(0, 4);
  if (!garments.length) return {
    categories, colors, materials, usedCount: 0, unusedCount: 0, mostUsed, visualGarments,
  };
  return { categories, colors, materials, usedCount, unusedCount: Math.max(0, garments.length - usedCount), mostUsed, visualGarments };
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
    summary = `Voy a cambiar una variable por vez: color, proporción o capa, para ${followup.focus}.`;
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

function centeredLookPreviewItems(look: SavedLook, garmentById: Map<string, Garment>) {
  const items = look.items.flatMap((piece) => {
    const garment = garmentById.get(piece.garmentId);
    if (!garment) return [];
    return [{ piece: normalizedCanvasPiece(piece, garment), garment }];
  });
  const fitted = fitLookPreview(items.map(item => item.piece), piece => garmentLayout(garmentById.get(piece.garmentId)!, piece.variant).bounds);
  return items.map((item, index) => ({ ...item, piece: fitted[index] }));
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

function shareHandle(value: string) {
  const normalized = value.trim().replace(/^@/, "");
  return normalized ? `@${normalized}` : "@FORME";
}

function shareLookGarments(look: SavedLook, garmentById: Map<string, Garment>) {
  const seen = new Set<string>();
  return [...look.items]
    .sort((a, b) => a.z - b.z)
    .flatMap((piece) => {
      if (seen.has(piece.garmentId)) return [];
      const garment = garmentById.get(piece.garmentId);
      if (!garment) return [];
      seen.add(piece.garmentId);
      return [garment];
    });
}

function fitCanvasText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (context.measureText(value).width <= maxWidth) return value;
  let fitted = value;
  while (fitted.length > 1 && context.measureText(`${fitted}…`).width > maxWidth) fitted = fitted.slice(0, -1);
  return `${fitted.trimEnd()}…`;
}

async function createInstagramStoryBlob(
  look: SavedLook,
  garmentById: Map<string, Garment>,
  options: ShareTemplateOptions,
  handle: string,
): Promise<Blob> {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este dispositivo no pudo crear la historia.");

  context.fillStyle = "#f3f3ef";
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
  context.fillText("FORMÉ®", 72, 92);
  if (options.labelMode !== "none") {
    context.font = "500 64px Helvetica, Arial, sans-serif";
    context.letterSpacing = "-2px";
    context.fillText(look.name, 72, 185, width - 144);
  }

  const artboard = { x: 92, y: 266, width: 896, height: 1344 };
  context.fillStyle = "#f3f3ef";
  context.fillRect(artboard.x, artboard.y, artboard.width, artboard.height);
  context.strokeStyle = "rgba(17,17,15,.10)";
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
  context.font = "400 36px Helvetica, Arial, sans-serif";
  context.letterSpacing = "-1px";
  const lookGarments = shareLookGarments(look, garmentById);
  if (options.includeGarmentList && lookGarments.length) {
    const visible = lookGarments.slice(0, 15);
    const columns = visible.length > 8 ? 3 : 2;
    const rows = Math.ceil(visible.length / columns);
    const gap = 28;
    const columnWidth = (width - 144 - gap * (columns - 1)) / columns;
    const rowHeight = Math.min(44, 174 / Math.max(1, rows));
    context.font = "600 13px Arial, sans-serif";
    context.letterSpacing = "2px";
    context.fillText("EN ESTE LOOK", 72, 1656);
    visible.forEach((garment, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = 72 + column * (columnWidth + gap);
      const y = 1692 + row * rowHeight;
      context.fillStyle = "rgba(17,17,15,.42)";
      context.font = "500 12px Arial, sans-serif";
      context.letterSpacing = "1px";
      context.fillText(String(index + 1).padStart(2, "0"), x, y);
      context.fillStyle = "#11110f";
      context.font = `${columns === 3 ? 15 : 17}px Helvetica, Arial, sans-serif`;
      context.letterSpacing = "0px";
      const brand = garment.brand?.trim();
      const label = `${translateGarmentName(garment.name)}${brand ? ` / ${brand}` : ""}`;
      context.fillText(fitCanvasText(context, label, columnWidth - 30), x + 30, y);
    });
    if (lookGarments.length > visible.length) {
      context.fillStyle = "rgba(17,17,15,.55)";
      context.font = "500 13px Arial, sans-serif";
      context.fillText(`+${lookGarments.length - visible.length} PRENDAS`, width - 230, 1842);
    }
  } else {
    context.fillStyle = "#11110f";
    context.font = "400 36px Helvetica, Arial, sans-serif";
    context.letterSpacing = "-1px";
    context.fillText("Vístete con lo que ya tienes.", 72, 1738);
  }
  context.font = "600 19px Arial, sans-serif";
  context.letterSpacing = "4px";
  const footer = [
    `${look.items.length} ${look.items.length === 1 ? "PIEZA" : "PIEZAS"}`,
    options.includeHandle ? shareHandle(handle) : "FORME.GALLERY",
  ].join("  /  ");
  context.fillStyle = "#11110f";
  context.fillText(footer, 72, options.includeGarmentList && lookGarments.length ? 1880 : 1793);
  context.fillStyle = "#e83b25";
  context.fillRect(72, options.includeGarmentList && lookGarments.length ? 1902 : 1840, 128, 8);

  const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!result) throw new Error("No se pudo exportar la historia.");
  return result;
}

async function createGarmentStoryBlob(
  garment: Garment,
  options: ShareTemplateOptions,
  handle: string,
): Promise<Blob> {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este dispositivo no pudo crear la historia.");
  context.fillStyle = "#f3f3ef";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(17,17,15,.12)";
  for (let x = 48; x < width; x += 28) for (let y = 48; y < height; y += 28) {
    context.beginPath(); context.arc(x, y, 1.2, 0, Math.PI * 2); context.fill();
  }
  context.fillStyle = "#11110f";
  context.font = "600 24px Arial, sans-serif";
  context.letterSpacing = "5px";
  context.fillText("FORMÉ®", 72, 92);
  const image = await loadShareImage(imageSrc(garmentPhotoFor(garment, "complete").image));
  try {
    const frame = { x: 90, y: 210, width: 900, height: 1300 };
    const contain = Math.min(frame.width / image.width, frame.height / image.height);
    const drawWidth = image.width * contain;
    const drawHeight = image.height * contain;
    context.shadowColor = "rgba(17,17,15,.12)";
    context.shadowBlur = 28;
    context.shadowOffsetY = 16;
    context.drawImage(image.source, frame.x + (frame.width - drawWidth) / 2, frame.y + (frame.height - drawHeight) / 2, drawWidth, drawHeight);
    context.shadowColor = "transparent";
  } finally { image.close(); }
  if (options.labelMode !== "none") {
    context.fillStyle = "#11110f";
    context.font = "500 58px Helvetica, Arial, sans-serif";
    context.letterSpacing = "-2px";
    context.fillText(translateGarmentName(garment.name), 72, 1662, width - 144);
    if (options.labelMode === "name-brand" && garment.brand?.trim()) {
      context.font = "500 22px Arial, sans-serif";
      context.letterSpacing = "4px";
      context.fillText(garment.brand.toLocaleUpperCase(), 72, 1712, width - 144);
    }
  }
  context.font = "600 19px Arial, sans-serif";
  context.letterSpacing = "4px";
  context.fillText(options.includeHandle ? shareHandle(handle) : "FORME.GALLERY", 72, 1810);
  context.fillStyle = "#e83b25";
  context.fillRect(72, 1850, 128, 8);
  const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!result) throw new Error("No se pudo exportar la prenda.");
  return result;
}

async function createClosetStoryBlob(
  garments: Garment[],
  options: ShareTemplateOptions,
  handle: string,
): Promise<Blob> {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este dispositivo no pudo crear la historia.");
  context.fillStyle = "#f3f3ef";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#11110f";
  context.font = "600 24px Arial, sans-serif";
  context.letterSpacing = "5px";
  context.fillText("MI CLOSET EN FORMÉ", 64, 84);
  const visible = garments.slice(0, 12);
  const columns = 3;
  const gap = 18;
  const cellWidth = (width - 128 - gap * (columns - 1)) / columns;
  const cellHeight = 390;
  const loaded = await Promise.all(visible.map(async (garment) => ({ garment, image: await loadShareImage(imageSrc(garmentPhotoFor(garment, "complete").image)) })));
  try {
    loaded.forEach(({ garment, image }, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = 64 + column * (cellWidth + gap);
      const y = 136 + row * (cellHeight + gap);
      context.fillStyle = "#e9e9e4";
      context.fillRect(x, y, cellWidth, cellHeight);
      const labelSpace = options.labelMode === "none" ? 24 : 70;
      const contain = Math.min((cellWidth - 24) / image.width, (cellHeight - labelSpace) / image.height);
      const drawWidth = image.width * contain;
      const drawHeight = image.height * contain;
      context.drawImage(image.source, x + (cellWidth - drawWidth) / 2, y + 12 + (cellHeight - labelSpace - drawHeight) / 2, drawWidth, drawHeight);
      if (options.labelMode !== "none") {
        context.fillStyle = "#11110f";
        context.font = "500 17px Arial, sans-serif";
        context.letterSpacing = "0";
        const name = translateGarmentName(garment.name);
        context.fillText(name.length > 25 ? `${name.slice(0, 23)}…` : name, x + 12, y + cellHeight - 35, cellWidth - 24);
        if (options.labelMode === "name-brand" && garment.brand?.trim()) {
          context.fillStyle = "#676760";
          context.font = "500 12px Arial, sans-serif";
          context.fillText(garment.brand.toLocaleUpperCase().slice(0, 28), x + 12, y + cellHeight - 15, cellWidth - 24);
        }
      }
    });
  } finally { loaded.forEach(({ image }) => image.close()); }
  context.fillStyle = "#11110f";
  context.font = "600 19px Arial, sans-serif";
  context.letterSpacing = "4px";
  context.fillText(options.includeHandle ? shareHandle(handle) : "FORME.GALLERY", 64, 1830);
  context.fillStyle = "#e83b25";
  context.fillRect(64, 1870, 128, 8);
  const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!result) throw new Error("No se pudo exportar el closet.");
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
          {savedLooks.length > 0 && <button className="week-auto-plan" type="button" onClick={onAutoPlan} disabled={busy}>{busy ? "ORGANIZANDO…" : plannedCount ? "REPLANTEAR SEMANA ↻" : "PLANEAR SEMANA →"}</button>}
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
              <span>Abrir en Canvas</span>
            </button>
            <div className="day-look-meta"><div><p>LOOK DEL DÍA</p><h3>{selectedLook.name}</h3><span>{selectedLook.items.length} piezas · {weeklyOccasionLabels[selectedEntry.occasion]}</span></div><button type="button" onClick={() => onToggleWorn(selectedEntry)}>{selectedEntry.worn ? "DESMARCAR" : "YA LO USÉ ✓"}</button></div>
            <button className="week-remove" type="button" onClick={() => onRemove(selectedDate)}>QUITAR DEL DÍA</button>
          </> : <div className="day-plan-empty"><span>＋</span><h3>Aún no elegiste un look</h3><p>{savedLooks.length ? "Elige uno de tus looks guardados." : "Guarda tu primer look para empezar a planear."}</p>{savedLooks.length > 0 && <button type="button" onClick={onCreateLook}>CREAR OTRO LOOK →</button>}</div>}
        </section>

        <aside className="week-look-library">
          <div className="week-library-heading"><div><p>TUS LOOKS</p><h3>Cambia el look de {selectedDay?.shortLabel}</h3></div></div>
          <div className="occasion-row" aria-label="Ocasión">
            {(Object.keys(weeklyOccasionLabels) as WeeklyOccasion[]).map((option) => <button type="button" className={occasion === option ? "active" : ""} onClick={() => setOccasion(option)} key={option}>{weeklyOccasionLabels[option]}</button>)}
          </div>
          <div className="week-look-grid">
            {savedLooks.map((look) => <button type="button" className={selectedEntry?.outfitId === look.id ? "active" : ""} onClick={() => onAssign(selectedDate, look.id, occasion)} disabled={busy} key={look.id}>
              <LookPreview look={look} garmentById={garmentById} />
              <span><strong>{look.name}</strong><small>{look.items.length} prendas</small></span>
            </button>)}
            {savedLooks.length === 0 && <div className="week-library-empty"><p>Cuando guardes un look, aparecerá aquí para asignarlo a un día.</p></div>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ClosetGarmentGrid({ garments, emptyLabel, onOpen, onResetFilters, selecting = false, selectedIds, onToggle }: {
  garments: Garment[];
  emptyLabel: string;
  onOpen: (garment: Garment) => void;
  onResetFilters: () => void;
  selecting?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (garment: Garment) => void;
}) {
  return <div className="garment-grid" data-selecting={selecting || undefined}>
    {garments.map((item) => {
      const selected = selectedIds?.has(item.id) ?? false;
      return <article className="garment-card" data-selected={selected || undefined} key={item.id}>
      <button type="button" className="garment-open" onClick={() => selecting && onToggle ? onToggle(item) : onOpen(item)} aria-pressed={selecting ? selected : undefined} aria-label={selecting ? `${selected ? "Quitar" : "Seleccionar"} ${translateGarmentName(item.name)}` : `Ver prenda: ${translateGarmentName(item.name)}`}>
        <span className="image-wrap">
          <img src={imageSrc(garmentPhotoFor(item, "complete").image)} alt="" loading="lazy" data-photo-role="complete" />
          {selecting && <span className="bulk-check" aria-hidden="true">{selected ? "✓" : ""}</span>}
          {(["queued", "processing", "uploaded", "batch_staged", "batch_processing", "cutout_pending"] as Garment["status"][]).includes(item.status) && <span className="processing-badge">Preparando</span>}
          {item.status === "failed" && <span className="processing-badge failed">Necesita revisión</span>}
        </span>
        <span className="garment-caption" title={translateGarmentName(item.name)}>{translateGarmentName(item.name)}</span>
      </button>
    </article>;})}
    {garments.length === 0 && <div className="filter-empty">{emptyLabel}<button onClick={onResetFilters}>Limpiar filtros</button></div>}
  </div>;
}

function ShareTemplateDialog({ target, options, garmentById, handle, busy, onOptions, onClose, onExport }: {
  target: ShareTarget;
  options: ShareTemplateOptions;
  garmentById: Map<string, Garment>;
  handle: string;
  busy: boolean;
  onOptions: (options: ShareTemplateOptions) => void;
  onClose: () => void;
  onExport: () => void;
}) {
  const title = target.kind === "look" ? target.look.name : target.kind === "garment" ? translateGarmentName(target.garment.name) : "Mi closet";
  const lookGarments = target.kind === "look" ? shareLookGarments(target.look, garmentById) : [];
  return <FormeDialog labelledBy="share-template-title" className="share-template-dialog" onClose={() => { if (!busy) onClose(); }}>
      <header><div><span>COMPARTIR</span><h2 id="share-template-title">Elige cómo se verá</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar">×</button></header>
      <div className="share-template-layout">
        <div className="share-template-preview" data-kind={target.kind} data-garment-list={target.kind === "look" && options.includeGarmentList || undefined}>
          <div className="share-preview-brand">FORMÉ®</div>
          <div className="share-preview-media">
            {target.kind === "look" && <LookPreview look={target.look} garmentById={garmentById} />}
            {target.kind === "garment" && <img src={imageSrc(garmentPhotoFor(target.garment, "complete").image)} alt="" />}
            {target.kind === "closet" && <div className="share-preview-closet">{target.garments.slice(0, 6).map((garment) => <span key={garment.id}>
              <img src={imageSrc(garmentPhotoFor(garment, "complete").image)} alt="" />
              {options.labelMode !== "none" && <small>{translateGarmentName(garment.name)}</small>}
              {options.labelMode === "name-brand" && garment.brand?.trim() && <strong>{garment.brand}</strong>}
            </span>)}</div>}
          </div>
          {target.kind !== "closet" && options.labelMode !== "none" && <div className="share-preview-copy"><strong>{title}</strong>{options.labelMode === "name-brand" && target.kind === "garment" && target.garment.brand && <span>{target.garment.brand}</span>}</div>}
          {target.kind === "look" && options.includeGarmentList && <div className="share-preview-look-list" aria-label="Prendas del look">
            <span>EN ESTE LOOK</span>
            <ol>{lookGarments.slice(0, 8).map((garment) => <li key={garment.id}><strong>{translateGarmentName(garment.name)}</strong>{garment.brand?.trim() && <small>{garment.brand}</small>}</li>)}</ol>
            {lookGarments.length > 8 && <small>+{lookGarments.length - 8} prendas</small>}
          </div>}
          {options.includeHandle && <span className="share-preview-handle">{shareHandle(handle)}</span>}
        </div>
        <div className="share-template-controls">
          <fieldset><legend>Información</legend>
            <label><input type="radio" name="share-label" checked={options.labelMode === "name"} onChange={() => onOptions({ ...options, labelMode: "name" })} /><span>Solo nombre</span></label>
            {target.kind !== "look" && <label><input type="radio" name="share-label" checked={options.labelMode === "name-brand"} onChange={() => onOptions({ ...options, labelMode: "name-brand" })} /><span>Nombre + marca</span></label>}
            <label><input type="radio" name="share-label" checked={options.labelMode === "none"} onChange={() => onOptions({ ...options, labelMode: "none" })} /><span>{target.kind === "look" ? "Sin título" : "Sin información"}</span></label>
          </fieldset>
          {target.kind === "look" && <label className="share-template-tag share-template-garments"><span><strong>Lista de prendas</strong><small>Aparece debajo del outfit, sin taparlo.</small></span><input type="checkbox" checked={options.includeGarmentList} onChange={(event) => onOptions({ ...options, includeGarmentList: event.target.checked })} /></label>}
          <label className="share-template-tag"><span><strong>Mostrar @usuario</strong><small>Desactívalo para exportar sin tag.</small></span><input type="checkbox" checked={options.includeHandle} onChange={(event) => onOptions({ ...options, includeHandle: event.target.checked })} /></label>
          <button type="button" className="primary-action" disabled={busy} onClick={onExport}>{busy ? "Preparando…" : "Compartir imagen"}</button>
        </div>
      </div>
  </FormeDialog>;
}

function ClosetActionIcon({ action = "add" }: { action?: "add" | "filter" | "select" | "share" }) {
  return <svg className="closet-action-icon" viewBox="0 0 24 24" aria-hidden="true">
    {action === "filter" && <><path d="M4 7h4m4 0h8M4 17h8m4 0h4" /><circle cx="10" cy="7" r="2" /><circle cx="14" cy="17" r="2" /></>}
    {action === "select" && <><rect x="4" y="4" width="16" height="16" rx="1" /><path d="m8 12 3 3 5-6" /></>}
    {action === "share" && <><path d="M12 15V3m-4 4 4-4 4 4" /><path d="M5 12v8h14v-8" /></>}
    {action === "add" && <path d="M12 5v14M5 12h14" />}
  </svg>;
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

export function WardrobeApp({
  initialRoute = "closet",
}: {
  initialRoute?: WardrobeRoute;
}) {
  const initialWardrobePanel: WardrobePanel = initialRoute === "looks" ? "looks" : initialRoute === "asistente" ? "assistant" : "closet";
  const [demoMode, setDemoMode] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [accountDataReady, setAccountDataReady] = useState(false);
  const [canvasDataReady, setCanvasDataReady] = useState(false);
  const [activeRoute, setActiveRoute] = useState<WardrobeRoute>(initialRoute);
  const [view, setView] = useState<View>(initialRoute === "canvas" ? "studio" : "wardrobe");
  const [wardrobePanel, setWardrobePanel] = useState<WardrobePanel>(initialWardrobePanel);
  const [closetMode, setClosetMode] = useState<ClosetMode>("browse");
  const [studioLibraryFilter, setStudioLibraryFilter] = useState<StudioLibraryFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [garments, setGarments] = useState(formeBasics);
  const [archiveFilters, setArchiveFilters] = useState<WardrobeFilters>(emptyFilters);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [uploadIntakeBatchId, setUploadIntakeBatchId] = useState<string | null>(null);
  const [uploadBatchSummary, setUploadBatchSummary] = useState<IntakeBatchSummary | null>(null);
  const preparingUploadRef = useRef(false);
  const [preparingUploads, setPreparingUploads] = useState(false);
  const [uploadNotice, setUploadNotice] = useState("");
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
    includeFormeBasics: false,
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
  const [productOnboardingOpen, setProductOnboardingOpen] = useState(false);
  const [productOnboardingStep, setProductOnboardingStep] = useState(0);
  const productOnboardingChecked = useRef(false);
  const [savingStyleProfile, setSavingStyleProfile] = useState(false);
  const [profileOpen, setProfileOpen] = useState(initialRoute === "perfil" || initialRoute === "ajustes");
  const [studioReturnPanel, setStudioReturnPanel] = useState<WardrobePanel>("closet");
  const [stylingRecommendations, setStylingRecommendations] = useState<StylingRecommendation[]>([]);
  const [assistantPresetId, setAssistantPresetId] = useState("");
  const [assistantFollowupId, setAssistantFollowupId] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState<AssistantAnswer | null>(null);
  const [recommendationHistory, setRecommendationHistory] = useState<string[]>([]);
  const [lockedPieceIds, setLockedPieceIds] = useState<Set<string>>(new Set());
  const [randomizing, setRandomizing] = useState(false);
  const randomizingRef = useRef(false);
  const latestCanvasPieces = useRef(canvasPieces);
  latestCanvasPieces.current = canvasPieces;
  const [selectedId, setSelectedId] = useState("");
  const [clearedLook, setClearedLook] = useState<{ items: CanvasPiece[]; id: string | null; name: string; saved: boolean; locked: Set<string>; automatic: Set<string> } | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedLooksOpen, setSavedLooksOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [garmentEditing, setGarmentEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ kind: "look" | "garment"; id: string; name: string } | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogSource, setCatalogSource] = useState<"personal" | "basics">("personal");
  const [catalogSort, setCatalogSort] = useState<"recent" | "type" | "name">("recent");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [libraryFavoritesOnly, setLibraryFavoritesOnly] = useState(false);
  const [closetGridSize, setClosetGridSize] = useGarmentGridSize("closet");
  const [canvasGridSize, setCanvasGridSize] = useGarmentGridSize("canvas");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySource, setLibrarySource] = useState<"personal" | "basics">("personal");
  const history = useRef(new CanvasHistory());
  const documentGeneration = useRef(0);
  const nameCheckpoint = useRef(false);
  const routeScroll = useRef(new Map<string, number>());
  const [historyRevision, setHistoryRevision] = useState(0);
  const restoredDraftKey = useRef("");
  const currentDocument = useRef<CanvasDocument>({ items: canvasPieces, id: activeOutfitId, name: activeLookName });
  currentDocument.current = { items: canvasPieces, id: activeOutfitId, name: activeLookName };
  const [garmentDraft, setGarmentDraft] = useState<GarmentDraft | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [garmentSaved, setGarmentSaved] = useState(false);
  const [savingGarment, setSavingGarment] = useState(false);
  const [garmentSaveError, setGarmentSaveError] = useState("");
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [deletingLookId, setDeletingLookId] = useState<string | null>(null);
  const [closetSelecting, setClosetSelecting] = useState(false);
  const [lookSelecting, setLookSelecting] = useState(false);
  const [selectedGarmentIds, setSelectedGarmentIds] = useState<Set<string>>(new Set());
  const [selectedLookIds, setSelectedLookIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [shareOptions, setShareOptions] = useState<ShareTemplateOptions>({ labelMode: "name-brand", includeHandle: true, includeGarmentList: false });
  const [shareBusy, setShareBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const autoPlacedIds = useRef(new Set(initialDemoCanvas.map(piece => piece.instanceId)));
  const rememberCanvasSize = useRef<(instanceId: string, scale: number) => void>(() => {});
  const canvasSizeSaves = useRef<Promise<void>>(Promise.resolve());
  const keyboardSizes = useRef(new Map<string, number>());
  const canvasGestures = useRef<CanvasGestures | null>(null);
  if (!canvasGestures.current) canvasGestures.current = new CanvasGestures({
    select: instanceId => { setSelectedId(instanceId); setSelectedGroupIds([]); setMarqueeRect(null); setReplacingId(null); },
    checkpoint,
    change: (instanceId, geometry) => {
      autoPlacedIds.current.delete(instanceId);
      setCanvasPieces(items => items.map(item => item.instanceId === instanceId ? { ...item, ...geometry } : item));
      setSaved(false);
    },
    replace: beginReplacingPiece,
    lock: toggleRandomLock,
    resize: (instanceId, scale) => rememberCanvasSize.current(instanceId, scale),
  });
  const transformHandleSession = useRef<TransformHandleSession | null>(null);
  const marqueeSession = useRef<MarqueeSession | null>(null);
  const finalizingCutouts = useRef(new Set<string>());
  const profileReturnRoute = useRef<"closet" | "looks" | "canvas" | "asistente">(
    initialRoute === "canvas"
      ? "canvas"
      : initialWardrobePanel === "looks"
        ? "looks"
        : initialWardrobePanel === "assistant"
          ? "asistente"
          : "closet",
  );
  const [weekAnchor] = useState(() => new Date());

  const garmentById = useMemo(() => new Map(garments.map((item) => [item.id, item])), [garments]);
  rememberCanvasSize.current = (instanceId, scale) => {
    const piece = latestCanvasPieces.current.find(item => item.instanceId === instanceId);
    const garment = piece && garmentById.get(piece.garmentId);
    if (!piece || !garment || !Number.isFinite(scale) || scale <= 0) return;
    const multiplier = manualCanvasScaleMultiplier(garment, piece.variant, scale);
    const platform = currentCanvasSizePlatform();
    if (Math.abs((garment.canvasScaleMultipliers?.[platform] ?? 0) - multiplier) < 0.000001) return;
    setGarments(items => items.map(item => item.id === garment.id ? {
      ...item,
      canvasScaleMultiplier: multiplier,
      canvasScaleMultipliers: { ...item.canvasScaleMultipliers, [platform]: multiplier },
    } : item));
    if (demoMode) {
      try {
        const stored = JSON.parse(localStorage.getItem("forme-demo-canvas-sizes-v2") || "{}");
        localStorage.setItem("forme-demo-canvas-sizes-v2", JSON.stringify({ ...stored, [platform]: { ...(stored[platform] ?? {}), [garment.id]: multiplier } }));
      } catch { /* Guest sizing remains available for this session. */ }
      return;
    }
    // Save once per completed gesture, in order, so a slower earlier response
    // can never overwrite the user's most recent adjustment.
    canvasSizeSaves.current = canvasSizeSaves.current.then(async () => {
      const response = await fetch(`/api/garments/${encodeURIComponent(garment.id)}/canvas-size`, {
        method: "PUT", headers: { "content-type": "application/json" }, keepalive: true,
        body: JSON.stringify({ scaleMultiplier: multiplier, platform }),
      });
      if (!response.ok) throw new Error("No se pudo guardar el tamaño de esta prenda. Ajusta el tamaño otra vez para reintentar.");
    }).catch(() => setWardrobeError("No se pudo guardar el tamaño de esta prenda. Ajusta el tamaño otra vez para reintentar."));
  };

  useEffect(() => {
    const query = window.matchMedia("(max-width: 699px)");
    const applyPlatform = () => {
      const platform = currentCanvasSizePlatform();
      setGarments(items => items.map(item => ({ ...item, canvasScaleMultiplier: item.canvasScaleMultipliers?.[platform] })));
    };
    query.addEventListener("change", applyPlatform);
    return () => query.removeEventListener("change", applyPlatform);
  }, []);

  const weekDays = useMemo(() => buildWeekDays(weekAnchor), [weekAnchor]);
  const filterOptions = useMemo<FilterOptions>(() => {
    const unique = (key: FilterKey) => Array.from(new Set(garments.map((item) => item[key]))).sort();
    const tonesByColor = garments.reduce<Record<string, string[]>>((result, item) => {
      result[item.colorFamily] = Array.from(new Set([...(result[item.colorFamily] ?? []), item.tone])).sort();
      return result;
    }, {});
    return {
      category: unique("category"),
      garmentType: unique("garmentType"),
      colorFamily: unique("colorFamily"),
      tone: unique("tone"),
      material: unique("material"),
      finish: unique("finish"),
      silhouette: unique("silhouette"),
      tonesByColor,
    };
  }, [garments]);
  const brandOptions = useMemo(
    () => autocompleteOptions(garments.map((item) => item.brand), starterBrandSuggestions),
    [garments],
  );
  const colorOptions = useMemo(
    () => autocompleteOptions(garments.map((item) => item.colorFamily), starterColorSuggestions),
    [garments],
  );
  const materialOptions = useMemo(
    () => autocompleteOptions(garments.map((item) => item.material), starterMaterialSuggestions),
    [garments],
  );
  const personalGarments = garments.filter((item) => item.collection !== "forme" && item.qaStatus !== "review" && (item.status === "ready" || item.status === "ghosted"));
  const closetReading = buildClosetReading(personalGarments, savedLooks);
  const basicsEnabled = demoMode || profile.includeFormeBasics === true;
  const sharedBasics = basicsEnabled ? garments.filter((item) => item.collection === "forme") : [];
  const garmentCategoryOrder: Garment["category"][] = ["Outerwear", "Tailoring", "Tops", "One-pieces", "Bottoms", "Footwear", "Accessories"];
  const filterCatalog = (items: Garment[]) => items.filter(item => matchFilters(item, archiveFilters) && matchesSearch(item, catalogQuery) && (!favoritesOnly || item.favorite))
    .sort((a, b) => {
      if (catalogSort === "name") return translateGarmentName(a.name).localeCompare(translateGarmentName(b.name), "es");
      if (catalogSort === "type") {
        const categoryDifference = garmentCategoryOrder.indexOf(a.category) - garmentCategoryOrder.indexOf(b.category);
        return categoryDifference || translateValue(a.garmentType).localeCompare(translateValue(b.garmentType), "es") || translateGarmentName(a.name).localeCompare(translateGarmentName(b.name), "es");
      }
      const aTime = Date.parse(a.createdAt ?? "");
      const bTime = Date.parse(b.createdAt ?? "");
      return Number.isFinite(aTime) && Number.isFinite(bTime) ? bTime - aTime : 0;
    });
  const visiblePersonalGarments = filterCatalog(personalGarments);
  const visibleFormeBasics = filterCatalog(sharedBasics);
  const showingBasics = demoMode || (basicsEnabled && catalogSource === "basics");
  const showingLibraryBasics = demoMode || (basicsEnabled && librarySource === "basics");
  const catalogItems = showingBasics ? visibleFormeBasics : visiblePersonalGarments;
  const orderedLayers = [...canvasPieces].sort((a, b) => b.z - a.z);
  const selectedCanvasPiece = canvasPieces.find((item) => item.instanceId === selectedId);
  const selectedCanvasGarment = selectedCanvasPiece ? garmentById.get(selectedCanvasPiece.garmentId) : undefined;
  const galleryWillReplace = Boolean(replacingId ?? selectedId);
  const selectedLayerOrder = [...canvasPieces].sort((a, b) => a.z - b.z);
  const selectedLayerIndex = selectedCanvasPiece
    ? selectedLayerOrder.findIndex((item) => item.instanceId === selectedCanvasPiece.instanceId)
    : -1;
  const assistantGarments = useMemo(() => {
    if (demoMode || personalGarments.length === 0) return sharedBasics;
    const categories = new Set(personalGarments.map((item) => item.category));
    const fallbackBasics = sharedBasics.filter((item) => !categories.has(item.category));
    return [...personalGarments, ...fallbackBasics];
  }, [demoMode, personalGarments, sharedBasics]);
  const matchesStudioLibraryFilter = (item: Garment) => {
    if (studioLibraryFilter === "outerwear") return item.category === "Outerwear" || item.category === "Tailoring";
    if (studioLibraryFilter === "one-pieces") return item.category === "One-pieces";
    if (studioLibraryFilter === "tops") return item.category === "Tops";
    if (studioLibraryFilter === "bottoms") return item.category === "Bottoms";
    if (studioLibraryFilter === "footwear") return item.category === "Footwear";
    if (studioLibraryFilter === "accessories") return item.category === "Accessories";
    return true;
  };
  const studioPersonalGarments = personalGarments.filter(item => matchesStudioLibraryFilter(item) && matchesSearch(item, libraryQuery) && (!libraryFavoritesOnly || item.favorite));
  const studioBasicGarments = sharedBasics.filter(item => matchesStudioLibraryFilter(item) && matchesSearch(item, libraryQuery) && (!libraryFavoritesOnly || item.favorite));
  const selectedGroupIdSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const canRandomize = canvasPieces.length
    ? canvasPieces.some(piece => !lockedPieceIds.has(piece.instanceId))
    : availableMixGarments(garments, basicsEnabled).length > 0;
  const archiveFilterCount = Object.values(archiveFilters).filter((item) => item !== "All").length;
  const editingGarment = garmentDraft ? garmentById.get(garmentDraft.id) : undefined;
  const editorPhoto = editingGarment ? garmentPhotoFor(editingGarment, "complete") : undefined;
  const uploadRetryableCount = uploadItems.filter((item) => item.status === "ready" || item.status === "failed" || item.status === "review").length;
  const uploadAllPassed = uploadItems.length > 0 && uploadItems.every((item) => item.status === "done");
  const editorTones = garmentDraft
    ? Array.from(new Set([garmentDraft.tone, ...(filterOptions.tonesByColor[garmentDraft.colorFamily] ?? [])])).filter(Boolean)
    : [];
  const editorLengths = garmentDraft ? Object.entries(lengthOptions[garmentRegion(garmentDraft)]) : [];
  const detectedLength = editingGarment?.anatomy?.closed?.bodyLength;
  const detectedLengthLabel = editorLengths.find(([key]) => key === detectedLength)?.[1];
  const profileImage = profile.avatarUrl || asset("/profile/tata.png");
  const profileImageClass = `profile-photo${profile.avatarUrl ? "" : " local-profile"}`;
  const profileJoinedDate = profile.joinedAt ? new Intl.DateTimeFormat("es-PE", {
    day: "numeric", month: "long", year: "numeric", timeZone: "America/Lima",
  }).format(new Date(profile.joinedAt)) : null;
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
    !demoMode && !assistantClosetReady ? "Añade al menos ocho prendas, incluyendo una parte de arriba, un pantalón y una capa, para recomendarte looks completos." : "",
  ].filter(Boolean);

  useEffect(() => {
    const cancel = () => canvasGestures.current?.cancel();
    const onVisibility = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancel(); window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  useEffect(() => {
    if (!accountDataReady || productOnboardingChecked.current) return;
    productOnboardingChecked.current = true;
    const onboardingParams = new URLSearchParams(window.location.search);
    const forced = onboardingParams.get("onboarding") === "1";
    const forcedStep = Number(onboardingParams.get("step"));
    const storageKey = `forme-product-onboarding-dismissed-v1:${sessionStatus === "authenticated" ? profile.id || profile.handle : "guest"}`;
    try {
      if (!forced && localStorage.getItem(storageKey) === "1") return;
      const resume = forced && Number.isInteger(forcedStep) && forcedStep >= 1 && forcedStep <= 4
        ? forcedStep - 1
        : Number(sessionStorage.getItem("forme-product-onboarding-resume-v1") || "0");
      setProductOnboardingStep(Number.isFinite(resume) ? Math.max(0, Math.min(3, resume)) : 0);
    } catch { setProductOnboardingStep(0); }
    if (forced || sessionStatus === "guest" || profile.onboardingCompleted === false) setProductOnboardingOpen(true);
  }, [accountDataReady, profile.handle, profile.id, profile.onboardingCompleted, sessionStatus]);
  useEffect(() => {
    if (view !== "studio" || savingOutfit) canvasGestures.current?.cancel();
  }, [view, savingOutfit]);

  useEffect(() => {
    if (!selectedPlanDate && weekDays.length) setSelectedPlanDate(weekDays.find((day) => day.isToday)?.key ?? weekDays[0].key);
  }, [selectedPlanDate, weekDays]);

  useEffect(() => {
    let active = true;
    let sessionAuthenticated = false;
    const loadAccount = async () => {
        const cachedProfile = readCachedSessionProfile();
        if (cachedProfile && active) {
          sessionAuthenticated = true;
          setDemoMode(false);
          setSessionStatus("authenticated");
          setProfile(cachedProfile);
          if (profileOpen) setProfileDraft(profileDraftFrom(cachedProfile));
        }
        const sessionResponse = await fetch("/api/session", { cache: "no-store" });
        if (sessionResponse.status === 428) {
          if (!active) return;
          clearCachedSessionProfile();
          const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          window.location.replace(`/ingresar?return_to=${encodeURIComponent(returnTo)}`);
          return;
        }
        if (sessionResponse.status === 401 || sessionResponse.status === 403) {
          if (!active) return;
          clearCachedSessionProfile();
          sessionAuthenticated = false;
          setDemoMode(true);
          setSessionStatus("guest");
          setAccountDataReady(true);
          setCanvasDataReady(true);
          try {
            const platform = currentCanvasSizePlatform();
            const stored = JSON.parse(localStorage.getItem("forme-demo-canvas-sizes-v2") || "{}");
            const legacy = JSON.parse(localStorage.getItem("forme-demo-canvas-sizes-v1") || "{}");
            const preferences = { mobile: stored.mobile ?? {}, desktop: { ...legacy, ...(stored.desktop ?? {}) } };
            setGarments(items => items.map(item => ({
              ...item,
              canvasScaleMultiplier: preferences[platform]?.[item.id],
              canvasScaleMultipliers: { mobile: preferences.mobile?.[item.id], desktop: preferences.desktop?.[item.id] },
            })));
          } catch { /* No saved guest sizes. */ }
          try {
            const storedLooks = localStorage.getItem(demoLooksStorageKey);
            setSavedLooks(storedLooks ? JSON.parse(storedLooks) as SavedLook[] : []);
          } catch {
            setSavedLooks([]);
          }
          try {
            const storedWeek = productFeatures.weeklyPlanner ? localStorage.getItem(demoWeekStorageKey) : null;
            setWeeklyPlan(storedWeek ? JSON.parse(storedWeek) as WeeklyPlanEntry[] : []);
          } catch {
            setWeeklyPlan([]);
          }
          setWardrobeError("");
          return;
        }
        if (!sessionResponse.ok) throw new Error("No se pudo revisar tu sesión.");
        const session = await sessionResponse.json() as { user: WardrobeProfile };
        if (!active) return;
        sessionAuthenticated = true;
        setDemoMode(false);
        setSessionStatus("authenticated");
        setProfile(session.user);
        if (profileOpen) setProfileDraft(profileDraftFrom(session.user));
        cacheSessionProfile(session.user);
        const batchesReady = fetch("/api/batches/status", { cache: "no-store" }).catch(() => null);
        const [wardrobeResponse, outfitsResponse, weekResponse, styleProfileResponse] = await Promise.all([
          batchesReady.then(() => fetch("/api/wardrobe", { cache: "no-store" })),
          fetch("/api/outfits", { cache: "no-store" }),
          productFeatures.weeklyPlanner ? fetch("/api/week", { cache: "no-store" }) : Promise.resolve(null),
          fetch("/api/style-profile", { cache: "no-store" }),
        ]);
        if (!wardrobeResponse.ok) throw new Error((await wardrobeResponse.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo abrir tu closet.");
        const wardrobe = await wardrobeResponse.json() as { garments: ApiGarment[]; canvasSizes?: Partial<Record<CanvasSizePlatform, Record<string, number>>> };
        const outfits = outfitsResponse.ok
          ? await outfitsResponse.json() as { outfits: SavedLook[] }
          : { outfits: [] };
        const week = weekResponse?.ok
          ? await weekResponse.json() as { entries: WeeklyPlanEntry[] }
          : { entries: [] };
        const loadedStyleProfile = styleProfileResponse.ok
          ? (await styleProfileResponse.json() as { profile: StyleProfile }).profile
          : { audience: "hombre" as const, exploration: 35, completed: false, ratings: [] };
        if (!active) return;
        const isLocalOwnerPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
        const ownerCatalogEnabled = Boolean(session.user.isOwner || isLocalOwnerPreview);
        const baseGarments = ownerCatalogEnabled ? starterGarments : formeBasics;
        const platform = currentCanvasSizePlatform();
        const loadedGarments = mergeApiGarments(baseGarments, wardrobe.garments).map(garment => {
          const canvasScaleMultipliers = { mobile: wardrobe.canvasSizes?.mobile?.[garment.id], desktop: wardrobe.canvasSizes?.desktop?.[garment.id] };
          return { ...garment, canvasScaleMultiplier: canvasScaleMultipliers[platform], canvasScaleMultipliers };
        });
        const loadedGarmentById = new Map(loadedGarments.map((item) => [item.id, item]));
        const normalizedLooks = outfits.outfits.map((look) => ({
          ...look,
          items: look.items.map((item) => normalizedCanvasPiece(item, loadedGarmentById.get(item.garmentId))),
        }));
        setCanvasDataReady(true);
        setGarments(loadedGarments);
        setSavedLooks(normalizedLooks);
        setWeeklyPlan(week.entries);
        setStyleProfile(loadedStyleProfile);
        setAccountDataReady(true);
        setStyleOnboardingOpen(productFeatures.styleTest && !loadedStyleProfile.completed);
        setWardrobePanel(initialWardrobePanel);
        void Promise.all(wardrobe.garments.map((item) => finalizePendingCutouts(item))).catch(() => null);
        const savedLook = normalizedLooks.find((outfit) => outfit.id === currentOutfitId);
        if (savedLook?.items.length) {
          autoPlacedIds.current.clear();
          setCanvasPieces(savedLook.items);
          setActiveOutfitId(savedLook.id);
          setActiveLookName(savedLook.name);
          setSaved(true);
        } else {
          const initialPieces = (ownerCatalogEnabled ? initialCanvas : initialDemoCanvas)
            .filter(piece => session.user.includeFormeBasics || loadedGarmentById.get(piece.garmentId)?.collection !== "forme");
          autoPlacedIds.current = new Set(initialPieces.map(piece => piece.instanceId));
          setCanvasPieces(initialPieces);
          setActiveOutfitId(null);
          setActiveLookName("Nuevo look");
          setSaved(false);
        }
        setWardrobeError("");
    };
    void loadAccount().catch((error: unknown) => {
      if (!active) return;
      setDemoMode(!sessionAuthenticated);
      setSessionStatus(sessionAuthenticated ? "authenticated" : "guest");
      setAccountDataReady(true);
      setWardrobeError(error instanceof Error ? error.message : "No se pudo abrir tu closet.");
    });
    return () => { active = false; };
  // The initial hydration intentionally runs once; pending cutouts are idempotent and guarded by a ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (view !== "studio" || !canvas) return;
    const alignNewPieces = () => {
      const frame = currentLayoutFrame();
      setCanvasPieces(items => {
        let changed = false;
        const next = items.map(piece => {
          const garment = garmentById.get(piece.garmentId);
          if (!garment || !autoPlacedIds.current.has(piece.instanceId)) return piece;
          const placement = defaultPlacement(garment, piece.variant, frame);
          if (Math.abs(piece.x - placement.x) + Math.abs(piece.y - placement.y) + Math.abs(piece.scale - placement.scale) < 0.00001) return piece;
          changed = true;
          return { ...piece, ...placement };
        });
        return changed ? next : items;
      });
    };
    alignNewPieces();

  }, [view, canvasPieces.length, garmentById]);

  useEffect(() => {
    const syncRouteFromHistory = () => {
      const routePath = window.location.pathname.replace(/^\//, "");
      const route = routePath as WardrobeRoute;
      if (["closet", "looks", "canvas", "perfil", "ajustes", "asistente"].includes(route)) applyWardrobeRoute(route);
      if (route === "closet" && new URLSearchParams(window.location.search).get("view") === "upload") setClosetMode("upload");
    };
    syncRouteFromHistory();
    window.addEventListener("popstate", syncRouteFromHistory);
    return () => window.removeEventListener("popstate", syncRouteFromHistory);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    setProfileDraft(profileDraftFrom(profile));
    setProfileSaveError("");
    setProfileSaved(false);
    const closeProfileOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeProfileRoute();
    };
    window.addEventListener("keydown", closeProfileOnEscape);
    return () => window.removeEventListener("keydown", closeProfileOnEscape);
  // Opening the route initializes the editable draft. Subsequent changes belong to the draft itself.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileOpen]);

  useEffect(() => {
    if (!profileOpen || sessionStatus !== "authenticated") return;
    let active = true;
    const refreshProfile = async () => {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (!response.ok) return;
        const { user } = await response.json() as { user: WardrobeProfile };
        if (!active) return;
        setProfile((current) => ({
          ...current,
          joinedAt: user.joinedAt,
          isTester: user.isTester,
          credits: user.credits,
          referralCode: user.referralCode,
          referralCount: user.referralCount,
          referralCredits: user.referralCredits,
          onboardingCompleted: user.onboardingCompleted,
        }));
      } catch { /* Keep the last confirmed balance when offline. */ }
    };
    void refreshProfile();
    window.addEventListener("focus", refreshProfile);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshProfile);
    };
  }, [profileOpen, sessionStatus]);

  function updateArchiveFilter(key: FilterKey, next: string) {
    setArchiveFilters((current) => ({ ...current, [key]: next, ...(key === "colorFamily" ? { tone: "All" } : {}) }));
  }

  function signOut() {
    clearCachedSessionProfile();
    try { sessionStorage.removeItem(`forme-canvas-draft-v1:${profile.handle}`); } catch { /* Logout works without storage. */ }
    window.location.replace("/auth/logout?return_to=%2Fcloset");
  }

  function beginGoogleSignIn() {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const login = new URL("/auth/google/start", window.location.origin);
    login.searchParams.set("return_to", returnTo || "/closet");
    window.location.assign(`${login.pathname}${login.search}`);
  }

  function beginOnboardingSignIn() {
    try { sessionStorage.setItem("forme-product-onboarding-resume-v1", "1"); } catch { /* Sign-in still works without storage. */ }
    beginGoogleSignIn();
  }

  function dismissProductOnboarding() {
    const storageKey = `forme-product-onboarding-dismissed-v1:${sessionStatus === "authenticated" ? profile.id || profile.handle : "guest"}`;
    try { localStorage.setItem(storageKey, "1"); } catch { /* Dismissal only needs to last for this render. */ }
    setProductOnboardingOpen(false);
  }

  function openProductOnboarding() {
    setProductOnboardingStep(0);
    setProductOnboardingOpen(true);
  }

  async function completeProductOnboarding() {
    const response = await fetch("/api/onboarding/complete", { method: "POST" });
    const result = await response.json().catch(() => null) as { completed?: boolean; rewarded?: boolean; credits?: number; error?: string } | null;
    if (!response.ok || !result?.completed || typeof result.credits !== "number") throw new Error(result?.error || "No pudimos activar tus créditos. Intenta otra vez.");
    const nextProfile = { ...profile, onboardingCompleted: true, credits: result.credits };
    setProfile(nextProfile);
    cacheSessionProfile(nextProfile);
    try {
      sessionStorage.removeItem("forme-product-onboarding-resume-v1");
      localStorage.removeItem(`forme-product-onboarding-dismissed-v1:${profile.id || profile.handle}`);
    } catch { /* Server completion remains authoritative. */ }
    return { rewarded: Boolean(result.rewarded), credits: result.credits };
  }

  function finishProductOnboarding() {
    setProductOnboardingOpen(false);
    if (sessionStatus === "authenticated") openUpload();
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
      if (!result.profile.includeFormeBasics) {
        setCatalogSource("personal");
        setLibrarySource("personal");
      }
      cacheSessionProfile(result.profile);
      setProfileDraft(profileDraftFrom(result.profile));
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
      if (navigator.share) {
        await navigator.share({ title: `${profile.name} en Formé`, text: `Mira mi closet en Formé`, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
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

  function openGarmentEditor(item: Garment, edit = false) {
    setGarmentEditing(edit);
    setGarmentDraft({
      id: item.id,
      name: translateGarmentName(item.name),
      lengthOverride: item.lengthOverride ?? null,
      description: item.description ?? "",
      brand: item.brand ?? "",
      category: item.category,
      garmentType: item.garmentType,
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

  function normalizeGarmentMetadata(
    key: "brand" | "colorFamily" | "material",
    options: string[],
    fallback = "",
  ) {
    setGarmentDraft((current) => {
      if (!current) return current;
      const next = (
        key === "brand"
          ? canonicalAutocompleteValue(current[key], options)
          : canonicalTranslatedAutocompleteValue(current[key], options)
      ) || fallback;
      if (key !== "colorFamily") return { ...current, [key]: next };
      const availableTones = filterOptions.tonesByColor[next] ?? [];
      const currentToneIsValid = availableTones.some((tone) => tone.toLocaleLowerCase() === current.tone.toLocaleLowerCase());
      return {
        ...current,
        colorFamily: next,
        tone: availableTones.length > 0 && !currentToneIsValid ? availableTones[0] : current.tone,
      };
    });
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
    if (!garmentDraft || savingGarment) return;
    const previous = garments.find(item => item.id === garmentDraft.id);
    setSavingGarment(true);
    const { id, ...edit } = garmentDraft;
    const normalized = {
      ...edit,
      name: edit.name.trim() || "Prenda sin nombre",
      brand: canonicalAutocompleteValue(edit.brand, brandOptions),
      colorFamily: canonicalTranslatedAutocompleteValue(edit.colorFamily, colorOptions) || "Other",
      tone: edit.tone.trim() || "Unclassified",
      material: canonicalTranslatedAutocompleteValue(edit.material, materialOptions) || "Other",
    };
    setGarments((items) => items.map((item) => item.id === id
      ? { ...item, ...normalized, color: normalized.tone }
      : item));
    setGarmentSaveError("");
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
      setGarmentDraft(current => current ? { ...current, ...normalized, lengthOverride: result.garment?.lengthOverride ?? null } : current);
      setGarmentSaved(true);
    } catch (error) {
      if (previous) setGarments(items => items.map(item => item.id === previous.id ? previous : item));
      setGarmentSaveError(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    } finally { setSavingGarment(false); }
  }

  async function setGarmentVisibility(item: Garment, isPublic: boolean) {
    if (savingGarment || item.collection === "forme") return;
    setSavingGarment(true);
    setGarmentSaveError("");
    setGarmentSaved(false);
    try {
      const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...apiPayload(item), isPublic }),
      });
      const result = await response.json().catch(() => null) as { garment?: ApiGarment; error?: string } | null;
      if (!response.ok || !result?.garment) throw new Error(result?.error || "No se pudo cambiar la visibilidad de la prenda.");
      setGarments((items) => mergeApiGarments(items, [result.garment as ApiGarment]));
      setGarmentDraft((current) => current?.id === item.id ? { ...current, isPublic: Boolean(result.garment?.isPublic) } : current);
    } catch (error) {
      setGarmentSaveError(error instanceof Error ? error.message : "No se pudo cambiar la visibilidad de la prenda.");
    } finally { setSavingGarment(false); }
  }

  async function toggleFavorite(item: Garment) {
    const next = { ...item, favorite: !item.favorite };
    setGarments((items) => items.map((garment) => garment.id === item.id ? next : garment));
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

  function deleteGarment(item: Garment) { setPendingDelete({ kind: "garment", id: item.id, name: translateGarmentName(item.name) }); }

  async function performDeleteGarment(item: Garment) {
    setGarments((items) => items.filter((garment) => garment.id !== item.id));
    setCanvasPieces((items) => items.filter((piece) => piece.garmentId !== item.id));
    setGarmentDraft(null);
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

  function routeForPanel(panel: WardrobePanel): "closet" | "looks" | "asistente" {
    return panel === "looks" ? "looks" : panel === "assistant" ? "asistente" : "closet";
  }

  function applyWardrobeRoute(route: WardrobeRoute) {
    setActiveRoute(route);
    if (route === "canvas") {
      setProfileOpen(false);
      setView("studio");
      return;
    }
    if (route === "perfil" || route === "ajustes") {
      setView("wardrobe");
      setProfileOpen(true);
      return;
    }
    setProfileOpen(false);
    setView("wardrobe");
    setWardrobePanel(route === "looks" ? "looks" : route === "asistente" ? "assistant" : "closet");
    if (route === "closet") setClosetMode("browse");
    setSavedLooksOpen(false);
  }

  function navigateWardrobeRoute(route: WardrobeRoute) {
    routeScroll.current.set(activeRoute, window.scrollY);
    if (route === "perfil" || route === "ajustes") {
      if (!profileOpen) profileReturnRoute.current = view === "studio" ? "canvas" : routeForPanel(wardrobePanel);
    }
    applyWardrobeRoute(route);
    requestAnimationFrame(() => window.scrollTo({ top: routeScroll.current.get(route) ?? 0, behavior: "instant" }));
    const nextPath = `/${route}`;
    if (window.location.pathname + window.location.search !== nextPath) window.history.pushState({ formeRoute: route }, "", nextPath);
  }

  function closeProfileRoute() {
    navigateWardrobeRoute(profileReturnRoute.current);
  }

  function openStudio(returnPanel: WardrobePanel = wardrobePanel) {
    if (view !== "studio") routeScroll.current.set(activeRoute, window.scrollY);
    setStudioReturnPanel(returnPanel);
    setProfileOpen(false);
    setView("studio");
    setActiveRoute("canvas");
    if (window.location.pathname !== "/canvas") window.history.pushState({ formeRoute: "canvas" }, "", "/canvas");
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
      if (item.preview.startsWith("blob:")) URL.revokeObjectURL(item.preview);
    });
    setUploadItems([]);
    setUploadNotice("");
    setUploadIntakeBatchId(null);
    setUploadBatchSummary(null);
    if (fileInput.current) fileInput.current.value = "";
    setUploadError("");
  }

  async function acceptFiles(source: FileList | File[] | undefined) {
    if (uploadIntakeBatchId || preparingUploadRef.current) return;
    const incoming = Array.from(source ?? []);
    if (!incoming.length) return;
    preparingUploadRef.current = true;
    setPreparingUploads(true);
    setUploadError("");
    setUploadNotice("");
    const existing = new Set(uploadItems.map(item => uploadFingerprint(item.file)));
    const accepted: UploadItem[] = [];
    const errors: string[] = [];
    let duplicates = 0;
    try {
      for (const file of incoming) {
        const fingerprint = uploadFingerprint(file);
        if (existing.has(fingerprint)) { duplicates++; continue; }
        const error = uploadFileError(file);
        if (error) { errors.push(`${file.name}: ${error}`); continue; }
        try {
          const processingFile = await processingFileFor(file);
          accepted.push({ id: crypto.randomUUID(), file, processingFile, preview: URL.createObjectURL(processingFile), name: file.name, status: "ready" });
          existing.add(fingerprint);
        } catch (error) { errors.push(`${file.name}: ${error instanceof Error ? error.message : "No se pudo abrir."}`); }
      }
      setUploadItems(items => [...items, ...accepted]);
      setUploadError(errors.join("\n"));
      if (duplicates) setUploadNotice(`${duplicates} ${duplicates === 1 ? "foto repetida omitida" : "fotos repetidas omitidas"}.`);
    } finally {
      preparingUploadRef.current = false;
      setPreparingUploads(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function updateUploadItem(id: string, patch: Partial<UploadItem>) {
    setUploadItems((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function removeUploadItem(id: string) {
    const item = uploadItems.find((candidate) => candidate.id === id);
    if (item?.preview.startsWith("blob:")) URL.revokeObjectURL(item.preview);
    setUploadItems((items) => items.filter((candidate) => candidate.id !== id));
    setUploadIntakeBatchId(null);
    setUploadBatchSummary(null);
    setUploadError("");
  }

  async function ghostGarments() {
    const pending = uploadItems.filter((item) => item.status === "ready" || item.status === "failed" || item.status === "review");
    if (!pending.length || preparingUploadRef.current || uploadingBatch) return;
    let intakeBatchId = uploadIntakeBatchId;
    if (!intakeBatchId) {
      const nextBatchId = crypto.randomUUID();
      try {
        const intakeResponse = await fetch("/api/intake-batches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clientId: nextBatchId,
            items: uploadItems.map((item) => ({
              clientItemId: item.id,
              filename: item.file.name,
              fingerprint: uploadFingerprint(item.file),
            })),
          }),
        });
        const intakeResult = await intakeResponse.json().catch(() => null) as { batch?: IntakeBatchSummary; error?: string } | null;
        if (!intakeResponse.ok || !intakeResult?.batch) throw new Error(intakeResult?.error || "No se pudo iniciar la subida. Vuelve a intentarlo.");
        intakeBatchId = nextBatchId;
        setUploadIntakeBatchId(nextBatchId);
        setUploadBatchSummary(intakeResult.batch);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "No se pudo iniciar la subida. Vuelve a intentarlo.");
        return;
      }
    }
    setUploadingBatch(true);
    setUploadError("");
    pending.forEach((item) => updateUploadItem(item.id, { status: "uploading", error: undefined }));

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
        const processingFile = item.processingFile;
        const body = new FormData();
        body.append("file", processingFile);
        body.append("original", item.file);
        body.append("intakeBatchId", intakeBatchId);
        body.append("intakeItemId", item.id);
        if (useDiscountedBatch) body.append("processingMode", "batch");
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
        const message = error instanceof Error ? error.message : "No se pudo cargar";
        updateUploadItem(item.id, { status: "failed", error: message });
        if (!item.garmentId) {
          await fetch(`/api/intake-batches/${encodeURIComponent(intakeBatchId)}/items/${encodeURIComponent(item.id)}/fail`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: message }),
          }).catch(() => null);
        }
      }
    }

    if (useDiscountedBatch && remote.size > 0) {
      try {
        let batchResult: { batch?: { status?: string }; fallback?: string; recognizing?: boolean; error?: string } | null = null;
        for (let recognitionAttempt = 0; recognitionAttempt < 90; recognitionAttempt += 1) {
        const batchResponse = await fetch("/api/batches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ garmentIds: [...remote.values()] }),
        });
        batchResult = await batchResponse.json().catch(() => null) as { batch?: { status?: string }; fallback?: string; recognizing?: boolean; error?: string } | null;
        if (!batchResponse.ok) throw new Error(batchResult?.error || "No se pudieron procesar las prendas.");
        if (!batchResult?.recognizing) break;
        await Promise.all([...remote.entries()].map(async ([localId, garmentId]) => {
          const check = await fetch(`/api/garments/${encodeURIComponent(garmentId)}/status`, { cache: "no-store" });
          const result = await check.json() as { garment?: ApiGarment };
          if (result.garment) {
            setGarments(items => mergeApiGarments(items, [result.garment!]));
            if (result.garment.metadataStatus === "ready") updateUploadItem(localId, { name: result.garment.name });
          }
        }));
        await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (batchResult?.recognizing) throw new Error("El reconocimiento sigue pendiente. Reintenta cuando termine.");
        remote.forEach((_, localId) => updateUploadItem(localId, {
          status: "processing",
          error: batchResult?.fallback ? undefined : "Puede tardar hasta 24 h",
        }));
      } catch (error) {
        failedCount += remote.size;
        remote.forEach((_, localId) => updateUploadItem(localId, { status: "failed", error: error instanceof Error ? error.message : "No se pudieron procesar las prendas" }));
        remote.clear();
      }
    }

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
        if (updatedGarment.metadataStatus === "ready") updateUploadItem(localId, { name: updatedGarment.name });
        if (updatedGarment.status === "ready" && updatedGarment.metadataStatus !== "pending") {
          updateUploadItem(localId, { status: "done", error: undefined });
          remote.delete(localId);
        } else if (updatedGarment.status === "review" || statusResult.job?.status === "review") {
          failedCount += 1;
          updateUploadItem(localId, { status: "review", error: "No pudimos comprobar que la imagen sea fiel a tu prenda. Reintenta." });
          remote.delete(localId);
        } else if (statusResult.job?.status === "failed" || statusResult.garment.status === "failed") {
          failedCount += 1;
          updateUploadItem(localId, { status: "failed", error: "Vuelve a intentarlo." });
          remote.delete(localId);
        }
      }
    }
    if (remote.size > 0) {
      remote.forEach((_, localId) => updateUploadItem(localId, { status: "processing", error: useDiscountedBatch ? "Puede tardar hasta 24 h" : undefined }));
    }
    try {
      const summaryResponse = await fetch(`/api/intake-batches/${encodeURIComponent(intakeBatchId)}`, { cache: "no-store" });
      const summaryResult = await summaryResponse.json().catch(() => null) as { batch?: IntakeBatchSummary } | null;
      if (summaryResponse.ok && summaryResult?.batch) setUploadBatchSummary(summaryResult.batch);
    } catch { /* El estado individual sigue visible aunque falle el resumen. */ }
    if (!failedCount && waitingCount) setUploadNotice(waitingCount === 1 ? "La prenda quedó guardada y se procesará cuando el servicio esté disponible." : `${waitingCount} prendas quedaron guardadas y se procesarán cuando el servicio esté disponible.`);
    setUploadingBatch(false);
  }

  useEffect(() => {
    if (!canvasDataReady) return;
    const key = `forme-canvas-draft-v1:${demoMode ? "guest" : profile.handle}`;
    if (restoredDraftKey.current !== key) {
      restoredDraftKey.current = key;
      try {
        const payload = JSON.parse(sessionStorage.getItem(key) ?? "null");
        const draft = readCanvasDraft(payload?.document);
        if (draft && draft.items.every(item => garmentById.has(item.garmentId))) {
          history.current.past = (Array.isArray(payload?.history) ? payload.history : []).map(readCanvasDraft).filter((item: CanvasDocument | null): item is CanvasDocument => Boolean(item && item.items.every(piece => garmentById.has(piece.garmentId)))).slice(-20);
          restoreDocument(draft);
          return;
        }
      } catch { /* A malformed or unavailable local draft does not block the closet. */ }
    }
    try { sessionStorage.setItem(key, JSON.stringify({ document: currentDocument.current, history: history.current.past.slice(-20) })); }
    catch { /* Private browsing may disallow session storage. */ }
  }, [canvasDataReady, demoMode, profile.handle, canvasPieces, activeOutfitId, activeLookName, historyRevision]);

  useEffect(() => {
    if (view !== "studio" || garmentDraft) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true]")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault(); travelHistory(event.shiftKey ? "redo" : "undo");
      }
      if (event.key === "Escape") { setSelectedId(""); setSelectedGroupIds([]); setSavedLooksOpen(false); setLayersOpen(false); setReplacingId(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, garmentDraft, savedLooks]);

  function checkpoint() {
    history.current.checkpoint(currentDocument.current);
    setHistoryRevision(value => value + 1);
  }

  function restoreDocument(document: CanvasDocument) {
    canvasGestures.current?.cancel();
    documentGeneration.current += 1;
    autoPlacedIds.current.clear();
    setCanvasPieces(snapshotLook(document.items));
    setActiveOutfitId(document.id);
    setActiveLookName(document.name);
    setSelectedId(""); setSelectedGroupIds([]); setLockedPieceIds(ids => new Set([...ids].filter(id => document.items.some(item => item.instanceId === id)))); setReplacingId(null);
    const stored = savedLooks.find(look => look.id === document.id);
    setSaved(Boolean(stored && sameDocument(document, { items: stored.items, id: stored.id, name: stored.name })));
  }

  function travelHistory(direction: "undo" | "redo") {
    if (savingOutfit) return;
    const document = history.current[direction](currentDocument.current);
    if (document) restoreDocument(document);
    setHistoryRevision(value => value + 1);
  }

  function newLook() {
    if (savingOutfit) return;
    checkpoint();
    restoreDocument({ items: [], id: null, name: "Nuevo look" });
    setClearedLook(null);
    openStudio("looks");
  }

  function openUpload() {
    navigateWardrobeRoute("closet");
    setClosetMode("upload");
    window.history.pushState({ formeRoute: "closet" }, "", "/closet?view=upload");
  }

  function togglePanel(panel: "looks" | "layers") {
    if (panel === "looks") { setSavedLooksOpen(open => !open); setLayersOpen(false); }
    else { setLayersOpen(open => !open); setSavedLooksOpen(false); }
  }

  function changeLayer(instanceId: string, direction: "up" | "down") {
    checkpoint();
    setCanvasPieces(items => moveCanvasLayer(items, instanceId, direction));
    setSaved(false);
  }

  async function addToCanvas(garmentId: string) {
    const garment = garmentById.get(garmentId);
    if (!garment || savingOutfit) return;
    const replacementId = replacingId ?? selectedId;
    const generationAtStart = documentGeneration.current;
    try { await prepareCanvasGarment(garment); }
    catch { setWardrobeError("No se pudo medir esta prenda. Vuelve a intentarlo."); return; }
    if (documentGeneration.current !== generationAtStart) return;
    checkpoint();
    setClearedLook(null);
    if (window.innerWidth <= 699) { setLayersOpen(false); setSavedLooksOpen(false); }
    const selectedPiece = replacementId ? latestCanvasPieces.current.find((item) => item.instanceId === replacementId) : undefined;
    setReplacingId(null);
    const selectedGarment = selectedPiece ? garmentById.get(selectedPiece.garmentId) : undefined;

    if (selectedPiece && selectedGarment) {
      const variant = garment.openImage ? "open" as const : "closed" as const;
      const placement = autoPlacedIds.current.has(selectedPiece.instanceId)
        ? defaultPlacement(garment, variant)
        : replacementPlacement(selectedPiece, selectedGarment, garment, variant, false);
      const next = latestCanvasPieces.current.map((item) => item.instanceId === selectedPiece.instanceId
        ? {
            ...item,
            garmentId,
            variant,
            ...placement,
          }
        : item);
      latestCanvasPieces.current = next;
      setCanvasPieces(next);
      setSelectedId(selectedPiece.instanceId);
      setSelectedGroupIds([]);
      setSaved(false);
      return;
    }

    const instanceId = crypto.randomUUID();
    autoPlacedIds.current.add(instanceId);
    const variant = garment.openImage ? "open" as const : "closed" as const;
    const placement = defaultPlacement(garment, variant);
    const current = latestCanvasPieces.current;
    const top = Math.max(0, ...current.map(item => item.z)) + 1;
    const next = [...current, {
        instanceId,
        garmentId,
        variant,
        x: placement.x,
        y: placement.y,
        scale: placement.scale,
        rotation: 0,
        z: top,
      }];
    latestCanvasPieces.current = next;
    setCanvasPieces(next);
    setSelectedId(instanceId);
    setSelectedGroupIds([]);
    setSaved(false);
  }

  async function addAndOpenStudio(garmentId: string) {
    await addToCanvas(garmentId);
    openStudio("closet");
  }

  function beginReplacingPiece(instanceId: string) {
    setReplacingId(instanceId); setStudioLibraryFilter("all"); setLibraryQuery("");
    setLayersOpen(false); setSavedLooksOpen(false);
    if (window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)").matches) {
      requestAnimationFrame(() => document.getElementById("canvas-garment-library")?.scrollIntoView({ block: "nearest" }));
    }
  }

  function gesturePoint(event: ReactPointerEvent<HTMLDivElement>): GesturePoint {
    return { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, touch: event.pointerType === "touch" };
  }

  function startCanvasGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gestures = canvasGestures.current!;
    if (savingOutfit || event.button !== 0) return;
    const directElement = event.target instanceof Element ? event.target.closest<HTMLElement>(".canvas-piece") : null;
    const pieceElements = Array.from(canvasRef.current?.querySelectorAll<HTMLElement>(".canvas-piece") ?? []);
    const candidates = pieceElements.map((element, order) => {
      const rect = element.getBoundingClientRect();
      const alpha = (element.dataset.alphaBounds ?? "").split(",").map(Number);
      const visible = visibleGarmentBounds(rect, { width: element.offsetWidth, height: element.offsetHeight }, alpha,
        new DOMMatrixReadOnly(getComputedStyle(element).transform));
      return { id: element.dataset.instanceId ?? "", z: Number(element.style.zIndex) || 0, order, rect: visible };
    }).filter(candidate => candidate.id);
    const hitId = topCanvasPieceAtPoint(candidates, event.clientX, event.clientY, event.pointerType === "touch" ? 10 : 2);
    const element = pieceElements.find(candidate => candidate.dataset.instanceId === hitId) ?? directElement;
    const piece = currentDocument.current.items.find(item => item.instanceId === element?.dataset.instanceId);
    const frame = canvasRef.current?.getBoundingClientRect();
    if (!gestures.active && (!piece || !frame)) return;
    const handled = gestures.down(gesturePoint(event), piece && frame ? { id: piece.instanceId, geometry: piece, frame } : undefined);
    if (!handled) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveCanvasGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canvasGestures.current?.has(event.pointerId)) return;
    event.preventDefault(); event.stopPropagation();
    canvasGestures.current.move(gesturePoint(event));
  }

  function endCanvasGesture(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    if (!canvasGestures.current?.has(event.pointerId)) return;
    event.preventDefault(); event.stopPropagation();
    canvasGestures.current.up(gesturePoint(event), cancelled);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function startMarqueeSelection(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest(".canvas-piece,.canvas-piece-ui,button,input,select")) return;
    if (event.button !== 0) return;
    setSelectedId("");
    setSelectedGroupIds([]);
    setReplacingId(null);
    if (event.pointerType === "touch" || window.innerWidth <= 900) return;
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
    const pieceElement = Array.from(canvasRef.current?.querySelectorAll<HTMLElement>(".canvas-piece") ?? [])
      .find(element => element.dataset.instanceId === instanceId);
    if (!piece || savingOutfit || !(pieceElement instanceof HTMLElement)) return;
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
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    setSelectedId(instanceId);
  }

  function moveTransformHandle(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = transformHandleSession.current;
    if (!session || session.pointerId !== event.pointerId || savingOutfit) return;
    if (!session.moved) {
      if (Math.hypot(event.clientX - session.startX, event.clientY - session.startY) < 2) return;
      checkpoint(); session.moved = true;
      autoPlacedIds.current.delete(session.instanceId);
    }
    event.preventDefault();
    event.stopPropagation();
    if (session.mode === "scale") {
      const distance = Math.hypot(event.clientX - session.centerX, event.clientY - session.centerY);
      const scale = clamp(session.startScale * (distance / session.startDistance), 0.08, 1.35);
      session.lastScale = scale;
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
    const session = transformHandleSession.current;
    if (session?.pointerId !== event.pointerId) return;
    transformHandleSession.current = null;
    if (event.type !== "pointercancel" && session.mode === "scale" && session.lastScale !== undefined && Math.abs(session.lastScale - session.startScale) > 0.00001) {
      rememberCanvasSize.current(session.instanceId, session.lastScale);
    }
  }

  function adjustPieceWithKeyboard(instanceId: string, field: "rotation" | "scale", delta: number) {
    const piece = currentDocument.current.items.find(item => item.instanceId === instanceId);
    if (!piece || savingOutfit) return;
    const value = field === "rotation" ? normalizeDegrees(piece.rotation + delta) : clamp(piece.scale + delta, .08, 1.35);
    if (piece[field] === value) return;
    checkpoint(); autoPlacedIds.current.delete(instanceId);
    if (field === "scale") keyboardSizes.current.set(instanceId, value);
    setCanvasPieces(items => items.map(item => item.instanceId === instanceId ? { ...item, [field]: value } : item));
    setSaved(false);
  }

  function removePiece(instanceId: string) {
    checkpoint();
    autoPlacedIds.current.delete(instanceId);
    setLockedPieceIds(ids => new Set([...ids].filter(id => id !== instanceId)));
    setCanvasPieces((items) => items.filter((item) => item.instanceId !== instanceId));
    setSelectedId((current) => current === instanceId ? "" : current);
    setSelectedGroupIds((current) => current.filter((id) => id !== instanceId));
    setSaved(false);
  }

  function duplicatePiece(instanceId: string) {
    checkpoint();
    const source = canvasPieces.find((item) => item.instanceId === instanceId);
    if (!source) return;
    const instanceIdCopy = crypto.randomUUID();
    setCanvasPieces((items) => {
      const above = items.filter(item => item.z > source.z).sort((a, b) => a.z - b.z)[0];
      const top = above ? (source.z + above.z) / 2 : source.z + 1;
      return [...items, {
        ...source,
        instanceId: instanceIdCopy,
        x: clamp(source.x + 4, 4, 96),
        y: clamp(source.y + 4, 4, 96),
        z: top,
      }].sort((a, b) => a.z - b.z).map((item, index) => ({ ...item, z: index + 1 }));
    });
    setSelectedId(instanceIdCopy);
    setSelectedGroupIds([]);
    setSaved(false);
  }

  function answerAssistantFollowup(preset: AssistantPreset, followup: AssistantFollowup, avoidCurrentRecommendations = false) {
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
    const avoidedGarmentIds = new Set(
      avoidCurrentRecommendations
        ? stylingRecommendations.flatMap((recommendation) => recommendation.items.map((item) => item.garmentId))
        : [],
    );
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
      : buildStylingRecommendations(assistantGarments, followup.code, followup.moment, followup.occasion, excludedSignatures, styleProfile, priorityGarmentIds, avoidedGarmentIds);
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
    if (followup) answerAssistantFollowup(selectedAssistantPreset, followup, true);
  }

  function generateLooksQuickly() {
    const preset = assistantPresets.find((item) => item.id === "week");
    const followup = preset?.options.find((item) => item.id === "week-mixed");
    if (!preset || !followup) return;
    answerAssistantFollowup(preset, followup);
    navigateWardrobeRoute("asistente");
  }

  function toggleRandomLock(instanceId: string) {
    if (randomizingRef.current) return;
    setLockedPieceIds(ids => {
      const next = new Set(ids);
      if (next.has(instanceId)) next.delete(instanceId); else next.add(instanceId);
      return next;
    });
  }

  async function randomizeCurrentLook() {
    if (randomizingRef.current || savingOutfit) return;
    randomizingRef.current = true;
    setRandomizing(true);
    const snapshot = canvasPieces;
    const generationAtStart = documentGeneration.current;
    try {
      if (!snapshot.length) {
        const chosen = randomLookGarments(garments, Math.random, basicsEnabled);
        if (!chosen.length) {
          setWardrobeError("Añade prendas a tu closet para empezar a mezclar.");
          return;
        }
        await Promise.all(chosen.map(prepareCanvasGarment));
        if (latestCanvasPieces.current !== snapshot || documentGeneration.current !== generationAtStart) return;
        const next = chosen.map(garment => {
          const variant = garment.openImage ? "open" as const : "closed" as const;
          return { instanceId: crypto.randomUUID(), garmentId: garment.id, variant, ...defaultPlacement(garment, variant), rotation: 0, z: layerBase(garment.category) + 1 };
        });
        checkpoint();
        autoPlacedIds.current = new Set(next.map(piece => piece.instanceId));
        latestCanvasPieces.current = next;
        setCanvasPieces(next);
        setSelectedId(""); setSelectedGroupIds([]); setLockedPieceIds(new Set()); setReplacingId(null);
        setClearedLook(null);
        setSaved(false);
        setWardrobeError("");
        return;
      }
      const replacements = randomGarmentReplacements(garments, snapshot, lockedPieceIds, Math.random, basicsEnabled);
      if (!replacements.size) {
        setWardrobeError("No hay otras prendas para mezclar. Prueba a liberar alguna de las que mantuviste.");
        return;
      }
      await Promise.all([...replacements.values()].map(prepareCanvasGarment));
      // A drag, deletion or a newly opened look during measurement wins over
      // this pending randomization; never overwrite the user's newer changes.
      if (latestCanvasPieces.current !== snapshot || documentGeneration.current !== generationAtStart) return;
      const next = applyGarmentReplacements(snapshot, replacements, garmentById, lockedPieceIds, autoPlacedIds.current);
      checkpoint();
      latestCanvasPieces.current = next;
      setCanvasPieces(next);
      setSaved(false);
      setWardrobeError("");
    } catch {
      setWardrobeError("No se pudo preparar una de las prendas para mezclar.");
    } finally {
      randomizingRef.current = false;
      setRandomizing(false);
    }
  }

  async function saveStylingRecommendation(recommendation: StylingRecommendation) {
    if (savingOutfit) return;
    const outfitId = `look-${crypto.randomUUID()}`;
    const lookName = `${recommendation.name} · ${String(savedLooks.length + 1).padStart(2, "0")}`;
    const items = recommendation.items.map((item) => ({ ...item, instanceId: crypto.randomUUID() }));
    setSavingOutfit(true);
    setWardrobeError("");
    try {
      if (!demoMode) {
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
    checkpoint();
    documentGeneration.current += 1;
    setClearedLook(null);
    autoPlacedIds.current.clear();
    setCanvasPieces(snapshotLook(look.items));
    setSelectedId("");
    setSelectedGroupIds([]);
    setActiveOutfitId(look.id);
    setActiveLookName(look.name);
    setSaved(true);
    setLockedPieceIds(new Set());
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
      if (!demoMode) {
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
      if (!demoMode) {
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
      if (!demoMode) {
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
    const plannableLooks = savedLooks.filter((look) => lookMatchesAudience(look, garmentById, styleProfile?.audience));
    if (!plannableLooks.length || planningWeek) {
      if (!plannableLooks.length) {
        setWardrobeError(savedLooks.length ? "Tus looks guardados no coinciden con las preferencias de tu perfil." : "Guarda al menos un look antes de planear la semana.");
        setWardrobePanel("looks");
      }
      return;
    }
    const occasions: WeeklyOccasion[] = ["work", "work", "daily", "work", "dinner", "weekend", "weekend"];
    const currentFirstLookId = weeklyPlan.find((entry) => entry.date === weekDays[0]?.key)?.outfitId;
    const currentFirstLookIndex = currentFirstLookId ? plannableLooks.findIndex((look) => look.id === currentFirstLookId) : -1;
    const rotationOffset = currentFirstLookIndex >= 0 ? (currentFirstLookIndex + 1) % plannableLooks.length : 0;
    const nextWeek = weekDays.map((day, index) => ({
      date: day.key,
      outfitId: plannableLooks[(index + rotationOffset) % plannableLooks.length].id,
      occasion: occasions[index],
      worn: false,
    }));
    setPlanningWeek(true);
    setWardrobeError("");
    try {
      if (!demoMode) {
        const response = await fetch("/api/week", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entries: nextWeek }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo completar la semana.");
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
    setSavedLooksOpen(false);
  }

  function deleteSavedLook(lookId: string) {
    const look = savedLooks.find(item => item.id === lookId);
    if (look) setPendingDelete({ kind: "look", id: lookId, name: look.name });
  }

  async function performDeleteSavedLook(lookId: string) {
    if (deletingLookId || savingOutfit) return;
    setDeletingLookId(lookId);
    setWardrobeError("");
    try {
      if (!demoMode) {
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
    } finally {
      setDeletingLookId(null);
    }
  }

  function openShareTemplate(target: ShareTarget) {
    setShareOptions({ labelMode: target.kind === "look" ? "name" : "name-brand", includeHandle: true, includeGarmentList: target.kind === "look" });
    setShareTarget(target);
  }

  async function exportShareTemplate() {
    if (!shareTarget || shareBusy) return;
    setShareBusy(true);
    setWardrobeError("");
    try {
      const blob = shareTarget.kind === "look"
        ? await createInstagramStoryBlob(shareTarget.look, garmentById, shareOptions, profile.handle)
        : shareTarget.kind === "garment"
          ? await createGarmentStoryBlob(shareTarget.garment, shareOptions, profile.handle)
          : await createClosetStoryBlob(shareTarget.garments, shareOptions, profile.handle);
      const baseName = shareTarget.kind === "look" ? shareTarget.look.name : shareTarget.kind === "garment" ? shareTarget.garment.name : "mi-closet";
      const file = new File([blob], storyFileName(baseName), { type: "image/png" });
      const canUseNativeShare = typeof navigator.share === "function"
        && (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));
      if (canUseNativeShare) {
        try {
          await navigator.share({
            files: [file],
            title: `${baseName} - Formé`,
            text: shareOptions.includeHandle ? `${shareHandle(profile.handle)} en Formé` : "Creado en Formé",
          });
          setShareTarget(null);
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
      setShareTarget(null);
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo compartir la imagen.");
    } finally { setShareBusy(false); }
  }

  function shareLook(look: SavedLook) {
    if (!look.items.length || shareBusy) return;
    openShareTemplate({ kind: "look", look });
  }

  function toggleGarmentSelection(item: Garment) {
    if (item.collection === "forme") return;
    setSelectedGarmentIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
      return next;
    });
  }

  function toggleLookSelection(look: SavedLook) {
    setSelectedLookIds((current) => {
      const next = new Set(current);
      if (next.has(look.id)) next.delete(look.id); else next.add(look.id);
      return next;
    });
  }

  async function bulkSetGarmentVisibility(isPublic: boolean) {
    const selected = personalGarments.filter((item) => selectedGarmentIds.has(item.id));
    if (!selected.length || bulkBusy) return;
    setBulkBusy(true); setWardrobeError("");
    try {
      const results = await Promise.all(selected.map(async (item) => {
        const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...apiPayload(item), isPublic }) });
        const result = await response.json().catch(() => null) as { garment?: ApiGarment; error?: string } | null;
        if (!response.ok || !result?.garment) throw new Error(result?.error || "No se pudo actualizar una prenda.");
        return result.garment;
      }));
      setGarments((items) => mergeApiGarments(items, results));
      setSelectedGarmentIds(new Set()); setClosetSelecting(false);
    } catch (error) { setWardrobeError(error instanceof Error ? error.message : "No se pudieron actualizar las prendas."); }
    finally { setBulkBusy(false); }
  }

  async function bulkDeleteGarments() {
    const selected = personalGarments.filter((item) => selectedGarmentIds.has(item.id));
    if (!selected.length || bulkBusy || !window.confirm(`¿Eliminar ${selected.length} prendas de tu closet?`)) return;
    setBulkBusy(true); setWardrobeError("");
    try {
      await Promise.all(selected.map(async (item) => {
        const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(apiPayload(item)) });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo eliminar una prenda.");
      }));
      const ids = new Set(selected.map((item) => item.id));
      setGarments((items) => items.filter((item) => !ids.has(item.id)));
      setCanvasPieces((items) => items.filter((piece) => !ids.has(piece.garmentId)));
      setSelectedGarmentIds(new Set()); setClosetSelecting(false);
    } catch (error) { setWardrobeError(error instanceof Error ? error.message : "No se pudieron eliminar las prendas."); }
    finally { setBulkBusy(false); }
  }

  async function bulkSetLookVisibility(isPublic: boolean) {
    const selected = savedLooks.filter((look) => selectedLookIds.has(look.id));
    if (!selected.length || bulkBusy) return;
    setBulkBusy(true); setWardrobeError("");
    try {
      await Promise.all(selected.map(async (look) => {
        const response = await fetch(`/api/outfits/${encodeURIComponent(look.id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: look.name, items: look.items, isPublic }) });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo actualizar un look.");
      }));
      setSavedLooks((looks) => looks.map((look) => selectedLookIds.has(look.id) ? { ...look, isPublic } : look));
      setSelectedLookIds(new Set()); setLookSelecting(false);
    } catch (error) { setWardrobeError(error instanceof Error ? error.message : "No se pudieron actualizar los looks."); }
    finally { setBulkBusy(false); }
  }

  async function bulkDeleteLooks() {
    const selected = savedLooks.filter((look) => selectedLookIds.has(look.id));
    if (!selected.length || bulkBusy || !window.confirm(`¿Eliminar ${selected.length} looks?`)) return;
    setBulkBusy(true); setWardrobeError("");
    try {
      await Promise.all(selected.map(async (look) => {
        const response = await fetch(`/api/outfits/${encodeURIComponent(look.id)}`, { method: "DELETE" });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo eliminar un look.");
      }));
      const ids = new Set(selected.map((look) => look.id));
      setSavedLooks((looks) => looks.filter((look) => !ids.has(look.id)));
      setWeeklyPlan((entries) => entries.filter((entry) => !ids.has(entry.outfitId)));
      setSelectedLookIds(new Set()); setLookSelecting(false);
    } catch (error) { setWardrobeError(error instanceof Error ? error.message : "No se pudieron eliminar los looks."); }
    finally { setBulkBusy(false); }
  }

  function currentSnapshotItems() {
    return snapshotLook(canvasPieces);
  }

  async function saveCurrentOutfit() {
    if (canvasPieces.length === 0 || savingOutfit) return;
    const itemsToSave = currentSnapshotItems();
    if (!itemsToSave.length) {
      setWardrobeError("Añade una prenda al Canvas antes de guardar.");
      return;
    }
    const documentAtSave = currentDocument.current;
    const generationAtSave = documentGeneration.current;
    const outfitId = activeOutfitId ?? `look-${crypto.randomUUID()}`;
    const fallbackName = `Look ${String(savedLooks.length + 1).padStart(2, "0")}`;
    const lookName = activeLookName === "Nuevo look" || !activeLookName.trim() ? fallbackName : activeLookName.trim();
    setSavingOutfit(true);
    setWardrobeError("");
    try {
      if (!demoMode) {
        const response = await fetch(`/api/outfits/${encodeURIComponent(outfitId)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: lookName, items: itemsToSave }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo guardar el look.");
      }
      const nextLook: SavedLook = { ...savedLooks.find(look => look.id === outfitId), id: outfitId, name: lookName, items: snapshotLook(itemsToSave) };
      setSavedLooks((looks) => {
        const nextLooks = [nextLook, ...looks.filter((look) => look.id !== outfitId)];
        if (demoMode) localStorage.setItem(demoLooksStorageKey, JSON.stringify(nextLooks));
        return nextLooks;
      });
      autoPlacedIds.current.clear();
      if (documentGeneration.current === generationAtSave) {
        setActiveOutfitId(outfitId);
        if (currentDocument.current.name === documentAtSave.name) setActiveLookName(lookName);
        setSaved(sameDocument(documentAtSave, currentDocument.current));
      }
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo guardar el look.");
    } finally {
      setSavingOutfit(false);
    }
  }

  async function duplicateLook(sourceItems: CanvasPiece[], lookName: string) {
    if (sourceItems.length === 0 || savingOutfit || deletingLookId) return;
    const outfitId = `look-${crypto.randomUUID()}`;
    const duplicatedPieces = sourceItems.map((item) => ({ ...item, instanceId: crypto.randomUUID() }));
    setSavingOutfit(true);
    setWardrobeError("");
    try {
      if (!demoMode) {
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
      openSavedLook(nextLook);
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo duplicar el look.");
    } finally {
      setSavingOutfit(false);
    }
  }

  function duplicateCurrentOutfit() {
    return duplicateLook(canvasPieces, `Look ${String(savedLooks.length + 1).padStart(2, "0")}`);
  }

  function duplicateSavedLook(look: SavedLook) {
    return duplicateLook(look.items, `${look.name} · copia`);
  }

  async function retryProcessing(item: Garment, quality?: "low" | "medium", outputVariant: "closed" | "open" = "closed") {
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
        if (updatedGarment.status === "failed") throw new Error("No se pudo preparar la imagen. Vuelve a intentarlo.");
      }
    } catch (error) {
      setGarments((items) => items.map((garment) => garment.id === item.id ? { ...garment, status: "failed" } : garment));
      setWardrobeError(error instanceof Error ? error.message : "No se pudo volver a preparar la imagen.");
    }
  }

  const saveLookLabel = savingOutfit ? "Guardando…" : saved ? "Guardado" : "Guardar look";
  const shareLookLabel = shareBusy ? "Preparando…" : "Compartir imagen";

  return (
    <main className={`site-shell view-${view} route-${activeRoute} forme-app`}>
      {productOnboardingOpen && <ProductOnboarding
        authenticated={sessionStatus === "authenticated"}
        alreadyCompleted={Boolean(profile.onboardingCompleted)}
        initialStep={productOnboardingStep}
        onSignIn={beginOnboardingSignIn}
        onComplete={completeProductOnboarding}
        onDismiss={dismissProductOnboarding}
        onFinish={finishProductOnboarding}
      />}
      {productFeatures.styleTest && !demoMode && styleOnboardingOpen && <StyleOnboarding
        profile={styleProfile}
        saving={savingStyleProfile}
        dismissible={Boolean(styleProfile?.completed)}
        onClose={() => { setStyleOnboardingOpen(false); if (styleProfile?.completed) setProfileOpen(true); }}
        onSave={saveStyleCalibration}
      />}
      <FormeAppHeader
        activeRoute={activeRoute}
        view={view}
        sessionStatus={sessionStatus}
        demoMode={demoMode}
        profileImage={profileImage}
        profileImageClass={profileImageClass}
        onNavigate={navigateWardrobeRoute}
        onOpenCanvas={() => openStudio(wardrobePanel)}
        onSignIn={beginGoogleSignIn}
      />

      {!accountDataReady && (
        <section className="account-route-loading" aria-label="Abriendo tu cuenta">
          <span />
          <span />
          <span />
        </section>
      )}

      {demoMode && sessionStatus === "guest" && (activeRoute === "perfil" || activeRoute === "ajustes") && (
        <section className="account-page-gate" aria-labelledby="account-gate-title">
          <div>
            <h1 id="account-gate-title">Tu cuenta</h1>
            <span>Entra para guardar tus prendas y looks.</span>
            <button type="button" onClick={beginGoogleSignIn}>Entrar con Google</button>
          </div>
        </section>
      )}

      {!demoMode && accountDataReady && activeRoute === "ajustes" && (
        <section className="settings-page" aria-labelledby="settings-title">
          <header className="settings-page-heading">
            <div>
              <h1 id="settings-title">Ajustes</h1>
            </div>
          </header>

          <div className="settings-page-grid">
            <section className="settings-identity">
              <span className="profile-drawer-avatar"><img className={profileImageClass} src={profileImage} alt={`Foto de perfil de ${profile.name}`} /></span>
              <div><h2>{profile.name}</h2><small>{profile.handle}</small><button type="button" className="account-sign-out" onClick={signOut}>Cerrar sesión</button></div>
            </section>

            <section className="settings-account-links"><h2>Cuenta</h2><Link href="/perfil">Perfil y privacidad</Link><Link href="/pricing">Información de la beta</Link><Link href="/about">Manifiesto</Link><Link href="/terminos">Términos de uso</Link><Link href="/privacidad">Privacidad y fotos</Link></section>
            {profile.referralCode && <section className="settings-account-links settings-referral">
              <h2>Invitaciones</h2>
              <strong>+5 créditos por cada registro</strong>
              <button type="button" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/ingresar?ref=${profile.referralCode}`)}>Copiar enlace de invitación</button>
              {Boolean(profile.referralCount) && <small>{profile.referralCount} {profile.referralCount === 1 ? "persona invitada" : "personas invitadas"}. +{profile.referralCredits || 0} créditos.</small>}
            </section>}
            <section className="settings-account-links settings-onboarding">
              <h2>Cómo usar Formé</h2>
              <strong>{profile.onboardingCompleted ? "Tutorial completado" : "Completa el tutorial y recibe 5 créditos"}</strong>
              <button type="button" onClick={openProductOnboarding}>Ver tutorial</button>
            </section>
            {productFeatures.styleTest && <>
            <section className="profile-style-summary">
              <p>Tu lectura actual</p>
              <h3>{profileTopStyles.length ? profileTopStyles.map((family) => family.label).join(", ") : "Todavía estamos conociéndote."}</h3>
              <span>{profileTopStyles.length
                ? "Estas direcciones aparecen con más fuerza en tus recomendaciones."
                : "Elige lo que te representa para recibir recomendaciones más tuyas."}</span>
              {profileTopStyles.length > 0 && <div className="profile-style-tags">{profileTopStyles.map((family) => <span key={family.id}>{family.label} <b>{family.rating?.affinity}%</b></span>)}</div>}
            </section>

            <section className="profile-exploration settings-exploration">
              <div><span>Cuánto quieres experimentar</span><strong>{styleProfile?.exploration ?? 35}%</strong></div>
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
              <div className="profile-exploration-labels"><small>Familiar</small><small>Experimental</small></div>
              <p>Controla cuánto se alejan las sugerencias de lo que ya usas.</p>
            </section>

            </>}
            {productFeatures.styleTest && <button className="profile-recalibrate" type="button" onClick={() => { setProfileOpen(false); setStyleOnboardingOpen(true); }}>
              <span>{styleProfile?.completed ? "Revisar mi calibración" : "Configurar mi estilo"}</span><b>→</b>
            </button>}
          </div>
        </section>
      )}

      {view === "wardrobe" && activeRoute === "perfil" && !demoMode && !accountDataReady && <section className="profile-page profile-page-loading" aria-label="Cargando perfil">
        <div className="profile-page-loading-hero">
          <span className="profile-page-loading-portrait" />
          <div className="profile-page-loading-copy"><span /><strong /><span /><span /></div>
          <div className="profile-page-loading-stats"><span /><span /><span /></div>
        </div>
      </section>}

      {view === "wardrobe" && activeRoute === "perfil" && !demoMode && accountDataReady && profileDraft && <section className="profile-page">
        <header className="profile-page-hero">
          <figure className="profile-page-portrait">
            <img src={profileImage} alt={`Retrato de ${profileDraft.name}`} />
          </figure>
          <div className="profile-page-intro">
            <span>{profileDraft.handle || "@tuusuario"}</span>
            <h1>{profileDraft.name || "Tu nombre"}</h1>
            {profile.isTester && <div className="profile-account-details"><span className="profile-tester-badge">Tester</span></div>}
            {profileJoinedDate && <p className="profile-joined-date">Se unió el <time dateTime={profile.joinedAt}>{profileJoinedDate}</time></p>}
            {profileDraft.bio.trim() ? <p>{profileDraft.bio}</p> : null}
            {profile.profilePublic && <nav className="profile-page-links" aria-label="Acciones del perfil">
              <button type="button" onClick={() => window.open(`/${profile.handle}`, "_blank", "noopener,noreferrer")}>Ver perfil público</button>
              <button type="button" onClick={() => void sharePublicProfile()}>Compartir perfil</button>
            </nav>}
          </div>
          <dl className="profile-page-stats">
            <div><dt>Prendas</dt><dd>{personalGarments.length}</dd></div>
            <div><dt>Looks</dt><dd>{savedLooks.length}</dd></div>
            {typeof profile.credits === "number" && <div><dt>Créditos</dt><dd>{profile.credits}</dd></div>}
            {productFeatures.weeklyPlanner && <div><dt>Días planeados</dt><dd>{weeklyPlan.length}</dd></div>}
          </dl>
        </header>

        <section className="closet-reading" aria-labelledby="closet-reading-title">
          <header className="closet-reading-heading">
            <h2 id="closet-reading-title">Análisis del closet</h2>
          </header>
          <div className="closet-reading-layout">
            <figure className="closet-reading-visual" aria-label="Prendas representativas del closet">
              {closetReading.visualGarments.map((garment) => <div key={garment.id}>
                <img src={imageSrc(garmentPhotoFor(garment, "complete").image)} alt={translateGarmentName(garment.name)} loading="lazy" />
              </div>)}
              {!closetReading.visualGarments.length && <p>Sin prendas</p>}
            </figure>
            <div className="closet-reading-data">
              <section className="closet-reading-composition">
                <h3>Composición</h3>
                <ol>{closetReading.categories.slice(0, 6).map(([category, count]) => <li key={category}><span>{translateValue(category)}</span><strong>{count}</strong></li>)}</ol>
              </section>
              <section className="closet-reading-palette">
                <h3>Paleta</h3>
                <ul>{closetReading.colors.slice(0, 5).map(([color, count]) => <li key={color}><i style={{ background: closetSwatch(color) }} /><span>{translateValue(color)}</span><strong>{count}</strong></li>)}</ul>
              </section>
              <section className="closet-reading-use">
                <h3>Uso en looks</h3>
                <dl>
                  <div><dt>Ya combinadas</dt><dd>{closetReading.usedCount}</dd></div>
                  <div><dt>Por explorar</dt><dd>{closetReading.unusedCount}</dd></div>
                </dl>
                {closetReading.mostUsed.length > 0 ? <ol>{closetReading.mostUsed.slice(0, 3).map(({ garment, count }) => <li key={garment.id}><span>{translateGarmentName(garment.name)}</span><strong>{count} {count === 1 ? "look" : "looks"}</strong></li>)}</ol> : <p>Sin looks guardados</p>}
                <div><button type="button" onClick={newLook}>Crear look</button><button type="button" onClick={() => navigateWardrobeRoute("looks")}>Ver Looks</button></div>
              </section>
              <section className="closet-reading-materials">
                <h3>Materiales</h3>
                <ul>{closetReading.materials.slice(0, 4).map(([material, count]) => <li key={material}><span>{translateValue(material)}</span><strong>{count}</strong></li>)}</ul>
                {!closetReading.materials.length && <p>Sin datos</p>}
              </section>
            </div>
          </div>
        </section>
        <div className="profile-page-body">
          <section className="profile-page-editor" aria-labelledby="profile-editor-title">
            <div className="profile-edit-columns">
            <div className="profile-identity-fields">
            <header>
              <h2 id="profile-editor-title">Perfil</h2>
            </header>
            <div className="profile-page-fields">
              <label>Nombre<input value={profileDraft.name} maxLength={60} onChange={(event) => updateProfileDraft("name", event.target.value)} /></label>
              <label>Usuario<div className="profile-handle-input"><span>@</span><input value={profileDraft.handle.replace(/^@/, "")} maxLength={30} autoCapitalize="none" spellCheck={false} onChange={(event) => updateProfileDraft("handle", `@${event.target.value.replace(/^@/, "")}`)} /></div></label>
              <label className="profile-page-bio">Bio<textarea placeholder="Opcional" value={profileDraft.bio} maxLength={160} rows={3} onChange={(event) => updateProfileDraft("bio", event.target.value)} /></label>
            </div>
            </div>

            <div className="profile-preferences">
            <div className="profile-page-visibility">
              <h3>Privacidad</h3>
              <label><span><strong>Perfil público</strong><small>Cualquier persona con el enlace podrá verlo.</small></span><input type="checkbox" checked={profileDraft.profilePublic} onChange={(event) => { setProfileSaved(false); setProfileSaveError(""); setProfileDraft((current) => current ? {
                ...current,
                profilePublic: event.target.checked,
                ...(!event.target.checked ? { discoverable: false, showCloset: false, showLooks: false } : {}),
              } : current); }} /></label>
              {profileDraft.profilePublic && <>
              <label><span><strong>Mostrar prendas elegidas</strong><small>Elígelas desde la ficha de cada prenda con «Mostrar en mi perfil».</small></span><input type="checkbox" disabled={!profileDraft.profilePublic} checked={profileDraft.showCloset} onChange={(event) => updateProfileDraft("showCloset", event.target.checked)} /></label>
              <label><span><strong>Mostrar looks elegidos</strong><small>Elígelos desde el menú de cada look con «Mostrar en mi perfil».</small></span><input type="checkbox" disabled={!profileDraft.profilePublic} checked={profileDraft.showLooks} onChange={(event) => updateProfileDraft("showLooks", event.target.checked)} /></label>
              <label><span><strong>Aparecer en búsquedas</strong></span><input type="checkbox" disabled={!profileDraft.profilePublic} checked={profileDraft.discoverable} onChange={(event) => updateProfileDraft("discoverable", event.target.checked)} /></label>
              </>}
            </div>

            <div className="profile-page-visibility">
              <h3>Prendas</h3>
              <label><span><strong>Mostrar básicos Formé</strong><small>Disponibles en Mi closet, Canvas y al mezclar.</small></span><input type="checkbox" checked={profileDraft.includeFormeBasics} onChange={(event) => updateProfileDraft("includeFormeBasics", event.target.checked)} /></label>
            </div>
            </div>
            </div>

            <div className="profile-page-save-row">
              {profileDraft.profilePublic && <div><span>Enlace público</span><strong>forme.gallery/{profileDraft.handle || "@tuusuario"}</strong></div>}
              <button className={profileSaved ? "saved" : ""} type="button" disabled={savingProfile} onClick={() => void saveAccountSettings()}>{savingProfile ? "Guardando…" : profileSaved ? "Guardado" : "Guardar cambios"}</button>
            </div>
            {profileSaveError && <p className="profile-save-error" role="alert">{profileSaveError}</p>}
          </section>

          {productFeatures.styleTest && <aside className="profile-page-reading" aria-labelledby="profile-reading-title">
            <header>
              <h2 id="profile-reading-title">Lo que Formé entiende de ti</h2>
              <p>Esta lectura cambia con los looks que guardas, descartas y usas.</p>
            </header>
            {profileTopStyles.length > 0 ? <ol>
              {profileTopStyles.map((family) => <li key={family.id}><span>{family.label}</span><strong>{family.rating?.affinity}%</strong></li>)}
            </ol> : <p className="profile-page-reading-empty">Todavía no tenemos suficiente información sobre tu estilo.</p>}
            <div className="profile-page-exploration">
              <span>GANAS DE EXPERIMENTAR</span>
              <strong>{styleProfile?.exploration ?? 35}%</strong>
              <p>{(styleProfile?.exploration ?? 35) >= 70 ? "Quieres ver opciones que se alejen de lo habitual." : (styleProfile?.exploration ?? 35) >= 40 ? "Buscas equilibrio entre lo conocido y algo nuevo." : "Prefieres variaciones cercanas a lo que ya funciona."}</p>
            </div>
            <button type="button" onClick={() => navigateWardrobeRoute("ajustes")}>AJUSTAR PREFERENCIAS</button>
          </aside>}
        </div>
      </section>}

      {view === "wardrobe" && activeRoute !== "perfil" && activeRoute !== "ajustes" && (
        <section className="content wardrobe-view" data-pending={!accountDataReady || undefined} inert={!accountDataReady}>
          {wardrobeError && <div className="app-message error" role="status">{wardrobeError}<button onClick={() => setWardrobeError("")} aria-label="Cerrar mensaje">×</button></div>}

          {wardrobePanel === "closet" && closetMode === "browse" ? (
            <section className="pieces-section" data-grid-size={closetGridSize}>
              <h1 className="sr-only">Mi closet</h1>
              <div className="catalog-toolbar">
                <div className="catalog-collection">
                  {!demoMode && basicsEnabled ? <label><span className="sr-only">Colección</span><select value={showingBasics ? "basics" : "personal"} onChange={event => setCatalogSource(event.target.value as "personal" | "basics")}>
                    <option value="personal">Mis prendas</option><option value="basics">Básicos Formé</option>
                  </select></label> : <span>{showingBasics ? "Básicos Formé" : "Prendas"}</span>}
                  <span className="catalog-count" aria-label={`${catalogItems.length} prendas`}>{catalogItems.length}</span>
                </div>
                <label className="catalog-search"><span className="sr-only">Buscar prendas</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" value={catalogQuery} onChange={event => setCatalogQuery(event.target.value)} placeholder="Buscar" /></label>
                <div className="catalog-tools">
                  <GarmentViewControls size={closetGridSize} onSizeChange={setClosetGridSize} favorites={favoritesOnly} onFavoritesChange={setFavoritesOnly} />
                  <button type="button" className={`catalog-filter${archiveFilterCount || catalogSort !== "recent" ? " active" : ""}`} onClick={() => setFiltersOpen(true)} aria-label={`Filtrar y ordenar prendas${archiveFilterCount ? `, ${archiveFilterCount} filtros activos` : ""}`} title="Filtrar y ordenar"><ClosetActionIcon action="filter" /><span>Filtros{archiveFilterCount ? ` · ${archiveFilterCount}` : ""}</span></button>
                  {!showingBasics && catalogItems.length > 0 && <button type="button" className={`catalog-secondary-action${closetSelecting ? " active" : ""}`} aria-label={closetSelecting ? "Cancelar selección" : "Seleccionar prendas"} title={closetSelecting ? "Cancelar selección" : "Seleccionar prendas"} onClick={() => { setClosetSelecting((value) => !value); setSelectedGarmentIds(new Set()); }}><ClosetActionIcon action="select" /><span className="catalog-action-label">{closetSelecting ? "Cancelar" : "Seleccionar"}</span></button>}
                  {!showingBasics && personalGarments.length > 0 && <button type="button" className="catalog-secondary-action" aria-label="Compartir closet" title="Compartir closet" onClick={() => openShareTemplate({ kind: "closet", garments: personalGarments })}><ClosetActionIcon action="share" /><span className="catalog-action-label">Compartir closet</span></button>}
                </div>
                {(demoMode || showingBasics || personalGarments.length > 0) && <button className="closet-add" type="button" onClick={demoMode ? beginGoogleSignIn : openUpload} aria-label={demoMode ? "Crear mi closet" : "Añadir prendas"}><ClosetActionIcon /><span>{demoMode ? "Crear mi closet" : <>Añadir<span className="closet-add-context"> prendas</span></>}</span></button>}
              </div>
              {closetSelecting && <div className="bulk-actionbar" role="toolbar" aria-label="Acciones para prendas seleccionadas">
                <strong>{selectedGarmentIds.size} {selectedGarmentIds.size === 1 ? "seleccionada" : "seleccionadas"}</strong>
                <button type="button" onClick={() => setSelectedGarmentIds(new Set(catalogItems.filter((item) => item.collection !== "forme").map((item) => item.id)))}>Todas las visibles</button>
                <button type="button" disabled={!selectedGarmentIds.size || bulkBusy} onClick={() => void bulkSetGarmentVisibility(true)}>Publicar</button>
                <button type="button" disabled={!selectedGarmentIds.size || bulkBusy} onClick={() => void bulkSetGarmentVisibility(false)}>Hacer privadas</button>
                <button type="button" className="danger-action" disabled={!selectedGarmentIds.size || bulkBusy} onClick={() => void bulkDeleteGarments()}>Eliminar</button>
              </div>}
              {filtersOpen && <FormeDialog labelledBy="filter-title" className="filter-dialog" onClose={() => setFiltersOpen(false)}>
                <header className="dialog-heading"><h2 id="filter-title">Filtros y orden</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">×</button></header>
                <label className="catalog-sort"><span>Ordenar por</span><select aria-label="Ordenar prendas" value={catalogSort} onChange={event => setCatalogSort(event.target.value as "recent" | "type" | "name")}><option value="recent">Más recientes</option><option value="type">Tipo de prenda</option><option value="name">Nombre A–Z</option></select></label>
                <AttributeFilters value={archiveFilters} options={filterOptions} onChange={updateArchiveFilter} onReset={() => setArchiveFilters(emptyFilters)} />
                <button className="primary-action" onClick={() => setFiltersOpen(false)}>Ver {catalogItems.length} prendas</button>
              </FormeDialog>}
              <div className="catalog-results">
                {!showingBasics && personalGarments.length === 0 ? <div className="closet-empty-personal"><h2>Tu closet está vacío</h2><p>Añade tus prendas para empezar a combinarlas.</p><button className="primary-action" type="button" onClick={openUpload}>Añadir prendas</button></div> :
                  <ClosetGarmentGrid garments={catalogItems} emptyLabel={favoritesOnly ? "No hay favoritas con estos filtros." : "No encontramos prendas con esta búsqueda."} onOpen={(item) => openGarmentEditor(item)} selecting={closetSelecting} selectedIds={selectedGarmentIds} onToggle={toggleGarmentSelection} onResetFilters={() => { setArchiveFilters(emptyFilters); setCatalogQuery(""); setFavoritesOnly(false); }} />}
              </div>
            </section>
          ) : wardrobePanel === "looks" ? (
            <section className="looks-view">
              <header className="closet-commandbar looks-commandbar">
                <div>
                  <h1 className="sr-only">Looks</h1><span className="collection-name">Looks guardados</span>
                  <span data-empty={savedLooks.length === 0 || undefined} aria-label={`${savedLooks.length} looks`}>{savedLooks.length}</span>
                </div>
                <nav aria-label="Acciones de Looks">
                  {productFeatures.assistant && <button type="button" onClick={generateLooksQuickly}>Generar</button>}
                  {savedLooks.length > 0 && <button type="button" onClick={() => { setLookSelecting((value) => !value); setSelectedLookIds(new Set()); }}>{lookSelecting ? "Cancelar" : "Seleccionar"}</button>}
                  {savedLooks.length > 0 && <button type="button" aria-label="Crear look" title="Crear look" className="primary-action" onClick={newLook}><ClosetActionIcon /><span className="closet-action-label">Crear look</span></button>}
                </nav>
              </header>
              {lookSelecting && <div className="bulk-actionbar" role="toolbar" aria-label="Acciones para looks seleccionados">
                <strong>{selectedLookIds.size} {selectedLookIds.size === 1 ? "seleccionado" : "seleccionados"}</strong>
                <button type="button" onClick={() => setSelectedLookIds(new Set(savedLooks.map((look) => look.id)))}>Todos</button>
                <button type="button" disabled={!selectedLookIds.size || bulkBusy} onClick={() => void bulkSetLookVisibility(true)}>Publicar</button>
                <button type="button" disabled={!selectedLookIds.size || bulkBusy} onClick={() => void bulkSetLookVisibility(false)}>Hacer privados</button>
                <button type="button" className="danger-action" disabled={!selectedLookIds.size || bulkBusy} onClick={() => void bulkDeleteLooks()}>Eliminar</button>
              </div>}
              <div className="saved-looks-grid">
                {savedLooks.map((look) => (
                  <article className="saved-look-card" data-selected={selectedLookIds.has(look.id) || undefined} key={look.id}>
                    <button className="saved-look-open" type="button" onClick={() => lookSelecting ? toggleLookSelection(look) : openSavedLook(look)} aria-pressed={lookSelecting ? selectedLookIds.has(look.id) : undefined} aria-label={lookSelecting ? `${selectedLookIds.has(look.id) ? "Quitar" : "Seleccionar"} ${look.name}` : `Abrir ${look.name} en el canvas`}>
                      <LookPreview look={look} garmentById={garmentById} />
                      {lookSelecting ? <span className="bulk-check">{selectedLookIds.has(look.id) ? "✓" : ""}</span> : <span>Abrir en Canvas</span>}
                    </button>
                    <div className="saved-look-meta">
                      <div><strong>{look.name}</strong><small>{demoMode ? "En este navegador" : look.isPublic && profile.profilePublic && profile.showLooks ? "En tu perfil público" : look.isPublic ? "Elegido para tu perfil" : "Privado"}</small></div>
                      {!lookSelecting && <FormeMenu label={`Acciones de ${look.name}`}>
                        {!demoMode && <>
                        <button type="button" onClick={() => void toggleOutfitVisibility(look)}>{look.isPublic ? "Ocultar del perfil" : "Mostrar en mi perfil"}</button>
                        {(!profile.profilePublic || !profile.showLooks) && <button type="button" onClick={() => navigateWardrobeRoute("perfil")}>Configurar perfil público</button>}
                        </>}
                        <button type="button" disabled={shareBusy} onClick={() => shareLook(look)}>Compartir imagen</button>
                        <button type="button" disabled={savingOutfit} onClick={() => void duplicateSavedLook(look)}>Duplicar look</button>
                        <button type="button" className="danger-action" onClick={() => void deleteSavedLook(look.id)}>Eliminar look</button>
                      </FormeMenu>}
                    </div>
                  </article>
                ))}
                {savedLooks.length === 0 && <div className="looks-empty"><h2>Aún no has guardado looks</h2><p>Combina prendas en el Canvas y guarda lo que te guste.</p><button type="button" className="primary-action" onClick={newLook}>Crear look</button></div>}
              </div>
              {productFeatures.weeklyPlanner && <WeeklyPlanView
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
              />}
            </section>
          ) : wardrobePanel === "assistant" ? (
            <section className="assistant-view">
              <header className="assistant-commandbar">
                <div>
                  <h1>Asistente</h1>
                  <p>Pregunta desde una ocasión. Formé responde usando tu perfil, tus prendas y tus looks.</p>
                </div>
              </header>
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

            </section>
          ) : (
            <section className="upload-view">
              <div className="upload-heading"><h1>Añadir prendas</h1><button type="button" onClick={() => navigateWardrobeRoute("closet")}>Volver al closet</button></div>
              <div className={`upload-layout ${uploadItems.length ? "has-files" : ""}`}>
                <input ref={fileInput} type="file" accept={uploadFileAccept} multiple disabled={Boolean(uploadIntakeBatchId) || preparingUploads} onChange={(event: ChangeEvent<HTMLInputElement>) => void acceptFiles(event.target.files ?? undefined)} hidden />
                {!uploadItems.length ? <div
                  className={`dropzone bulk-dropzone ${draggingUpload ? "dragging" : ""}`}
                  onDragEnter={event => { event.preventDefault(); setDraggingUpload(true); }}
                  onDragOver={event => event.preventDefault()}
                  onDragLeave={() => setDraggingUpload(false)}
                  onDrop={event => { event.preventDefault(); setDraggingUpload(false); void acceptFiles(event.dataTransfer.files); }}
                >
                  <div className="dropzone-empty"><p>Una prenda por foto, completa y con buena luz.</p><button type="button" className="primary-action" disabled={preparingUploads} onClick={() => fileInput.current?.click()}>{preparingUploads ? "Comprobando fotos…" : "Seleccionar fotos"}</button><small>Arrastra tus fotos aquí · Hasta 20 MB por foto</small></div>
                </div> : <>
                  <div className="upload-queue-heading"><span>{uploadItems.length} {uploadItems.length === 1 ? "foto" : "fotos"}</span>{!uploadIntakeBatchId && <button type="button" disabled={preparingUploads} onClick={() => fileInput.current?.click()}>{preparingUploads ? "Comprobando…" : "+ Añadir fotos"}</button>}</div>
                  <div className="upload-photo-queue" aria-label="Fotos para añadir al closet">{uploadItems.map(item => {
                    const recognized = garments.find(garment => garment.id === item.garmentId);
                    const canEdit = recognized?.metadataStatus === "ready";
                    const state = uploadStatusLabels[item.status];
                    return <article className={`upload-photo status-${item.status}`} key={item.id}>
                      <div className="upload-photo-visual"><img src={recognized?.qaStatus === "passed" ? imageSrc(recognized.image) : item.preview} alt={recognized?.name || item.name} />{!uploadIntakeBatchId && <button type="button" className="upload-remove" disabled={preparingUploads} onClick={() => removeUploadItem(item.id)} aria-label={`Quitar ${item.name}`}>×</button>}</div>
                      <p className="upload-photo-name" title={recognized?.name || item.name}>{recognized?.name || item.name}</p>
                      {item.status !== "ready" && <span className="upload-photo-state">{state}</span>}
                      {item.error && <p className={item.status === "failed" || item.status === "review" ? "upload-photo-error" : "upload-photo-note"}>{item.error}</p>}
                      {canEdit && <button type="button" className="upload-edit" onClick={() => openGarmentEditor(recognized, true)}>Editar ficha</button>}
                    </article>;
                  })}</div>
                  <div className="upload-footer">
                    <p role="status">{uploadingBatch && uploadItems.some(item => item.status === "uploading") ? "Subiendo fotos…" : uploadingBatch || uploadItems.some(item => item.status === "processing") ? `${uploadItems.filter(item => item.status === "done").length} de ${uploadItems.length} listas. Puedes volver al closet.` : uploadAllPassed ? "Prendas listas" : ""}</p>
                    {uploadAllPassed && !uploadingBatch ? <button className="primary-action" onClick={() => { resetUpload(); navigateWardrobeRoute("closet"); }}>Ver prendas</button>
                      : <button className="primary-action" disabled={!uploadRetryableCount || uploadingBatch || preparingUploads} onClick={ghostGarments}>{uploadingBatch ? "Preparando…" : uploadItems.some(item => item.status === "failed" || item.status === "review") ? `Reintentar ${uploadRetryableCount}` : uploadRetryableCount ? `Añadir ${uploadRetryableCount} ${uploadRetryableCount === 1 ? "prenda" : "prendas"}` : "En proceso"}</button>}
                  </div>
                </>}
                {uploadNotice && <p className="upload-status" role="status">{uploadNotice}</p>}
                {uploadError && <p className="upload-status upload-error" role="alert">{uploadError}</p>}
              </div>
            </section>
          )}
        </section>
      )}

      {view === "studio" && (
        <section className="content studio-view" data-pending={!accountDataReady || undefined} inert={!accountDataReady}>
          <div className="studio-layout" aria-busy={savingOutfit}>
            <header className="studio-heading">
              <div className="studio-document-name"><label className="sr-only" htmlFor="look-name">Nombre del look</label><input id="look-name" disabled={savingOutfit} value={activeLookName} maxLength={80} onFocus={() => { nameCheckpoint.current = false; }} onChange={event => { if (!nameCheckpoint.current) { checkpoint(); nameCheckpoint.current = true; } setActiveLookName(event.target.value); setSaved(false); }} /><span className="sr-only" aria-live="polite">{savingOutfit ? "Guardando…" : saved ? "Guardado en Looks" : demoMode ? "Borrador en este navegador" : "Borrador"}</span></div>
              <nav className="canvas-panel-nav" aria-label="Paneles del canvas">
                <button type="button" className={layersOpen ? "active" : ""} onClick={() => togglePanel("layers")} aria-expanded={layersOpen} aria-controls="canvas-layers" aria-label="Capas" title="Capas"><LookActionIcon action="layers" /><span>Capas</span></button>
                <button type="button" className={savedLooksOpen ? "active" : ""} onClick={() => togglePanel("looks")} aria-expanded={savedLooksOpen} aria-controls="canvas-saved-looks" aria-label="Looks guardados" title="Looks guardados"><LookActionIcon action="looks" /><span>Looks</span></button>
              </nav>
            </header>
            <div className="canvas-column">
              <div className={`look-canvas ${canvasPieces.length === 0 ? "is-empty" : "has-pieces"} library-open ${savedLooksOpen ? "saved-looks-open" : ""}`}
                onPointerDownCapture={startCanvasGesture} onPointerMoveCapture={moveCanvasGesture}
                onPointerUpCapture={event => endCanvasGesture(event)} onPointerCancelCapture={event => endCanvasGesture(event, true)}
                onLostPointerCapture={event => { if (canvasGestures.current?.has(event.pointerId)) canvasGestures.current.cancel(); }}
                onContextMenu={event => { if (canvasGestures.current?.active) event.preventDefault(); }}
              >
                <div
                  className="look-artboard"
                  ref={canvasRef}
                  role="group"
                  aria-label="Área de trabajo del look"
                  onKeyDown={event => {
                    if (event.key === "Escape") {
                      setSelectedId(""); setSelectedGroupIds([]);
                      if (window.innerWidth <= 900) { setSavedLooksOpen(false); }
                    }
                  }}
                  onPointerDown={startMarqueeSelection}
                  onPointerMove={moveMarqueeSelection}
                  onPointerUp={stopMarqueeSelection}
                  onPointerCancel={stopMarqueeSelection}
                >
                  {canvasPieces.length === 0 && <div className="empty-canvas">
                    <p>{canRandomize ? "Añade una prenda o prueba Mezclar." : "Añade prendas a tu closet para empezar."}</p>
                    {!canRandomize && <button type="button" className="canvas-empty-action" onClick={openUpload}>Añadir prendas</button>}
                    {clearedLook && <button type="button" className="canvas-empty-action" onClick={() => {
                      setCanvasPieces(clearedLook.items); setActiveOutfitId(clearedLook.id); setActiveLookName(clearedLook.name);
                      setSaved(clearedLook.saved); setLockedPieceIds(clearedLook.locked); autoPlacedIds.current = clearedLook.automatic;
                      setClearedLook(null);
                    }}>Deshacer vaciado</button>}
                  </div>}
                  {marqueeRect && <span className="canvas-marquee" aria-hidden="true" style={{ left: marqueeRect.left, top: marqueeRect.top, width: marqueeRect.width, height: marqueeRect.height }} />}
                  {canvasPieces.map((piece) => {
                    const garment = garmentById.get(piece.garmentId);
                    if (!garment) return null;
                    const pieceImage = piece.variant === "open" && garment.openImage ? garment.openImage : garment.image;
                    const piecePhotoRole: GarmentPhotoRole = piece.variant === "open" && garment.openImage ? "canvas" : "complete";
                    const canvasImage = cleanCanvasImage(pieceImage);
                    const layout = garmentLayout(garment, piece.variant);
                    const layerOrder = [...canvasPieces].sort((a, b) => a.z - b.z);
                    const layerIndex = layerOrder.findIndex(item => item.instanceId === piece.instanceId);
                    const expandedHitbox = garment.category === "Accessories" && (piece.scale <= 0.2 || garment.id.includes("sunglasses"));
                    const safeScale = Math.max(piece.scale, 0.08);
                    const pieceStyle = {
                      left: `${piece.x}%`,
                      top: `${piece.y}%`,
                      zIndex: piece.z,
                      transform: `translate(-50%, -50%) rotate(${piece.rotation}deg) scale(${piece.scale})`,
                      "--piece-outline-width": `${1.5 / safeScale}px`,
                      ...(expandedHitbox ? { "--piece-hitbox-inset": `-${24 / Math.max(piece.scale, 0.08)}px` } : {}),
                    } as CSSProperties;
                    return (
                      <Fragment key={piece.instanceId}>
                      <div
                        className={`canvas-piece ${expandedHitbox ? "expanded-hitbox" : ""} ${selectedId === piece.instanceId ? "selected" : ""} ${selectedGroupIdSet.has(piece.instanceId) ? "group-selected" : ""}`}
                        data-instance-id={piece.instanceId}
                        role="button"
                        tabIndex={0}
                        aria-label={`Seleccionar ${translateGarmentName(garment.name)}`}
                        aria-pressed={selectedId === piece.instanceId}
                        onKeyDown={event => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault(); setSelectedId(piece.instanceId); setSelectedGroupIds([]);
                          } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                            event.preventDefault(); checkpoint(); autoPlacedIds.current.delete(piece.instanceId);
                            const step = event.shiftKey ? 5 : 1;
                            setCanvasPieces(items => items.map(item => item.instanceId === piece.instanceId ? { ...item, x: clamp(item.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), 4, 96), y: clamp(item.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0), 4, 96) } : item));
                            setSaved(false);
                          }
                        }}
                        data-random-locked={lockedPieceIds.has(piece.instanceId)}
                        data-photo-role={piecePhotoRole}
                        data-height-slots={layout.slots}
                        data-layout-region={layout.region}
                        data-alpha-bounds={layout.bounds.join(",")}
                        data-body-height={layout.bodyHeight}
                        data-anchor-y={layoutAnchorY(layout)}
                        data-neck-rise={layout.neckRise}
                        data-sleeve-bottoms={layout.sleeveBottoms.join(",")}
                        style={pieceStyle}
                      >
                        <img src={imageSrc(canvasImage)} alt={translateGarmentName(garment.name)} draggable={false} />
                      </div>
                      {(selectedId === piece.instanceId || lockedPieceIds.has(piece.instanceId)) && <CanvasPieceOverlay
                        instanceId={piece.instanceId}
                        geometryKey={`${piece.x}:${piece.y}:${piece.scale}:${piece.rotation}:${pieceImage}:${layout.bounds.join(",")}`}
                        selected={selectedId === piece.instanceId}
                      >
                        {selectedId === piece.instanceId && <fieldset className="canvas-piece-actions" disabled={savingOutfit} aria-label="Herramientas de la prenda">
                          <span className="canvas-selection-box" aria-hidden="true" />
                          <button type="button" className="piece-action piece-duplicate" aria-label="Duplicar prenda" title="Duplicar prenda" onClick={() => duplicatePiece(piece.instanceId)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M15 8V4H4v11h4" /></svg>
                          </button>
                          <button type="button" className="piece-action piece-remove" aria-label="Quitar del look" title="Quitar del look" onClick={() => removePiece(piece.instanceId)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                          </button>
                          <button type="button" className="piece-action piece-layer-up" aria-label="Subir una capa" title="Subir una capa" disabled={layerIndex === layerOrder.length - 1} onClick={() => changeLayer(piece.instanceId, "up")}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 7 4-4 4 4M12 3v10M4 15l8 5 8-5M4 11l3 2m10 0 3-2" /></svg>
                          </button>
                          <button type="button" className="piece-action piece-layer-down" aria-label="Bajar una capa" title="Bajar una capa" disabled={layerIndex === 0} onClick={() => changeLayer(piece.instanceId, "down")}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4M12 3v11M4 15l8 5 8-5M4 11l3 2m10 0 3-2" /></svg>
                          </button>
                          <button type="button" className="piece-action piece-keep" aria-label="Mantener al mezclar" title={lockedPieceIds.has(piece.instanceId) ? "Permitir cambiar al mezclar" : "Mantener al mezclar"} aria-pressed={lockedPieceIds.has(piece.instanceId)} onClick={() => toggleRandomLock(piece.instanceId)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d={lockedPieceIds.has(piece.instanceId) ? "M8 10V7a4 4 0 0 1 8 0v3M12 14v3" : "M8 10V7a4 4 0 0 1 7-2M12 14v3"} /></svg>
                          </button>
                          <button type="button" className="piece-action piece-replace" aria-label="Cambiar prenda" title="Cambiar prenda" onClick={() => beginReplacingPiece(piece.instanceId)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" /></svg>
                          </button>
                          <button type="button" className="transform-handle rotate-handle" disabled={savingOutfit}
                            aria-label={`Girar ${translateGarmentName(garment.name)}`} title="Arrastra para girar · ← → con teclado"
                            onKeyDown={event => { if (["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); adjustPieceWithKeyboard(piece.instanceId, "rotation", event.key === "ArrowLeft" ? -5 : 5); } }}
                            onPointerDown={event => startTransformHandle(event, piece.instanceId, "rotate")}
                            onPointerMove={moveTransformHandle} onPointerUp={stopTransformHandle} onPointerCancel={stopTransformHandle}
                          ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V3M5 3h5M5.5 3.5A9 9 0 1 1 3 13" /></svg></button>
                          <button type="button" className="transform-handle scale-handle" disabled={savingOutfit}
                            onKeyUp={event => {
                              if (["ArrowUp", "ArrowDown"].includes(event.key)) {
                                const scale = keyboardSizes.current.get(piece.instanceId);
                                keyboardSizes.current.delete(piece.instanceId);
                                if (scale !== undefined) rememberCanvasSize.current(piece.instanceId, scale);
                              }
                            }}
                            aria-label={`Cambiar tamaño de ${translateGarmentName(garment.name)}`} title="Arrastra para cambiar tamaño · ↑ ↓ con teclado"
                            onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); adjustPieceWithKeyboard(piece.instanceId, "scale", event.key === "ArrowDown" ? -.03 : .03); } }}
                            onPointerDown={event => startTransformHandle(event, piece.instanceId, "scale")}
                            onPointerMove={moveTransformHandle} onPointerUp={stopTransformHandle} onPointerCancel={stopTransformHandle}
                          ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10V4h6M4 4l6 6M20 14v6h-6M20 20l-6-6" /></svg></button>
                        </fieldset>}
                        {lockedPieceIds.has(piece.instanceId) && <span className="piece-kept" role="status" aria-label="Se mantiene al mezclar" title="Se mantiene al mezclar"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg></span>}
                      </CanvasPieceOverlay>}

                      </Fragment>
                    );
                  })}
                </div>

              </div>
            </div>

              <div className="studio-document-actions" role="group" aria-label="Crear y probar looks" data-piece-selected={selectedCanvasPiece ? "true" : undefined}>
                {selectedCanvasPiece && selectedCanvasGarment && <div className="selected-piece-actions" role="group" aria-label={`Acciones de ${translateGarmentName(selectedCanvasGarment.name)}`}>
                  <span className="selected-piece-name">{translateGarmentName(selectedCanvasGarment.name)}</span>
                  <button type="button" className="canvas-icon-action" aria-label="Bajar una capa" title="Bajar una capa" disabled={savingOutfit || selectedLayerIndex === 0} onClick={() => changeLayer(selectedCanvasPiece.instanceId, "down")}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4M12 3v11M4 15l8 5 8-5M4 11l3 2m10 0 3-2" /></svg>
                  </button>
                  <button type="button" className="canvas-icon-action" aria-label="Subir una capa" title="Subir una capa" disabled={savingOutfit || selectedLayerIndex === selectedLayerOrder.length - 1} onClick={() => changeLayer(selectedCanvasPiece.instanceId, "up")}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 7 4-4 4 4M12 3v10M4 15l8 5 8-5M4 11l3 2m10 0 3-2" /></svg>
                  </button>
                  <button type="button" className="canvas-icon-action" aria-label="Duplicar prenda" title="Duplicar prenda" disabled={savingOutfit} onClick={() => duplicatePiece(selectedCanvasPiece.instanceId)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M15 8V4H4v11h4" /></svg>
                  </button>
                  <button type="button" className="canvas-icon-action danger-action" aria-label="Quitar del look" title="Quitar del look" disabled={savingOutfit} onClick={() => removePiece(selectedCanvasPiece.instanceId)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                  </button>
                </div>}
                <div className="look-document-actions">
                <button type="button" className="canvas-core-action new-look-action" aria-label="Nuevo look" onClick={newLook} disabled={savingOutfit} title="Nuevo look"><LookActionIcon action="new" /><span className="canvas-action-label">Nuevo</span></button>
                <button type="button" className="canvas-core-action mix-look-action" aria-label={randomizing ? "Mezclando…" : "Mezclar"} title="Mezclar" aria-busy={randomizing} onClick={() => void randomizeCurrentLook()} disabled={!canRandomize || randomizing || savingOutfit || !canvasDataReady}><LookActionIcon action="mix" /><span className="canvas-action-label">Mezclar</span></button>
                <button type="button" className="history-action" aria-label="Deshacer" title="Deshacer · ⌘Z" disabled={!history.current.past.length || savingOutfit} onClick={() => travelHistory("undo")}><LookActionIcon action="undo" /></button>
                <button type="button" className="history-action" aria-label="Rehacer" title="Rehacer · ⇧⌘Z" disabled={!history.current.future.length || savingOutfit} onClick={() => travelHistory("redo")}><LookActionIcon action="redo" /></button>
                <div className="canvas-utility-actions" role="group" aria-label="Acciones del look">
                  <button type="button" className="canvas-icon-action" aria-label="Guardar una copia" title="Guardar una copia" onClick={() => void duplicateCurrentOutfit()} disabled={savingOutfit || !canvasPieces.length}><LookActionIcon action="copy" /></button>
                  <button type="button" className="canvas-icon-action" aria-label={shareLookLabel} title={shareLookLabel} aria-busy={shareBusy} onClick={() => shareLook({ id: activeOutfitId ?? "current-share", name: activeLookName || "Mi look", items: currentSnapshotItems() })} disabled={shareBusy || !canvasPieces.length}><LookActionIcon action="share" /></button>
                  <button type="button" className="canvas-icon-action danger-action" aria-label="Vaciar canvas" title="Vaciar canvas" disabled={savingOutfit || !canvasPieces.length} onClick={() => { canvasGestures.current?.cancel(); checkpoint(); setCanvasPieces([]); setSelectedId(""); setSelectedGroupIds([]); setSaved(false); }}><LookActionIcon action="clear" /></button>
                </div>
                <button type="button" className={`primary-action save-look-action ${saved ? "saved" : ""}`} aria-label={saveLookLabel} title={saveLookLabel} aria-busy={savingOutfit} disabled={savingOutfit || !canvasPieces.length || saved} onClick={() => void saveCurrentOutfit()}><LookActionIcon action="save" /><span className="canvas-action-label">{saved && !savingOutfit ? "Guardado" : "Guardar"}</span></button>
                </div>
              </div>
            <div className="studio-library-column">
            <aside className="look-controls garment-library-panel panel-open" id="canvas-garment-library" aria-label="Prendas y categorías" data-grid-size={canvasGridSize}>
              <h2>Prendas</h2>
              <div className="library-tools">
              <div className="library-options">
                {!demoMode && basicsEnabled && <label><span className="sr-only">Colección del canvas</span><select aria-label="Colección del canvas" value={librarySource} onChange={event => setLibrarySource(event.target.value as "personal" | "basics")}>
                  <option value="personal">Mis prendas</option><option value="basics">Básicos Formé</option>
                </select></label>}
                <label><span className="sr-only">Categoría de prendas</span><select aria-label="Categoría de prendas" value={studioLibraryFilter} onChange={event => setStudioLibraryFilter(event.target.value as StudioLibraryFilter)}>
                  <option value="all">Todas</option><option value="outerwear">Casacas y abrigos</option><option value="tops">Tops</option><option value="bottoms">Pantalones y faldas</option><option value="one-pieces">Vestidos y enterizos</option><option value="footwear">Calzado</option><option value="accessories">Accesorios</option>
                </select></label>
              </div>
              <GarmentViewControls size={canvasGridSize} onSizeChange={setCanvasGridSize} favorites={libraryFavoritesOnly} onFavoritesChange={setLibraryFavoritesOnly} compact />
              </div>
              <label className="library-search"><span className="sr-only">Buscar en la biblioteca</span><input type="search" placeholder="Buscar" value={libraryQuery} onChange={event => setLibraryQuery(event.target.value)} /></label>
              {replacingId && <div className="replacement-notice">Elige la nueva prenda.<button type="button" onClick={() => setReplacingId(null)}>Cancelar</button></div>}
              <div className="sticker-tray-groups">
                {!showingLibraryBasics && studioPersonalGarments.length > 0 && <section className="sticker-tray-section" aria-label="Mis prendas">
                  <div className="sticker-tray">{studioPersonalGarments.map((item) => {
                      const photo = garmentPhotoFor(item, "complete");
                      return <button key={item.id} onClick={() => addToCanvas(item.id)} aria-label={`${galleryWillReplace ? "Reemplazar con" : "Añadir"} ${translateGarmentName(item.name)}${galleryWillReplace ? "" : " al canvas"}`}>
                        <img src={imageSrc(photo.image)} alt="" loading="lazy" data-photo-role={photo.role} />
                        <span className="canvas-thumbnail-label">{translateGarmentName(item.name)}</span>
                      </button>;
                    })}</div>
                </section>}
                {showingLibraryBasics && studioBasicGarments.length > 0 && <section className="sticker-tray-section forme-basics-section" aria-label="Básicos Formé">
                  <div className="sticker-tray">{studioBasicGarments.map((item) => {
                      const photo = garmentPhotoFor(item, "complete");
                      return <button key={item.id} onClick={() => addToCanvas(item.id)} aria-label={`${galleryWillReplace ? "Reemplazar con" : "Añadir"} ${translateGarmentName(item.name)}${galleryWillReplace ? "" : " al canvas"}`}>
                        <img src={imageSrc(photo.image)} alt="" loading="lazy" data-photo-role={photo.role} />
                        <span className="canvas-thumbnail-label">{translateGarmentName(item.name)}</span>
                      </button>;
                    })}</div>
                </section>}
                {(showingLibraryBasics ? studioBasicGarments : studioPersonalGarments).length === 0 && <div className="canvas-library-empty">
                  {(showingLibraryBasics || personalGarments.length > 0) && <p>{libraryFavoritesOnly ? "No hay favoritas con estos filtros." : "No encontramos prendas."}</p>}
                  <button type="button" onClick={() => {
                    if (!showingLibraryBasics && !personalGarments.length) { openUpload(); return; }
                    setStudioLibraryFilter("all"); setLibraryQuery(""); setLibraryFavoritesOnly(false);
                  }}>{!showingLibraryBasics && !personalGarments.length ? "Añadir prendas" : libraryFavoritesOnly ? "Ver todas las prendas" : "Limpiar búsqueda"}</button>
                </div>}
              </div>
            </aside>

            {savedLooksOpen && <aside className={`saved-looks-panel ${savedLooksOpen ? "panel-open" : "panel-closed"}`} id="canvas-saved-looks" aria-label="Looks">
              <h2>Looks guardados</h2>
              <button type="button" className="canvas-panel-close" onClick={() => setSavedLooksOpen(false)} aria-label="Cerrar looks"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button>
              {savedLooks.length > 0
                ? <div className="saved-look-panel-list">{savedLooks.map((look) => (
                  <article className={`saved-look-panel-card ${activeOutfitId === look.id ? "active" : ""}`} key={look.id} aria-label={look.name}>
                    <button type="button" className="saved-look-panel-open" onClick={() => openSavedLook(look)} aria-label={`Abrir ${look.name}`} title={look.name} aria-pressed={activeOutfitId === look.id} disabled={savingOutfit || Boolean(deletingLookId)}>
                      <LookPreview look={look} garmentById={garmentById} />
                    </button>
                    <span className="saved-look-panel-name">{look.name}</span>
                  </article>
                ))}</div>
                : <div className="saved-look-panel-empty"><p>Guarda tu primer look.</p></div>}
            </aside>}
            {layersOpen && <aside className="canvas-layers-panel" id="canvas-layers" aria-label="Capas del look">
              <h2>Capas <span>{canvasPieces.length}</span></h2>{canvasPieces.length > 1 && <p>Las de arriba quedan delante.</p>}
              <button type="button" className="canvas-panel-close" onClick={() => setLayersOpen(false)} aria-label="Cerrar capas">×</button>
              <ol>{orderedLayers.map((piece, index) => { const garment = garmentById.get(piece.garmentId); if (!garment) return null; return <li key={piece.instanceId} className={selectedId === piece.instanceId ? "active" : ""}>
                <button type="button" className="layer-select" aria-pressed={selectedId === piece.instanceId} onClick={() => { setSelectedId(piece.instanceId); setSelectedGroupIds([]); if (window.innerWidth <= 699) setLayersOpen(false); }}><img src={imageSrc(garment.image)} alt="" /><span>{translateGarmentName(garment.name)}{lockedPieceIds.has(piece.instanceId) && <small>Se mantiene al mezclar</small>}</span></button>
                <button type="button" aria-label={`Subir ${translateGarmentName(garment.name)} una capa`} disabled={index === 0} onClick={() => changeLayer(piece.instanceId, "up")}>↑</button>
                <button type="button" aria-label={`Bajar ${translateGarmentName(garment.name)} una capa`} disabled={index === orderedLayers.length - 1} onClick={() => changeLayer(piece.instanceId, "down")}>↓</button>
              </li>; })}</ol>
              {!canvasPieces.length && <p>Añade prendas para ordenarlas aquí.</p>}
            </aside>}

            </div>

            {wardrobeError && <div className="canvas-status-message" role="status">{wardrobeError}<button type="button" onClick={() => setWardrobeError("")} aria-label="Cerrar mensaje">×</button></div>}
          </div>
        </section>
      )}

      {garmentDraft && editingGarment && (
        <FormeDialog labelledBy="garment-editor-title" className={`garment-editor ${garmentEditing ? "is-editing" : ""}`} onClose={() => { if (!savingGarment) setGarmentDraft(null); }}>
            <header className="garment-editor-header">
              <h2 id="garment-editor-title">{garmentEditing ? "Editar prenda" : garmentDraft.name || "Prenda"}</h2>
              <button type="button" disabled={savingGarment} onClick={() => setGarmentDraft(null)} aria-label="Cerrar ficha">×</button>
            </header>
            <div className="garment-editor-body">
              <div className="garment-editor-visual">
                {editorPhoto && <div className="garment-editor-image"><img src={imageSrc(editorPhoto.image)} alt={garmentDraft.name} data-photo-role={editorPhoto.role} /></div>}
              </div>
              {!garmentEditing ? <div className="garment-detail-copy">
                <p className="detail-eyebrow">{translateValue(garmentDraft.garmentType)}{garmentDraft.brand ? ` · ${garmentDraft.brand}` : ""}</p>
                {garmentDraft.description.trim() && garmentDraft.description.trim() !== garmentDraft.name.trim() && <p>{garmentDraft.description}</p>}
                <dl><div><dt>Color</dt><dd>{translateValue(garmentDraft.colorFamily)}</dd></div><div><dt>Material</dt><dd>{translateValue(garmentDraft.material)}</dd></div></dl>
                <button className="primary-action" type="button" disabled={savingGarment} onClick={() => { void addAndOpenStudio(editingGarment.id); setGarmentDraft(null); }}>Añadir al Canvas</button>
                {editingGarment.collection !== "forme" && <div className="garment-detail-actions">
                  <button type="button" disabled={savingGarment} aria-pressed={Boolean(editingGarment.favorite)} onClick={() => void toggleFavorite(editingGarment)}>{editingGarment.favorite ? "Quitar de favoritas" : "Añadir a favoritas"}</button>
                  <button type="button" disabled={savingGarment} onClick={() => setGarmentEditing(true)}>Editar ficha</button>
                  <button type="button" disabled={savingGarment} onClick={() => openShareTemplate({ kind: "garment", garment: editingGarment })}>Compartir imagen</button>
                </div>}
                {editingGarment.collection !== "forme" && <div className="garment-sharing" aria-busy={savingGarment}>
                  <label className="item-public-toggle">
                    <span><strong>Mostrar en mi perfil</strong><small id="garment-visibility-help">{savingGarment ? "Guardando…" : !profile.profilePublic ? "Oculta mientras tu perfil sea privado." : !profile.showCloset ? "Oculta hasta activar «Mostrar prendas elegidas» en tu perfil." : editingGarment.isPublic ? "Visible en tu perfil público." : "Solo tú puedes verla."}</small></span>
                    <input type="checkbox" aria-label="Mostrar en mi perfil" aria-describedby="garment-visibility-help" checked={Boolean(editingGarment.isPublic)} disabled={savingGarment} onChange={(event) => void setGarmentVisibility(editingGarment, event.target.checked)} />
                  </label>
                  {(!profile.profilePublic || !profile.showCloset) && <button className="garment-profile-link" type="button" disabled={savingGarment} onClick={() => { setGarmentDraft(null); navigateWardrobeRoute("perfil"); }}>Configurar perfil público</button>}
                  {garmentSaveError && <p className="garment-save-error" role="alert">{garmentSaveError}</p>}
                </div>}
              </div> :
              <form className="garment-editor-form" aria-busy={savingGarment} onSubmit={(event) => { event.preventDefault(); void saveGarmentDraft(); }}><fieldset disabled={savingGarment}>
                <div className="garment-editor-fields">
                  <label className="field-wide">Nombre<input value={garmentDraft.name} onChange={(event) => updateGarmentDraft("name", event.target.value)} /></label>

                  <label className="field-wide">Marca<input list="forme-brand-options" value={garmentDraft.brand} onChange={(event) => updateGarmentDraft("brand", event.target.value)} onBlur={() => normalizeGarmentMetadata("brand", brandOptions)} placeholder="Opcional" autoCapitalize="words" autoComplete="off" spellCheck={false} /></label>
                  <label>Tipo<select value={garmentDraft.garmentType} onChange={(event) => {
                    const garmentType = event.target.value as Garment["garmentType"];
                    const category = (Object.keys(garmentTypesByCategory) as Garment["category"][]).find(key => garmentTypesByCategory[key].includes(garmentType))!;
                    setGarmentDraft(current => current ? { ...current, category, garmentType, lengthOverride: current.category === category ? current.lengthOverride : null } : current);
                    setGarmentSaved(false); setGarmentSaveError("");
                  }}>{Object.entries(garmentTypesByCategory).map(([category, types]) => <optgroup label={translateValue(category)} key={category}>{types.map(type => <option value={type} key={type}>{translateValue(type)}</option>)}</optgroup>)}</select></label>
                  <label>Color<input list="forme-color-options" value={translateValue(garmentDraft.colorFamily)} onChange={(event) => updateGarmentDraft("colorFamily", event.target.value)} onBlur={() => normalizeGarmentMetadata("colorFamily", colorOptions, "Other")} autoComplete="off" /></label>
                </div>
                <details className="garment-edit-advanced"><summary>Detalles</summary><div className="garment-editor-fields">
                  <label className="field-wide">Descripción<textarea value={garmentDraft.description} maxLength={1000} rows={3} onChange={(event) => updateGarmentDraft("description", event.target.value)} /></label>
                  <label>Tono<select value={garmentDraft.tone} onChange={(event) => updateGarmentDraft("tone", event.target.value)}>{editorTones.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  <label>Material<input list="forme-material-options" value={translateValue(garmentDraft.material)} onChange={(event) => updateGarmentDraft("material", event.target.value)} onBlur={() => normalizeGarmentMetadata("material", materialOptions, "Other")} autoComplete="off" /></label>
                  <label>Acabado<select value={garmentDraft.finish} onChange={(event) => updateGarmentDraft("finish", event.target.value)}>{filterOptions.finish.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  {editorLengths.length > 0 && <label>Largo en el Canvas<select value={garmentDraft.lengthOverride ?? ""} onChange={event => updateGarmentDraft("lengthOverride", event.target.value ? event.target.value as LengthOverride : null)}>
                    <option value="">{detectedLengthLabel ? `Automático · ${detectedLengthLabel}` : "Automático"}</option>
                    {editorLengths.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select></label>}
                  <label>Corte<select value={garmentDraft.silhouette} onChange={(event) => updateGarmentDraft("silhouette", event.target.value)}>{filterOptions.silhouette.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                </div>
                <datalist id="forme-brand-options">{brandOptions.map((option) => <option value={option} key={option} />)}</datalist>
                <datalist id="forme-color-options">{colorOptions.map((option) => <option value={translateValue(option)} key={option} />)}</datalist>
                <datalist id="forme-material-options">{materialOptions.map((option) => <option value={translateValue(option)} key={option} />)}</datalist>

                <div className="custom-tag-editor">
                  <div><span>Etiquetas</span></div>
                  {garmentDraft.tags.length > 0 && <div className="custom-tag-list">{garmentDraft.tags.map((tag) => <button type="button" key={tag} aria-label={`Quitar etiqueta ${tag}`} onClick={() => updateGarmentDraft("tags", garmentDraft.tags.filter((item) => item !== tag))}>{tag}<span>×</span></button>)}</div>}
                  <div className="tag-input-row"><input aria-label="Nueva etiqueta" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={handleTagKeyDown} placeholder="Ej.: viaje, oficina" /><button type="button" onClick={addDraftTag} disabled={!tagInput.trim()}>Añadir</button></div>
                </div>

                </details>
                {editingGarment.originalImage && ["ready", "uploaded", "failed", "review"].includes(editingGarment.status) && <details className="processing-options">
                  <summary>Mejorar imagen</summary>
                  <div>
                    <p>Se creará otra imagen a partir de tu foto original.</p>
                    <div className="processing-option-actions">
                      <button type="button" onClick={() => retryProcessing(editingGarment, "medium", "closed")}>Generar de nuevo</button>
                    </div>
                  </div>
                </details>}

                <div className="garment-editor-actions">
                  <button type="button" className="delete-garment" onClick={() => deleteGarment(editingGarment)}>Eliminar</button>
                  {garmentSaveError && <span className="garment-save-error">{garmentSaveError}</span>}
                  <button type="button" onClick={() => setGarmentDraft(null)}>Cancelar</button>
                  <button type="submit" className={garmentSaved ? "saved" : ""}>{savingGarment ? "Guardando…" : garmentSaved ? "Guardado" : "Guardar cambios"}</button>
                </div>
              </fieldset></form>}
            </div>
        </FormeDialog>
      )}

      {pendingDelete && <FormeDialog labelledBy="delete-title" className="confirmation-dialog" onClose={() => setPendingDelete(null)}>
        <h2 id="delete-title">¿Eliminar {pendingDelete.name}?</h2>
        <p>{pendingDelete.kind === "look" ? "Se eliminará de tus looks guardados. Tus prendas seguirán en el closet." : "La prenda se quitará de tu closet."}</p>
        <div className="confirmation-actions"><button type="button" className="secondary-action" autoFocus onClick={() => setPendingDelete(null)}>Cancelar</button><button type="button" className="primary-action" onClick={() => { const item = pendingDelete; setPendingDelete(null); if (item.kind === "look") void performDeleteSavedLook(item.id); else { const garment = garmentById.get(item.id); if (garment) void performDeleteGarment(garment); } }}>Eliminar</button></div>
      </FormeDialog>}
      {shareTarget && <ShareTemplateDialog
        target={shareTarget}
        options={shareOptions}
        garmentById={garmentById}
        handle={profile.handle}
        busy={shareBusy}
        onOptions={setShareOptions}
        onClose={() => setShareTarget(null)}
        onExport={() => void exportShareTemplate()}
      />}
      <FormeMobileNav
        activeRoute={activeRoute}
        view={view}
        onNavigate={(route) => navigateWardrobeRoute(route)}
        onOpenCanvas={() => openStudio(wardrobePanel)}
      />
    </main>
  );
}

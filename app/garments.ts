export type GarmentAttributes = {
  colorFamily: string;
  tone: string;
  material: string;
  finish: string;
  silhouette: string;
};

export type Garment = GarmentAttributes & {
  id: string;
  name: string;
  brand?: string;
  tags?: string[];
  category: "Outerwear" | "Tops" | "Bottoms" | "Tailoring";
  color: string;
  image: string;
  openImage?: string;
  status: "ghosted" | "original";
  favorite?: boolean;
};

type ArchiveEntry = Omit<Garment, "id" | "image" | "openImage" | "status" | keyof GarmentAttributes> & {
  file: string;
  openFile?: string;
};

type BasicEntry = Omit<Garment, keyof GarmentAttributes>;

const washedBlack = /Essentials|Open-Knit|Draped Black Shirt|Oversized Black Tee|Washed Black Jeans/i;
const pitchBlack = /Peacoat|Trench|Cape|Poncho|Blazer|Wide-Leg/i;

function colorAttributes(color: string, name: string): Pick<GarmentAttributes, "colorFamily" | "tone"> {
  if (color.includes("/")) return { colorFamily: "Multicolor", tone: color };
  if (/black/i.test(color)) {
    const tone = washedBlack.test(name) || /washed/i.test(color) ? "Washed black" : pitchBlack.test(name) ? "Pitch black" : "Black";
    return { colorFamily: "Black", tone };
  }
  if (/ivory/i.test(color)) return { colorFamily: "White", tone: "Ivory" };
  if (/cream/i.test(color)) return { colorFamily: "White", tone: "Cream" };
  if (/white/i.test(color)) return { colorFamily: "White", tone: "Optic white" };
  if (/brown/i.test(color)) return { colorFamily: "Brown", tone: /shearling/i.test(name) ? "Dark brown" : "Brown" };
  if (/camel|tan/i.test(color)) return { colorFamily: "Brown", tone: "Tan / camel" };
  if (/navy/i.test(color)) return { colorFamily: "Blue", tone: "Navy" };
  if (/light blue/i.test(color)) return { colorFamily: "Blue", tone: "Light blue" };
  if (/denim|indigo/i.test(color)) return { colorFamily: "Blue", tone: "Denim blue" };
  if (/blue/i.test(color)) return { colorFamily: "Blue", tone: /embroidered/i.test(name) ? "Navy" : "Denim blue" };
  if (/sage/i.test(color)) return { colorFamily: "Green", tone: "Sage" };
  if (/greige/i.test(color)) return { colorFamily: "Grey", tone: "Greige" };
  if (/stone/i.test(color)) return { colorFamily: "Grey", tone: "Stone" };
  if (/orange/i.test(color)) return { colorFamily: "Red / orange", tone: "Orange" };
  return { colorFamily: "Other", tone: color || "Unclassified" };
}

function materialFor(name: string): string {
  if (/Transparent Rain/i.test(name)) return "Transparent shell";
  if (/Shearling/i.test(name)) return "Shearling";
  if (/Leather/i.test(name)) return "Leather";
  if (/Fleece/i.test(name)) return "Fleece";
  if (/Denim|Jeans/i.test(name)) return "Denim";
  if (/Crewneck|Sweater/i.test(name)) return "Knit";
  if (/Tee|Shirt|Coach Jacket|Human Made|Frog-Closure|Pleated Chinos|Collarless/i.test(name)) return "Cotton";
  if (/Peacoat|Blazer|Trench|Coat|Cape|Poncho|Wide-Leg Trousers|Toggle Jacket/i.test(name)) return "Wool blend";
  if (/Bomber|Shell|Parka|Puffer|Padded Collar|Track|Field Jacket|Utility|Drawcord|Varsity|Blouson/i.test(name)) return "Technical nylon";
  return "Cotton";
}

function finishFor(name: string, material: string): string {
  if (material === "Transparent shell") return "Transparent";
  if (/Fleece|Shearling|Open-Knit|Fur-Trim/i.test(name)) return "Textured";
  if (/Leather Hooded Shirt|Leather Zip Blouson/i.test(name)) return "Glossy";
  if (material === "Leather" || /WFP Bomber|Graphic Varsity|Puffer|Track Shell|Lightweight Shell/i.test(name)) return "Low sheen";
  return "Matte";
}

function silhouetteFor(name: string): string {
  if (/Cropped/i.test(name)) return "Cropped";
  if (/Draped|Kimono|Wrap|Asymmetric|Belted/i.test(name)) return "Draped";
  if (/Peacoat|Coat|Trench|Parka|Longline/i.test(name)) return "Longline";
  if (/Oversized|Puffer|Funnel-Neck|Cape|Poncho|Wide-Leg/i.test(name)) return "Oversized";
  if (/Bomber|Blouson|Crewneck|Sweater|Fleece|Shell|Pleated|Hooded|Varsity/i.test(name)) return "Relaxed";
  return "Regular";
}

export function classifyGarment(item: Pick<Garment, "name" | "category" | "color">): GarmentAttributes {
  const color = colorAttributes(item.color, item.name);
  const material = materialFor(item.name);
  return {
    ...color,
    material,
    finish: finishFor(item.name, material),
    silhouette: silhouetteFor(item.name),
  };
}

const archive: ArchiveEntry[] = [
  { file: "001_DSC01768.webp", openFile: "001_DSC01768-open.webp", name: "Daisy Coach Jacket", category: "Outerwear", color: "Black", favorite: true },
  { file: "002_DSC01771.webp", openFile: "002_DSC01771-open.webp", name: "WFP Bomber", category: "Outerwear", color: "Black" },
  { file: "003_DSC01773.webp", openFile: "003_DSC01773-open.webp", name: "Navy Peacoat", category: "Tailoring", color: "Navy" },
  { file: "004_DSC01775.webp", openFile: "004_DSC01775-open.webp", name: "Leather Hooded Shirt", category: "Outerwear", color: "Black" },
  { file: "005_DSC01777.webp", openFile: "005_DSC01777-open.webp", name: "Utility Field Jacket", category: "Outerwear", color: "Black" },
  { file: "006_DSC01779.webp", openFile: "006_DSC01779-open.webp", name: "Leather Blazer", category: "Tailoring", color: "Brown" },
  { file: "007_DSC01781.webp", openFile: "007_DSC01781-open.webp", name: "Asymmetric Trench", category: "Outerwear", color: "Black" },
  { file: "008_DSC01783.webp", openFile: "008_DSC01783-open.webp", name: "Padded Collar Jacket", category: "Outerwear", color: "Black", favorite: true },
  { file: "009_DSC01785.webp", openFile: "009_DSC01785-open.webp", name: "Belted Short Coat", category: "Tailoring", color: "Black" },
  { file: "010_DSC01787.webp", openFile: "010_DSC01787-open.webp", name: "Leather Bomber", category: "Outerwear", color: "Black" },
  { file: "011_DSC01789.webp", openFile: "011_DSC01789-open.webp", name: "Single-Breasted Blazer", category: "Tailoring", color: "Black" },
  { file: "012_DSC01791.webp", openFile: "012_DSC01791-open.webp", name: "Track Shell", category: "Outerwear", color: "Black" },
  { file: "013_DSC01793.webp", openFile: "013_DSC01793-open.webp", name: "Leather Sports Bomber", category: "Outerwear", color: "Black" },
  { file: "014_DSC01795.webp", openFile: "014_DSC01795-open.webp", name: "Drawcord Bomber", category: "Outerwear", color: "Black" },
  { file: "015_DSC01797.webp", openFile: "015_DSC01797-open.webp", name: "Graphic Tailored Blazer", category: "Tailoring", color: "Black" },
  { file: "016_DSC01799.webp", openFile: "016_DSC01799-open.webp", name: "Camel Wrap Coat", category: "Outerwear", color: "Camel" },
  { file: "017_DSC01801.webp", name: "Funnel-Neck Cape", category: "Outerwear", color: "Black" },
  { file: "018_DSC01803.webp", openFile: "018_DSC01803-open.webp", name: "Leather Hooded Bomber", category: "Outerwear", color: "Black" },
  { file: "019_DSC01804.webp", openFile: "019_DSC01804-open.webp", name: "Leather Zip Blouson", category: "Outerwear", color: "Black" },
  { file: "020_DSC01806.webp", openFile: "020_DSC01806-open.webp", name: "Long Black Trench", category: "Outerwear", color: "Black" },
  { file: "021_DSC01808.webp", openFile: "021_DSC01808-open.webp", name: "Lightweight Shell", category: "Outerwear", color: "Black" },
  { file: "022_DSC01810.webp", openFile: "022_DSC01810-open.webp", name: "Tiger Fleece", category: "Outerwear", color: "Orange" },
  { file: "023_DSC01814.webp", openFile: "023_DSC01814-open.webp", name: "Graphic Varsity Jacket", category: "Outerwear", color: "Black / Green" },
  { file: "024_DSC01816.webp", name: "Essentials Crewneck", category: "Tops", color: "Black", favorite: true },
  { file: "025_DSC01819.webp", openFile: "025_DSC01819-open.webp", name: "Fur-Trim Leather Bomber", category: "Outerwear", color: "Black" },
  { file: "026_DSC01822.webp", openFile: "026_DSC01822-open.webp", name: "Tan Coach Jacket", category: "Outerwear", color: "Tan" },
  { file: "027_DSC01824.webp", openFile: "027_DSC01824-open.webp", name: "Hooded Field Parka", category: "Outerwear", color: "Black" },
  { file: "028_DSC01826.webp", name: "Open-Knit Sweater", category: "Tops", color: "Black" },
  { file: "029_DSC01830.webp", openFile: "029_DSC01830-open.webp", name: "Sage Puffer", category: "Outerwear", color: "Sage" },
  { file: "030_DSC01833.webp", openFile: "030_DSC01833-open.webp", name: "Kimono Blazer", category: "Tailoring", color: "Black" },
  { file: "031_DSC01835.webp", name: "Embroidered Cape Coat", category: "Outerwear", color: "Black" },
  { file: "032_DSC01838.webp", openFile: "032_DSC01838-open.webp", name: "Greige Technical Shell", category: "Outerwear", color: "Greige" },
  { file: "033_DSC01840.webp", openFile: "033_DSC01840-open.webp", name: "Brown Shearling Coat", category: "Outerwear", color: "Brown" },
  { file: "034_DSC01842.webp", openFile: "034_DSC01842-open.webp", name: "Floral Fleece", category: "Outerwear", color: "Brown / Black" },
  { file: "035_DSC01845.webp", openFile: "035_DSC01845-open.webp", name: "Embroidered Coach Jacket", category: "Outerwear", color: "Blue" },
  { file: "036_DSC01848.webp", openFile: "036_DSC01848-open.webp", name: "Technical Long Parka", category: "Outerwear", color: "Black" },
  { file: "037_DSC01850.webp", openFile: "037_DSC01850-open.webp", name: "Transparent Rain Shell", category: "Outerwear", color: "Red / Blue" },
  { file: "038_DSC01857.webp", name: "Cape Coat", category: "Outerwear", color: "Black" },
  { file: "039_DSC01859.webp", openFile: "039_DSC01859-open.webp", name: "Ivory Collarless Jacket", category: "Outerwear", color: "Ivory" },
  { file: "040_DSC01861.webp", openFile: "040_DSC01861-open.webp", name: "Light Denim Jacket", category: "Outerwear", color: "Denim" },
  { file: "041_DSC01863.webp", name: "Draped Wool Poncho", category: "Outerwear", color: "Black" },
  { file: "042_DSC01867.webp", openFile: "042_DSC01867-open.webp", name: "Frog-Closure Jacket", category: "Outerwear", color: "Greige" },
  { file: "043_DSC01871.webp", name: "Contrast-Piped Shirt", category: "Tops", color: "Black" },
  { file: "044_DSC01873.webp", name: "Draped Black Shirt", category: "Tops", color: "Black" },
  { file: "045_DSC01875.webp", openFile: "045_DSC01875-open.webp", name: "Human Made Jacket", category: "Outerwear", color: "Cream", favorite: true },
  { file: "046_DSC01878.webp", openFile: "046_DSC01878-open.webp", name: "MA-1 Bomber", category: "Outerwear", color: "Black" },
  { file: "047_DSC01880.webp", openFile: "047_DSC01880-open.webp", name: "Toggle Jacket", category: "Outerwear", color: "Cream" },
  { file: "048_DSC01882.webp", openFile: "048_DSC01882-open.webp", name: "White Track Shell", category: "Outerwear", color: "White" },
  { file: "049_DSC01884.webp", openFile: "049_DSC01884-open.webp", name: "Ivory Technical Shell", category: "Outerwear", color: "Ivory" },
  { file: "050_DSC01888.webp", openFile: "050_DSC01888-open.webp", name: "Cropped Double Blazer", category: "Tailoring", color: "Black" },
];

const basics: BasicEntry[] = [
  { id: "bottom-blue-jeans", name: "Classic Straight Jeans", category: "Bottoms", color: "Indigo", image: "/wardrobe/cutouts/blue-straight-jeans.webp", status: "ghosted", favorite: true },
  { id: "bottom-black-jeans", name: "Washed Black Jeans", category: "Bottoms", color: "Washed Black", image: "/wardrobe/cutouts/washed-black-jeans.webp", status: "ghosted" },
  { id: "bottom-black-trouser", name: "Wide-Leg Trousers", category: "Bottoms", color: "Black", image: "/wardrobe/cutouts/black-wide-trousers.webp", status: "ghosted" },
  { id: "bottom-stone-chino", name: "Pleated Chinos", category: "Bottoms", color: "Stone", image: "/wardrobe/cutouts/stone-pleated-chinos.webp", status: "ghosted" },
  { id: "top-basic-white-tee", name: "Basic White Tee", category: "Tops", color: "White", image: "/wardrobe/cutouts/basic-white-tee.webp", status: "ghosted" },
  { id: "top-oversized-black-tee", name: "Oversized Black Tee", category: "Tops", color: "Black", image: "/wardrobe/cutouts/oversized-black-tee.webp", status: "ghosted" },
  { id: "top-blue-long-sleeve-shirt", name: "Blue Long-Sleeve Shirt", category: "Tops", color: "Light Blue", image: "/wardrobe/cutouts/blue-long-sleeve-shirt.webp", status: "ghosted" },
  { id: "top-black-short-sleeve-shirt", name: "Black Short-Sleeve Shirt", category: "Tops", color: "Black", image: "/wardrobe/cutouts/black-short-sleeve-shirt.webp", status: "ghosted" },
];

export const starterGarments: Garment[] = [
  ...archive.map(({ file, openFile, ...item }, index) => ({
    ...item,
    ...classifyGarment(item),
    id: `archive-${String(index + 1).padStart(3, "0")}`,
    image: `/wardrobe/cutouts/${file}`,
    openImage: openFile ? `/wardrobe/cutouts/${openFile}` : undefined,
    status: "ghosted" as const,
  })),
  ...basics.map((item) => ({ ...item, ...classifyGarment(item) })),
];

export type Garment = {
  id: string;
  name: string;
  category: "Outerwear" | "Tops" | "Bottoms" | "Tailoring";
  color: string;
  image: string;
  openImage?: string;
  status: "ghosted" | "original";
  favorite?: boolean;
};

type ArchiveEntry = Omit<Garment, "id" | "image" | "openImage" | "status"> & {
  file: string;
  openFile?: string;
};

const archive: ArchiveEntry[] = [
  { file: "001_DSC01768.webp", name: "Daisy Coach Jacket", category: "Outerwear", color: "Black", favorite: true },
  { file: "002_DSC01771.webp", openFile: "002_DSC01771-open.webp", name: "WFP Bomber", category: "Outerwear", color: "Black" },
  { file: "003_DSC01773.webp", name: "Navy Peacoat", category: "Tailoring", color: "Navy" },
  { file: "004_DSC01775.webp", name: "Leather Hooded Shirt", category: "Outerwear", color: "Black" },
  { file: "005_DSC01777.webp", name: "Utility Field Jacket", category: "Outerwear", color: "Black" },
  { file: "006_DSC01779.webp", openFile: "006_DSC01779-open.webp", name: "Leather Blazer", category: "Tailoring", color: "Brown" },
  { file: "007_DSC01781.webp", name: "Asymmetric Trench", category: "Outerwear", color: "Black" },
  { file: "008_DSC01783.webp", name: "Padded Collar Jacket", category: "Outerwear", color: "Black", favorite: true },
  { file: "009_DSC01785.webp", name: "Belted Short Coat", category: "Tailoring", color: "Black" },
  { file: "010_DSC01787.webp", name: "Leather Bomber", category: "Outerwear", color: "Black" },
  { file: "011_DSC01789.webp", name: "Single-Breasted Blazer", category: "Tailoring", color: "Black" },
  { file: "012_DSC01791.webp", name: "Track Shell", category: "Outerwear", color: "Black" },
  { file: "013_DSC01793.webp", name: "Leather Sports Bomber", category: "Outerwear", color: "Black" },
  { file: "014_DSC01795.webp", name: "Drawcord Bomber", category: "Outerwear", color: "Black" },
  { file: "015_DSC01797.webp", name: "Graphic Tailored Blazer", category: "Tailoring", color: "Black" },
  { file: "016_DSC01799.webp", name: "Camel Wrap Coat", category: "Outerwear", color: "Camel" },
  { file: "017_DSC01801.webp", name: "Funnel-Neck Cape", category: "Outerwear", color: "Black" },
  { file: "018_DSC01803.webp", name: "Leather Hooded Bomber", category: "Outerwear", color: "Black" },
  { file: "019_DSC01804.webp", name: "Leather Zip Blouson", category: "Outerwear", color: "Black" },
  { file: "020_DSC01806.webp", name: "Long Black Trench", category: "Outerwear", color: "Black" },
  { file: "021_DSC01808.webp", name: "Lightweight Shell", category: "Outerwear", color: "Black" },
  { file: "022_DSC01810.webp", name: "Tiger Fleece", category: "Outerwear", color: "Orange" },
  { file: "023_DSC01814.webp", openFile: "023_DSC01814-open.webp", name: "Graphic Varsity Jacket", category: "Outerwear", color: "Black / Green" },
  { file: "024_DSC01816.webp", name: "Essentials Crewneck", category: "Tops", color: "Black", favorite: true },
  { file: "025_DSC01819.webp", name: "Fur-Trim Leather Bomber", category: "Outerwear", color: "Black" },
  { file: "026_DSC01822.webp", name: "Tan Coach Jacket", category: "Outerwear", color: "Tan" },
  { file: "027_DSC01824.webp", name: "Hooded Field Parka", category: "Outerwear", color: "Black" },
  { file: "028_DSC01826.webp", name: "Open-Knit Sweater", category: "Tops", color: "Black" },
  { file: "029_DSC01830.webp", name: "Sage Puffer", category: "Outerwear", color: "Sage" },
  { file: "030_DSC01833.webp", name: "Kimono Blazer", category: "Tailoring", color: "Black" },
  { file: "031_DSC01835.webp", name: "Embroidered Cape Coat", category: "Outerwear", color: "Black" },
  { file: "032_DSC01838.webp", name: "Greige Technical Shell", category: "Outerwear", color: "Greige" },
  { file: "033_DSC01840.webp", name: "Brown Shearling Coat", category: "Outerwear", color: "Brown" },
  { file: "034_DSC01842.webp", name: "Floral Fleece", category: "Outerwear", color: "Brown / Black" },
  { file: "035_DSC01845.webp", name: "Embroidered Coach Jacket", category: "Outerwear", color: "Blue" },
  { file: "036_DSC01848.webp", name: "Technical Long Parka", category: "Outerwear", color: "Black" },
  { file: "037_DSC01850.webp", name: "Transparent Rain Shell", category: "Outerwear", color: "Red / Blue" },
  { file: "038_DSC01857.webp", name: "Cape Coat", category: "Outerwear", color: "Black" },
  { file: "039_DSC01859.webp", name: "Ivory Collarless Jacket", category: "Tops", color: "Ivory" },
  { file: "040_DSC01861.webp", openFile: "040_DSC01861-open.webp", name: "Light Denim Jacket", category: "Outerwear", color: "Denim" },
  { file: "041_DSC01863.webp", name: "Draped Wool Poncho", category: "Outerwear", color: "Black" },
  { file: "042_DSC01867.webp", name: "Frog-Closure Jacket", category: "Outerwear", color: "Greige" },
  { file: "043_DSC01871.webp", name: "Contrast-Piped Shirt", category: "Tops", color: "Black" },
  { file: "044_DSC01873.webp", name: "Draped Black Shirt", category: "Tops", color: "Black" },
  { file: "045_DSC01875.webp", name: "Human Made Jacket", category: "Outerwear", color: "Cream", favorite: true },
  { file: "046_DSC01878.webp", openFile: "046_DSC01878-open.webp", name: "MA-1 Bomber", category: "Outerwear", color: "Black" },
  { file: "047_DSC01880.webp", name: "Toggle Jacket", category: "Outerwear", color: "Cream" },
  { file: "048_DSC01882.webp", name: "White Track Shell", category: "Outerwear", color: "White" },
  { file: "049_DSC01884.webp", name: "Ivory Technical Shell", category: "Outerwear", color: "Ivory" },
  { file: "050_DSC01888.webp", name: "Cropped Double Blazer", category: "Tailoring", color: "Black" },
];

const basics: Garment[] = [
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
    id: `archive-${String(index + 1).padStart(3, "0")}`,
    image: `/wardrobe/cutouts/${file}`,
    openImage: openFile ? `/wardrobe/cutouts/${openFile}` : undefined,
    status: "ghosted" as const,
  })),
  ...basics,
];

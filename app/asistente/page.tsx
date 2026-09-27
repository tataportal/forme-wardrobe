import { redirect } from "next/navigation";
import { productFeatures } from "../product-features";
import { WardrobeApp } from "../wardrobe-app";

export default function AssistantPage() {
  if (!productFeatures.assistant) redirect("/canvas");
  return <WardrobeApp initialRoute="asistente" />;
}

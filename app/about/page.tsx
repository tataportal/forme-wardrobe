import type { Metadata } from "next";
import { FormeLanding } from "../forme-landing";

export const metadata: Metadata = {
  title: "Qué es Formé | Closet digital y asistente de estilo",
  description: "Digitaliza tus prendas, arma looks y recibe recomendaciones que aprenden de ti.",
};

export default function AboutPage() {
  return <FormeLanding />;
}

import savoirFaireAboutHtml from "../../public/savoir-exact/about/original-about.html?raw";

export function GET() {
  return new Response(savoirFaireAboutHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

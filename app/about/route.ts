import formeAboutHtml from "../../public/forme-about/about.html?raw";

export function GET() {
  return new Response(formeAboutHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

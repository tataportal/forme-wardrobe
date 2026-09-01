import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const WIDTH = 1600;
const HEIGHT = 900;
const OUTPUT = fileURLToPath(
  new URL("../public/forme-social-instagram-v1.gif", import.meta.url),
);
const TEMP = mkdtempSync(join(tmpdir(), "forme-social-preview-"));

const frames = [
  { background: "#ff0000", foreground: "#000000" },
  { background: "#000000", foreground: "#ffffff" },
  { background: "#ffffff", foreground: "#000000" },
  { background: "#000000", foreground: "#ffffff" },
];

function wordmarkSvg({ background, foreground }) {
  return `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${background}"/>
      <g fill="${foreground}">
        <text x="800" y="546" text-anchor="middle"
          font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
          font-size="309" font-weight="900" letter-spacing="-21">FORMÉ</text>
        <text x="1353" y="311"
          font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
          font-size="56" font-weight="700">®</text>
      </g>
    </svg>`;
}

try {
  const framePaths = [];

  for (const [index, colors] of frames.entries()) {
    const framePath = join(TEMP, `frame-${index}.png`);
    await sharp(Buffer.from(wordmarkSvg(colors))).png().toFile(framePath);
    framePaths.push(framePath);
  }

  const result = spawnSync(
    "magick",
    [
      "-delay",
      "50",
      ...framePaths,
      "-loop",
      "0",
      OUTPUT,
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || "ImageMagick no pudo generar el GIF social.");
  }

  console.log(
    JSON.stringify(
      {
        output: OUTPUT,
        width: WIDTH,
        height: HEIGHT,
        frames: frames.length,
        secondsPerFrame: 0.5,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(TEMP, { recursive: true, force: true });
}

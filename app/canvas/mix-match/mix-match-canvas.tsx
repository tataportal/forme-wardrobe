"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import styles from "./mix-match.module.css";

export type MixMatchGarment = {
  id: string;
  name: string;
  image?: string;
  colorFamily?: string;
  tone?: string;
  material?: string;
  finish?: string;
  silhouette?: string;
  garmentType?: string;
  favorite?: boolean;
};

type RailKey = "outerwear" | "tops" | "bottoms" | "footwear" | "accessories";

type Rail = {
  key: RailKey;
  label: string;
  options: MixMatchGarment[];
};

type Selection = Record<RailKey, number>;

type MixMatchCanvasProps = {
  outerwear: MixMatchGarment[];
  tops: MixMatchGarment[];
  bottoms: MixMatchGarment[];
  footwear: MixMatchGarment[];
  accessories: MixMatchGarment[];
};

const initialSelection: Selection = {
  outerwear: 3,
  tops: 3,
  bottoms: 3,
  footwear: 3,
  accessories: 0,
};

function selectedOption(rail: Rail, selection: Selection) {
  return rail.options[selection[rail.key]];
}

const neutralColors = new Set(["Black", "White", "Grey", "Brown"]);
const harmoniousColorPairs = new Set([
  "Blue|Brown",
  "Blue|Green",
  "Brown|Green",
  "Brown|Red / orange",
  "Green|Red / orange",
]);

function isNeutral(garment: MixMatchGarment) {
  return neutralColors.has(garment.colorFamily ?? "")
    || /black|white|grey|gray|ivory|cream|navy|brown|camel|tan|stone|greige/i.test(
      garment.tone ?? "",
    );
}

function isStatement(garment: MixMatchGarment) {
  return garment.colorFamily === "Multicolor"
    || garment.finish === "Glossy"
    || /graphic|embroidered|multicolor|neon|floral|contrast/i.test(
      `${garment.name} ${garment.tone ?? ""}`,
    );
}

function colorPairScore(first: MixMatchGarment, second: MixMatchGarment) {
  const firstColor = first.colorFamily ?? "";
  const secondColor = second.colorFamily ?? "";

  if (firstColor && firstColor === secondColor) return 2.8;
  if (firstColor === "Multicolor" || secondColor === "Multicolor") {
    return isNeutral(first) || isNeutral(second) ? 3.2 : -2.4;
  }
  if (isNeutral(first) && isNeutral(second)) return 2.1;
  if (isNeutral(first) || isNeutral(second)) return 2.6;

  const pair = [firstColor, secondColor].sort().join("|");
  return harmoniousColorPairs.has(pair) ? 1.8 : 0.2;
}

function combinationScore(garments: MixMatchGarment[]) {
  let score = 0;

  for (let firstIndex = 0; firstIndex < garments.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < garments.length;
      secondIndex += 1
    ) {
      score += colorPairScore(garments[firstIndex], garments[secondIndex]);
    }
  }

  const statementCount = garments.filter(isStatement).length;
  score += statementCount === 1 ? 1.4 : 0;
  score -= Math.max(0, statementCount - 1) * 2.8;

  const oversizedCount = garments.filter(
    (garment) => garment.silhouette === "Oversized",
  ).length;
  score -= Math.max(0, oversizedCount - 1) * 1.8;

  const top = garments.find((garment) =>
    ["T-shirt", "Shirt", "Sweater", "Sweatshirt", "Hoodie", "Top"].includes(
      garment.garmentType ?? "",
    )
  );
  const bottom = garments.find((garment) =>
    ["Jeans", "Trousers", "Chinos", "Skirt", "Shorts"].includes(
      garment.garmentType ?? "",
    )
  );
  const footwear = garments.find((garment) =>
    ["Sneakers", "Shoes", "Boots", "Heels", "Sandals"].includes(
      garment.garmentType ?? "",
    )
  );
  const outerwear = garments.find((garment) =>
    ["Jacket", "Coat", "Parka", "Bomber", "Cape", "Poncho", "Suit Jacket", "Blazer"].includes(
      garment.garmentType ?? "",
    )
  );

  if (top && footwear) {
    if (
      ["Hoodie", "Sweatshirt", "T-shirt"].includes(top.garmentType ?? "")
      && footwear.garmentType === "Sneakers"
    ) {
      score += 1.2;
    }
    if (
      top.garmentType === "Shirt"
      && ["Shoes", "Boots"].includes(footwear.garmentType ?? "")
    ) {
      score += 0.8;
    }
  }

  if (
    outerwear
    && footwear
    && ["Coat", "Suit Jacket", "Blazer"].includes(outerwear.garmentType ?? "")
    && ["Shoes", "Boots"].includes(footwear.garmentType ?? "")
  ) {
    score += 1;
  }

  if (
    bottom?.garmentType === "Shorts"
    && footwear
    && ["Shoes", "Heels"].includes(footwear.garmentType ?? "")
  ) {
    score -= 1.2;
  }

  score += garments.filter((garment) => garment.favorite).length * 0.35;
  return score;
}

function smartCombination(
  rails: Rail[],
  selection: Selection,
  visibleColumns: number,
) {
  const candidates: Array<{
    indices: number[];
    garments: MixMatchGarment[];
    score: number;
  }> = [];

  function visit(indices: number[], garments: MixMatchGarment[]) {
    const rail = rails[indices.length];
    if (!rail) {
      candidates.push({
        indices,
        garments,
        score: combinationScore(garments),
      });
      return;
    }

    const indexedOptions = rail.options.map((garment, index) => ({ garment, index }));
    const edgeColumns = Math.floor(visibleColumns / 2);
    const interiorOptions = indexedOptions.filter(({ index }) =>
      index >= edgeColumns && index < rail.options.length - edgeColumns
    );
    const visibleOptions = interiorOptions.length ? interiorOptions : indexedOptions;
    const alternateOptions = visibleOptions
      .filter(({ index }) => rail.options.length === 1 || index !== selection[rail.key]);
    const optionsToVisit = alternateOptions.length ? alternateOptions : visibleOptions;

    optionsToVisit.forEach(({ garment, index }) => {
      visit([...indices, index], [...garments, garment]);
    });
  }

  visit([], []);
  candidates.sort((first, second) => second.score - first.score);
  const pool = candidates.slice(0, Math.min(10, candidates.length));
  const winner = pool[Math.floor(Math.random() * pool.length)];

  return winner
    ? Object.fromEntries(
      rails.map((rail, index) => [rail.key, winner.indices[index]]),
    ) as Partial<Selection>
    : {};
}

function centerOptionInRail(
  railElement: HTMLDivElement,
  option: HTMLElement,
  behavior: ScrollBehavior,
) {
  const left = option.offsetLeft - (railElement.clientWidth - option.offsetWidth) / 2;
  if (Math.abs(railElement.scrollLeft - left) < 1) return;
  railElement.scrollTo({ left, behavior });
}

export function MixMatchCanvas({
  outerwear,
  tops,
  bottoms,
  footwear,
  accessories,
}: MixMatchCanvasProps) {
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [showOuterwear, setShowOuterwear] = useState(true);
  const [saved, setSaved] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("Desliza cada fila para cambiar la prenda.");
  const railRefs = useRef<Partial<Record<RailKey, HTMLDivElement | null>>>({});
  const scrollTimers = useRef<Partial<Record<RailKey, ReturnType<typeof setTimeout>>>>({});
  const scrollFrames = useRef<Partial<Record<RailKey, number>>>({});
  const lastWheelMove = useRef<Partial<Record<RailKey, number>>>({});
  const edgeAnimations = useRef<Partial<Record<RailKey, Animation>>>({});

  const coreRails = useMemo<Rail[]>(() => {
    const rails: Rail[] = [
      { key: "tops", label: "Top", options: tops },
      { key: "bottoms", label: "Parte inferior", options: bottoms },
      { key: "footwear", label: "Calzado", options: footwear },
    ];

    if (showOuterwear) {
      rails.unshift({ key: "outerwear", label: "Abrigo", options: outerwear });
    }

    return rails;
  }, [bottoms, footwear, outerwear, showOuterwear, tops]);

  const visibleRails = useMemo<Rail[]>(() => {
    if (!saved) return coreRails;
    return [
      ...coreRails,
      {
        key: "accessories",
        label: "Accesorios",
        options: [
          { id: "no-accessory", name: "Sin accesorio" },
          ...accessories,
        ],
      },
    ];
  }, [accessories, coreRails, saved]);

  useEffect(() => {
    return () => {
      Object.values(scrollTimers.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      Object.values(scrollFrames.current).forEach((frame) => {
        if (frame) window.cancelAnimationFrame(frame);
      });
      Object.values(edgeAnimations.current).forEach((animation) => {
        animation?.cancel();
      });
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      visibleRails.forEach((rail) => {
        if (rail.key === "accessories") return;
        const railElement = railRefs.current[rail.key];
        const option = railElement?.querySelector<HTMLElement>(
          `[data-option-index="${selection[rail.key]}"]`,
        );
        if (railElement && option) {
          centerOptionInRail(railElement, option, "auto");
        }
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [visibleRails]);

  function bounceRail(rail: Rail, railElement: HTMLDivElement, delta: number) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const amplitude = Math.min(26, Math.max(8, Math.abs(delta) * 0.18));
    const offset = delta < 0 ? amplitude : -amplitude;
    edgeAnimations.current[rail.key]?.cancel();
    edgeAnimations.current[rail.key] = railElement.animate(
      [
        { transform: "translateX(0)" },
        { transform: `translateX(${offset}px)`, offset: 0.32 },
        { transform: "translateX(0)" },
      ],
      {
        duration: Math.round(280 + amplitude * 4),
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
  }

  useEffect(() => {
    const cleanups = visibleRails.map((rail) => {
      const railElement = railRefs.current[rail.key];
      if (!railElement) return undefined;

      const handleWheel = (event: WheelEvent) => {
        if (saved && rail.key !== "accessories") return;

        const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
        if (!delta) return;

        event.preventDefault();
        const now = window.performance.now();
        if (now - (lastWheelMove.current[rail.key] ?? 0) < 280) return;

        const { nearestIndex } = nearestOptionToCenter(railElement);
        const direction = delta > 0 ? 1 : -1;
        const nextIndex = nearestIndex + direction;

        if (nextIndex < 0 || nextIndex >= rail.options.length) {
          lastWheelMove.current[rail.key] = now;
          bounceRail(rail, railElement, delta);
          return;
        }

        const nextOption = railElement.querySelector<HTMLElement>(
          `[data-option-index="${nextIndex}"]`,
        );
        if (nextOption) {
          lastWheelMove.current[rail.key] = now;
          centerOptionInRail(railElement, nextOption, "smooth");
        }
      };

      railElement.addEventListener("wheel", handleWheel, { passive: false });
      return () => railElement.removeEventListener("wheel", handleWheel);
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup?.());
    };
  }, [saved, visibleRails]);

  function moveRailTo(rail: Rail, index: number, behavior: ScrollBehavior = "smooth") {
    if (!rail.options.length) return;
    const nextIndex = Math.max(0, Math.min(index, rail.options.length - 1));
    const railElement = railRefs.current[rail.key];
    const option = railElement?.querySelector<HTMLElement>(`[data-option-index="${nextIndex}"]`);

    if (railElement && option) {
      centerOptionInRail(railElement, option, behavior);
      option.focus({ preventScroll: true });
    }
  }

  function nearestOptionToCenter(railElement: HTMLDivElement) {
    const options = Array.from(
      railElement.querySelectorAll<HTMLElement>("[data-option-index]"),
    );
    const firstOption = options[0];

    if (!firstOption) {
      return { nearestIndex: 0, nearestOption: null };
    }

    const secondOption = options[1];
    const gridStep = secondOption
      ? secondOption.offsetLeft - firstOption.offsetLeft
      : firstOption.offsetWidth;
    const firstCellCenter = firstOption.offsetLeft + firstOption.offsetWidth / 2;
    const viewportCenter = railElement.scrollLeft + railElement.clientWidth / 2;
    const nearestIndex = Math.max(
      0,
      Math.min(
        Math.round((viewportCenter - firstCellCenter) / gridStep),
        options.length - 1,
      ),
    );
    const nearestOption = options[nearestIndex] ?? null;
    return { nearestIndex, nearestOption };
  }

  function updateRailSelectionFromCenter(rail: Rail) {
    const railElement = railRefs.current[rail.key];
    if (!railElement || saved && rail.key !== "accessories") return;

    const { nearestIndex } = nearestOptionToCenter(railElement);

    setSelection((current) => (
      current[rail.key] === nearestIndex
        ? current
        : { ...current, [rail.key]: nearestIndex }
    ));
  }

  function snapRailToCenter(rail: Rail) {
    const railElement = railRefs.current[rail.key];
    if (!railElement || saved && rail.key !== "accessories") return;

    const { nearestIndex, nearestOption } = nearestOptionToCenter(railElement);
    if (nearestOption) {
      centerOptionInRail(railElement, nearestOption, "smooth");
    }

    setSelection((current) => (
      current[rail.key] === nearestIndex
        ? current
        : { ...current, [rail.key]: nearestIndex }
    ));
  }

  function handleRailScroll(rail: Rail) {
    if (!scrollFrames.current[rail.key]) {
      scrollFrames.current[rail.key] = window.requestAnimationFrame(() => {
        scrollFrames.current[rail.key] = undefined;
        updateRailSelectionFromCenter(rail);
      });
    }

    const existing = scrollTimers.current[rail.key];
    if (existing) clearTimeout(existing);
    scrollTimers.current[rail.key] = setTimeout(() => snapRailToCenter(rail), 150);
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    rail: Rail,
    index: number,
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    moveRailTo(rail, index + (event.key === "ArrowRight" ? 1 : -1));
  }

  function saveCurrentLook() {
    const coreSelection = Object.fromEntries(
      coreRails.map((rail) => [
        rail.key,
        selectedOption(rail, selection)?.id ?? null,
      ]),
    );

    window.localStorage.setItem(
      "forme-mix-match-look",
      JSON.stringify({ garments: coreSelection, accessory: null }),
    );
    setSaved(true);
    setFinished(false);
    setMessage("Look guardado. Ahora puedes añadir un accesorio.");
  }

  function finishLook() {
    const coreSelection = Object.fromEntries(
      coreRails.map((rail) => [
        rail.key,
        selectedOption(rail, selection)?.id ?? null,
      ]),
    );
    const accessoryRail = visibleRails.find((rail) => rail.key === "accessories");
    const accessory = accessoryRail
      ? selectedOption(accessoryRail, selection)?.id ?? null
      : null;

    window.localStorage.setItem(
      "forme-mix-match-look",
      JSON.stringify({
        garments: coreSelection,
        accessory: accessory === "no-accessory" ? null : accessory,
      }),
    );
    setFinished(true);
    setMessage("Look guardado.");
  }

  function editCoreLook() {
    setSaved(false);
    setFinished(false);
    setMessage("Desliza cada fila para cambiar la prenda.");
  }

  function toggleOuterwear() {
    setShowOuterwear((current) => !current);
    setSaved(false);
    setFinished(false);
    setMessage(showOuterwear ? "Look sin abrigo." : "Abrigo añadido.");
  }

  function mixCurrentLook() {
    const mixableRails = coreRails.filter((rail) => rail.options.length);
    const visibleColumns = window.innerWidth >= 1600
      ? 7
      : window.innerWidth >= 1024
        ? 5
        : 3;
    const nextSelection = smartCombination(
      mixableRails,
      selection,
      visibleColumns,
    );

    window.requestAnimationFrame(() => {
      mixableRails.forEach((rail) => {
        const nextIndex = nextSelection[rail.key];
        const railElement = railRefs.current[rail.key];
        const option = typeof nextIndex === "number"
          ? railElement?.querySelector<HTMLElement>(
            `[data-option-index="${nextIndex}"]`,
          )
          : null;

        if (railElement && option) {
          centerOptionInRail(railElement, option, "smooth");
        }
      });
    });

    setMessage("Look combinado por color, textura y silueta.");
  }

  return (
    <main
      className={`${styles.page} ${saved ? styles.saved : ""}`}
      style={{ "--rail-count": visibleRails.length } as React.CSSProperties}
    >
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/closet" aria-label="Formé, ir al closet">
          FORMÉ<span>®</span>
        </Link>

        <nav className={styles.navigation} aria-label="Navegación principal">
          <Link href="/closet">Closet</Link>
          <span aria-current="page">Canvas</span>
          <Link href="/asistente">Asistente</Link>
        </nav>

        <div className={styles.headerActions}>
          <button type="button" onClick={toggleOuterwear}>
            {showOuterwear ? "Quitar abrigo" : "Añadir abrigo"}
          </button>
          <Link href="/canvas">Canvas actual</Link>
        </div>
      </header>

      <section className={styles.rails} aria-label="Mix and match">
        {visibleRails.map((rail) => {
          const selectedIndex = selection[rail.key];
          const selected = selectedOption(rail, selection);
          const frozen = saved && rail.key !== "accessories";

          return (
            <section
              className={`${styles.rail} ${frozen ? styles.frozen : ""}`}
              data-rail={rail.key}
              key={rail.key}
              aria-labelledby={`mix-match-${rail.key}`}
            >
              <h2 id={`mix-match-${rail.key}`} className={styles.railLabel}>
                {rail.label}: {selected?.name ?? "Sin prendas"}
              </h2>

              {rail.options.length ? (
                <div
                  className={styles.railScroller}
                  ref={(node) => {
                    railRefs.current[rail.key] = node;
                  }}
                  onScroll={() => handleRailScroll(rail)}
                >
                  {rail.options.map((option, index) => (
                    <button
                      className={`${styles.option} ${index === selectedIndex ? styles.selected : ""}`}
                      data-option-index={index}
                      disabled={frozen}
                      key={option.id}
                      type="button"
                      aria-label={`${rail.label}: ${option.name}`}
                      aria-pressed={index === selectedIndex}
                      onClick={() => moveRailTo(rail, index)}
                      onKeyDown={(event) => handleOptionKeyDown(event, rail, index)}
                    >
                      {option.image ? (
                        <img src={option.image} alt="" draggable={false} />
                      ) : (
                        <span className={styles.emptyOption}>{option.name}</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyRail}>Añade prendas a tu closet para usar esta fila.</p>
              )}
            </section>
          );
        })}
      </section>

      <footer className={styles.footer}>
        <p aria-live="polite">{message}</p>
        <div className={styles.footerActions}>
          {saved && !finished ? (
            <button className={styles.secondaryAction} type="button" onClick={editCoreLook}>
              Editar look
            </button>
          ) : null}
          {!saved ? (
            <button className={styles.mixAction} type="button" onClick={mixCurrentLook}>
              Mix and match
            </button>
          ) : null}
          <button
            className={styles.primaryAction}
            type="button"
            disabled={finished}
            onClick={saved ? finishLook : saveCurrentLook}
          >
            {finished ? "Guardado" : saved ? "Terminar" : "Guardar look"}
          </button>
        </div>
      </footer>
    </main>
  );
}

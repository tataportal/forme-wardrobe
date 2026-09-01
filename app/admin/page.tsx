"use client";

import { useEffect, useMemo, useState } from "react";
import "./admin.css";

type PipelineStep = {
  key: string;
  label: string;
  state: "done" | "failed" | "skipped" | "processing" | "pending";
  timestamp: string | null;
};

type GenerationItem = {
  id: string;
  fullId: string;
  account: { id: string; name: string; email: string };
  sourceName: string;
  source: string | null;
  generated: string | null;
  generatedOpen: string | null;
  normalized: string | null;
  normalizedOpen: string | null;
  status: string;
  error: string | null;
  promptHistory: Array<{
    prompt: string;
    recordedAt: string | null;
    record: string;
    inputImage: string | null;
    outputImage: string | null;
  }>;
  pipeline: PipelineStep[];
};

type GenerationBatch = {
  id: string;
  mode: string;
  syncedAt: string;
  itemCount: number;
  accounts: Array<{ id: string; name: string; email: string; itemCount: number }>;
  items: GenerationItem[];
};

const emptyBatch: GenerationBatch = {
  id: "PRODUCCIÓN LIVE",
  mode: "live-d1-r2",
  syncedAt: "",
  itemCount: 0,
  accounts: [],
  items: [],
};

function time(value: string | null) {
  if (!value) return "sin timestamp";
  const lima = new Date(new Date(value).getTime() - 5 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(lima.getUTCDate())}/${pad(lima.getUTCMonth() + 1)}/${String(lima.getUTCFullYear()).slice(-2)} ${pad(lima.getUTCHours())}:${pad(lima.getUTCMinutes())}`;
}

function elapsed(current: string | null, previous: string | null) {
  if (!current || !previous) return null;
  const seconds = Math.max(0, Math.round((new Date(current).getTime() - new Date(previous).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60 ? `${seconds % 60} s` : ""}`.trim();
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60 ? `${minutes % 60} min` : ""}`.trim();
}

function previousTimestamp(steps: readonly { timestamp: string | null }[], index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (steps[cursor].timestamp) return steps[cursor].timestamp;
  }
  return null;
}

function stepMetric(steps: readonly { state: string; timestamp: string | null }[], index: number) {
  const step = steps[index];
  if (index === 0) return time(step.timestamp);
  if (step.state === "skipped") return "no aplica";
  if (!step.timestamp) return "sin dato";
  if (index === steps.length - 1) return elapsed(step.timestamp, steps[0].timestamp) ?? "sin dato";
  return elapsed(step.timestamp, previousTimestamp(steps, index)) ?? "sin dato";
}

function stepSortValue(steps: readonly { timestamp: string | null }[], index: number) {
  const current = steps[index]?.timestamp;
  if (!current) return -1;
  if (index === 0) return new Date(current).getTime();
  const previous = index === steps.length - 1 ? steps[0]?.timestamp : previousTimestamp(steps, index);
  if (!previous) return -1;
  return Math.max(0, new Date(current).getTime() - new Date(previous).getTime());
}

export default function AdminGenerations() {
  const [generationBatch, setGenerationBatch] = useState<GenerationBatch>(emptyBatch);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ index: number; direction: "desc" | "asc" } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/generations", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as GenerationBatch & { error?: string };
        if (!response.ok) throw new Error(payload.error || "No se pudo abrir producción.");
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setGenerationBatch(payload);
        setOpenId(payload.items[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "No se pudo abrir producción.");
      });
    return () => { active = false; };
  }, []);
  const filtered = useMemo(() => {
    const items = generationBatch.items.filter((item) =>
      (account === "all" || item.account.id === account) &&
      `${item.id} ${item.sourceName} ${item.account.email}`.toLowerCase().includes(query.toLowerCase())
    );
    if (!sort) return items;
    return [...items].sort((a, b) => {
      const difference = stepSortValue(b.pipeline, sort.index) - stepSortValue(a.pipeline, sort.index);
      return sort.direction === "desc" ? difference : -difference;
    });
  }, [query, account, sort, generationBatch.items]);

  function orderBy(index: number) {
    setSort((current) => current?.index === index
      ? { index, direction: current.direction === "desc" ? "asc" : "desc" }
      : { index, direction: "desc" });
  }

  return <main className="ops-shell">
    <header className="ops-header">
      <div><b>FORMÉ</b><span>ADMIN / IMAGE PIPELINE</span></div>
      <span>{generationBatch.id}{generationBatch.syncedAt ? ` · ${time(generationBatch.syncedAt)}` : ""}</span>
    </header>

    <section className="ops-toolbar">
      <div><h1>Generaciones</h1><p>{filtered.length} de {generationBatch.itemCount} piezas</p></div>
      <label>Cuenta
        <select value={account} onChange={(event) => setAccount(event.target.value)}>
          <option value="all">Todas las cuentas</option>
          {generationBatch.accounts.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.email}</option>)}
        </select>
      </label>
      <label>Buscar
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, archivo o email" />
      </label>
    </section>

    {loadError && <p className="ops-error" role="alert">{loadError}</p>}

    <section className="pipeline-table">
      <div className="pipeline-head">
        <span>Pieza</span>
        <button className={sort?.index === 0 ? "active" : ""} onClick={() => orderBy(0)} title="Ordenar por fecha de inicio">
          <span>Fecha</span>
          <i>{sort?.index === 0 && sort.direction === "asc" ? "↑" : "↓"}</i>
        </button>
        {generationBatch.items[0]?.pipeline.map((step, index) => index === 0
          ? <span className="head-centered" key={step.key}>{step.label}</span>
          : <button
            className={sort?.index === index ? "active" : ""}
            key={step.key}
            onClick={() => orderBy(index)}
            title="Ordenar por duración"
          >
            <span>{step.label}</span>
            <i>{sort?.index === index && sort.direction === "asc" ? "↑" : "↓"}</i>
          </button>)}
        <span>Detalle</span>
      </div>
      {filtered.map((item) => {
        const open = openId === item.id;
        const thumbnail = item.generated ?? item.generatedOpen ?? item.normalized ?? item.normalizedOpen ?? item.source;
        return <article className={`pipeline-row${open ? " open" : ""}`} key={item.id}>
          <div className="row-summary">
            <span className="piece-cell">
              {thumbnail ? <img src={thumbnail} alt="" /> : <span className="thumb-empty" aria-hidden="true" />}
              <span className="piece-meta"><b>#{item.id}</b><small>{item.sourceName}</small><em>{item.account.email}</em></span>
            </span>
            <time className="date-cell">{time(item.pipeline[0]?.timestamp ?? null)}</time>
            {item.pipeline.map((step, index) => <span className={`step-cell ${step.state}`} key={step.key} title={`${step.label}: ${time(step.timestamp)}`}>
              <i>{step.state === "done" ? "✓" : step.state === "failed" ? "!" : step.state === "skipped" ? "—" : "…"}</i>{index > 0 && <small>{stepMetric(item.pipeline, index)}</small>}
            </span>)}
            <button className="expand-cell" onClick={() => setOpenId(open ? null : item.id)} aria-expanded={open} aria-label={`${open ? "Cerrar" : "Ver"} detalle de ${item.id}`}>{open ? "↑" : "↓"}</button>
          </div>

          {open && <div className="row-detail">
            <section className="evidence-images">
              <figure><figcaption><span>Input</span>{item.source && <a href={item.source} target="_blank">Abrir archivo ↗</a>}</figcaption>{item.source && <a href={item.source} target="_blank"><img src={item.source} alt={`Input ${item.id}`} /></a>}</figure>
              <figure><figcaption><span>Generación cerrada</span>{item.generated && <a href={item.generated} target="_blank">Abrir archivo ↗</a>}</figcaption>{item.generated && <a href={item.generated} target="_blank"><img src={item.generated} alt={`Generación cerrada ${item.id}`} /></a>}</figure>
              {item.generatedOpen && <figure><figcaption><span>Generación abierta</span><a href={item.generatedOpen} target="_blank">Abrir archivo ↗</a></figcaption><a href={item.generatedOpen} target="_blank"><img src={item.generatedOpen} alt={`Generación abierta ${item.id}`} /></a></figure>}
              <figure className="alpha"><figcaption><span>Cutout cerrado</span>{item.normalized && <a href={item.normalized} target="_blank">Abrir archivo ↗</a>}</figcaption>{item.normalized && <a href={item.normalized} target="_blank"><img src={item.normalized} alt={`Cutout cerrado ${item.id}`} /></a>}</figure>
              {item.normalizedOpen && <figure className="alpha"><figcaption><span>Cutout abierto</span><a href={item.normalizedOpen} target="_blank">Abrir archivo ↗</a></figcaption><a href={item.normalizedOpen} target="_blank"><img src={item.normalizedOpen} alt={`Cutout abierto ${item.id}`} /></a></figure>}
            </section>

            <section className="prompt-history">
              <h2>Historial de prompts e inputs</h2>
              {item.promptHistory.map((entry, index) => <details key={`${entry.record}-${index}`} open={index === item.promptHistory.length - 1}>
                <summary><b>Intento {index + 1}</b><time>{time(entry.recordedAt)}</time><span>{entry.record}</span></summary>
                <div>
                  <nav className="history-links" aria-label={`Archivos del intento ${index + 1}`}>
                    {entry.inputImage && <a href={entry.inputImage} target="_blank">Input usado ↗</a>}
                    {entry.outputImage && <a href={entry.outputImage} target="_blank">Output ↗</a>}
                  </nav>
                  <blockquote>{entry.prompt}</blockquote>
                </div>
              </details>)}
            </section>
          </div>}
        </article>;
      })}
    </section>
  </main>;
}

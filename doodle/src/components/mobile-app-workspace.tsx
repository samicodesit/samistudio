"use client";

import Image from "next/image";
import Link from "next/link";
import { Lightbulb, PencilLine, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { DoodleClient } from "./doodle-client";
import { isPlayRuntime } from "@/lib/billing/play-client";
import { getCopy, localePath, SUPPORTED_LOCALES, type DoodleCopy, type Locale } from "@/lib/i18n";
import { getDoodleIdeas, IDEA_IMAGES } from "@/lib/doodle-ideas";
import type { SceneIdeaId } from "@/lib/scenes/suggestions";
import "./mobile-app-workspace.css";

type Tab = "create" | "ideas" | "settings";
const LABELS: Record<Locale, [string, string, string]> = {
  en: ["Create", "Ideas", "Settings"], nl: ["Maken", "Ideeën", "Instellingen"],
  de: ["Erstellen", "Ideen", "Einstellungen"], fr: ["Créer", "Idées", "Réglages"],
  es: ["Crear", "Ideas", "Ajustes"], "pt-br": ["Criar", "Ideias", "Configurações"],
  it: ["Crea", "Idee", "Impostazioni"], ja: ["作成", "アイデア", "設定"],
  ko: ["만들기", "아이디어", "설정"], ar: ["ارسم", "أفكار", "الإعدادات"],
};
function currentTab(): Tab {
  return location.hash === "#ideas" ? "ideas" : location.hash === "#settings" ? "settings" : "create";
}

const IDEAS_HINT: Record<Locale, string> = {
  en: "Pick an idea and make it your own.", nl: "Kies een idee en maak er iets van jezelf van.",
  de: "Wähle eine Idee und mach sie zu deiner eigenen.", fr: "Choisissez une idée et personnalisez-la.",
  es: "Elige una idea y hazla tuya.", "pt-br": "Escolha uma ideia e dê seu toque pessoal.",
  it: "Scegli un’idea e falla tua.", ja: "アイデアを選んで、自分らしくアレンジ。",
  ko: "아이디어를 골라 나만의 그림을 만들어 보세요.", ar: "اختر فكرة وأضف إليها لمستك.",
};

export function MobileAppWorkspace({ locale, copy, initialScene = "", initialSuggestionIds }: { locale: Locale; copy: DoodleCopy; initialScene?: string; initialSuggestionIds?: readonly SceneIdeaId[] }) {
  const [installed, setInstalled] = useState(false);
  const [tab, setTab] = useState<Tab>("create");
  const [draft, setDraft] = useState({ scene: initialScene, revision: 0 });
  const labels = LABELS[locale];
  const ideas = getDoodleIdeas(locale);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)");
    const update = () => setInstalled(isPlayRuntime() || media.matches || new URLSearchParams(location.search).get("runtime") === "app");
    const frame = requestAnimationFrame(() => { update(); setTab(currentTab()); });
    const onBack = () => setTab(currentTab());
    media.addEventListener("change", update);
    window.addEventListener("popstate", onBack);
    return () => { cancelAnimationFrame(frame); media.removeEventListener("change", update); window.removeEventListener("popstate", onBack); };
  }, []);

  function selectTab(next: Tab) {
    if (next === tab) return;
    history.pushState(history.state, "", `${location.pathname}${location.search}${next === "create" ? "#composer" : `#${next}`}`);
    setTab(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return <div className="mobile-app-workspace" data-installed={installed}>
    <div className="app-account-slot" data-account-host="app" aria-label={copy.account.label} />
    {/* Keep Create mounted across tabs so browsing never discards a drawing. */}
    <div hidden={installed && tab !== "create"}>
      <DoodleClient key={draft.revision} locale={locale} copy={copy} initialScene={draft.scene} initialSuggestionIds={initialSuggestionIds} accountHost={installed ? "app" : "web"} />
    </div>
    {installed && tab === "ideas" ? <section className="app-panel" aria-labelledby="app-ideas-title">
      <h1 id="app-ideas-title">{labels[1]}</h1>
      <p>{IDEAS_HINT[locale]}</p>
      <div className="app-ideas-grid">{ideas.featured.map((prompt, index) => <button key={prompt} type="button" aria-label={`${ideas.tryIdea}: ${prompt}`} onClick={() => {
        setDraft(previous => ({ scene: prompt, revision: previous.revision + 1 }));
        selectTab("create");
      }}>
        <Image src={IDEA_IMAGES[index]} alt="" width={360} height={360} />
        <span>{prompt}</span><strong>{ideas.tryIdea} <span aria-hidden="true">↗</span></strong>
      </button>)}</div>
    </section> : null}
    {installed && tab === "settings" ? <section className="app-panel app-settings" aria-labelledby="app-settings-title">
      <h1 id="app-settings-title">{labels[2]}</h1>
      <h2>{copy.header.languageLabel}</h2>
      <div className="app-language-list">{SUPPORTED_LOCALES.map(item => <Link key={item} href={`${localePath(item)}?runtime=${isPlayRuntime() ? "play" : "app"}#settings`} aria-current={item === locale ? "true" : undefined}>
        <span>{getCopy(item).localeLabel}</span>{item === locale ? <span aria-hidden="true">✓</span> : null}
      </Link>)}</div>
      <h2>Doodle · Sami Studio</h2>
      <div className="app-support-links">
        <Link href="/contact">{copy.footer.contact}</Link>
        <Link href="/privacy">{copy.footer.privacy}</Link>
        <Link href="/terms">{copy.footer.terms}</Link>
        <Link href="/refund">{copy.footer.refunds}</Link>
      </div>
    </section> : null}
    {installed ? <nav className="app-bottom-nav" aria-label="Doodle app">
      {(["create", "ideas", "settings"] as const).map((item, index) => {
        const Icon = [PencilLine, Lightbulb, Settings][index];
        return <button key={item} type="button" aria-current={tab === item ? "page" : undefined} onClick={() => selectTab(item)}><Icon size={22} aria-hidden="true" /><span>{labels[index]}</span></button>;
      })}
    </nav> : null}
  </div>;
}

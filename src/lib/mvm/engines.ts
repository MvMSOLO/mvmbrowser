export type EngineId = "ddg" | "google" | "bing" | "brave" | "yandex" | "ecosia" | "startpage" | "custom";

export const ENGINES: { id: EngineId; template: string }[] = [
  { id: "ddg", template: "https://html.duckduckgo.com/html/?q=%s" },
  { id: "google", template: "https://www.google.com/search?q=%s&gbv=1&hl=%l" },
  { id: "bing", template: "https://www.bing.com/search?q=%s" },
  { id: "brave", template: "https://search.brave.com/search?q=%s" },
  { id: "yandex", template: "https://yandex.com/search/?text=%s" },
  { id: "ecosia", template: "https://www.ecosia.org/search?q=%s" },
  { id: "startpage", template: "https://www.startpage.com/sp/search?query=%s" },
  { id: "custom", template: "" },
];

export function engineTemplate(id: EngineId, custom: string, lang: string): string {
  if (id === "custom" && custom.includes("%s")) return custom;
  const found = ENGINES.find((e) => e.id === id) ?? ENGINES[0];
  return found.template.replaceAll("%l", encodeURIComponent(lang || "en"));
}

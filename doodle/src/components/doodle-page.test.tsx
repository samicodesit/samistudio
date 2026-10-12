import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DoodlePage } from "./doodle-page";
import { getCopy, SUPPORTED_LOCALES } from "@/lib/i18n";
import { ARTICLE_SLUGS, getEditorialPath } from "@/lib/editorial";
import { PLAY_STORE_URL } from "./discovery-links";
import { getGalleryCopy } from "@/lib/gallery-copy";
import { getLandingResources } from "@/lib/landing-resources";
import { ideasPath } from "@/lib/doodle-ideas";

describe("DoodlePage", () => {
  it.each(SUPPORTED_LOCALES)("renders %s creation CTA and crawlable footer guides without an accordion", (locale) => {
    const html = renderToStaticMarkup(<DoodlePage locale={locale} />);
    const page = new DOMParser().parseFromString(html, "text/html");
    const nextStep = page.querySelector(".landing-next-step");
    const copy = getCopy(locale);
    const supporting = getLandingResources(locale);

    expect(page.querySelector("#doodle-tool")).not.toBeNull();
    expect(nextStep?.querySelector("h2")?.textContent).toBe(getGalleryCopy(locale).invitation);
    expect(nextStep?.querySelectorAll("a")).toHaveLength(1);
    expect(nextStep?.querySelector(`a[href="${ideasPath(locale)}"]`)?.textContent).toBe(supporting.exploreIdeas);
    expect(nextStep?.querySelector("p")).toBeNull();
    expect(page.querySelector(".landing-resources, .landing-guides")).toBeNull();
    for (const [index, slug] of ARTICLE_SLUGS.entries()) {
      const link = page.querySelector(`footer a[href="${getEditorialPath(locale, "blog", slug)}"]`);
      expect(link).not.toBeNull();
      expect(link?.closest("details")).toBeNull();
      expect(link?.textContent).toBe(supporting.guides[index]);
    }
    expect(page.querySelector("footer .android-app-link a")?.getAttribute("href")).toBe(PLAY_STORE_URL);
    const data = JSON.parse(page.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(data.description).toBe(copy.seo.description);
  });

  it("renders localized tool and crawlable supporting content", () => {
    const { container } = render(<DoodlePage locale="de" />);

    fireEvent.click(container.querySelector(".language-switcher summary")!);
    expect(screen.getByRole("heading", { level: 2, name: "Zeichnen wir." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: getGalleryCopy("de").invitation })).toBeInTheDocument();
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nederlands" })).toHaveAttribute("href", "/nl");
    expect(screen.getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Rückerstattungen" })).toHaveAttribute("href", "/refund");
    expect(screen.getByRole("link", { name: getLandingResources("de").exploreIdeas })).toHaveAttribute("href", "/de/doodle-ideas");
    expect(container.querySelector('[data-account-host="web"]')).toHaveAttribute("aria-label", "Konto");
  });

  it("advertises the free trial without stale paid pack pricing", () => {
    const { container } = render(<DoodlePage locale="ja" />);
    const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "");

    expect(data.offers).toHaveLength(1);
    expect(data).toMatchObject({
      "@type": "WebApplication",
      name: "Doodle",
      inLanguage: "ja",
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "無料でお試しください" },
      ],
    });
  });

  it("renders the Arabic tool in natural Modern Standard Arabic", () => {
    const { container } = render(<DoodlePage locale="ar" />);
    fireEvent.click(container.querySelector(".language-switcher summary")!);

    expect(screen.getByRole("heading", { level: 2, name: "يلا نرسم" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "أنشئ رسمة" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("hrefLang", "en");
    for (const link of screen.getAllByRole("link", { name: "الصفحة الرئيسية لـ Doodle" })) expect(link).toHaveAttribute("dir", "ltr");
  });

  it("links English visitors to the doodle ideas gallery", () => {
    render(<DoodlePage locale="en" />);

    expect(screen.getByRole("link", { name: "Explore drawing ideas" })).toHaveAttribute("href", "/doodle-ideas");
  });
});

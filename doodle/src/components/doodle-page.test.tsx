import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DoodlePage } from "./doodle-page";

describe("DoodlePage", () => {
  it("renders localized tool and crawlable supporting content", () => {
    const { container } = render(<DoodlePage locale="de" />);

    fireEvent.click(container.querySelector(".language-switcher summary")!);
    fireEvent.click(container.querySelector(".landing-resources summary")!);
    expect(screen.getByRole("heading", { level: 2, name: "Zeichnen wir." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "So funktioniert es" })).toBeInTheDocument();
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nederlands" })).toHaveAttribute("href", "/nl");
    expect(screen.getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Rückerstattungen" })).toHaveAttribute("href", "/refund");
    expect(screen.getByRole("link", { name: "Doodle-Ideen ansehen" })).toHaveAttribute("href", "/de/doodle-ideas");
    expect(container.querySelector('[data-account-host="web"]')).toHaveAttribute("aria-label", "Konto");
  });

  it("adds visible-content-matching WebApplication structured data", () => {
    const { container } = render(<DoodlePage locale="ja" />);
    const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "");

    expect(data).toMatchObject({
      "@type": "WebApplication",
      name: "Doodle",
      inLanguage: "ja",
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "無料でお試しください" },
        { "@type": "Offer", price: "4.99", priceCurrency: "EUR", description: "あと10枚のイラスト" },
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

    expect(screen.getByRole("link", { name: "Browse doodle ideas" })).toHaveAttribute("href", "/doodle-ideas");
  });
});

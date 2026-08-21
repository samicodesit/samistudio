import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DoodlePage } from "./doodle-page";

describe("DoodlePage", () => {
  it("renders localized tool and crawlable supporting content", () => {
    render(<DoodlePage locale="de" />);

    expect(screen.getByRole("heading", { level: 1, name: "Was sollen wir zeichnen?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "So funktioniert es" })).toBeInTheDocument();
    expect(screen.getByText("Deutsch")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nederlands" })).toHaveAttribute("href", "/nl");
  });

  it("adds visible-content-matching WebApplication structured data", () => {
    const { container } = render(<DoodlePage locale="ja" />);
    const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "");

    expect(data).toMatchObject({
      "@type": "WebApplication",
      name: "Doodle",
      inLanguage: "ja",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    });
  });

  it("renders the Arabic tool in natural Modern Standard Arabic", () => {
    render(<DoodlePage locale="ar" />);

    expect(screen.getByRole("heading", { level: 1, name: "ماذا نرسم؟" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "أنشئ رسمة" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("hrefLang", "en");
    expect(screen.getByRole("link", { name: "الصفحة الرئيسية لـ Doodle" })).toHaveAttribute("dir", "ltr");
  });
});

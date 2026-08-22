import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/(english)/privacy/page";
import RefundPage from "@/app/(english)/refund/page";
import ContactPage from "@/app/(english)/contact/page";

describe("legal pages", () => {
  it("publishes a canonical privacy policy that explains real data handling", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeInTheDocument();
    expect(screen.getAllByText(/OpenAI/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Stripe/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "samicodesit@gmail.com" })[0]).toHaveAttribute(
      "href", "mailto:samicodesit@gmail.com",
    );
    expect(privacyMetadata.alternates).toEqual({ canonical: "https://doodle.samistudio.nl/privacy" });
  });

  it("states the refund window and provides a working contact route", () => {
    const { rerender } = render(<RefundPage />);
    expect(screen.getByText(/14 days/)).toBeInTheDocument();
    expect(screen.getByText(/Failed generations do not use a doodle credit/)).toBeInTheDocument();

    rerender(<ContactPage />);
    expect(screen.getByRole("link", { name: "Email Sami Studio" })).toHaveAttribute(
      "href",
      "mailto:samicodesit@gmail.com",
    );
  });
});

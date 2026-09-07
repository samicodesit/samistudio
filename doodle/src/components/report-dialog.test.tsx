import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportDialog } from "./report-dialog";

const prepareReportImage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/reports/prepare-report-image", () => ({ prepareReportImage }));

const imageFile = new File(["private image"], "doodle.png", { type: "image/png" });

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function setup(onClose = vi.fn()) {
  render(<ReportDialog open imageFile={imageFile} scene="A private scene" locale="en" onClose={onClose} />);
  return { onClose };
}

describe("ReportDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    prepareReportImage.mockReset();
  });

  it("submits an actionable report without the image or description by default", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ id: "report-reference" }, { status: 201 }));
    setup();

    await user.selectOptions(screen.getByRole("combobox", { name: "Why are you reporting this doodle?" }), "violence");
    await user.type(screen.getByRole("textbox", { name: "Add details (optional)" }), "Unexpected injury");
    await user.click(screen.getByRole("button", { name: "Submit report" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/reports", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      body: JSON.stringify({
        reason: "violence",
        details: "Unexpected injury",
        locale: "en",
        includeContent: false,
      }),
    }));
    expect(prepareReportImage).not.toHaveBeenCalled();
    expect(await screen.findByText("report-reference")).toBeVisible();
    expect(screen.getByText("Report received.")).toBeVisible();
  });

  it("uploads bounded image and description only after explicit consent", async () => {
    const user = userEvent.setup();
    prepareReportImage.mockResolvedValue({ base64: "jpeg-base64", width: 480, height: 480 });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ id: "report-reference" }, { status: 201 }));
    setup();

    await user.selectOptions(screen.getByRole("combobox", { name: "Why are you reporting this doodle?" }), "hate");
    await user.click(screen.getByRole("checkbox", { name: /Include this doodle and its description/ }));
    expect(prepareReportImage).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Submit report" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      reason: "hate",
      details: "",
      locale: "en",
      includeContent: true,
      scene: "A private scene",
      imageBase64: "jpeg-base64",
    });
  });

  it("requires details for the other reason and cancels without submitting", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { onClose } = setup();

    await user.selectOptions(screen.getByRole("combobox", { name: "Why are you reporting this doodle?" }), "other");
    expect(screen.getByRole("button", { name: "Submit report" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Add details (required)" }), "The image contains unsafe text.");
    expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

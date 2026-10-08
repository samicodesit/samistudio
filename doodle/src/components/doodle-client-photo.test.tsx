import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DoodleClient } from "./doodle-client";
import { getCopy } from "@/lib/i18n";
import { photoDraftStore, discardPhotoDraft } from "@/lib/photo-draft-store";
import { File as NodeFile } from "node:buffer";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/photo-draft-store", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/photo-draft-store")>(), photoDraftStore: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input) => input === "/api/account" ? Response.json({ authenticated: false, email: null, balance: 0, freeRemaining: 2 }) : new Response(null, { status: 502 })));
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 600, height: 400, close: vi.fn() })));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn() } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,AQID");
  sessionStorage.clear(); localStorage.clear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function choosePhoto() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=", "base64");
  fireEvent.change(input, { target: { files: [new NodeFile([png], "photo.png", { type: "image/png" })] } });
  await screen.findByRole("img", { name: "Selected photo" });
}

it("keeps selection local, restores the draft and retains the chosen detail", async () => {
  render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="My earlier idea" />);
  await screen.findByText("2 free doodles left");
  fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
  await choosePhoto();
  expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/generate")).toHaveLength(0);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(screen.getByRole("textbox")).toHaveValue("My earlier idea");
  expect(screen.getByRole("radio", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
});

it("submits only the photo once and retains it after a recoverable failure", async () => {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>(done => { resolve = done; });
  vi.mocked(fetch).mockImplementation(async input => input === "/api/account" ? Response.json({ authenticated: false, email: null, balance: 0, freeRemaining: 2 }) : pending);
  render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="Private draft" />);
  await screen.findByText("2 free doodles left");
  await choosePhoto();
  const create = screen.getByRole("button", { name: "Create doodle" });
  act(() => { fireEvent.click(create); fireEvent.click(create); });
  const requests = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/generate");
  expect(requests).toHaveLength(1);
  expect(JSON.parse(String(requests[0][1]?.body))).toEqual({ photo: "AQID", detailLevel: "simple" });
  await act(async () => resolve(new Response(null, { status: 502 })));
  await waitFor(() => expect(screen.getByRole("img", { name: "Selected photo" })).toBeVisible());
  expect(screen.getByRole("button", { name: "Create doodle" })).toBeEnabled();
});

it("starts an Ideas selection without restoring the previous photo", async () => {
  const previousId = "previous-photo-draft";
  sessionStorage.setItem("doodle:photo-draft-id", previousId);
  vi.mocked(photoDraftStore).mockImplementation(async (action, id) => action === "read" && id === previousId ? { id, base64: "AQID", scene: "Previous text", expiresAt: Date.now() + 60_000 } : undefined);
  discardPhotoDraft();
  render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="A new idea" />);
  await screen.findByText("2 free doodles left");
  expect(screen.getByRole("textbox")).toHaveValue("A new idea");
  expect(screen.queryByRole("img", { name: "Selected photo" })).toBeNull();
});

it("keeps a valid selection when a replacement is damaged or cancelled", async () => {
  vi.mocked(photoDraftStore).mockResolvedValue(undefined);
  render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="My saved idea" />);
  await screen.findByText("2 free doodles left");
  await choosePhoto();
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new NodeFile(["damaged"], "photo.jpg", { type: "image/jpeg" })] } });
  await screen.findByText("This photo could not be opened. Try a JPG, PNG or WebP image.");
  expect(screen.getByRole("img", { name: "Selected photo" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Create doodle" })).toBeEnabled();
  fireEvent.change(input, { target: { files: [] } });
  expect(screen.getByRole("img", { name: "Selected photo" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(screen.getByRole("textbox")).toHaveValue("My saved idea");
  expect(screen.queryByText("This photo could not be opened. Try a JPG, PNG or WebP image.")).toBeNull();
});

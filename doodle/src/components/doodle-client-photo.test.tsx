import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DoodleClient } from "./doodle-client";
import { getCopy } from "@/lib/i18n";
import { photoDraftStore, discardPhotoDraft } from "@/lib/photo-draft-store";
import { File as NodeFile } from "node:buffer";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/photo-draft-store", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/photo-draft-store")>(), photoDraftStore: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => {
 const accountHost=document.createElement("div");accountHost.dataset.accountHost="web";document.body.append(accountHost);

  // Node's optional Web Storage global can shadow JSDOM's browser storage.
  const preferences = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => preferences.get(key) ?? null,
    setItem: (key: string, value: string) => preferences.set(key, value),
    removeItem: (key: string) => preferences.delete(key),
    clear: () => preferences.clear(),
  });
  vi.stubGlobal("fetch", vi.fn(async (input) => input === "/api/account" ? Response.json({ authenticated: false, email: null, balance: 0, freeRemaining: 2 }) : new Response(null, { status: 502 })));
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 600, height: 400, close: vi.fn() })));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn() } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,AQID");
  window.sessionStorage.clear(); window.localStorage.clear();
  vi.mocked(photoDraftStore).mockResolvedValue(undefined);
  URL.createObjectURL = vi.fn(() => "blob:doodle-result");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function choosePhoto() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=", "base64");
  fireEvent.change(input, { target: { files: [new NodeFile([png], "photo.png", { type: "image/png" })] } });
  await screen.findByRole("img", { name: "Selected photo" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Create doodle" })).toBeEnabled());
}

function generationResponse(status: number) {
  vi.mocked(fetch).mockImplementation(async input => input === "/api/account"
    ? Response.json({ authenticated: false, email: null, balance: 0, freeRemaining: 2 })
    : status === 200
      ? new Response(new Blob(["png"], { type: "image/png" }), { headers: { "X-Doodle-Free-Remaining": "1" } })
      : new Response(null, { status }));
}

it.each([
  [400, "This photo could not be opened. Try a JPG, PNG or WebP image."],
  [413, "That photo is too large. Try a smaller image."],
  [422, "This photo couldn't be turned into a doodle. Try a different photo."],
] as const)("gives photo-specific recovery for status %s without losing the input", async (status, message) => {
  generationResponse(status);
  render(<DoodleClient locale="en" copy={getCopy("en")} />);
  await screen.findByRole("button", { name: "Sign in" });
  fireEvent.click(screen.getByRole("button", { name: /^Detail:/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
  await waitFor(() => expect(screen.queryByRole("dialog",{name:"Drawing detail"})).not.toBeInTheDocument());
  await choosePhoto();
  fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
  await screen.findByText(message);
  expect(screen.getByRole("img", { name: "Selected photo" })).toBeVisible();
  await waitFor(() => expect(screen.getByRole("button", { name: "Detail: Medium" })).toHaveAttribute("aria-expanded", "false"));
  expect(screen.queryByText(getCopy("en").errors.refused)).toBeNull();
});

it("keeps the existing guidance for a refused text idea", async () => {
  generationResponse(422);
  render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="Two cats" />);
  await screen.findByRole("button", { name: "Sign in" });
  fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
  await screen.findByText(getCopy("en").errors.refused);
  expect(screen.getByRole("textbox")).toHaveValue("Two cats");
});

it("clears an old generation failure only after a successful replacement or Remove", async () => {
  generationResponse(502);
  render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="My saved idea" />);
  await screen.findByRole("button", { name: "Sign in" });
  await choosePhoto();
  fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
  await screen.findByText(getCopy("en").errors.general);
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [] } });
  expect(screen.getByText(getCopy("en").errors.general)).toBeVisible();
  fireEvent.change(input, { target: { files: [new NodeFile(["damaged"], "photo.jpg", { type: "image/jpeg" })] } });
  await screen.findByText("This photo could not be opened. Try a JPG, PNG or WebP image.");
  expect(screen.getByText(getCopy("en").errors.general)).toBeVisible();
  await choosePhoto();
  await waitFor(() => expect(screen.queryByText(getCopy("en").errors.general)).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
  await screen.findByText(getCopy("en").errors.general);
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(screen.queryByText(getCopy("en").errors.general)).toBeNull();
  expect(screen.getByRole("textbox")).toHaveValue("My saved idea");
  expect(screen.getByRole("textbox")).toHaveFocus();
});

it.each([true, false])("returns from a result to the same draft without another generation (photo: %s)", async withPhoto => {
  generationResponse(200);
  render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="My earlier idea" />);
  await screen.findByRole("button", { name: "Sign in" });
  fireEvent.click(screen.getByRole("button", { name: /^Detail:/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
  await waitFor(() => expect(screen.queryByRole("dialog",{name:"Drawing detail"})).not.toBeInTheDocument());
  if (withPhoto) await choosePhoto();
  fireEvent.click(screen.getByRole("button", { name: "Create doodle" }));
  fireEvent.click(await screen.findByRole("button", { name: "Back" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Detail: Medium" })).toHaveAttribute("aria-expanded", "false"));
  expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/generate")).toHaveLength(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:doodle-result");
  if (withPhoto) {
    expect(screen.getByRole("img", { name: "Selected photo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create doodle" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  }
  expect(screen.getByRole("textbox")).toHaveValue("My earlier idea");
  expect(screen.getByRole("textbox")).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByText("1 free doodle left", {selector:".account-usage"})).toBeVisible();
  fireEvent(screen.getByRole("dialog"), new Event("cancel", {cancelable:true}));

});

it("keeps selection local, restores the draft and retains the chosen detail", async () => {
  render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="My earlier idea" />);
  await screen.findByRole("button", { name: "Sign in" });
  fireEvent.click(screen.getByRole("button", { name: /^Detail:/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
  await waitFor(() => expect(screen.queryByRole("dialog",{name:"Drawing detail"})).not.toBeInTheDocument());
  await choosePhoto();
  expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/generate")).toHaveLength(0);
  expect(screen.queryByRole("textbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(screen.getByRole("textbox")).toHaveValue("My earlier idea");
  await waitFor(() => expect(screen.getByRole("button", { name: "Detail: Medium" })).toHaveAttribute("aria-expanded", "false"));
});

it("submits only the photo once and retains it after a recoverable failure", async () => {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>(done => { resolve = done; });
  vi.mocked(fetch).mockImplementation(async input => input === "/api/account" ? Response.json({ authenticated: false, email: null, balance: 0, freeRemaining: 2 }) : pending);
  render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="Private draft" />);
  await screen.findByRole("button", { name: "Sign in" });
  await choosePhoto();
  const create = screen.getByRole("button", { name: "Create doodle" });
  act(() => { fireEvent.click(create); fireEvent.click(create); });
  const requests = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/generate");
  expect(requests).toHaveLength(1);
  expect(JSON.parse(String(requests[0][1]?.body))).toEqual({ photo: "AQID", detailLevel: "medium" });
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
  await screen.findByRole("button", { name: "Sign in" });
  expect(screen.getByRole("textbox")).toHaveValue("A new idea");
  expect(screen.queryByRole("img", { name: "Selected photo" })).toBeNull();
});

it("keeps a valid selection when a replacement is damaged or cancelled", async () => {
  vi.mocked(photoDraftStore).mockResolvedValue(undefined);
  render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="My saved idea" />);
  await screen.findByRole("button", { name: "Sign in" });
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

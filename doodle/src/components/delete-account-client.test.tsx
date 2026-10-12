import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountSummary } from "@/app/api/account/route";
import { DeleteAccountClient } from "./delete-account-client";

vi.mock("./google-sign-in-button", () => ({
  GoogleSignInButton: ({ onCredential }: { onCredential(token: string): void }) => (
    <button type="button" onClick={() => onCredential("google-token")}>Continue with Google</button>
  ),
}));

const anonymous: AccountSummary = { authenticated: false, email: null, balance: 0, freeRemaining: 1 };
const signedIn: AccountSummary = { authenticated: true, email: "buyer@example.com", balance: 3, freeRemaining: null };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

describe("DeleteAccountClient", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("lets a signed-out user authenticate on the public deletion page", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(anonymous))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(signedIn));

    render(<DeleteAccountClient />);
    await user.click(await screen.findByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(screen.getByText("buyer@example.com")).toBeVisible());
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/google", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "google-token" }),
    });
  });

  it("deletes only after a separate permanent-deletion confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(signedIn))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const storage=()=>{const items=new Map<string,string>();return {setItem:(key:string,value:string)=>items.set(key,value),getItem:(key:string)=>items.get(key)??null,removeItem:(key:string)=>items.delete(key)};};
    vi.stubGlobal("localStorage",storage());
    vi.stubGlobal("sessionStorage",storage());
    localStorage.setItem("doodle:has-purchased","1");
    sessionStorage.setItem("doodle:pack-selection","pack_big");
    sessionStorage.setItem("doodle:return","temporary prompt");
    sessionStorage.setItem("doodle:checkout-draft-id","checkout-id");
    sessionStorage.setItem("doodle:photo-draft-id","photo-id");
    render(<DeleteAccountClient />);
    await user.click(await screen.findByRole("button", { name: "Delete my Doodle account" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Delete permanently" }));

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/account", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    expect(await screen.findByRole("heading", { name: "Account deleted" })).toBeVisible();
    expect(localStorage.getItem("doodle:has-purchased")).toBeNull();
    for(const key of ["doodle:pack-selection","doodle:return","doodle:checkout-draft-id","doodle:photo-draft-id"])expect(sessionStorage.getItem(key)).toBeNull();
  });
});

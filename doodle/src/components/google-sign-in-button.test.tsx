import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSignInButton } from "./google-sign-in-button";

vi.mock("next/script", () => ({ default: () => null }));

const renderButton = vi.fn();
const initialize = vi.fn();

describe("Google sign-in button", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client-id");
    renderButton.mockReset();
    initialize.mockReset();
    window.google = { accounts: { id: { initialize, renderButton } } };
  });

  it("renders Google's localized official control and forwards its credential", async () => {
    const onCredential = vi.fn();
    render(<GoogleSignInButton locale="pt-br" busy={false} onCredential={onCredential} onError={vi.fn()} />);

    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: "google-client-id" }));
    expect(renderButton).toHaveBeenCalledWith(expect.any(HTMLDivElement), expect.objectContaining({ locale: "pt_BR", width: expect.any(Number) }));
    const options = initialize.mock.calls[0][0];
    options.callback({ credential: "google-token" });
    expect(onCredential).toHaveBeenCalledWith("google-token");
  });
});

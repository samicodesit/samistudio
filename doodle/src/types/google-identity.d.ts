interface Window {
  google?: {
    accounts: {
      id: {
        initialize(config: {
          client_id: string;
          callback?: (response: { credential?: string }) => void;
          use_fedcm_for_prompt?: boolean;
          ux_mode?: "popup" | "redirect";
          login_uri?: string;
        }): void;
        renderButton(element: HTMLElement, options: Record<string, unknown>): void;
      };
    };
  };
}

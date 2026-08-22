interface Window {
  google?: {
    accounts: {
      id: {
        initialize(config: { client_id: string; callback(response: { credential?: string }): void; use_fedcm_for_prompt?: boolean }): void;
        renderButton(element: HTMLElement, options: Record<string, unknown>): void;
      };
    };
  };
}

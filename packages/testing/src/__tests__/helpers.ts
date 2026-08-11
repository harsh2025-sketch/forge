/** Shared test helpers for the @forge/testing self-tests. */

/** Builds a structural webhook request from a header map and a string body. */
export function makeWebhookRequest(
  headers: Readonly<Record<string, string>>,
  body: string
): { headers: { get(name: string): string | null }; text(): Promise<string> } {
  return {
    headers: {
      get(name: string): string | null {
        const match = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
        return match === undefined ? null : headers[match];
      },
    },
    text: async () => body,
  };
}

/** Builds a structural middleware request from a header map. */
export function makeMiddlewareRequest(
  headers: Readonly<Record<string, string>>,
  url = "https://app.example.test/protected"
): { url: string; headers: { get(name: string): string | null } } {
  return {
    url,
    headers: {
      get(name: string): string | null {
        const match = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
        return match === undefined ? null : headers[match];
      },
    },
  };
}

declare module 'cloudflare:workers' {
  export const env: Record<string, unknown> & {
    ASSETS?: {
      fetch(input: Request | string, init?: RequestInit): Promise<Response>;
    };
    HYPERDRIVE?: {
      connectionString: string;
    };
  };
}

declare module 'cloudflare:node' {
  export function httpServerHandler(options: { port: number }): {
    fetch(request: Request, env?: unknown, ctx?: unknown): Promise<Response>;
  };
}

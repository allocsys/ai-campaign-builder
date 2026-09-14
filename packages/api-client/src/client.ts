export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => string | null;
  /** Called with every ApiError this client produces, right before it's
   * thrown -- lets an app react to a specific backend error `code` (e.g.
   * "business_account_deleted") from one place instead of every call site
   * having to inspect err.message. Optional; never affects control flow
   * here (the error is thrown either way). */
  onError?: (error: ApiError) => void;
}

export class ApiClient {
  private baseUrl: string;
  private getToken?: () => string | null;
  private onError?: (error: ApiError) => void;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getToken = config.getToken;
    this.onError = config.onError;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = new Headers(options.headers || {});

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.getToken) {
      const token = this.getToken();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      let errorCode: string | undefined;
      try {
        const errorData = await response.json();
        if (errorData && typeof errorData === 'object') {
          if ('error' in errorData && typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if ('message' in errorData && typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          }
          if ('code' in errorData && typeof errorData.code === 'string') {
            errorCode = errorData.code;
          }
        }
      } catch {
        if (response.statusText) {
          errorMessage = response.statusText;
        }
      }
      const apiError = new ApiError(response.status, errorMessage, errorCode);
      this.onError?.(apiError);
      throw apiError;
    }

    if (response.status === 204) {
      return {} as T;
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  // Same auth/error handling as request(), but returns a Blob instead of
  // parsing JSON -- for endpoints that proxy binary content (e.g. evidence
  // images served through review.ts / staff-pos.ts's private-bucket proxy
  // routes) rather than JSON bodies.
  async requestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = new Headers(options.headers || {});

    if (this.getToken) {
      const token = this.getToken();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      let errorCode: string | undefined;
      try {
        const errorData = await response.json();
        if (errorData && typeof errorData === 'object') {
          if ('error' in errorData && typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if ('message' in errorData && typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          }
          if ('code' in errorData && typeof errorData.code === 'string') {
            errorCode = errorData.code;
          }
        }
      } catch {
        if (response.statusText) {
          errorMessage = response.statusText;
        }
      }
      const apiError = new ApiError(response.status, errorMessage, errorCode);
      this.onError?.(apiError);
      throw apiError;
    }

    return response.blob();
  }
}

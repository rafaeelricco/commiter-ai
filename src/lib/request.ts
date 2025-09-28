export {
  fetchF,
  fetchWithProgress,
  type OnProgress,
  type FetchError,
  type FetchErrorResponse,
  UnableToSend,
  NetworkError,
  BadStatus,
  UnableToDecode,
  fetchErrorToString,
  mapFetchError
};

import { Parser } from "@/lib/json/parser";
import * as p from "@/lib/json/parser";
import { Future } from "@/lib/future";
import { Success } from "@/lib/result";
import { Nullable } from "@/lib/maybe";

type ErrorMessage = string;

class UnableToSend {
  private readonly _tag: null = null;
  constructor(readonly message: ErrorMessage) {}
}

class NetworkError {
  private readonly _tag: null = null;
  constructor(readonly message: ErrorMessage) {}
}

class BadStatus<T> {
  private readonly _tag: null = null;
  constructor(
    readonly code: number,
    readonly message: string,
    readonly details: T
  ) {}

  map<W>(f: (t: T) => W) {
    return new BadStatus(this.code, this.message, f(this.details));
  }
}

class UnableToDecode {
  private readonly _tag: null = null;
  constructor(readonly message: string) {}
}

type FetchErrorResponse = FetchError<Response>;

type FetchError<T> = UnableToSend | NetworkError | BadStatus<T> | UnableToDecode;

function mapFetchError<T, W>(e: FetchError<T>, f: (v: T) => W): FetchError<W> {
  if (e instanceof BadStatus) {
    return e.map(f);
  }
  return e;
}

function fetchErrorToString(e: FetchError<unknown>): string {
  switch (true) {
    case e instanceof UnableToSend:
      return `Unable to send: ${e.message}`;
    case e instanceof NetworkError:
      return `Network error: ${e.message}`;
    case e instanceof UnableToDecode:
      return `Unable to decode response: ${e.message}`;
    case e instanceof BadStatus:
      switch (e.code) {
        case 400:
          return `Bad request: ${e.message}`;
        case 401:
          return `Unauthorized: ${e.message}`;
        case 403:
          return `Forbidden: ${e.message}`;
        case 404:
          return `Not found: ${e.message}`;
        case 409:
          return `Conflict: ${e.message}`;
        case 422:
          return `Unprocessable entity: ${e.message}`;
        case 429:
          return `Too many requests: ${e.message}`;
        case 500:
          return `Internal server error: ${e.message}`;
        case 502:
          return `Bad gateway: ${e.message}`;
        case 503:
          return `Service unavailable: ${e.message}`;
        case 504:
          return `Gateway timeout: ${e.message}`;
        default:
          return `HTTP error (${e.code}): ${e.message}`;
      }
    default:
      return e satisfies never;
  }
}

function fetchF<Res>(url: string, body: RequestInit, parser: Parser<Res>): Future<FetchErrorResponse, Res> {
  const controller = new AbortController();
  let open = true;
  return Future.create<ErrorMessage, Response>((reject, resolve) => {
    try {
      fetch(url, { signal: controller.signal, ...body }).then(
        (v) => {
          if (open) {
            open = false;
            resolve(v);
          }
        },
        (err) => {
          if (open) {
            open = false;
            reject(err);
          }
        }
      );
    } catch (e) {
      reject((e as Error).message);
    }

    return function cancel() {
      controller.abort();
      open = false;
    };
  })
    .mapRej<FetchErrorResponse>((e: ErrorMessage) => new UnableToSend(e))
    .chain((r) => {
      const successfulStatus = r.status >= 200 && r.status < 300;
      return successfulStatus ?
          Future.attemptP(() => r.json()).mapRej((e) => new UnableToDecode(e.message))
        : Future.reject(new BadStatus(r.status, r.statusText, r));
    })
    .chain((r) => {
      const parsed = p.parse(r, parser);
      if (parsed instanceof Success) {
        return Future.resolve(parsed.value);
      }

      return Future.reject(new UnableToDecode(parsed.error));
    });
}

type Bytes = number;

type RequestProgress = {
  uploaded: Bytes;
  uploadSize: Nullable<Bytes>;
  downloaded: Bytes;
  downloadSize: Nullable<Bytes>;
};

type RequestConfig = {
  blob: Blob;
  method: string;
  url: string;
  headers: Map<string, string>;
};

type OnProgress = (x: RequestProgress) => void;

function fetchWithProgress<Res>(
  { blob, method, url, headers }: RequestConfig,
  parser: Parser<Res>,
  onProgress: OnProgress
): Future<FetchErrorResponse, Res> {
  let uploaded = 0;
  let downloaded = 0;
  const xhr = new XMLHttpRequest();
  return Future.create<FetchErrorResponse, Res>((reject, resolve) => {
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        uploaded = event.loaded;
        onProgress({
          uploaded,
          uploadSize: event.total,
          downloaded,
          downloadSize: null
        });
      }
    });
    xhr.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        downloaded = event.loaded;
        onProgress({
          uploaded,
          uploadSize: null,
          downloaded,
          downloadSize: event.total
        });
      }
    });

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject(new BadStatus(xhr.status, xhr.statusText, xhr.response));
      }
    };
    xhr.onerror = function () {
      reject(new NetworkError(xhr.response));
    };

    try {
      xhr.open(method, url, true);
      Array.from(headers.entries()).forEach(([key, value]) => xhr.setRequestHeader(key, value));
      xhr.send(blob);
    } catch (e) {
      return reject(new UnableToSend((e as Error).message));
    }
  }).chain((r) => {
    const parsed = p.parse(r, parser);
    if (parsed instanceof Success) {
      return Future.resolve(parsed.value);
    }

    return Future.reject(new UnableToDecode(parsed.error));
  });
}

/**
 * API client for the POPPER-PROOF COURT FastAPI backend.
 *
 * All functions throw on non-2xx responses; callers decide how to surface.
 * The base URL comes from NEXT_PUBLIC_API_URL (build-time), with a safe
 * localhost fallback so dev just works without any .env file.
 */

export type CaseCreatePayload = {
  hypothesis: string;
  organization_type?: string;
};

export type Case = {
  id: string;
  hypothesis: string;
  organization_type: string | null;
  created_at: string; // ISO 8601
};

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Pydantic 422 returns a structured detail array — try to extract first msg.
    let detail = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body);
      if (parsed?.detail) {
        detail = Array.isArray(parsed.detail)
          ? parsed.detail[0]?.msg ?? JSON.stringify(parsed.detail)
          : String(parsed.detail);
      }
    } catch {
      /* keep raw body */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`API ${status}: ${detail}`);
    this.name = "ApiError";
  }
}

export const createCase = (payload: CaseCreatePayload): Promise<Case> =>
  request<Case>("/api/cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getCase = (caseId: string): Promise<Case> =>
  request<Case>(`/api/cases/${encodeURIComponent(caseId)}`);

export const listCases = (): Promise<Case[]> =>
  request<Case[]>("/api/cases");

// --- ExperimentPlan endpoints ----------------------------------------------

import type { ExperimentPlan, StareDecisisResult } from "./types";

/** Generate (or return cached) ExperimentPlan for a case whose trial completed. */
export const generatePlan = (
  caseId: string,
  opts?: { force?: boolean },
): Promise<ExperimentPlan> => {
  const qs = opts?.force ? "?force=true" : "";
  return request<ExperimentPlan>(
    `/api/cases/${encodeURIComponent(caseId)}/plan${qs}`,
    { method: "POST" },
  );
};

/** Fetch the cached plan for a case (404 if not generated yet). */
export const fetchPlan = (caseId: string): Promise<ExperimentPlan> =>
  request<ExperimentPlan>(`/api/cases/${encodeURIComponent(caseId)}/plan`);

// --- Pretrial Discovery endpoints ------------------------------------------

/** Run (or return cached) pretrial discovery for the case. */
export const runDiscovery = (
  caseId: string,
  opts?: { force?: boolean },
): Promise<StareDecisisResult> => {
  const qs = opts?.force ? "?force=true" : "";
  return request<StareDecisisResult>(
    `/api/cases/${encodeURIComponent(caseId)}/discover${qs}`,
    { method: "POST" },
  );
};

/** Fetch cached discovery for a case (404 if none yet). */
export const fetchDiscovery = (caseId: string): Promise<StareDecisisResult> =>
  request<StareDecisisResult>(
    `/api/cases/${encodeURIComponent(caseId)}/discover`,
  );

// --- Court Reporter chat (POST + SSE) -------------------------------------

import type { ChatMessage } from "./types";

/** Callbacks fired during a single Reporter reply stream. */
export type ReporterStreamHandlers = {
  /** Called for every token delta as it arrives. */
  onToken: (text: string) => void;
  /** Called once the server emits the terminal `done` event. */
  onDone?: () => void;
  /** Called on any transport / server error (including 4xx/5xx). */
  onError?: (err: Error) => void;
  /** AbortSignal to cancel mid-stream (e.g. user clicks Stop). */
  signal?: AbortSignal;
};

/**
 * Stream the Court Reporter's reply for a case.
 *
 * Why a hand-rolled SSE parser instead of EventSource? EventSource only
 * supports GET, but we need to POST the chat history on every message
 * (the backend is stateless). So we POST + read `text/event-stream`
 * via fetch's ReadableStream and parse the bytes ourselves.
 */
export async function streamReporter(
  caseId: string,
  messages: ChatMessage[],
  handlers: ReporterStreamHandlers,
): Promise<void> {
  const { onToken, onDone, onError, signal } = handlers;

  let res: Response;
  try {
    res = await fetch(
      `${API_BASE}/api/cases/${encodeURIComponent(caseId)}/reporter/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ messages }),
        signal,
        cache: "no-store",
      },
    );
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(String(e)));
    return;
  }

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let detail = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body);
      if (parsed?.detail) detail = String(parsed.detail);
    } catch {
      /* keep raw body */
    }
    onError?.(new ApiError(res.status, detail));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finished = false;

  try {
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;
      // Per SSE spec, frames may be separated by \n\n, \r\n\r\n, or \r\r.
      // sse-starlette uses CRLF, browsers' EventSource normalizes both —
      // we do the same so our parser works regardless of server style.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");

      // SSE frames are separated by a blank line ("\n\n"). Each frame can
      // contain multiple `event:` / `data:` lines. We slice off complete
      // frames and leave any partial tail in `buffer` for the next chunk.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of frame.split("\n")) {
          if (line.startsWith(":")) continue; // SSE comment / keepalive
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart());
          }
        }
        if (dataLines.length === 0) continue;
        const data = dataLines.join("\n");

        if (eventName === "token") {
          try {
            const parsed = JSON.parse(data) as { text?: string };
            if (parsed.text) onToken(parsed.text);
          } catch {
            /* ignore malformed frame */
          }
        } else if (eventName === "done") {
          finished = true;
          onDone?.();
          break;
        } else if (eventName === "error") {
          let msg = "Reporter stream error";
          try {
            const parsed = JSON.parse(data) as { message?: string };
            if (parsed.message) msg = parsed.message;
          } catch {
            /* ignore */
          }
          onError?.(new Error(msg));
          finished = true;
          break;
        }
      }
    }
    if (!finished) onDone?.(); // EOF without explicit done
  } catch (e) {
    if (signal?.aborted) {
      onDone?.(); // user-initiated cancel — treat as graceful close
      return;
    }
    onError?.(e instanceof Error ? e : new Error(String(e)));
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}

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

import type { ExperimentPlan } from "./types";

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

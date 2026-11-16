import type { DfaModel } from "../sim/signals";

export interface CompileResult {
  valid: boolean;
  error_type?: string;
  error_message?: string;
  logs?: string[];
  dfa: DfaModel | null;
  target_code?: string | null;
}

export async function fetchExamples(): Promise<Record<string, string>> {
  const resp = await fetch("/api/examples");
  return resp.json();
}

export async function compileCode(code: string): Promise<CompileResult> {
  const resp = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return resp.json();
}

import { supabase } from "@/integrations/supabase/client";

async function readFunctionError(error: any, fallback: string) {
  let message = String(error?.message || fallback);
  const response = error?.context;

  if (response && typeof response.clone === "function") {
    try {
      const payload = await response.clone().json();
      message = String(payload?.error || payload?.message || message);
    } catch {
      try {
        const text = await response.clone().text();
        if (text) message = text;
      } catch {
        // Mantém a mensagem original.
      }
    }
  }

  return message;
}

export async function invokeAuthenticatedFunction<T = any>(
  functionName: string,
  body: Record<string, any>,
): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData.session;

  if (sessionError || !session?.access_token) {
    throw new Error("Sessão expirada. Entre novamente no aplicativo.");
  }

  const invocationResult = await supabase.functions.invoke(functionName, {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (invocationResult.error) {
    throw new Error(await readFunctionError(invocationResult.error, "Erro ao executar a operação."));
  }

  if ((invocationResult.data as any)?.error) {
    throw new Error(String((invocationResult.data as any).error));
  }

  return invocationResult.data as T;
}

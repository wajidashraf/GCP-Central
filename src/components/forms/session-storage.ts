const PERSISTED_FORM_STATE_VERSION = 1;

type PersistedFormEnvelope<TState> = {
  version: number;
  data: TState;
};

export function readPersistedFormState<TState>(key: string): TState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawState = window.sessionStorage.getItem(key);
  if (!rawState) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawState) as PersistedFormEnvelope<TState>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.version !== PERSISTED_FORM_STATE_VERSION ||
      !("data" in parsed)
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function writePersistedFormState<TState>(key: string, data: TState) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: PersistedFormEnvelope<TState> = {
    version: PERSISTED_FORM_STATE_VERSION,
    data,
  };

  window.sessionStorage.setItem(key, JSON.stringify(payload));
}

export function clearPersistedFormState(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(key);
}

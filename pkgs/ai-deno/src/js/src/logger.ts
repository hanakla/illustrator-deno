const _AI_DENO_ = globalThis._AI_DENO_ ?? {
  op_aideno_debug_enabled: () => true,
  op_ai_alert: () => {},
};

const enableLogger = _AI_DENO_.op_aideno_debug_enabled();
console.log("[deno_ai(js)] enableLogger", enableLogger);

export const logger = {
  log: (...args: any[]) => {
    if (!enableLogger) return;
    console.log("[deno_ai(js)]", ...args);
  },
  info: (...args: any[]) => {
    if (!enableLogger) return;
    console.info("[deno_ai(js)]", ...args);
  },
  error: (...args: any[]) => {
    if (!enableLogger) return;
    console.error("[deno_ai(js)]", ...args);
  },
  time: (label: string) => {
    if (!enableLogger) return;
    console.time(label);
  },
  timeEnd: (label: string) => {
    if (!enableLogger) return;
    console.timeEnd(label);
  },
};

import { appApi, type FrontendErrorReportPayload } from "./appApi";

let initialized = false;

function compactString(value: unknown, max = 2000): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, max);
}

function compactStack(stack: unknown): string | null {
    if (typeof stack !== "string") return null;
    return stack.slice(0, 4000);
}

function toReasonString(reason: unknown): string {
    if (reason instanceof Error) return reason.message || reason.name || "Unhandled rejection";
    if (typeof reason === "string") return reason;
    if (reason === null || reason === undefined) return "Unhandled rejection";
    try {
        return JSON.stringify(reason);
    } catch {
        return String(reason);
    }
}

function report(payload: FrontendErrorReportPayload) {
    if (import.meta.env.DEV) {
        console.error("frontend_error", payload);
        return;
    }

    if (import.meta.env.PROD) {
        void appApi.reportFrontendError(payload);
    }
}

export function setupGlobalErrorTracking() {
    if (initialized || typeof window === "undefined") return;
    initialized = true;

    const previousOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
        report({
            kind: "window_error",
            message: compactString(String(message), 1000) ?? "Unhandled window error",
            stack: compactStack(error?.stack),
            source: compactString(source),
            line: typeof lineno === "number" ? lineno : null,
            column: typeof colno === "number" ? colno : null,
            url: compactString(window.location.href),
            userAgent: compactString(window.navigator.userAgent),
            timestamp: new Date().toISOString(),
        });

        return typeof previousOnError === "function"
            ? previousOnError.call(window, message, source, lineno, colno, error)
            : false;
    };

    const previousUnhandledRejection = window.onunhandledrejection;
    window.onunhandledrejection = (event) => {
        const reason = event?.reason;
        const reasonMessage = toReasonString(reason);
        const reasonStack =
            reason instanceof Error
                ? compactStack(reason.stack)
                : null;

        report({
            kind: "unhandled_rejection",
            message: compactString(reasonMessage, 1000) ?? "Unhandled promise rejection",
            stack: reasonStack,
            reason: compactString(reasonMessage, 2000),
            source: null,
            line: null,
            column: null,
            url: compactString(window.location.href),
            userAgent: compactString(window.navigator.userAgent),
            timestamp: new Date().toISOString(),
        });

        if (typeof previousUnhandledRejection === "function") {
            return previousUnhandledRejection.call(window, event);
        }
    };
}

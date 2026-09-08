function csrf(): string {
    return document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1] ?? ""
}

export class ApiError extends Error {
    constructor(public status: number, public errors: string[], public fieldErrors: Record<string, string[]>) {
        super(errors[0] ?? "Request failed")
    }
}

export async function api<T = unknown>(
    path: string,
    { method = "GET", body }: { method?: string; body?: unknown } = {}
): Promise<T> {
    const res = await fetch(`/api${path}`, {
        method,
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(method !== "GET" ? { "X-XSRF-Token": csrf() } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    })

    const json = await res.json().catch(() => ({}))
    const payload = json.response ?? json          // Flask-Security wraps in `response`

    if (!res.ok) {
        // Flask-Security sends `errors: [...]`; our own routes send `error: "..."`.
        const errors = payload.errors ?? (payload.error ? [payload.error] : [])
        throw new ApiError(res.status, errors, payload.field_errors ?? {})
    }
    return payload
}
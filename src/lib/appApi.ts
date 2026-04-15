import { supabase } from "./supabaseClient";

// Preferisci una variabile dedicata per l'API applicativa.
// appApi.ts

const BASE = (import.meta.env.VITE_APP_API_URL || "").replace(/\/+$/, "");
const TENANT_CONTEXT_STORAGE_KEY = "jip_tenant_context_v1";
const TENANT_CONTEXT_CHANGED_EVENT = "tenant-context-changed";

export class AppApiError extends Error {
    status: number;
    code: string;
    action: "relogin" | "forbidden" | "retry" | "none";

    constructor(
        message: string,
        opts: { status: number; code: string; action: "relogin" | "forbidden" | "retry" | "none" }
    ) {
        super(message);
        this.name = "AppApiError";
        this.status = opts.status;
        this.code = opts.code;
        this.action = opts.action;
    }
}

if (!BASE) {
    throw new Error(
        "❌ Missing VITE_APP_API_URL: frontend must call backend-api"
    );
}

async function getAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    const token = data.session?.access_token;
    if (!token) {
        throw new AppApiError("Sessione non valida. Effettua di nuovo il login.", {
            status: 401,
            code: "SESSION_MISSING",
            action: "relogin",
        });
    }
    return token;
}

export type TenantContextSelection = {
    companyId: string | null;
    perimeterId: string | null;
};

function readTenantContext(): TenantContextSelection {
    if (typeof window === "undefined") return { companyId: null, perimeterId: null };
    const raw = window.localStorage.getItem(TENANT_CONTEXT_STORAGE_KEY);
    if (!raw) return { companyId: null, perimeterId: null };
    try {
        const parsed = JSON.parse(raw);
        return {
            companyId: typeof parsed?.companyId === "string" && parsed.companyId.trim() ? parsed.companyId : null,
            perimeterId: typeof parsed?.perimeterId === "string" && parsed.perimeterId.trim() ? parsed.perimeterId : null,
        };
    } catch {
        return { companyId: null, perimeterId: null };
    }
}

function writeTenantContext(next: TenantContextSelection) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
        TENANT_CONTEXT_STORAGE_KEY,
        JSON.stringify({
            companyId: next.companyId ?? null,
            perimeterId: next.perimeterId ?? null,
        })
    );
}

function normalizeTenantContext(input: TenantContextSelection | null | undefined): TenantContextSelection {
    return {
        companyId: typeof input?.companyId === "string" && input.companyId.trim()
            ? input.companyId
            : null,
        perimeterId: typeof input?.perimeterId === "string" && input.perimeterId.trim()
            ? input.perimeterId
            : null,
    };
}

function isSameTenantContext(
    a: TenantContextSelection | null | undefined,
    b: TenantContextSelection | null | undefined
): boolean {
    const normalizedA = normalizeTenantContext(a);
    const normalizedB = normalizeTenantContext(b);
    return normalizedA.companyId === normalizedB.companyId
        && normalizedA.perimeterId === normalizedB.perimeterId;
}

function emitTenantContextChanged(previous: TenantContextSelection, next: TenantContextSelection) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent(TENANT_CONTEXT_CHANGED_EVENT, {
            detail: {
                previous,
                next,
            },
        })
    );
}

function mergeHeaders(base: HeadersInit | undefined, tenant: TenantContextSelection): HeadersInit {
    const result: Record<string, string> = {};

    if (base && typeof base === "object" && !Array.isArray(base) && !(base instanceof Headers)) {
        Object.assign(result, base as Record<string, string>);
    } else if (Array.isArray(base)) {
        for (const [key, value] of base) result[key] = String(value);
    } else if (base instanceof Headers) {
        base.forEach((value, key) => {
            result[key] = value;
        });
    }

    if (tenant.companyId) result["x-company-id"] = tenant.companyId;
    if (tenant.perimeterId) result["x-perimeter-id"] = tenant.perimeterId;

    return result;
}

async function apiFetch(path: string, init?: RequestInit) {
    let token: string;
    try {
        token = await getAccessToken();
    } catch (err: any) {
        // Keep frontend auth state consistent when the local session is gone/corrupted.
        if (err instanceof AppApiError && err.status === 401) {
            writeTenantContext({ companyId: null, perimeterId: null });
            await supabase.auth.signOut();
        }
        throw err;
    }
    const tenant = readTenantContext();

    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...mergeHeaders(init?.headers, tenant),
        },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
        const codeFromBody =
            typeof json?.error?.code === "string"
                ? json.error.code
                : typeof json?.code === "string"
                    ? json.code
                    : null;

        if (res.status === 429) {
            const retryAfter = res.headers.get("retry-after");
            const extra = retryAfter ? ` (riprova tra ~${retryAfter}s)` : "";
            throw new AppApiError(`HTTP 429: troppe richieste${extra}`, {
                status: 429,
                code: codeFromBody ?? "RATE_LIMITED",
                action: "retry",
            });
        }

        if (res.status === 503) {
            const retryAfter = res.headers.get("retry-after");
            const extra = retryAfter ? ` (riprova tra ~${retryAfter}s)` : "";
            throw new AppApiError(`HTTP 503: servizio non disponibile${extra}`, {
                status: 503,
                code: codeFromBody ?? "SERVICE_UNAVAILABLE",
                action: "retry",
            });
        }

        if (res.status === 401) {
            // Token invalid/expired or missing: clear tenant context + end session.
            writeTenantContext({ companyId: null, perimeterId: null });
            await supabase.auth.signOut();
            throw new AppApiError("Sessione scaduta o non valida. Effettua di nuovo il login.", {
                status: 401,
                code: codeFromBody ?? "UNAUTHORIZED",
                action: "relogin",
            });
        }

        if (res.status === 403) {
            throw new AppApiError("Non hai i permessi per questa operazione.", {
                status: 403,
                code: codeFromBody ?? "FORBIDDEN",
                action: "forbidden",
            });
        }

        const msg =
            json?.error?.message ||
            json?.message ||
            (typeof json?.error === "string" ? json.error : null) ||
            `HTTP ${res.status}`;
        throw new AppApiError(msg, {
            status: res.status,
            code: codeFromBody ?? "API_ERROR",
            action: "none",
        });
    }

    return json;
}

export const appApi = {
    isAuthError(error: unknown): boolean {
        return error instanceof AppApiError && error.status === 401;
    },

    isForbiddenError(error: unknown): boolean {
        return error instanceof AppApiError && error.status === 403;
    },

    getTenantContext(): TenantContextSelection {
        return readTenantContext();
    },

    setTenantContext(next: TenantContextSelection) {
        const previous = readTenantContext();
        const normalized = normalizeTenantContext(next);
        writeTenantContext(normalized);
        if (!isSameTenantContext(previous, normalized)) {
            emitTenantContextChanged(previous, normalized);
        }
    },

    clearTenantContext() {
        const previous = readTenantContext();
        const cleared = { companyId: null, perimeterId: null };
        writeTenantContext(cleared);
        if (!isSameTenantContext(previous, cleared)) {
            emitTenantContextChanged(previous, cleared);
        }
    },

    async createTestScenario(name: string): Promise<{ id: string; name: string }> {
        const json = await apiFetch(`/api/admin/test-scenarios`, {
            method: "POST",
            body: JSON.stringify({ name }),
        });
        return { id: json.scenario.id, name: json.scenario.name };
    },

    async insertTestScenarioApplication(params: {
        scenarioId: string;
        user_id: string;
        position_id: string;
        priority: number;
    }) {
        await apiFetch(`/api/admin/test-scenarios/${params.scenarioId}/applications`, {
            method: "POST",
            body: JSON.stringify({
                user_id: params.user_id,
                position_id: params.position_id,
                priority: params.priority,
            }),
        });
    },

    async initializeTestScenario(scenarioId: string) {
        return apiFetch(`/api/admin/test-scenarios/${scenarioId}/initialize`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    },

    async resetActiveUsers() {
        return apiFetch("/api/admin/users/reset-active", {
            method: "POST",
            body: JSON.stringify({}),
        });
    },

    async adminUpdateMaxApplications(maxApplications: number) {
        return apiFetch(`/api/admin/config/max-applications`, {
            method: "POST",
            body: JSON.stringify({ maxApplications }),
        });
    },

    async deactivateUserAndCleanup(userId: string) {
        return apiFetch(`/api/admin/users/${userId}/deactivate`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    },

    async activateMe() {
        return apiFetch(`/api/users/me/activate`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    },

    async deactivateMe() {
        return apiFetch(`/api/users/me/deactivate`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    },

    async getMe(): Promise<{
        user: { id: string; email?: string };
        isAdmin: boolean;
        isOwner?: boolean;
        isSuperAdmin?: boolean;
        access?: any;
    }> {
        try {
            return await apiFetch(`/api/me`, { method: "GET" });
        } catch (e: any) {
            const msg = String(e?.message ?? "").toLowerCase();
            const isTenantScopeError =
                msg.includes("tenant_scope_mismatch") ||
                msg.includes("requested company does not match requested perimeter") ||
                msg.includes("company context required") ||
                msg.includes("perimeter context required");

            if (isTenantScopeError) {
                // stale/mismatched tenant context in localStorage: reset and retry once
                writeTenantContext({ companyId: null, perimeterId: null });
                return apiFetch(`/api/me`, { method: "GET" });
            }

            throw e;
        }
    },

    async getMyUser(): Promise<any> {
        const json = await apiFetch(`/api/users/me`, { method: "GET" });
        return json.user;
    },

    async getMyApplications(): Promise<any[]> {
        const json = await apiFetch(`/api/users/me/applications`, { method: "GET" });
        return json.applications ?? [];
    },

    async reorderUserApplications(params: {
        userId: string;
        updates: { app_ids: string[]; priority: number }[];
    }) {
        await apiFetch(`/api/users/${params.userId}/reorder-applications`, {
            method: "POST",
            body: JSON.stringify({ updates: params.updates }),
        });
    },

    async applyToPositionsBulk(params: {
        userId: string;
        positionIds: string[];
        priority: number;
    }) {
        return apiFetch(`/api/users/${params.userId}/applications/bulk`, {
            method: "POST",
            body: JSON.stringify({
                positionIds: params.positionIds,
                priority: params.priority,
            }),
        });
    },

    async withdrawFromPositionsBulk(params: {
        userId: string;
        positionIds: string[];
    }) {
        return apiFetch(`/api/users/${params.userId}/applications/bulk`, {
            method: "DELETE",
            body: JSON.stringify({
                positionIds: params.positionIds,
            }),
        });
    },

    getPositionsMapPayload: async (params?: { viewerUserId?: string; mode?: "from" | "to" }) => {
        const qs = new URLSearchParams();
        if (params?.viewerUserId) qs.set("viewerUserId", params.viewerUserId);
        if (params?.mode) qs.set("mode", params.mode);
        qs.set("_ts", String(Date.now()));

        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        return apiFetch(`/api/map/positions${suffix}`, { method: "GET" });
    },

    async adminWarmupNeo4j() {
        return apiFetch(`/api/admin/graph/warmup`, { method: "POST", body: JSON.stringify({}) });
    },

    async syncGraph() {
        return apiFetch(`/api/admin/sync-graph`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    },

    async adminFindChains(body: any) {
        return apiFetch(`/api/admin/graph/chains`, {
            method: "POST",
            body: JSON.stringify(body ?? {}),
        });
    },

    async adminGetUsers() {
        const json = await apiFetch(`/api/admin/users`, { method: "GET" });
        return json.users ?? [];
    },

    async adminGetPositions() {
        const json = await apiFetch(`/api/admin/positions`, { method: "GET" });
        return json.positions ?? [];
    },

    async adminGetActiveUsers() {
        const json = await apiFetch(`/api/admin/users/active`, { method: "GET" });
        return json.users ?? [];
    },

    async adminGetCandidatures() {
        const json = await apiFetch(`/api/admin/candidatures`, { method: "GET" });
        return json.applications ?? [];
    },

    async adminGraphSummary() {
        return apiFetch(`/api/admin/graph/summary`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    },

    async adminGetLocations() {
        const json = await apiFetch(`/api/admin/locations`, { method: "GET" });
        return json.locations ?? [];
    },

    async adminPatchUser(userId: string, patch: any) {
        const json = await apiFetch(`/api/admin/users/${userId}`, {
            method: "PATCH",
            body: JSON.stringify(patch ?? {}),
        });
        return json.user;
    },

    async adminGetRoles() {
        const json = await apiFetch(`/api/admin/roles`, { method: "GET" });
        return json.roles ?? [];
    },

    async adminGetScenarios() {
        const json = await apiFetch(`/api/admin/test-scenarios`, { method: "GET" });
        return json.scenarios ?? [];
    },

    async adminGetConfig() {
        const json = await apiFetch(`/api/admin/config`, { method: "GET" });
        return json.config ?? null;
    },

    async adminCreateUser(params: { full_name: string; email: string }) {
        const json = await apiFetch(`/api/admin/users`, {
            method: "POST",
            body: JSON.stringify(params),
        });
        return json.user;
    },

    async adminDeleteUser(userId: string) {
        return apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    },

    // ✅ Public: locations per Register (NO supabase.from in FE)
    async publicGetLocations(): Promise<{ id: string; name: string }[]> {
        const res = await fetch(`${BASE}/api/public/locations`, { method: "GET" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
            const msg =
                json?.error ||
                json?.message ||
                `HTTP ${res.status}`;
            throw new Error(msg);
        }

        return json.locations ?? [];
    },

    // ✅ Bootstrap profilo applicativo (crea/aggiorna riga in users) DOPO login
    async ensureMeProfile(params: { full_name: string; location_id: string | null }) {
        return apiFetch(`/api/users/me/ensure`, {
            method: "POST",
            body: JSON.stringify(params),
        });
    },

    async adminCreateLocation(params: {
        name: string;
        latitude?: number | null;
        longitude?: number | null;
    }) {
        const json = await apiFetch(`/api/admin/locations`, {
            method: "POST",
            body: JSON.stringify(params),
        });
        return json.location;
    },

    async adminDeleteLocation(id: string) {
        return apiFetch(`/api/admin/locations/${id}`, { method: "DELETE" });
    },

    async adminCreateRole(params: { name: string }) {
        const json = await apiFetch(`/api/admin/roles`, {
            method: "POST",
            body: JSON.stringify(params),
        });
        return json.role;
    },

    async adminDeleteRole(id: string) {
        return apiFetch(`/api/admin/roles/${id}`, { method: "DELETE" });
    },

    async getConfig(): Promise<{ maxApplications: number } | null> {
        const json = await apiFetch(`/api/config`, { method: "GET" });
        const cfg = json.config ?? null;
        if (!cfg) return null;

        return {
            maxApplications: cfg.max_applications,
        };
    },

    async adminGetScenarioApplications(scenarioId: string) {
        const json = await apiFetch(`/api/admin/test-scenarios/${scenarioId}/applications`, {
            method: "GET",
        });
        return json.applications ?? [];
    },

    async adminRenameScenario(scenarioId: string, name: string) {
        return apiFetch(`/api/admin/test-scenarios/${scenarioId}`, {
            method: "PATCH",
            body: JSON.stringify({ name }),
        });
    },

    async adminDeleteScenario(scenarioId: string) {
        return apiFetch(`/api/admin/test-scenarios/${scenarioId}`, { method: "DELETE" });
    },

    async adminDeleteScenarioApplication(scenarioId: string, appId: string) {
        return apiFetch(`/api/admin/test-scenarios/${scenarioId}/applications/${appId}`, {
            method: "DELETE",
        });
    },

    async adminDeleteAllScenarioApplications(scenarioId: string) {
        return apiFetch(`/api/admin/test-scenarios/${scenarioId}/applications`, {
            method: "DELETE",
        });
    },

    /* =========================
       INTERLOCKING SCENARIOS
       ========================= */

    async adminListInterlockingScenarios() {
        const json = await apiFetch(`/api/admin/interlocking-scenarios`, {
            method: "GET",
        });
        return { scenarios: json.scenarios ?? [] };
    },

    async adminSaveInterlockingScenario(payload: {
        scenario_code: string;
        generated_at: string;
        strategy: string;
        max_len: number;
        total_chains: number;
        unique_people: number;
        coverage: number | null;
        avg_length: number | null;
        max_length: number | null;
        avg_priority: number | null;
        build_nodes: number | null;
        build_relationships: number | null;
        chains_json: any[];
        optimal_chains_json: any[] | null;
    }) {
        return apiFetch(`/api/admin/interlocking-scenarios`, {
            method: "POST",
            body: JSON.stringify(payload),
        });
    },

    async adminDeleteInterlockingScenarios(payload: { ids: string[] }) {
        return apiFetch(`/api/admin/interlocking-scenarios`, {
            method: "DELETE",
            body: JSON.stringify(payload),
        });
    },

    async adminInviteUser(params: {
        email: string;
        full_name?: string;
        first_name?: string;
        last_name?: string;
        location_id: string | null;
        access_role?: "user" | "admin" | "admin_user";
    }) {
        return apiFetch(`/api/admin/users/invite`, {
            method: "POST",
            body: JSON.stringify(params),
        });
    },

    async adminGetCampaignStatus(): Promise<{ campaign_status: "open" | "closed" }> {
        const json = await apiFetch(`/api/admin/campaign-status`, { method: "GET" });
        return { campaign_status: json.campaign_status };
    },

    async adminSetCampaignStatus(status: "open" | "closed"): Promise<{ campaign_status: "open" | "closed" }> {
        const json = await apiFetch(`/api/admin/campaign-status`, {
            method: "PATCH",
            body: JSON.stringify({ campaign_status: status }),
        });
        return { campaign_status: json.campaign_status };
    },

    async platformGetCompanies() {
        const json = await apiFetch(`/api/platform/companies`, { method: "GET" });
        return json.companies ?? [];
    },

    async platformCreateCompany(params: {
        name: string;
        first_super_admin: { first_name: string; last_name: string; email: string };
    }) {
        const json = await apiFetch(`/api/platform/companies`, {
            method: "POST",
            body: JSON.stringify(params),
        });
        return json.company;
    },

    async platformRenameCompany(companyId: string, params: { name: string }) {
        const json = await apiFetch(`/api/platform/companies/${companyId}`, {
            method: "PATCH",
            body: JSON.stringify(params),
        });
        return json.company;
    },

    async platformGetCompanySuperAdmins(companyId: string) {
        const json = await apiFetch(`/api/platform/companies/${companyId}/super-admins`, { method: "GET" });
        return json.super_admins ?? [];
    },

    async platformAddCompanySuperAdmin(
        companyId: string,
        params: { first_name: string; last_name: string; email: string }
    ) {
        const json = await apiFetch(`/api/platform/companies/${companyId}/super-admins`, {
            method: "POST",
            body: JSON.stringify(params),
        });
        return json.super_admin;
    },

    async platformRemoveCompanySuperAdmin(companyId: string, userId: string) {
        return apiFetch(`/api/platform/companies/${companyId}/super-admins/${userId}`, { method: "DELETE" });
    },

    async platformGetPerimeters(companyId: string) {
        const json = await apiFetch(`/api/platform/companies/${companyId}/perimeters`, { method: "GET" });
        return json.perimeters ?? [];
    },

    async platformCreatePerimeter(companyId: string, params: { name: string }) {
        const json = await apiFetch(`/api/platform/companies/${companyId}/perimeters`, {
            method: "POST",
            body: JSON.stringify(params),
        });
        return json.perimeter;
    },

    async platformRenamePerimeter(companyId: string, perimeterId: string, params: { name: string }) {
        const json = await apiFetch(`/api/platform/companies/${companyId}/perimeters/${perimeterId}`, {
            method: "PATCH",
            body: JSON.stringify(params),
        });
        return json.perimeter;
    },

    async platformGetPerimeterAdmins(companyId: string, perimeterId: string) {
        const json = await apiFetch(`/api/platform/companies/${companyId}/perimeters/${perimeterId}/admins`, {
            method: "GET",
        });
        return json.admins ?? [];
    },

    async platformAddPerimeterAdmin(
        companyId: string,
        perimeterId: string,
        params: { first_name: string; last_name: string; email: string }
    ) {
        const json = await apiFetch(`/api/platform/companies/${companyId}/perimeters/${perimeterId}/admins`, {
            method: "POST",
            body: JSON.stringify(params),
        });
        return json.admin;
    },

    async platformRemovePerimeterAdmin(companyId: string, perimeterId: string, userId: string) {
        return apiFetch(`/api/platform/companies/${companyId}/perimeters/${perimeterId}/admins/${userId}`, {
            method: "DELETE",
        });
    },
};

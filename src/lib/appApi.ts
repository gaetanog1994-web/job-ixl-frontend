import { supabase } from "./supabaseClient";

// Preferisci una variabile dedicata per l'API applicativa.
// appApi.ts

const BASE = (import.meta.env.VITE_APP_API_URL || "").replace(/\/+$/, "");

if (!BASE) {
    throw new Error(
        "❌ Missing VITE_APP_API_URL: frontend must call backend-api"
    );
}

async function getAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessione non valida: access_token mancante");
    return token;
}

async function apiFetch(path: string, init?: RequestInit) {
    const token = await getAccessToken();

    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(init?.headers ?? {}),
        },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
        if (res.status === 429) {
            const retryAfter = res.headers.get("retry-after");
            const extra = retryAfter ? ` (riprova tra ~${retryAfter}s)` : "";
            throw new Error(`HTTP 429: troppe richieste${extra}`);
        }

        const msg =
            json?.error?.message ||
            json?.message ||
            (typeof json?.error === "string" ? json.error : null) ||
            `HTTP ${res.status}`;
        throw new Error(msg);
    }

    return json;
}

export const appApi = {
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

    async getMe(): Promise<{ user: { id: string; email?: string }; isAdmin: boolean }> {
        return apiFetch(`/api/me`, { method: "GET" });
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
        return apiFetch(`/api/admin/graph/warmup`, { method: "GET" });
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

    async getConfig(): Promise<{ max_applications: number } | null> {
        const json = await apiFetch(`/api/config`, { method: "GET" });
        return json.config ?? null;
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
};
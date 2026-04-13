import React, { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { appApi } from "../lib/appApi";
import { supabase } from "../lib/supabaseClient";
import "../styles/dashboard.css";

const AccountPage: React.FC = () => {
    const { user, loading } = useAuth();
    const [userData, setUserData] = useState<any>(null);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);
    const [passwordSaving, setPasswordSaving] = useState(false);

    useEffect(() => {
        if (!user) return;
        appApi.getMyUser().then(setUserData).catch(console.error);
    }, [user]);

    const handleChangePassword = async () => {
        if (!newPassword || !confirmPassword) {
            setPasswordMsg({ text: "Compila entrambi i campi.", ok: false });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordMsg({ text: "Le password non coincidono.", ok: false });
            return;
        }
        try {
            setPasswordSaving(true);
            setPasswordMsg(null);
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
                setPasswordMsg({ text: "Errore: " + error.message, ok: false });
            } else {
                setPasswordMsg({ text: "Password aggiornata con successo.", ok: true });
                setNewPassword("");
                setConfirmPassword("");
            }
        } catch (e: any) {
            setPasswordMsg({ text: "Errore imprevisto.", ok: false });
        } finally {
            setPasswordSaving(false);
        }
    };

    if (loading || !userData) return <div className="db-loading"><div className="db-spinner" />Caricamento…</div>;

    return (
        <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 16px" }}>
            <div className="db-card db-fade-in">
                <div className="db-card-title">Il mio profilo</div>

                {/* Info utente */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
                    <div>
                        <div className="db-stat-label">Email</div>
                        <div className="db-cell-primary">{userData.email ?? "—"}</div>
                    </div>
                    <div>
                        <div className="db-stat-label">Sede</div>
                        <div className="db-cell-primary">{userData.location_name ?? userData.location_id ?? "—"}</div>
                    </div>
                    <div>
                        <div className="db-stat-label">Ruolo</div>
                        <div className="db-cell-primary">{userData.role_name ?? userData.role_id ?? "—"}</div>
                    </div>
                </div>

                <hr style={{ margin: "24px 0", borderColor: "var(--border)" }} />

                {/* Cambia password */}
                <div className="db-card-title">Cambia password</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16, maxWidth: 340 }}>
                    <input
                        type="password"
                        placeholder="Nuova password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={passwordSaving}
                        style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14 }}
                    />
                    <input
                        type="password"
                        placeholder="Conferma nuova password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={passwordSaving}
                        style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14 }}
                    />
                    <button
                        onClick={handleChangePassword}
                        disabled={passwordSaving}
                        style={{
                            padding: "10px 20px", background: "var(--brand, #e8511a)", color: "#fff",
                            border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14,
                            cursor: passwordSaving ? "not-allowed" : "pointer", opacity: passwordSaving ? 0.7 : 1,
                        }}
                    >
                        {passwordSaving ? "Salvataggio…" : "Aggiorna password"}
                    </button>
                    {passwordMsg && (
                        <p style={{ color: passwordMsg.ok ? "var(--success, #22c55e)" : "var(--danger, #ef4444)", margin: 0, fontSize: 13 }}>
                            {passwordMsg.text}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountPage;

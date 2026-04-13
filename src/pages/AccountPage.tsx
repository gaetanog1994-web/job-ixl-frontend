import React, { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { appApi } from "../lib/appApi";
import { supabase } from "../lib/supabaseClient";
import "../styles/dashboard.css";

const AccountPage: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
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

    if (loading || !userData) {
        return (
            <div className="db-loading" style={{ paddingTop: 80 }}>
                <div className="db-spinner" />
                Caricamento…
            </div>
        );
    }

    return (
        <div
            style={{
                maxWidth: 560,
                margin: "0 auto",
                padding: "32px 16px 40px",
                fontFamily: "var(--font)",
                display: "flex",
                flexDirection: "column",
                gap: 20,
            }}
        >
            {/* Back button */}
            <div>
                <button
                    onClick={() => navigate("/")}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 9,
                        padding: "7px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "var(--font)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "background 0.15s, color 0.15s",
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = "var(--surface)";
                        e.currentTarget.style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                >
                    ← Dashboard
                </button>
            </div>

            {/* Profile card */}
            <div className="db-card db-fade-in" style={{ padding: "20px 24px" }}>
                <div className="db-card-title" style={{ marginBottom: 18 }}>Il mio profilo</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div>
                        <div className="db-stat-label" style={{ marginBottom: 4 }}>Email</div>
                        <div className="db-cell-primary">{userData.email ?? "—"}</div>
                    </div>
                    <div style={{ height: 1, background: "var(--border)" }} />
                    <div>
                        <div className="db-stat-label" style={{ marginBottom: 4 }}>Sede</div>
                        <div className="db-cell-primary">{userData.location_name ?? "—"}</div>
                    </div>
                    <div style={{ height: 1, background: "var(--border)" }} />
                    <div>
                        <div className="db-stat-label" style={{ marginBottom: 4 }}>Ruolo</div>
                        <div className="db-cell-primary">{userData.role_name ?? "—"}</div>
                    </div>
                </div>
            </div>

            {/* Change password card */}
            <div className="db-card db-fade-in" style={{ padding: "20px 24px" }}>
                <div className="db-card-title" style={{ marginBottom: 18 }}>Cambia password</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 340 }}>
                    <input
                        type="password"
                        placeholder="Nuova password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={passwordSaving}
                        style={{
                            padding: "10px 12px",
                            borderRadius: 9,
                            border: "1px solid var(--border)",
                            fontSize: 13,
                            fontFamily: "var(--font)",
                            color: "var(--text-primary)",
                            background: "var(--surface)",
                            outline: "none",
                            transition: "border-color 0.15s",
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = "var(--brand)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
                    />
                    <input
                        type="password"
                        placeholder="Conferma nuova password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={passwordSaving}
                        style={{
                            padding: "10px 12px",
                            borderRadius: 9,
                            border: "1px solid var(--border)",
                            fontSize: 13,
                            fontFamily: "var(--font)",
                            color: "var(--text-primary)",
                            background: "var(--surface)",
                            outline: "none",
                            transition: "border-color 0.15s",
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = "var(--brand)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
                    />
                    <button
                        onClick={handleChangePassword}
                        disabled={passwordSaving}
                        style={{
                            padding: "10px 20px",
                            background: passwordSaving ? "var(--text-muted)" : "var(--brand)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 9,
                            fontWeight: 600,
                            fontSize: 13,
                            fontFamily: "var(--font)",
                            cursor: passwordSaving ? "not-allowed" : "pointer",
                            transition: "background 0.15s",
                            boxShadow: passwordSaving ? "none" : "0 2px 8px rgba(232,81,26,0.25)",
                        }}
                    >
                        {passwordSaving ? "Salvataggio…" : "Aggiorna password"}
                    </button>
                    {passwordMsg && (
                        <p style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 500,
                            color: passwordMsg.ok ? "var(--available-color)" : "#ef4444",
                        }}>
                            {passwordMsg.text}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountPage;

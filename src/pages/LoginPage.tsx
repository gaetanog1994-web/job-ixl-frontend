import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { appApi } from "../lib/appApi";


const LoginPage: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            const { data, error: loginError } =
                await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

            if (loginError) {
                setError("Errore durante il login: " + loginError.message);
                return;
            }

            if (!data.user) {
                setError("Login impossibile: utente non trovato.");
                return;
            }
            if (!data.user) {
                setError("Login impossibile: utente non trovato.");
                return;
            }

            // ✅ Bootstrap profilo applicativo se manca (caso: signup con email confirmation)
            try {
                await appApi.getMyUser(); // se esiste già, ok
            } catch (e: any) {
                const msg = String(e?.message ?? "");

                // quando /api/users/me risponde 404 "User row not found"
                if (msg.includes("User row not found") || msg.includes("404")) {
                    const raw = localStorage.getItem("pending_profile");

                    if (raw) {
                        const pending = JSON.parse(raw);
                        await appApi.ensureMeProfile({
                            full_name: String(pending?.full_name ?? "").trim(),
                            location_id: pending?.location_id ? String(pending.location_id) : null,
                        });
                        localStorage.removeItem("pending_profile");
                    } else {
                        // fallback: non abbiamo i dati (utente registrato tempo fa / storage pulito)
                        // qui puoi decidere: o fai passare comunque, o mandi a pagina "completa profilo"
                        // Per ora: facciamo passare e lasceremo che l'app gestisca l'assenza profilo.
                    }
                } else {
                    throw e; // altro errore: meglio non mascherarlo
                }
            }

            // Redirect alla dashboard (root)
            window.location.href = "/";

        } catch (err) {
            setError("Errore imprevisto.");
            console.error(err);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font, 'Inter', sans-serif)",
                background: "#0b0f14",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "380px",
                    padding: "32px",
                    background: "#111",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "26px" }}>
                    <div style={{ width: 44, height: 44, background: "#fff", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.2)", overflow: "hidden" }}>
                        <img src="/jip-logo-icon.jpg" alt="JIP Logo" style={{ width: "75%", height: "75%", objectFit: "contain" }} />
                    </div>
                    <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "#ffffff", letterSpacing: "0.01em" }}>JIP</h2>
                </div>

                {error && (
                    <p style={{ color: "#ff6b6b", marginBottom: "12px" }}>
                        {error}
                    </p>
                )}

                <form onSubmit={handleLogin}>
                    <input
                        type="email"
                        placeholder="Email aziendale"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                            width: "100%",
                            marginBottom: "12px",
                            padding: "10px",
                        }}
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{
                            width: "100%",
                            marginBottom: "16px",
                            padding: "10px",
                        }}
                    />

                    <button
                        type="submit"
                        style={{
                            width: "100%", padding: "12px", background: "var(--brand, #e8511a)", color: "#fff", 
                            border: "none", borderRadius: "10px", fontWeight: 600, fontSize: "15px", 
                            cursor: "pointer", boxShadow: "0 4px 12px rgba(232,81,26,0.3)", marginTop: "8px",
                            transition: "transform 0.1s" 
                        }}
                    >
                        Accedi
                    </button>
                    <div style={{ textAlign: "center", marginTop: "24px" }}>
                        <a href="/signup" style={{ color: "#9ca3af", fontSize: "14px", textDecoration: "none" }}>Non hai un account? <span style={{ color: "var(--brand, #e8511a)", fontWeight: 600 }}>Registrati</span></a>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;

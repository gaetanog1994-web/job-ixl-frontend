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
                background: "#1e1e1e",
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
                <h2 style={{ marginBottom: "20px", textAlign: "center" }}>
                    Login
                </h2>

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
                            width: "100%",
                            padding: "10px",
                            cursor: "pointer",
                        }}
                    >
                        Accedi
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;

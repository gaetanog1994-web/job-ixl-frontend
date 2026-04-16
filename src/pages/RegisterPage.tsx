import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient"; // RESTA SOLO per auth.signUp
import { appApi } from "../lib/appApi";

type Location = { id: string; name: string };

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [selectedLocation, setSelectedLocation] = useState("");

    const [locations, setLocations] = useState<Location[]>([]);
    const [error, setError] = useState("");
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // ✅ 1) Carica sedi via backend (NO supabase.from in FE)
    useEffect(() => {
        const load = async () => {
            setLoadingLocations(true);
            setError("");
            try {
                const locs = await appApi.publicGetLocations();
                setLocations(locs);
            } catch (e: unknown) {
                console.error("Errore nel caricamento sedi:", e);
                setError(e instanceof Error ? e.message : "Errore nel caricamento sedi");
            } finally {
                setLoadingLocations(false);
            }
        };
        load();
    }, []);

    // ✅ 2) Register: auth su supabase + bootstrap profilo su backend
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!selectedLocation) {
            setError("Seleziona una sede.");
            return;
        }

        setSubmitting(true);

        try {
            // 2.1 SignUp (Auth)
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: "http://localhost:5173/login",
                },
            });

            if (authError) {
                setError("Errore durante la creazione dell'account: " + authError.message);
                return;
            }

            // Se supabase non ritorna sessione (email confirmation), non possiamo chiamare backend con token.
            // In quel caso: chiediamo all’utente di verificare email e fare login.
            const hasSession = !!authData.session;
            if (!hasSession) {
                localStorage.setItem(
                    "pending_profile",
                    JSON.stringify({
                        full_name: fullName,
                        location_id: selectedLocation || null,
                    })
                );
                alert("Registrazione avvenuta. Controlla la mail per confermare e poi fai login.");
                navigate("/login");
                return;
            }


            // 2.2 Assicura sessione (alcune config richiedono signIn esplicito)
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (loginError || !loginData.session) {
                alert("Account creato. Ora fai login.");
                navigate("/login");
                return;
            }

            // 2.3 Bootstrap/ensure profilo applicativo su backend (NO insert users da FE)
            await appApi.ensureMeProfile({
                full_name: fullName,
                location_id: selectedLocation || null,
            });

            alert("Registrazione riuscita!");
            navigate("/");
        } catch (err: unknown) {
            console.error("🔥 ERRORE GENERALE:", err);
            setError(err instanceof Error ? err.message : "Errore imprevisto");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            style={{
                fontFamily: "var(--font, 'Inter', sans-serif)",
                maxWidth: "400px",
                margin: "auto",
                paddingTop: "60px",
                position: "relative",
            }}
        >
            <Link
                to="/login"
                style={{
                    position: "absolute",
                    top: "16px",
                    right: "0",
                    fontSize: "14px",
                    textDecoration: "none",
                    color: "var(--brand, #e8511a)",
                    fontWeight: 600,
                }}
            >
                Accedi →
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "30px" }}>
                <div style={{ width: 48, height: 48, background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                    <img src="/jip-logo-icon.jpg" alt="JIP Logo" style={{ width: "75%", height: "75%", objectFit: "contain" }} />
                </div>
                <h2 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: "#0f172a", letterSpacing: "0.01em" }}>JIP</h2>
            </div>

            <h3 style={{ fontSize: 18, color: "#334155", marginBottom: "24px", fontWeight: 600 }}>Crea il tuo account</h3>

            {error && <p style={{ color: "#ef4444", marginBottom: "16px", fontSize: 14 }}>{error}</p>}

            <form onSubmit={handleRegister}>
                <input
                    type="text"
                    placeholder="Nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    style={{ width: "100%", marginBottom: "10px" }}
                    disabled={submitting}
                />

                <input
                    type="email"
                    placeholder="Email aziendale"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ width: "100%", marginBottom: "10px" }}
                    disabled={submitting}
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: "100%", marginBottom: "10px" }}
                    disabled={submitting}
                />

                <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    required
                    style={{ width: "100%", marginBottom: "10px" }}
                    disabled={loadingLocations || submitting}
                >
                    <option value="">
                        {loadingLocations ? "Caricamento sedi..." : "Scegli una sede"}
                    </option>

                    {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                            {loc.name}
                        </option>
                    ))}
                </select>

                <button type="submit" style={{ 
                    width: "100%", padding: "12px", background: "var(--brand, #e8511a)", color: "#fff", 
                    border: "none", borderRadius: "10px", fontWeight: 600, fontSize: "15px", 
                    cursor: "pointer", boxShadow: "0 4px 12px rgba(232,81,26,0.3)", marginTop: "10px",
                    transition: "transform 0.1s" 
                }} disabled={submitting}>
                    {submitting ? "Registrazione in corso..." : "Registrati"}
                </button>
            </form>
        </div>
    );
};

export default RegisterPage;

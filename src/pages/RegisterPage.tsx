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
            } catch (e: any) {
                console.error("Errore nel caricamento sedi:", e);
                setError(e?.message ?? "Errore nel caricamento sedi");
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
        } catch (err: any) {
            console.error("🔥 ERRORE GENERALE:", err);
            setError(err?.message ?? "Errore imprevisto");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            style={{
                maxWidth: "400px",
                margin: "auto",
                paddingTop: "40px",
                position: "relative",
            }}
        >
            <Link
                to="/login"
                style={{
                    position: "absolute",
                    top: "0",
                    right: "0",
                    fontSize: "14px",
                    textDecoration: "none",
                    color: "#4da3ff",
                    fontWeight: 500,
                }}
            >
                Accedi
            </Link>

            <h2>Registrazione</h2>

            {error && <p style={{ color: "red" }}>{error}</p>}

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

                <button type="submit" style={{ width: "100%", padding: "10px" }} disabled={submitting}>
                    {submitting ? "Registrazione..." : "Registrati"}
                </button>
            </form>
        </div>
    );
};

export default RegisterPage;

import { useNavigate } from "react-router-dom";

const AdminHome: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div style={{ padding: "40px" }}>


            <h2>Area Admin</h2>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "20px",
                    marginTop: "40px",
                }}
            >
                {/* 🟩 A — INTERLOCKING */}
                <div
                    style={boxStyle}
                    onClick={() => navigate("/admin/interlocking")}
                >
                    <h3>A. Interlocking</h3>
                    <p>
                        Individua le catene chiuse di scambio tra posizioni.
                    </p>
                </div>

                {/* 🟩 B — CONFIGURAZIONE */}
                <div
                    style={boxStyle}
                    onClick={() => navigate("/admin/configurazione")}
                >
                    <h3>B. Configurazione</h3>
                    <p>
                        Gestisci utenti, ruoli, reparti, sedi, responsabili e HR.
                    </p>
                </div>

                {/* 🟩 C — CAMPAGNE CANDIDATURE */}
                <div
                    style={boxStyle}
                    onClick={() => navigate("/admin/campagne")}
                >
                    <h3>C. Campagne candidature</h3>
                    <p>
                        Gestisci il lifecycle della campagna e lo storico perimetro.
                    </p>
                </div>

                {/* 🟩 D — MAPPE UTENTI ATTIVI */}
                <div
                    style={boxStyle}
                    onClick={() => navigate("/admin/maps")}
                >
                    <h3>D. Mappe utenti attivi</h3>
                    <p>
                        Analizza le candidature dal punto di vista di ciascun utente.
                    </p>
                </div>

                {/* 🟩 E — LISTA CANDIDATURE */}
                <div
                    style={boxStyle}
                    onClick={() => navigate("/admin/candidatures")}
                >
                    <h3>E. Lista candidature</h3>
                    <p>
                        Visualizza le candidature correnti della campagna aperta.
                    </p>
                </div>
            </div>
        </div>
    );
};

const boxStyle: React.CSSProperties = {
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "30px",
    cursor: "pointer",
    transition: "all 0.2s ease",
};

export default AdminHome;

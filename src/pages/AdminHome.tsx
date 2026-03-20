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
                {/* 🟩 A — TABELLE CANDIDATURE */}
                <div
                    style={boxStyle}
                    onClick={() => navigate("/admin/candidatures")}
                >
                    <h3>A. Tabelle candidature</h3>
                    <p>
                        Visualizza e monitora tutte le candidature presenti
                        sulla piattaforma.
                    </p>
                </div>

                {/* 🟩 B — MAPPE UTENTI ATTIVI */}
                <div
                    style={boxStyle}
                    onClick={() => navigate("/admin/maps")}
                >
                    <h3>B. Mappe utenti attivi</h3>
                    <p>
                        Analizza le candidature dal punto di vista di ciascun
                        utente.
                    </p>
                </div>

                {/* 🟩 C — INTERLOCKING */}
                <div
                    style={boxStyle}
                    onClick={() => navigate("/admin/interlocking")}
                >
                    <h3>C. Catene di interlocking</h3>
                    <p>
                        Individua le catene chiuse di scambio tra posizioni.
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

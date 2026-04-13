import { useNavigate } from "react-router-dom";

const PreAuthPage = () => {
    const navigate = useNavigate();

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: "20px",
                background: "#0b0f14",
                color: "#fff",
                textAlign: "center",
                fontFamily: "var(--font, 'Inter', sans-serif)",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "8px" }}>
                <div style={{ width: 56, height: 56, background: "#fff", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.3)", overflow: "hidden" }}>
                    <img src="/jip-logo-icon.jpg" alt="JIP Logo" style={{ width: "75%", height: "75%", objectFit: "contain" }} />
                </div>
                <h1 style={{ fontSize: 40, fontWeight: 800, margin: 0, color: "#ffffff", letterSpacing: "0.01em" }}>JIP</h1>
            </div>

            <p style={{ maxWidth: "420px", opacity: 0.8 }}>
                Simula e ottimizza la mobilità interna attraverso catene di interlocking.
            </p>

            <div style={{ display: "flex", gap: "15px", marginTop: "20px" }}>
                <button
                    onClick={() => navigate("/login")}
                    style={{
                        padding: "12px 24px",
                        fontSize: "15px",
                        fontWeight: 600,
                        cursor: "pointer",
                        background: "var(--brand, #e8511a)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "10px",
                        boxShadow: "0 4px 12px rgba(232,81,26,0.3)",
                    }}
                >
                    Accedi
                </button>
            </div>
        </div>
    );
};

export default PreAuthPage;

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
            }}
        >
            <h1 style={{ marginBottom: "10px" }}>
                JIP
            </h1>

            <p style={{ maxWidth: "420px", opacity: 0.8 }}>
                Simula e ottimizza la mobilità interna attraverso catene di interlocking.
            </p>

            <div style={{ display: "flex", gap: "15px", marginTop: "20px" }}>
                <button
                    onClick={() => navigate("/login")}
                    style={{
                        padding: "10px 18px",
                        fontSize: "14px",
                        cursor: "pointer",
                    }}
                >
                    Accedi
                </button>

                <button
                    onClick={() => navigate("/signup")}
                    style={{
                        padding: "10px 18px",
                        fontSize: "14px",
                        cursor: "pointer",
                    }}
                >
                    Registrati
                </button>
            </div>
        </div>
    );
};

export default PreAuthPage;

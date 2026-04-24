import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { appApi } from "../lib/appApi";

type AppRow = {
    id: string;
    created_at?: string;
    candidate_name?: string;
    candidate_role_name?: string;
    occupant_name?: string;
    occupant_role_name?: string;
};

const AdminApplications = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [applications, setApplications] = useState<AppRow[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await appApi.adminGetCandidatures();
                setApplications(data ?? []);
            } catch {
                setApplications([]);
            }
        };
        void load();
    }, [location.key]);

    return (
        <div style={{ padding: "30px" }}>
            <button onClick={() => navigate("/admin")}>Dashboard</button>

            <h3 style={{ marginTop: "20px" }}>A. Tabelle delle candidature</h3>

            <table width="100%">
                <thead>
                    <tr>
                        <th>Candidato</th>
                        <th>Ruolo candidato</th>
                        <th>Occupante</th>
                        <th>Ruolo occupante</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>
                    {applications.map((app) => (
                        <tr key={app.id}>
                            <td>{app.candidate_name ?? "—"}</td>
                            <td>{app.candidate_role_name ?? "—"}</td>
                            <td>{app.occupant_name ?? "—"}</td>
                            <td>{app.occupant_role_name ?? "—"}</td>
                            <td>{app.created_at ? new Date(app.created_at).toLocaleDateString("it-IT") : "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AdminApplications;

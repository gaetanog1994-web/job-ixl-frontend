import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";

const AdminApplications = () => {
    const navigate = useNavigate();
    const [applications, setApplications] = useState<any[]>([]);
    const location = useLocation();

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from("applications")
                .select(`
          id,
          created_at,
          users ( full_name ),
          positions (
            title,
            users ( full_name )
          )
        `)
                .order("created_at", { ascending: false });

            if (data) setApplications(data);
        };

        load();
    }, [location.key]);

    return (
        <div style={{ padding: "30px" }}>
            <button onClick={() => navigate("/admin")}>Dashboard</button>

            <h3 style={{ marginTop: "20px" }}>
                A. Tabelle delle candidature
            </h3>

            <button style={{ marginBottom: "10px" }}>
                Visualizza grafo
            </button>

            <table width="100%">
                <thead>
                    <tr>
                        <th>Candidato</th>
                        <th>Posizione</th>
                        <th>Occupata da</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>
                    {applications.map(app => (
                        <tr key={app.id}>
                            <td>{app.users?.full_name}</td>
                            <td>{app.positions?.title}</td>
                            <td>{app.positions?.users?.full_name}</td>
                            <td>
                                {new Date(app.created_at).toLocaleDateString("it-IT")}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AdminApplications;

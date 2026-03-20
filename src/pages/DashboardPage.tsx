import React, { useEffect } from "react";
import PositionsMap from "../components/PositionsMap";
import { useSearchParams } from "react-router-dom";
import { appApi } from "../lib/appApi";

const DashboardPage: React.FC = () => {
    const [searchParams] = useSearchParams();

    // 🔑 UNICA sorgente di verità
    const highlightPositionId =
        searchParams.get("highlightPositionId") ?? undefined;
    console.log("[DashboardPage] highlightPositionId =", highlightPositionId);
    useEffect(() => {
        console.log(
            "[DashboardPage EFFECT] highlightPositionId changed:",
            highlightPositionId
        );
    }, [highlightPositionId]);


    useEffect(() => {
        const load = async () => {
            try {
                // ritorna { user, isAdmin }
                const me = await appApi.getMe();
                console.log("[DashboardPage] isAdmin =", me.isAdmin);
            } catch (e) {
                console.warn("[DashboardPage] getMe failed:", e);
            }
        };
        load();
    }, []);


    return (
        <div style={{ width: "100%", height: "calc(100vh - 60px)" }}>
            <h2 style={{ textAlign: "center" }}>
                Mappa delle posizioni
            </h2>

            <PositionsMap
                interaction="write"
                highlightPositionId={highlightPositionId}
            />
        </div>
    );
};

export default DashboardPage;

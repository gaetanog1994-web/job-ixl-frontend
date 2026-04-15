import { useEffect, useState, type CSSProperties } from "react";
import { appApi } from "../lib/appApi";

type Props = {
  sectionLabel?: string;
  style?: CSSProperties;
};

const TenantContextStrip: React.FC<Props> = ({ sectionLabel, style }) => {
  const [meData, setMeData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    const loadContext = async () => {
      try {
        const me = await appApi.getMe();
        if (!cancelled) setMeData(me ?? null);
      } catch {
        if (!cancelled) setMeData(null);
      }
    };

    const handleTenantContextChanged = () => {
      loadContext();
    };

    loadContext();
    window.addEventListener("tenant-context-changed", handleTenantContextChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("tenant-context-changed", handleTenantContextChanged);
    };
  }, []);

  const access = meData?.access ?? {};
  const companyName = access?.currentCompanyName ?? "Company non selezionata";
  const perimeterName = access?.currentPerimeterName ?? "Perimeter non selezionato";

  return (
    <div
      className="db-card"
      style={{
        padding: "12px 14px",
        marginBottom: "14px",
        borderRadius: 14,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Contesto attivo</span>
          <span style={{ margin: "0 6px", color: "var(--text-muted)" }}>·</span>
          <span>{companyName}</span>
          <span style={{ margin: "0 6px", color: "var(--text-muted)" }}>/</span>
          <span>{perimeterName}</span>
          {sectionLabel ? (
            <>
              <span style={{ margin: "0 6px", color: "var(--text-muted)" }}>/</span>
              <span>{sectionLabel}</span>
            </>
          ) : null}
        </div>

      </div>
    </div>
  );
};

export default TenantContextStrip;

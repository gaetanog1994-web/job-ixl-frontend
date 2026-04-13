import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { appApi } from "../lib/appApi";
import { labelAccessRole, labelAdminContext, labelHighestRole } from "../lib/accessLabels";

type Props = {
  sectionLabel?: string;
  style?: CSSProperties;
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "#fff",
  padding: "5px 9px",
  fontSize: 12,
  color: "var(--text-secondary)",
  fontWeight: 600,
};

const TenantContextStrip: React.FC<Props> = ({ sectionLabel, style }) => {
  const navigate = useNavigate();
  const [meData, setMeData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await appApi.getMe();
        if (!cancelled) setMeData(me ?? null);
      } catch {
        if (!cancelled) setMeData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const access = meData?.access ?? {};
  const companyName = access?.currentCompanyName ?? "Company non selezionata";
  const perimeterName = access?.currentPerimeterName ?? "Perimeter non selezionato";
  const accessRoleLabel = labelAccessRole(access?.accessRole);
  const highestRoleLabel = labelHighestRole(access?.highestRole);
  const adminLevelLabel = labelAdminContext({
    isOwner: meData?.isOwner === true,
    isSuperAdmin: meData?.isSuperAdmin === true,
    isAdmin: meData?.isAdmin === true,
  });

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

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={badgeStyle}>Company: {companyName}</span>
          <span style={badgeStyle}>Perimeter: {perimeterName}</span>
          <span style={badgeStyle}>Access role: {accessRoleLabel}</span>
          <span style={badgeStyle}>Livello: {highestRoleLabel}</span>
          <span style={badgeStyle}>{adminLevelLabel}</span>
          <button
            className="db-btn db-btn-outline"
            style={{ height: 28, padding: "0 10px", fontSize: 12 }}
            onClick={() => navigate("/select-context")}
          >
            Cambia contesto
          </button>
        </div>
      </div>
    </div>
  );
};

export default TenantContextStrip;

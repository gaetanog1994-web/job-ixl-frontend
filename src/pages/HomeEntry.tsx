import { Navigate } from "react-router-dom";
import { useActiveContext } from "../lib/ActiveContextProvider";

const HomeEntry: React.FC = () => {
  const {
    activeSelection,
    resolveDestinationForSelection,
    isBootstrappingContext,
    isContextResolved,
    contextError,
  } = useActiveContext();

  if (isBootstrappingContext) {
    return (
      <div style={{ padding: "24px", fontFamily: "'Inter', sans-serif", color: "#64748b" }}>
        Caricamento contesto...
      </div>
    );
  }

  if (!isContextResolved || !activeSelection) {
    return (
      <div style={{ padding: "24px", fontFamily: "'Inter', sans-serif", color: "#991b1b" }}>
        {contextError ?? "Nessun contesto tenant disponibile per questo account."}
      </div>
    );
  }

  return <Navigate to={resolveDestinationForSelection(activeSelection)} replace />;
};

export default HomeEntry;

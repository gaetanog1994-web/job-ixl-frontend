import { useMemo, useRef, useState } from "react";

export type OrgNode = {
  id: string;
  name: string;
  parent_id?: string | null;
};

type TreeNode = OrgNode & {
  children: TreeNode[];
  depth: number;
  path: string[];
  pathNames: string[];
};

type Props = {
  nodes: OrgNode[];
  value: string | null;
  onChange: (id: string | null, pathNames: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

function buildTree(nodes: OrgNode[]): { roots: TreeNode[]; byId: Map<string, TreeNode> } {
  const byId = new Map<string, TreeNode>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [], depth: 0, path: [], pathNames: [] });
  }

  const roots: TreeNode[] = [];
  for (const node of nodes) {
    const treeNode = byId.get(node.id)!;
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  function computeMeta(node: TreeNode, depth: number, parentPath: string[], parentNames: string[]) {
    node.depth = depth;
    node.path = [...parentPath, node.id];
    node.pathNames = [...parentNames, node.name];
    for (const child of node.children) {
      computeMeta(child, depth + 1, node.path, node.pathNames);
    }
  }
  for (const root of roots) computeMeta(root, 0, [], []);

  return { roots, byId };
}

const OrgUnitTreeSelector = ({
  nodes,
  value,
  onChange,
  placeholder = "Seleziona unità organizzativa",
  disabled = false,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  const { roots, byId } = useMemo(() => buildTree(nodes), [nodes]);
  const selectedNode = value ? byId.get(value) : null;

  const searchLower = search.trim().toLowerCase();

  const matchingIds = useMemo(() => {
    if (!searchLower) return null;
    const result = new Set<string>();

    function addWithAncestors(node: TreeNode) {
      result.add(node.id);
      if (node.parent_id && byId.has(node.parent_id)) {
        addWithAncestors(byId.get(node.parent_id)!);
      }
    }

    for (const [, node] of byId) {
      if (node.name.toLowerCase().includes(searchLower)) addWithAncestors(node);
    }
    return result;
  }, [searchLower, byId]);

  const effectiveExpanded = useMemo(() => {
    if (!matchingIds || !searchLower) return expanded;
    const combined = new Set(expanded);
    for (const id of matchingIds) {
      const node = byId.get(id);
      if (node && node.children.length > 0) combined.add(id);
    }
    return combined;
  }, [matchingIds, expanded, byId, searchLower]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectLeaf = (node: TreeNode) => {
    if (node.children.length > 0) return;
    onChange(node.id, node.pathNames);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, []);
  };

  const open = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const close = () => {
    setIsOpen(false);
    setSearch("");
  };

  const renderNode = (node: TreeNode): React.ReactNode => {
    if (matchingIds && !matchingIds.has(node.id)) return null;
    const isLeaf = node.children.length === 0;
    const isExpanded = effectiveExpanded.has(node.id);
    const isSelected = node.id === value;
    const hasVisible = node.children.some((c) => !matchingIds || matchingIds.has(c.id));

    return (
      <div key={node.id}>
        <div
          role={isLeaf ? "option" : undefined}
          aria-selected={isLeaf ? isSelected : undefined}
          onClick={() => (isLeaf ? handleSelectLeaf(node) : toggleExpand(node.id, { stopPropagation: () => {} } as React.MouseEvent))}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 10px",
            paddingLeft: `${10 + node.depth * 20}px`,
            borderRadius: "8px",
            cursor: isLeaf ? "pointer" : "pointer",
            background: isSelected ? "rgba(232,81,26,0.08)" : "transparent",
            transition: "background 0.12s",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#f8fafc";
          }}
          onMouseLeave={(e) => {
            if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent";
          }}
        >
          {!isLeaf ? (
            <span
              onClick={(e) => toggleExpand(node.id, e)}
              style={{
                width: "18px",
                height: "18px",
                border: "1px solid #e2e8f0",
                borderRadius: "5px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                color: "#64748b",
                flexShrink: 0,
                transition: "transform 0.15s, background 0.12s, border-color 0.12s",
                transform: isExpanded ? "rotate(90deg)" : "none",
                background: isExpanded ? "#fff7ed" : "#fff",
                borderColor: isExpanded ? "#fed7aa" : "#e2e8f0",
              }}
            >
              ›
            </span>
          ) : (
            <span
              style={{
                width: "18px",
                height: "18px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "9px",
                color: isSelected ? "#e8511a" : "#cbd5e1",
                flexShrink: 0,
                transition: "color 0.12s",
              }}
            >
              {isSelected ? "●" : "○"}
            </span>
          )}

          <span
            style={{
              fontSize: "13px",
              fontWeight: isLeaf ? (isSelected ? 700 : 500) : 600,
              color: isSelected ? "#e8511a" : isLeaf ? "#0f172a" : "#475569",
              flex: 1,
              lineHeight: 1.3,
            }}
          >
            {node.name}
          </span>

          {!isLeaf && (
            <span style={{ fontSize: "11px", color: "#94a3b8", flexShrink: 0 }}>
              {node.children.length}
            </span>
          )}
        </div>

        {!isLeaf && (isExpanded || (!!searchLower && hasVisible)) && (
          <div
            style={{
              borderLeft: "1px solid #e2e8f0",
              marginLeft: `${10 + node.depth * 20 + 9}px`,
            }}
          >
            {node.children.map(renderNode)}
          </div>
        )}
      </div>
    );
  };

  const hasResults = roots.some((r) => !matchingIds || matchingIds.has(r.id));

  return (
    <div style={{ position: "relative", fontFamily: "var(--font, 'Inter', sans-serif)" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 10px",
          borderRadius: "9px",
          border: `1px solid ${isOpen ? "#e8511a" : "#e2e8f0"}`,
          background: disabled ? "#f8fafc" : "#f1f5f9",
          color: selectedNode ? "#0f172a" : "#94a3b8",
          fontSize: "13px",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
          transition: "border-color 0.15s",
          outline: "none",
          boxShadow: isOpen ? "0 0 0 2px rgba(232,81,26,0.12)" : "none",
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedNode ? selectedNode.name : placeholder}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {value && !disabled && (
            <span
              onClick={handleClear}
              style={{
                fontSize: "16px",
                lineHeight: 1,
                color: "#94a3b8",
                cursor: "pointer",
                padding: "0 2px",
                borderRadius: "3px",
                transition: "color 0.12s",
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#ef4444")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#94a3b8")}
            >
              ×
            </span>
          )}
          <span
            style={{
              fontSize: "10px",
              color: "#94a3b8",
              transition: "transform 0.15s",
              transform: isOpen ? "rotate(180deg)" : "none",
              display: "inline-block",
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Breadcrumb path below trigger */}
      {selectedNode && selectedNode.pathNames.length > 1 && (
        <div
          style={{
            marginTop: "5px",
            fontSize: "11px",
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            gap: "3px",
            flexWrap: "wrap",
          }}
        >
          {selectedNode.pathNames.map((name, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              {i > 0 && <span style={{ color: "#cbd5e1" }}>›</span>}
              <span
                style={{
                  fontWeight: i === selectedNode.pathNames.length - 1 ? 700 : 400,
                  color: i === selectedNode.pathNames.length - 1 ? "#0f172a" : "#94a3b8",
                }}
              >
                {name}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 1999 }}
            onClick={close}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              minWidth: "280px",
              maxHeight: "300px",
              display: "flex",
              flexDirection: "column",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              boxShadow: "0 16px 32px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)",
              zIndex: 2000,
              overflow: "hidden",
            }}
          >
            {/* Search bar */}
            <div
              style={{
                padding: "10px 10px 8px",
                borderBottom: "1px solid #f1f5f9",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "0 10px",
                }}
              >
                <span style={{ fontSize: "13px", color: "#94a3b8", flexShrink: 0 }}>⌕</span>
                <input
                  ref={searchRef}
                  placeholder="Cerca unità..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    color: "#0f172a",
                    padding: "7px 0",
                  }}
                />
              </div>
            </div>

            {/* Tree area */}
            <div
              role="listbox"
              style={{ overflowY: "auto", padding: "6px", flex: 1 }}
            >
              {nodes.length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  Nessuna unità configurata.
                </div>
              ) : !hasResults ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  Nessun risultato per "{search}".
                </div>
              ) : (
                roots.map(renderNode)
              )}
            </div>

            {/* Footer hint */}
            {nodes.length > 0 && (
              <div
                style={{
                  padding: "6px 10px",
                  borderTop: "1px solid #f1f5f9",
                  fontSize: "11px",
                  color: "#94a3b8",
                  flexShrink: 0,
                }}
              >
                Seleziona un nodo foglia per assegnare la posizione
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default OrgUnitTreeSelector;

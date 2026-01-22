// src/state/useProjectState.ts
// =============================================================================
// Central project state for MVP 1.
//
// IMPORTANT (React gotcha):
// When updating arrays based on previous state, ALWAYS use the functional form:
//   setAnchors(prev => [...prev, newAnchor])
// This prevents “stale closure” bugs where updates silently don’t apply.
// =============================================================================

import { useCallback, useMemo, useState } from "react";
import type { Anchor, ProjectSpecs } from "../types";

// Simple sequential ID generator (A1, A2, A3...)
// (Later we can switch to UUID if you want.)
function nextAnchorId(count: number) {
  return `A${count + 1}`;
}

export function useProjectState() {
  // ---------------------------------------------------------------------------
  // SECTION A — Project specs
  // ---------------------------------------------------------------------------
  const [specs, setSpecs] = useState<ProjectSpecs>({
    width: 24,
    depth: 12,
    gridSize: 4.5,
    units: "in",
    ceilingHeight: 96,
  });

  // ---------------------------------------------------------------------------
  // SECTION B — Anchors (array)
  // ---------------------------------------------------------------------------
  const [anchors, setAnchors] = useState<Anchor[]>([]);

  // ---------------------------------------------------------------------------
  // SECTION C — Selection
  // ---------------------------------------------------------------------------
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);

  const selectedAnchor = useMemo(() => {
    if (!selectedAnchorId) return null;
    return anchors.find((a) => a.id === selectedAnchorId) ?? null;
  }, [anchors, selectedAnchorId]);

  // ---------------------------------------------------------------------------
  // SECTION D — Mutations (all use functional updates)
  // ---------------------------------------------------------------------------

  const createAnchor = useCallback((x: number, y: number) => {
    setAnchors((prev) => {
      const id = nextAnchorId(prev.length);
      const next: Anchor = { id, x, y };
      return [...prev, next];
    });
  }, []);

  const updateAnchorPosition = useCallback((id: string, x: number, y: number) => {
    setAnchors((prev) => prev.map((a) => (a.id === id ? { ...a, x, y } : a)));
  }, []);

  const deleteAnchor = useCallback((id: string) => {
    setAnchors((prev) => prev.filter((a) => a.id !== id));
    setSelectedAnchorId((prev) => (prev === id ? null : prev));
  }, []);

  return {
    specs,
    setSpecs,

    anchors,
    createAnchor,
    updateAnchorPosition,
    deleteAnchor,

    selectedAnchorId,
    setSelectedAnchorId,
    selectedAnchor,
  };
}

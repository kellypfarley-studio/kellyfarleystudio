export type ToolMode =
  | "select"
  | "move_anchor"
  | "place_strand"
  | "place_swoop"
  | "place_canopy_fastener";

export type DepthLayer = "front" | "mid" | "back";

export type MoundPreset = "none" | "small" | "medium" | "large";

export type ProjectSpecs = {
  projectName: string;
  ceilingHeightIn: number;
  boundaryWidthIn: number;
  boundaryHeightIn: number;
  gridSpacingIn: number;
  strandHoleDiameterIn: number;
  fastenerHoleDiameterIn: number;
  dueDate: string; // ISO date string (YYYY-MM-DD)
  previewDepth?: {
    depthSpreadIn: number;
    layerSpreadIn: number;
    jitterIn: number;
    perspectiveFactor?: number;
  };
  previewView?: {
    rotationDeg: number;
    rotationStrength: number;
    /** preview rendering detail: 'simple' uses thin path, 'detailed' uses procedural links */
    detail?: "simple" | "detailed";
  };
  /** optional pricing defaults for material/unit costs */
  pricing?: PricingDefaults;
  /** optional material defaults for weights/dimensions */
  materials?: MaterialsDefaults;
  /** optional quote settings (multipliers for different sales channels) */
  quote?: QuoteSettings;
};

export type PaletteColor = {
  id: string;
  name: string;
  hex: string;
};

export type ViewTransform = {
  zoom: number; // zoom=1 means "fit bounds"
  panX: number; // in inches
  panY: number; // in inches
};

export type AnchorType = "strand" | "canopy_fastener";

export type HoleType = "strand" | "fastener";

export type Anchor = {
  id: string;
  xIn: number;
  yIn: number;
  type: AnchorType;
  holeType?: HoleType;
  gridCol?: number;
  gridRow?: number;
};

export type StrandSpec = {
  sphereCount: number;
  topChainLengthIn: number;
  bottomChainLengthIn: number;
  moundPreset: MoundPreset;
  colorId: string;
  layer: DepthLayer;
};

export type Strand = {
  id: string;
  anchorId: string;
  spec: StrandSpec;
};

export type CustomStrandSpec = StrandSpec & {
  // optional overrides for custom strand geometry
  pitchIn?: number; // distance between spheres along strand
  gapIn?: number; // gap at ends or between sections
  turnbuckle?: boolean; // whether to include a turnbuckle/adjuster
};

export type CustomStrand = {
  id: string;
  anchorId: string;
  spec: CustomStrandSpec;
};

export type SwoopSpec = {
  sphereCount: number;
  chainAIn: number;
  chainBIn: number;
  sagIn: number;
  colorId?: string;
};

export type Swoop = {
  id: string;
  aHoleId: string;
  bHoleId: string;
  spec: SwoopSpec;
};

export type NotesState = {
  customerNotes: string;
  artistNotes: string;
};

export type PlanToolsState = {
  mode: ToolMode;
  draftStrand: StrandSpec;
  draftSwoop?: SwoopSpec;
  draftCustomStrand?: CustomStrandSpec;
  pendingSwoopStartHoleId?: string | null;
};

export type SelectionState = {
  selectedAnchorId: string | null;
  selectedSwoopId?: string | null;
};

export type CursorState = {
  inside: boolean;
  xIn: number;
  yIn: number;
};

export type MenuAction = "save" | "png" | "pdf" | "csv" | "dxf" | "dfa" | "export_3d_zip";

// Milestone 5: pricing, materials, quote tiers, and computed resource summaries

export type MaterialsDefaults = {
  sphereDiameterIn: number;
  sphereWeightLb: number;
  chainWeightLbPerFoot: number;
  eyeScrewWeightLb?: number;
  claspWeightLb?: number;
  plateWeightLb?: number;
};

export type PricingDefaults = {
  sphereUnitCost: number;
  claspUnitCost: number;
  eyeScrewUnitCost?: number;
  fastenerUnitCost?: number;
  chainCostPerFoot: number;
  decorativePlateCost: number;
  laborCost?: number;
};

export type QuoteSettings = {
  /** multiplier applied for showroom pricing (suggested default: 1.40) */
  showroomMultiplier?: number;
  /** multiplier applied for designer pricing (suggested default: 1.20) */
  designerMultiplier?: number;
};

export type ResourcesSummary = {
  spheres: number;
  clasps: number;
  holes: number;
  strandHoleCount?: number;
  fastenerHoleCount?: number;
  /** Count of vertical strands placed (not including swoops) */
  strands: number;
  /** Breakdown of strand counts by sphere count (key is the sphereCount as a string) */
  strandsBySphereCount: Record<string, number>;
  hangingAnchors: number;
  canopyFasteners: number;
  chainFeet: number; // total linear feet of chain required
  totalWeightLb: number; // computed total weight of materials in pounds
};

export type CostsSummary = {
  // per-line totals (materials only) e.g. spheres, clasps, chain
  lineTotals: {
    spheres?: number;
    clasps?: number;
    eyeScrews?: number;
    chain?: number;
    decorativePlates?: number;
    [key: string]: number | undefined;
  };
  materialsSubtotal: number;
  laborSubtotal?: number;
  artistNet: number; // net to artist before showroom/designer tiers
  showroomNet: number; // amount after showroom multiplier
  designerNet: number; // amount after designer multiplier
  total: number; // grand total customer price
};

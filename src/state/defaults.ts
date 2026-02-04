import type {
  CursorState,
  NotesState,
  PaletteColor,
  PlanToolsState,
  ProjectSpecs,
  SelectionState,
  StrandSpec,
  CustomStrandBuilderState,
  StackSpec,
  ClusterSpec,
  ClusterBuilderState,
  ViewTransform,
  MaterialsDefaults,
  PricingDefaults,
  QuoteSettings,
} from "../types/appTypes";

export const DEFAULT_PALETTE: PaletteColor[] = [
  { id: "c0", name: "White", hex: "#ffffff" },
  { id: "c0a", name: "Ultra Light", hex: "#f5f5f5" },
  { id: "c6", name: "Very Light", hex: "#bbbbbb" },
  { id: "c5", name: "Light Gray", hex: "#999999" },
  { id: "c4", name: "Mid Gray", hex: "#777777" },
  { id: "c3", name: "Gray", hex: "#555555" },
  { id: "c2", name: "Dark Gray", hex: "#333333" },
  { id: "c1", name: "Black", hex: "#111111" },
  { id: "c7", name: "Warm Gray", hex: "#7a6f66" },
  { id: "c8", name: "Neutral Brown", hex: "#6f5e4a" },
];

export const DEFAULT_SPECS: ProjectSpecs = {
  projectName: "New Project",
  ceilingHeightIn: 110,
  boundaryWidthIn: 24,
  boundaryHeightIn: 12,
  gridSpacingIn: 4.5,
  strandHoleDiameterIn: 0.28,
  fastenerHoleDiameterIn: 0.5,
  dueDate: "2026-10-12",
  previewDepth: {
    depthSpreadIn: 3,
    layerSpreadIn: 1,
    jitterIn: 0.25,
    perspectiveFactor: 0.0,
  },
  previewView: {
    rotationDeg: 0,
    rotationStrength: 1,
  },
};

export const DEFAULT_MATERIALS: MaterialsDefaults = {
  sphereDiameterIn: 4.5,
  sphereWeightLb: 0.02,
  chainWeightLbPerFoot: 0.02,
  eyeScrewWeightLb: 0.005,
  claspWeightLb: 0.01,
  plateWeightLb: 0.02,
};

export const DEFAULT_PRICING: PricingDefaults = {
  sphereUnitCost: 126.0,
  claspUnitCost: 0.5,
  eyeScrewUnitCost: 0.25,
  fastenerUnitCost: 1.25,
  chainCostPerFoot: 1.5,
  decorativePlateCost: 2.5,
  laborCost: 15,
};

export const DEFAULT_QUOTE: QuoteSettings = {
  showroomMultiplier: 1.4,
  designerMultiplier: 1.2,
};

// Merge pricing/materials/quote into the default specs so new projects start with sane values
DEFAULT_SPECS.materials = DEFAULT_MATERIALS;
DEFAULT_SPECS.pricing = DEFAULT_PRICING;
DEFAULT_SPECS.quote = DEFAULT_QUOTE;

export const DEFAULT_VIEW: ViewTransform = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

export const DEFAULT_NOTES: NotesState = {
  customerNotes: "",
  artistNotes: "",
};

export const DEFAULT_SELECTION: SelectionState = {
  selectedAnchorId: null,
};

export const DEFAULT_CURSOR: CursorState | null = null;

export function makeDefaultStrandSpec(palette: PaletteColor[]): StrandSpec {
  return {
    sphereCount: 10,
    topChainLengthIn: 16,
    bottomChainLengthIn: 10,
    moundPreset: "none",
    colorId: palette[0]?.id ?? "c1",
    layer: "front",
  };
}

export function makeDefaultStackSpec(palette: PaletteColor[]): StackSpec {
  return {
    sphereCount: 8,
    topChainLengthIn: 12,
    bottomChainLengthIn: 8,
    moundPreset: "none",
    colorId: palette[0]?.id ?? "c1",
    layer: "front",
  };
}

export function makeDefaultClusterSpec(): ClusterSpec {
  return {
    strands: [],
    itemRadiusIn: 2.25,
    spreadIn: 10,
  };
}

export function makeDefaultCustomBuilder(palette: PaletteColor[]): CustomStrandBuilderState {
  const defaultColor = palette[0]?.id ?? "c1";
  return {
    nodes: [],
    chainLengthIn: 8,
    strandSphereCount: 6,
    stackSphereCount: 6,
    strandColorId: defaultColor,
    stackColorId: defaultColor,
    layer: "front",
  };
}

export function makeDefaultClusterBuilder(palette: PaletteColor[]): ClusterBuilderState {
  const defaultColor = palette[0]?.id ?? "c1";
  return {
    strands: [],
    topChainLengthIn: 12,
    sphereCount: 10,
    bottomSphereCount: 0,
    colorId: defaultColor,
    itemRadiusIn: 2.25,
    spreadIn: 10,
    selectedIndex: null,
    showPreview: false,
  };
}

export function makeDefaultPlanTools(palette: PaletteColor[]): PlanToolsState {
  return {
    mode: "place_strand",
    draftStrand: makeDefaultStrandSpec(palette),
    draftStack: makeDefaultStackSpec(palette),
    clusterBuilder: makeDefaultClusterBuilder(palette),
    draftSwoop: { sphereCount: 6, chainAIn: 12, chainBIn: 12, sagIn: 4, colorId: palette[0]?.id ?? "c1" },
    customBuilder: makeDefaultCustomBuilder(palette),
    pendingSwoopStartHoleId: null,
  };
}

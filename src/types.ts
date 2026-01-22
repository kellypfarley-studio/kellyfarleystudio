export type Units = "in";

export type ProjectSpecs = {
  units: Units;
  width: number;
  depth: number;
  gridSize: number;
  offsetX: number;
  offsetY: number;
};

export type Anchor = {
  id: string;
  x: number;
  y: number;
};

import type { CostsSummary, PricingDefaults, QuoteSettings, ResourcesSummary } from "../types/appTypes";

type Props = {
  resources: ResourcesSummary;
  costs: CostsSummary;
  pricing?: PricingDefaults;
  quote?: QuoteSettings;
  onPricingPatch: (patch: Partial<PricingDefaults>) => void;
  onQuotePatch: (patch: Partial<QuoteSettings>) => void;
};

function numberInput(value?: number, onChange?: (v: number) => void) {
  return (
    <input
      type="number"
      step="0.01"
      value={value ?? 0}
      onChange={(e) => onChange && onChange(Number(e.target.value))}
      style={{ width: 80 }}
    />
  );
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ResourceBand({ resources, costs, pricing, quote, onPricingPatch, onQuotePatch }: Props) {
  const p = ({ ...(pricing ?? {}) } as PricingDefaults);
  const q = ({ ...(quote ?? {}) } as QuoteSettings);

  const strandBreakdown = Object.entries(resources.strandsBySphereCount ?? {})
    .filter(([k, v]) => Number(k) > 0 && (v ?? 0) > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => `${k}-sphere: ${v}`)
    .join("  •  ");
  const stackBreakdown = Object.entries(resources.stacksBySphereCount ?? {})
    .filter(([k, v]) => Number(k) > 0 && (v ?? 0) > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => `${k}-sphere: ${v}`)
    .join("  •  ");

  return (
    <div className="card bottomBand statusGrid" style={{ color: "#000", background: "#fff" }}>
      <div>
        <div className="panelTitle">Resources</div>
        <div className="smallLabel">Spheres: {resources.spheres}</div>
        {resources.pileSpheres ? <div className="smallLabel">Floor pile spheres: {resources.pileSpheres}</div> : null}
        {resources.hangingSpheres != null ? <div className="smallLabel">Hanging spheres: {resources.hangingSpheres}</div> : null}
        <div className="smallLabel">Clasps: {resources.clasps}</div>
        <div className="smallLabel">Strands: {resources.strands}</div>
        {strandBreakdown ? <div className="smallLabel">{strandBreakdown}</div> : null}
        <div className="smallLabel">Stacks: {resources.stacks ?? 0}</div>
        {stackBreakdown ? <div className="smallLabel">{stackBreakdown}</div> : null}
        <div className="smallLabel">Custom Strands: {resources.customStrands ?? 0}</div>
        <div className="smallLabel">Clusters: {resources.clusters ?? 0}</div>
        <div className="smallLabel">Strand Holes: {resources.strandHoleCount ?? 0}</div>
        <div className="smallLabel">Fastener Holes: {resources.fastenerHoleCount ?? 0}</div>
        <div className="smallLabel">Total Chain Length (ft): {Number(resources.chainFeet.toFixed(2))}</div>
        <div className="smallLabel">Hanging Weight (lb): {Number(resources.totalWeightLb.toFixed(2))}</div>
      </div>

      <div>
        <div className="panelTitle">Project estimated expenses</div>
        <div className="smallLabel">
          Sphere Unit Cost: {numberInput(p.sphereUnitCost, (v) => onPricingPatch({ sphereUnitCost: v }))}
          &nbsp; Total: ${formatCurrency(costs.lineTotals.spheres ?? 0)}
        </div>
        <div className="smallLabel">
          Clasp Unit Cost: {numberInput(p.claspUnitCost, (v) => onPricingPatch({ claspUnitCost: v }))}
          &nbsp; Total: ${formatCurrency(costs.lineTotals.clasps ?? 0)}
        </div>
        <div className="smallLabel">
          Eye Screw Unit Cost: {numberInput(p.eyeScrewUnitCost, (v) => onPricingPatch({ eyeScrewUnitCost: v }))}
          &nbsp; Total: ${formatCurrency(costs.lineTotals.eyeScrews ?? 0)}
        </div>
        <div className="smallLabel">
          Fastener Unit Cost: {numberInput(p.fastenerUnitCost, (v) => onPricingPatch({ fastenerUnitCost: v }))}
          &nbsp; Total: ${formatCurrency(costs.lineTotals.fasteners ?? 0)}
        </div>
        <div className="smallLabel">
          Chain Cost/ft: {numberInput(p.chainCostPerFoot, (v) => onPricingPatch({ chainCostPerFoot: v }))}
          &nbsp; Total: ${formatCurrency(costs.lineTotals.chain ?? 0)}
        </div>
        <div className="smallLabel">
          Decorative Plate Cost: {numberInput(p.decorativePlateCost, (v) => onPricingPatch({ decorativePlateCost: v }))}
          &nbsp; Total: ${formatCurrency(costs.lineTotals.decorativePlates ?? 0)}
        </div>
        <div className="smallLabel">Materials subtotal: ${formatCurrency(costs.materialsSubtotal ?? 0)}</div>
        <div className="smallLabel">Labor: ${formatCurrency(costs.laborSubtotal ?? 0)}</div>
      </div>

      <div>
        <div className="panelTitle">Custom project quote</div>
        <div className="smallLabel">
          Showroom Multiplier: {numberInput(q.showroomMultiplier, (v) => onQuotePatch({ showroomMultiplier: v }))}
        </div>
        <div className="smallLabel">
          Designer Multiplier: {numberInput(q.designerMultiplier, (v) => onQuotePatch({ designerMultiplier: v }))}
        </div>
        <div className="smallLabel">Artist net price: ${formatCurrency(costs.artistNet ?? 0)}</div>
        <div className="smallLabel">Showroom net price: ${formatCurrency(costs.showroomNet ?? 0)}</div>
        <div className="smallLabel">Designer net price: ${formatCurrency(costs.designerNet ?? 0)}</div>
      </div>
    </div>
  );
}

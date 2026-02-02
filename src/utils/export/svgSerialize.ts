export type FitBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
};

export type SerializeOptions = {
  /** If provided, will set the cloned svg's viewBox to these bounds (in same units as the svg)
   * viewBox will be set to: `${minX} ${minY} ${w} ${h}`
   */
  fitBounds?: FitBounds;
  /** Alternative convenience: provide a raw viewBox string to set on the clone. */
  viewBox?: string;
  /** Include XML declaration (default true). Set to false to skip adding <?xml ...?> */
  includeXmlDeclaration?: boolean;
};

/**
 * Clone and serialize an SVG element to a string suitable for saving to .svg files.
 * The clone will be ensured to have basic xmlns attributes. Optionally the clone's
 * `viewBox` can be overridden to a provided fit bounds.
 */
export function serializeSvg(svgEl: SVGSVGElement, options?: SerializeOptions): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!clone.getAttribute('xmlns:xlink')) {
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }

  if (options?.fitBounds) {
    const fb = options.fitBounds;
    clone.setAttribute('viewBox', `${fb.minX} ${fb.minY} ${fb.w} ${fb.h}`);
  } else if (options?.viewBox) {
    clone.setAttribute('viewBox', options.viewBox);
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);

  if (options?.includeXmlDeclaration === false) {
    return svgString;
  }

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
}

export default serializeSvg;

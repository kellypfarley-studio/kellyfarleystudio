declare module "qrcode" {
  const QRCode: any;
  export default QRCode;
}

declare module "gifenc" {
  export const GIFEncoder: any;
  export const applyPalette: any;
  export const quantize: any;
}

declare module "three" {
  const THREE: any;
  export = THREE;
}

declare module "three/examples/jsm/exporters/GLTFExporter.js" {
  export const GLTFExporter: any;
}

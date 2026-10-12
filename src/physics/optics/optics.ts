/**
 * Geometric Optics Module
 *
 * Thin lenses and spherical mirrors, using the "real-is-positive" convention
 * with every distance measured as a positive number from the optical element:
 *
 *   u  object distance (always > 0 here — the object is real)
 *   v  image distance:  v > 0  → real image,   v < 0 → virtual image
 *   f  focal length:    f > 0  → converging (convex lens / concave mirror)
 *                       f < 0  → diverging  (concave lens / convex mirror)
 *
 * The same pair of equations describes all four elements:
 *
 *   1/f = 1/u + 1/v      ⇒   v = u·f / (u − f)
 *   m   = h_i / h_o = −v/u        (m < 0 ⇒ inverted, m > 0 ⇒ erect)
 *
 * Where the image *sits* differs: for a lens a real image is on the far side
 * (x = +v), for a mirror a real image is on the object's side (x = −v).
 * In both cases a virtual image has v < 0 and so lands on the opposite side
 * of where a real one would — see {@link imageX}.
 *
 * Coordinates for ray diagrams: element at x = 0, light travels left → right,
 * object at x = −u, +y is up.
 */

export type OpticalElement =
  | 'concave-mirror'
  | 'convex-mirror'
  | 'converging-lens'
  | 'diverging-lens';

export interface OpticsParams {
  element: OpticalElement;
  focalLength: number; // cm (absolute value; sign determined by element type)
  objectDistance: number; // cm (positive, measured from element)
  objectHeight: number; // cm (positive upward)
}

export interface OpticsResult {
  imageDistance: number; // cm (positive = real, negative = virtual)
  imageHeight: number; // cm (negative ⇒ inverted)
  magnification: number;
  isReal: boolean;
  isInverted: boolean;
  isEnlarged: boolean;
  nature: string; // "Real, Inverted, Diminished", etc.
  signedFocalLength: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Ray {
  /** Solid path: object tip → element → far end of the drawn ray. */
  points: Point[];
  /**
   * Dashed back-extension from the element to the image tip. Present only when
   * the image is virtual (rays diverge, so only their extensions meet).
   */
  virtualExtension?: Point[];
  color: string;
  label: string;
}

export const DEFAULT_OPTICS_PARAMS: OpticsParams = {
  element: 'converging-lens',
  focalLength: 15,
  objectDistance: 30,
  objectHeight: 5,
};

/** How far (in cm) past the element rays are extended; the canvas clips them. */
const RAY_EXTENT = 400;

export function isMirror(element: OpticalElement): boolean {
  return element === 'concave-mirror' || element === 'convex-mirror';
}

/**
 * Signed focal length: positive for converging elements, negative for diverging.
 */
export function getSignedFocalLength(element: OpticalElement, f: number): number {
  const absF = Math.abs(f);
  switch (element) {
    case 'concave-mirror':
    case 'converging-lens':
      return absF;
    case 'convex-mirror':
    case 'diverging-lens':
      return -absF;
  }
}

/**
 * Calculate image properties using 1/f = 1/u + 1/v and m = −v/u.
 */
export function calculateImage(params: OpticsParams): OpticsResult {
  const f = getSignedFocalLength(params.element, params.focalLength);
  const u = Math.max(params.objectDistance, 1e-6);

  // Object at the focal point: rays leave parallel, image at infinity.
  if (Math.abs(u - f) < 0.001) {
    return {
      imageDistance: Infinity,
      imageHeight: Infinity,
      magnification: Infinity,
      isReal: false,
      isInverted: false,
      isEnlarged: true,
      nature: 'Image at infinity',
      signedFocalLength: f,
    };
  }

  const v = (u * f) / (u - f);
  const m = -v / u;

  const imageHeight = m * params.objectHeight;
  const isReal = v > 0;
  const isInverted = m < 0;
  const isSameSize = Math.abs(Math.abs(m) - 1) < 0.005;
  const isEnlarged = !isSameSize && Math.abs(m) > 1;

  const nature = [
    isReal ? 'Real' : 'Virtual',
    isInverted ? 'Inverted' : 'Erect',
    isSameSize ? 'Same size' : isEnlarged ? 'Enlarged' : 'Diminished',
  ].join(', ');

  return {
    imageDistance: v,
    imageHeight,
    magnification: m,
    isReal,
    isInverted,
    isEnlarged,
    nature,
    signedFocalLength: f,
  };
}

/**
 * Horizontal position (cm, element at 0) of the image for ray-diagram drawing.
 * Lens: real image is on the far side (+v). Mirror: real image is on the
 * object side (−v); a virtual image (v < 0) therefore lands behind the mirror.
 */
export function imageX(element: OpticalElement, v: number): number {
  return isMirror(element) ? -v : v;
}

export interface FocalMarker {
  x: number; // cm, element at 0
  label: string;
  virtual: boolean;
}

/**
 * Focal / centre-of-curvature markers to draw for the given element.
 * Lenses have a focal point on each side; mirrors only on their own axis —
 * concave mirrors in front (real), convex mirrors behind (virtual).
 */
export function getFocalMarkers(element: OpticalElement, absF: number): FocalMarker[] {
  const f = Math.abs(absF);
  switch (element) {
    case 'converging-lens':
    case 'diverging-lens':
      return [
        { x: -f, label: 'F', virtual: false },
        { x: f, label: "F'", virtual: false },
        { x: -2 * f, label: '2F', virtual: false },
        { x: 2 * f, label: "2F'", virtual: false },
      ];
    case 'concave-mirror':
      return [
        { x: -f, label: 'F', virtual: false },
        { x: -2 * f, label: 'C', virtual: false },
      ];
    case 'convex-mirror':
      return [
        { x: f, label: 'F', virtual: true },
        { x: 2 * f, label: 'C', virtual: true },
      ];
  }
}

/** Extend a ray that leaves `from` along `dir` until it reaches x = xEnd. */
function extendTo(from: Point, dir: Point, xEnd: number): Point {
  if (Math.abs(dir.x) < 1e-12) return { x: xEnd, y: from.y };
  const t = (xEnd - from.x) / dir.x;
  return { x: xEnd, y: from.y + dir.y * t };
}

/**
 * Generate the three principal rays for the ray diagram.
 *
 *   1. Parallel to the axis → passes through (or appears to come from) F.
 *   2. Aimed at the optical centre / pole → lens: undeviated, mirror: reflected
 *      symmetrically.
 *   3. Aimed through (or toward) the near focal point → leaves parallel.
 *
 * The post-element direction of each ray is derived analytically from the
 * geometry (not from the computed image), so the diagram independently
 * confirms the lens/mirror equation: every ray passes through the image tip.
 */
export function generatePrincipalRays(params: OpticsParams, result: OpticsResult): Ray[] {
  const f = result.signedFocalLength;
  const u = Math.max(params.objectDistance, 1e-6);
  const h = params.objectHeight;
  const v = result.imageDistance;
  const ih = result.imageHeight;
  const mirror = isMirror(params.element);

  if (!isFinite(v)) return [];

  const absF = Math.abs(f);
  const sgnF = f >= 0 ? 1 : -1;
  const objTip: Point = { x: -u, y: h };
  // Height where the "through the focal point" ray meets the element.
  const y3 = (-h * f) / (u - f);
  const dirSign = mirror ? -1 : 1; // rays continue left after a mirror, right after a lens
  const xEnd = dirSign * RAY_EXTENT;
  const imageTip: Point = { x: imageX(params.element, v), y: ih };

  const build = (hit: Point, dir: Point, color: string, label: string): Ray => ({
    points: [objTip, hit, extendTo(hit, dir, xEnd)],
    virtualExtension: v < 0 ? [hit, imageTip] : undefined,
    color,
    label,
  });

  // Direction vectors after the element (x component sign encodes forward/back).
  const dir1: Point = mirror
    ? { x: -absF, y: -h * sgnF } // parallel ray → toward / away from F
    : { x: absF, y: -h * sgnF };
  const dir2: Point = mirror ? { x: -u, y: -h } : { x: u, y: -h };
  const dir3: Point = { x: dirSign, y: 0 };

  return [
    build({ x: 0, y: h }, dir1, '#ef4444', 'Parallel ray'),
    build({ x: 0, y: 0 }, dir2, '#22c55e', mirror ? 'Pole ray' : 'Central ray'),
    build({ x: 0, y: y3 }, dir3, '#3b82f6', 'Focal ray'),
  ];
}

/**
 * Geometric Optics Module
 * 
 * Implements thin lens and mirror equations using the standard sign convention:
 * 
 * Sign Convention (Real-Is-Positive for mirrors, Cartesian for lenses):
 * - Object distance (u): negative when object is on same side as incoming light
 * - Image distance (v): positive for real images, negative for virtual
 * - Focal length (f): positive for converging (concave mirror / convex lens),
 *                      negative for diverging (convex mirror / concave lens)
 * 
 * Equations:
 *   Mirror equation: 1/f = 1/v + 1/u
 *   Lens equation:   1/f = 1/v - 1/u  (with sign convention)
 *   Magnification:   m = -v/u (mirrors), m = v/u (lenses)
 *   
 * For this simulation, we use the simplified convention:
 *   1/v = 1/f - 1/u  =>  v = uf/(u - f)
 *   where u is object distance (positive), f is focal length (signed)
 */

export type OpticalElement = 'concave-mirror' | 'convex-mirror' | 'converging-lens' | 'diverging-lens';

export interface OpticsParams {
  element: OpticalElement;
  focalLength: number;      // cm (absolute value; sign determined by element type)
  objectDistance: number;    // cm (positive, measured from element)
  objectHeight: number;     // cm (positive upward)
}

export interface OpticsResult {
  imageDistance: number;     // cm (positive = real, negative = virtual)
  imageHeight: number;      // cm (sign indicates orientation)
  magnification: number;
  isReal: boolean;
  isInverted: boolean;
  isEnlarged: boolean;
  nature: string;           // description: "Real, Inverted, Diminished", etc.
  signedFocalLength: number;
}

export interface Ray {
  start: { x: number; y: number };
  points: { x: number; y: number }[];
  color: string;
  label: string;
}

export const DEFAULT_OPTICS_PARAMS: OpticsParams = {
  element: 'converging-lens',
  focalLength: 15,
  objectDistance: 30,
  objectHeight: 5,
};

/**
 * Get signed focal length based on element type.
 * Converging elements (concave mirror, convex lens): positive f
 * Diverging elements (convex mirror, concave lens): negative f
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
 * Calculate image properties using the thin lens/mirror equation.
 * Uses the convention: 1/v = 1/f - 1/u  (v = uf/(u-f))
 */
export function calculateImage(params: OpticsParams): OpticsResult {
  const f = getSignedFocalLength(params.element, params.focalLength);
  const u = params.objectDistance;
  
  // Guard: object at focal point creates image at infinity
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

  // v = uf / (u - f)
  const v = (u * f) / (u - f);
  
  // Magnification: m = -v/u for mirrors, v/u for lenses
  const isMirror = params.element === 'concave-mirror' || params.element === 'convex-mirror';
  const m = isMirror ? -(v / u) : (v / u);
  
  const imageHeight = m * params.objectHeight;
  const isReal = v > 0;
  const isInverted = m < 0;
  const isEnlarged = Math.abs(m) > 1;

  let nature = '';
  nature += isReal ? 'Real' : 'Virtual';
  nature += ', ';
  nature += isInverted ? 'Inverted' : 'Erect';
  nature += ', ';
  nature += isEnlarged ? 'Enlarged' : (Math.abs(m) === 1 ? 'Same size' : 'Diminished');

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
 * Generate principal rays for ray diagram visualization.
 * Returns three standard rays used in geometric optics.
 */
export function generatePrincipalRays(
  params: OpticsParams,
  result: OpticsResult
): Ray[] {
  const f = result.signedFocalLength;
  const u = params.objectDistance;
  const h = params.objectHeight;
  const v = result.imageDistance;
  const ih = result.imageHeight;
  const isMirror = params.element === 'concave-mirror' || params.element === 'convex-mirror';
  
  const rays: Ray[] = [];
  const elementX = 0; // optical element at origin

  if (!isFinite(v)) return rays;

  if (!isMirror) {
    // LENS RAYS

    // Ray 1: Parallel to axis → through focal point
    rays.push({
      start: { x: -u, y: h },
      points: [
        { x: -u, y: h },
        { x: elementX, y: h },
        { x: v, y: ih },
      ],
      color: '#ef4444',
      label: 'Parallel ray',
    });

    // Ray 2: Through center → undeviated
    rays.push({
      start: { x: -u, y: h },
      points: [
        { x: -u, y: h },
        { x: elementX, y: 0 },
        { x: v, y: ih },
      ],
      color: '#22c55e',
      label: 'Central ray',
    });

    // Ray 3: Through focal point → parallel after lens
    rays.push({
      start: { x: -u, y: h },
      points: [
        { x: -u, y: h },
        { x: elementX, y: h * (1 - u / (u - f)) + h * (u / (u - f)) },
        { x: v, y: ih },
      ],
      color: '#3b82f6',
      label: 'Focal ray',
    });
  } else {
    // MIRROR RAYS - similar but reflected
    rays.push({
      start: { x: -u, y: h },
      points: [
        { x: -u, y: h },
        { x: elementX, y: h },
        { x: -Math.abs(v), y: ih },
      ],
      color: '#ef4444',
      label: 'Parallel ray',
    });

    rays.push({
      start: { x: -u, y: h },
      points: [
        { x: -u, y: h },
        { x: elementX, y: 0 },
        { x: -Math.abs(v), y: ih },
      ],
      color: '#22c55e',
      label: 'Center ray',
    });
  }

  return rays;
}

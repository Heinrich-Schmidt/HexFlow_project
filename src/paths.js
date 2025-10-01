import * as THREE from 'three';

/** Build a CurvePath (sequence of QuadraticBezierCurve3) from points and rounding per segment.
 * rounding = 0..1 => how far control point is pushed along the angle bisector
 */
export function buildCurveFromPointList(pointVec3List, roundingGlobal=0, perStepRounding=[]){
  const path = new THREE.CurvePath();
  if (!pointVec3List || pointVec3List.length<2) return path;

  const pts = pointVec3List.map(p=>p.clone());

  const segs = [];
  for(let i=0;i<pts.length-1;i++){
    const A=pts[i], B=pts[i+1];
    // default straight line as quadratic with control at midpoint
    let r = (perStepRounding[i] ?? null);
    if (r == null) r = roundingGlobal;
    r = Math.max(0, Math.min(1, +r));
    if (r <= 1e-6){
      const mid = new THREE.Vector3().addVectors(A,B).multiplyScalar(0.5);
      segs.push(new THREE.QuadraticBezierCurve3(A, mid, B));
    } else {
      // push control point outwards to create rounding
      const ab = new THREE.Vector3().subVectors(B,A);
      const mid = new THREE.Vector3().addVectors(A,B).multiplyScalar(0.5);
      // fake normal in XY plane
      const n = new THREE.Vector3(-ab.y, ab.x, 0).normalize();
      const ctrl = new THREE.Vector3().addVectors(mid, n.multiplyScalar(ab.length()*0.25*r));
      segs.push(new THREE.QuadraticBezierCurve3(A, ctrl, B));
    }
  }
  segs.forEach(s=>path.add(s));
  return path;
}

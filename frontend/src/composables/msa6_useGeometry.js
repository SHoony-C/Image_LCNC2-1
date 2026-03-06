/**
 * msa6_useGeometry.js
 * Pure geometry utility functions - no reactive state needed.
 */

/**
 * Calculate the direction (cross product) of three points.
 */
export function getDirection(p1, p2, p3) {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
}

/**
 * Check if a point lies on a line segment.
 */
export function isPointOnSegment(lineStart, lineEnd, point) {
  return (
    point.x <= Math.max(lineStart.x, lineEnd.x) &&
    point.x >= Math.min(lineStart.x, lineEnd.x) &&
    point.y <= Math.max(lineStart.y, lineEnd.y) &&
    point.y >= Math.min(lineStart.y, lineEnd.y)
  );
}

/**
 * Check if two line segments intersect.
 */
export function doLinesIntersect(line1Start, line1End, line2Start, line2End) {
  const d1 = getDirection(line1Start, line1End, line2Start);
  const d2 = getDirection(line1Start, line1End, line2End);
  const d3 = getDirection(line2Start, line2End, line1Start);
  const d4 = getDirection(line2Start, line2End, line1End);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && isPointOnSegment(line1Start, line1End, line2Start)) return true;
  if (d2 === 0 && isPointOnSegment(line1Start, line1End, line2End)) return true;
  if (d3 === 0 && isPointOnSegment(line2Start, line2End, line1Start)) return true;
  if (d4 === 0 && isPointOnSegment(line2Start, line2End, line1End)) return true;

  return false;
}

/**
 * Calculate the minimum distance from a point to a line segment.
 */
export function getPointToLineDistance(point, lineStart, lineEnd) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) {
    return Math.sqrt(A * A + B * B);
  }

  let param = dot / lenSq;
  let xx, yy;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the ratio of a segment length to the total line length.
 */
export function getDistanceRatio(start, end, lineStart, lineEnd) {
  const dx1 = end.x - start.x;
  const dy1 = end.y - start.y;
  const segmentLength = Math.sqrt(dx1 * dx1 + dy1 * dy1);

  const dx2 = lineEnd.x - lineStart.x;
  const dy2 = lineEnd.y - lineStart.y;
  const totalLength = Math.sqrt(dx2 * dx2 + dy2 * dy2);

  return totalLength > 0 ? segmentLength / totalLength : 0;
}

// Shared collision math supports rotated buildings and traced map footprints.
export function rectangleBoundary(
  x,
  z,
  width,
  depth,
  angle = 0,
  margin = 1.05,
) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const hw = width / 2 + margin,
    hd = depth / 2 + margin;
  const ex = Math.abs(c) * hw + Math.abs(s) * hd;
  const ez = Math.abs(s) * hw + Math.abs(c) * hd;
  return {
    x,
    z,
    hw,
    hd,
    angle,
    minX: x - ex,
    maxX: x + ex,
    minZ: z - ez,
    maxZ: z + ez,
  };
}

export function polygonBoundary(points, margin = 0.9, holes = []) {
  return {
    points,
    holes,
    margin,
    minX: Math.min(...points.map((p) => p[0])) - margin,
    maxX: Math.max(...points.map((p) => p[0])) + margin,
    minZ: Math.min(...points.map((p) => p[1])) - margin,
    maxZ: Math.max(...points.map((p) => p[1])) + margin,
  };
}

export function containsPoint(boundary, x, z) {
  if (
    x < boundary.minX ||
    x > boundary.maxX ||
    z < boundary.minZ ||
    z > boundary.maxZ
  )
    return false;
  if (!boundary.points) {
    const c = Math.cos(boundary.angle),
      s = Math.sin(boundary.angle);
    const dx = x - boundary.x,
      dz = z - boundary.z;
    return (
      Math.abs(dx * c - dz * s) < boundary.hw &&
      Math.abs(dx * s + dz * c) < boundary.hd
    );
  }
  const interiors = [];
  for (const p of [boundary.points, ...boundary.holes]) {
    let inside = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [ax, az] = p[j],
        [bx, bz] = p[i];
      if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
        inside = !inside;
      const dx = bx - ax,
        dz = bz - az,
        len = dx * dx + dz * dz;
      const t = len
        ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len))
        : 0;
      if (Math.hypot(x - ax - t * dx, z - az - t * dz) < boundary.margin)
        return true;
    }
    interiors.push(inside);
  }
  return interiors[0] && !interiors.slice(1).some(Boolean);
}

export interface ArrowFlight {
  id: string;
  from: [number, number, number];
  to:   [number, number, number];
  startTime: number;
  duration:  number;
}

export const activeArrows = new Map<string, ArrowFlight>();

export function addArrow(data: {
  id: string;
  from: number[];
  to:   number[];
  duration: number;
}) {
  activeArrows.set(data.id, {
    id:        data.id,
    from:      data.from as [number, number, number],
    to:        data.to   as [number, number, number],
    startTime: performance.now() / 1000,
    duration:  Math.max(0.05, data.duration),
  });
}

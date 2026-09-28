export type GesturePoint = { id: number; x: number; y: number; time: number; touch: boolean };
export type GestureGeometry = { x: number; y: number; scale: number; rotation: number };
type Frame = { left: number; top: number; width: number; height: number };
type Contact = GesturePoint & { startX: number; startY: number };
type Pair = { x: number; y: number; distance: number; angle: number };
type Session = {
  id: string; frame: Frame; geometry: GestureGeometry; origin: GestureGeometry;
  contacts: Map<number, Contact>; pair: Pair | null;
  initialScale: number; changed: boolean; moved: boolean; held: boolean; multiple: boolean;
};
type Callbacks = {
  select(id: string): void;
  checkpoint(): void;
  change(id: string, geometry: GestureGeometry): void;
  replace(id: string): void;
  lock(id: string): void;
  resize?(id: string, scale: number): void;
};
type Timer = { start(fn: () => void, delay: number): unknown; clear(id: unknown): void };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const degrees = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;
const pairOf = (contacts: Map<number, Contact>): Pair => {
  const [a, b] = [...contacts.values()];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
    distance: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
};

// One session owns a prenda until every finger lifts. Gesture changes never touch z.
export class CanvasGestures {
  private session: Session | null = null;
  private holdTimer: unknown = null;
  private lastTap: { id: string; x: number; y: number; time: number } | null = null;

  constructor(private callbacks: Callbacks, private timer: Timer = {
    start: (fn, delay) => setTimeout(fn, delay),
    clear: id => clearTimeout(id as ReturnType<typeof setTimeout>),
  }) {}

  get active() { return this.session !== null; }
  has(pointerId: number) { return this.session?.contacts.has(pointerId) ?? false; }

  private clearHold() {
    if (this.holdTimer !== null) this.timer.clear(this.holdTimer);
    this.holdTimer = null;
  }

  down(point: GesturePoint, target?: { id: string; geometry: GestureGeometry; frame: Frame }): boolean {
    const contact = { ...point, startX: point.x, startY: point.y };
    const active = this.session;
    if (active) {
      // A second finger may land on empty canvas or another overlapping prenda.
      if (!point.touch || active.contacts.size >= 2) return true;
      this.clearHold(); this.lastTap = null;
      active.contacts.set(point.id, contact);
      active.multiple = true; active.moved = true; active.held = false;
      active.pair = pairOf(active.contacts);
      active.origin = { ...active.geometry };
      return true;
    }
    if (!target || target.frame.width <= 0 || target.frame.height <= 0) return false;
    if (!point.touch || this.lastTap?.id !== target.id) this.lastTap = null;
    const geometry = { x: target.geometry.x, y: target.geometry.y, scale: target.geometry.scale, rotation: target.geometry.rotation };
    const session: Session = { id: target.id, frame: target.frame, geometry,
      origin: { ...geometry }, contacts: new Map([[point.id, contact]]), pair: null,
      initialScale: geometry.scale, changed: false, moved: false, held: false, multiple: false };
    this.session = session;
    this.callbacks.select(target.id);
    if (point.touch) this.holdTimer = this.timer.start(() => {
      this.holdTimer = null;
      if (this.session !== session || session.moved || session.multiple) return;
      session.held = true; this.lastTap = null;
      this.callbacks.lock(session.id);
    }, 550);
    return true;
  }

  private change(geometry: GestureGeometry) {
    const session = this.session!;
    if (Object.keys(geometry).every(key => Math.abs(geometry[key as keyof GestureGeometry] - session.geometry[key as keyof GestureGeometry]) < .00001)) return;
    if (!session.changed) { this.callbacks.checkpoint(); session.changed = true; }
    session.geometry = geometry;
    this.callbacks.change(session.id, geometry);
  }

  move(point: GesturePoint) {
    const session = this.session, contact = session?.contacts.get(point.id);
    if (!session || !contact) return;
    contact.x = point.x; contact.y = point.y;
    if (Math.hypot(point.x - contact.startX, point.y - contact.startY) > 8) {
      session.moved = true; this.clearHold(); this.lastTap = null;
    }
    if (session.pair && session.contacts.size === 2) {
      const current = pairOf(session.contacts), start = session.pair;
      if (start.distance < 8) { session.pair = current; session.origin = { ...session.geometry }; return; }
      const scale = clamp(session.origin.scale * current.distance / start.distance, .08, 1.35);
      const ratio = scale / session.origin.scale;
      const delta = degrees((current.angle - start.angle) * 180 / Math.PI);
      const angle = delta * Math.PI / 180;
      const dx = session.frame.left + session.origin.x * session.frame.width / 100 - start.x;
      const dy = session.frame.top + session.origin.y * session.frame.height / 100 - start.y;
      // Keep the point between the fingers attached to the same part of the prenda.
      const cx = current.x + ratio * (dx * Math.cos(angle) - dy * Math.sin(angle));
      const cy = current.y + ratio * (dx * Math.sin(angle) + dy * Math.cos(angle));
      this.change({ x: clamp((cx - session.frame.left) / session.frame.width * 100, 4, 96),
        y: clamp((cy - session.frame.top) / session.frame.height * 100, 4, 96),
        scale, rotation: degrees(session.origin.rotation + delta) });
    } else if (session.moved && !session.held) {
      this.change({ ...session.origin,
        x: clamp(session.origin.x + (point.x - contact.startX) / session.frame.width * 100, 4, 96),
        y: clamp(session.origin.y + (point.y - contact.startY) / session.frame.height * 100, 4, 96) });
    }
  }

  up(point: GesturePoint, cancelled = false) {
    const session = this.session, contact = session?.contacts.get(point.id);
    if (!session || !contact) return;
    if (cancelled) { this.cancel(); return; }
    this.clearHold();
    const tap = point.touch && !session.moved && !session.held && !session.multiple
      && point.time - contact.time < 300 && Math.hypot(point.x - contact.startX, point.y - contact.startY) <= 8;
    session.contacts.delete(point.id);
    if (session.contacts.size) {
      const remaining = [...session.contacts.values()][0];
      remaining.startX = remaining.x; remaining.startY = remaining.y;
      session.origin = { ...session.geometry }; session.pair = null;
      return;
    }
    this.session = null;
    if (Math.abs(session.geometry.scale - session.initialScale) > .00001) this.callbacks.resize?.(session.id, session.geometry.scale);
    if (tap) {
      const previous = this.lastTap;
      if (previous?.id === session.id && point.time - previous.time < 320
        && Math.hypot(point.x - previous.x, point.y - previous.y) < 32) {
        this.lastTap = null; this.callbacks.replace(session.id);
      } else this.lastTap = { id: session.id, x: point.x, y: point.y, time: point.time };
    } else this.lastTap = null;
  }

  cancel() { this.clearHold(); this.session = null; this.lastTap = null; }
}

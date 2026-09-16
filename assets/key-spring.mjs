/** A damped mechanical stroke. Time is in seconds and travel is normalized. */
export class KeySpring {
  position = 0;
  velocity = 0;
  target = 0;
  get moving() { return this.position !== this.target || this.velocity !== 0; }
  setPressed(pressed) { this.target = pressed ? 1 : 0; }
  advance(seconds) {
    let remaining = Math.min(Math.max(seconds, 0), 0.04);
    const stiffness = this.target ? 1900 : 1050;
    const damping = this.target ? 82 : 49;
    while (remaining > 0) {
      const step = Math.min(remaining, 1 / 240);
      this.velocity += ((this.target - this.position) * stiffness - this.velocity * damping) * step;
      this.position += this.velocity * step;
      remaining -= step;
    }
    if (Math.abs(this.position - this.target) < 0.0003 && Math.abs(this.velocity) < 0.012) {
      this.position = this.target;
      this.velocity = 0;
    }
    return this.position;
  }
}

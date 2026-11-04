// Imported first by the demo tab: the made-up home is always in the evening of its screenshots, so the
// greeting, the night sky and the lights agree whenever someone visits. The clock still runs from there.
const RealDate = Date;
const start = new RealDate();
const offset = new RealDate(start).setHours(21, 30, 0, 0) - start.getTime();

class EveningDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length) super(...(args as [string]));
    else super(RealDate.now() + offset);
  }
  static override now() {
    return RealDate.now() + offset;
  }
}
globalThis.Date = EveningDate as DateConstructor;

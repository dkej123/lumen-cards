/** Greeting by the clock (owner decision), in the browser's local time: "Good night" only late at night. */
export function greetingKey(now: Date = new Date()): string {
  const h = now.getHours();
  if (h >= 5 && h < 12) return "card.greeting.morning";
  if (h >= 12 && h < 18) return "card.greeting.day";
  if (h >= 18 && h < 22) return "card.greeting.evening";
  return "card.greeting.night";
}

const NUMBER = "(?:0|[1-9]\\d*)";
const VERSION_PATTERN = new RegExp(`^(${NUMBER})\\.(${NUMBER})\\.(${NUMBER})$`);
const COMPARATOR_PATTERN = new RegExp(
  `^(>=|<=|>|<|=)?(${NUMBER}\\.${NUMBER}\\.${NUMBER})$`,
);

export function parseSemver(value) {
  const match = VERSION_PATTERN.exec(String(value ?? ""));
  if (!match) return null;
  return match.slice(1).map(Number);
}

export function compareSemver(left, right) {
  const a = Array.isArray(left) ? left : parseSemver(left);
  const b = Array.isArray(right) ? right : parseSemver(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] < b[index]) return -1;
    if (a[index] > b[index]) return 1;
  }
  return 0;
}

export function parseVersionPin(value) {
  const text = String(value ?? "").trim();
  if (parseSemver(text)) return [{ operator: "=", version: text }];

  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 4) return null;

  const comparators = [];
  for (const token of tokens) {
    const match = COMPARATOR_PATTERN.exec(token);
    if (!match) return null;
    comparators.push({ operator: match[1] || "=", version: match[2] });
  }
  return comparators;
}

export function satisfiesVersionPin(version, pin) {
  if (!parseSemver(version)) return false;
  const comparators = parseVersionPin(pin);
  if (!comparators) return false;

  return comparators.every(({ operator, version: target }) => {
    const comparison = compareSemver(version, target);
    if (operator === "=") return comparison === 0;
    if (operator === ">") return comparison > 0;
    if (operator === ">=") return comparison >= 0;
    if (operator === "<") return comparison < 0;
    if (operator === "<=") return comparison <= 0;
    return false;
  });
}

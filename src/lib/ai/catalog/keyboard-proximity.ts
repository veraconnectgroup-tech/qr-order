/** QWERTY keyboard adjacency for typo layer 5. */

const KEYBOARD_NEIGHBORS: Record<string, string[]> = {
  q: ["w", "a"],
  w: ["q", "e", "s", "a"],
  e: ["w", "r", "d", "s"],
  r: ["e", "t", "f", "d"],
  t: ["r", "y", "g", "f"],
  y: ["t", "u", "h", "g"],
  u: ["y", "i", "j", "h"],
  i: ["u", "o", "k", "j"],
  o: ["i", "p", "l", "k"],
  p: ["o", "l"],
  a: ["q", "w", "s", "z"],
  s: ["a", "w", "e", "d", "x", "z"],
  d: ["s", "e", "r", "f", "c", "x"],
  f: ["d", "r", "t", "g", "v", "c"],
  g: ["f", "t", "y", "h", "b", "v"],
  h: ["g", "y", "u", "j", "n", "b"],
  j: ["h", "u", "i", "k", "m", "n"],
  k: ["j", "i", "o", "l", "m"],
  l: ["k", "o", "p"],
  z: ["a", "s", "x"],
  x: ["z", "s", "d", "c"],
  c: ["x", "d", "f", "v"],
  v: ["c", "f", "g", "b"],
  b: ["v", "g", "h", "n"],
  n: ["b", "h", "j", "m"],
  m: ["n", "j", "k"],
};

export function keyboardNeighbors(char: string): string[] {
  return KEYBOARD_NEIGHBORS[char.toLowerCase()] ?? [];
}

export function isKeyboardAdjacentSubstitution(left: string, right: string): boolean {
  if (left.length !== 1 || right.length !== 1) return false;
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return keyboardNeighbors(a).includes(b) || keyboardNeighbors(b).includes(a);
}

/** Single keyboard-proximity substitution at same position (e.g. nurger → burger). */
export function isKeyboardProximityTypo(token: string, candidate: string): boolean {
  if (token.length !== candidate.length || token.length < 3) return false;

  let mismatches = 0;
  for (let index = 0; index < token.length; index += 1) {
    if (token[index] === candidate[index]) continue;
    if (!isKeyboardAdjacentSubstitution(token[index]!, candidate[index]!)) {
      return false;
    }
    mismatches += 1;
    if (mismatches > 1) return false;
  }

  return mismatches === 1;
}

export function keyboardProximityScore(token: string, candidate: string): number {
  return isKeyboardProximityTypo(token, candidate) ? 0.75 : 0;
}

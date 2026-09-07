export function sanitizeKeypadInput(raw: string): string {
  return raw.replace(/[^0-9+\-×*÷\/.,]/g, "").replace(/,/g, "");
}
export function evaluateKeypadExpression(expr: string): number | null {
  const s = sanitizeKeypadInput(expr).replace(/×/g, "*").replace(/÷/g, "/");
  if (!s || /[+\-*/.]$/.test(s)) return null;
  if (/[^0-9+\-*/.]/.test(s)) return null;
  const tokens = s.split(/([+\-*/])/).filter(Boolean);
  let acc = Number(tokens[0]);
  if (!Number.isFinite(acc)) return null;
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = Number(tokens[i + 1]);
    if (!Number.isFinite(n)) return null;
    if (op === "+") acc += n;
    else if (op === "-") acc -= n;
    else if (op === "*") acc *= n;
    else if (op === "/") {
      if (n === 0) return null;
      acc = Math.trunc(acc / n);
    } else return null;
  }
  if (!Number.isSafeInteger(acc) || acc < 0) return null;
  return acc;
}

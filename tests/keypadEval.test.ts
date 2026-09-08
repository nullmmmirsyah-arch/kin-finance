import { describe,it,expect } from "vitest";
import { evaluateKeypadExpression, sanitizeKeypadInput } from "@/utils/keypadEval";
describe("keypadEval",()=>{
  it("evaluates addition",()=> expect(evaluateKeypadExpression("12,000+5,000")).toBe(17000));
  it("handles mixed ops left-to-right",()=> expect(evaluateKeypadExpression("10+5×2")).toBe(30));
  it("returns null on trailing operator",()=> expect(evaluateKeypadExpression("10+")).toBeNull());
  it("rejects decimal operands",()=> {
    expect(evaluateKeypadExpression("1.5+0.5")).toBeNull();
    expect(evaluateKeypadExpression("12.5×2")).toBeNull();
    expect(evaluateKeypadExpression("12.5")).toBeNull();
  });
  it("sanitize strips invalid chars",()=> expect(sanitizeKeypadInput("12a+5b")).toBe("12+5"));
});

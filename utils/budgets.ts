export type BudgetSummaryInput = { amount: number; spent?: number };

export type BudgetSummary = {
  budgeted: number;
  spent: number;
  hasRedacted: boolean;
  progress: number;
  honeyLevel: number;
  remaining: number;
};

export function summarizeBudgets(budgets: BudgetSummaryInput[]): BudgetSummary {
  if (budgets.length === 0) {
    return { budgeted: 0, spent: 0, hasRedacted: false, progress: 0, honeyLevel: 0, remaining: 0 };
  }
  let budgeted = 0;
  let spent = 0;
  let hasRedacted = false;
  for (const b of budgets) {
    budgeted += b.amount;
    if (b.spent === undefined) {
      hasRedacted = true;
    } else {
      spent += b.spent;
    }
  }
  const progress = hasRedacted ? 0 : budgeted > 0 ? spent / budgeted : 0;
  const honeyLevel = hasRedacted ? 0 : Math.max(1 - progress, 0);
  return { budgeted, spent, hasRedacted, progress, honeyLevel, remaining: budgeted - spent };
}

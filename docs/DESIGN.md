# Kin Finance — Design

> Date: 2026-08-07
> Status: Approved
> Purpose: Design system + screen descriptions for Google Stitch

---

## Design System

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | #92400E | Buttons, active states, brand |
| Primary Light | #FDE68A | Badges, highlights |
| Background | #FFFBF5 | Screen background (warm white) |
| Surface | #FEF3C7 | Cards, containers |
| Text Primary | #1C1917 | Headings, body text |
| Text Secondary | #78716C | Captions, helper text |
| Success | #065F46 | Positive amounts, success states |
| Error | #991B1B | Error messages, negative amounts |
| Border | #E7E5E4 | Input borders, dividers |
| Gradient Card | linear-gradient(135deg, #FFFBF5, #FEF3C7) | Card background |

### Typography

| Token | Size | Weight | Color |
|-------|------|--------|-------|
| H1 | 28px | Bold | stone-900 |
| H2 | 20px | Semi-bold | stone-900 |
| Body | 16px | Regular | stone-800 |
| Caption | 14px | Regular | stone-500 |
| Small | 12px | Regular | stone-400 |

### Spacing

| Token | Value |
|-------|-------|
| XS | 4px |
| SM | 8px |
| MD | 16px |
| LG | 24px |
| XL | 32px |

### Border Radius

| Token | Value |
|-------|-------|
| SM | 12px |
| MD | 16px |
| LG | 24px |

### Shadow

| Token | Value |
|-------|-------|
| Card | 0 2px 8px rgba(0, 0, 0, 0.04) |
| Elevated | 0 4px 16px rgba(0, 0, 0, 0.08) |

### Components

| Component | Specs |
|-----------|-------|
| Button | Solid fill, full width, 48px height, 16px radius, shadow |
| Input | Outlined, 48px height, 12px radius, warm border |
| Card | Gradient surface, 16px radius, 16px padding, subtle shadow |
| Header | Bold title, left aligned, warm tone |

### Icons

- Feather Icons (stroke-based, consistent)
- Size: 24px default, 20px small

### Empty & Error States

- Illustration: simple line art, warm tone
- Heading: clear, descriptive
- Description: brief explanation
- CTA button: direct action

---

## Screen Descriptions

### Screen 1: Onboarding

```markdown
## Onboarding Screen

**Purpose:** User creates their first Household

**Layout (top to bottom):**
1. Large illustration: warm line art of a family (centered, ~200px)
2. Title: "Welcome to Kin Finance" (H1, centered)
3. Description: "Create your Household to start managing your family's finances." (Body, centered, text-secondary)
4. TextInput: placeholder "Household name" (full width, 48px height)
5. Button: "Create Household" (full width, solid primary, 48px height)
6. Inline error message below input (if any, text-error)

**On Submit:** Navigate to Home Screen
```

---

### Screen 2: Home (Dashboard)

```markdown
## Home Screen

**Purpose:** Main dashboard showing household overview

**Layout (top to bottom):**
1. Header: "Hello, {email}!" (H2, left aligned)
2. Household card: gradient surface, 16px radius
   - Household name (H1, centered)
   - Member count badge (small pill)
3. Section: "My Accounts"
   - Horizontal scroll of account cards
   - Each card: account name, balance (thousand separator), account type icon
   - "Add Account" card (dashed border, plus icon, centered)
4. Section: "Recent Transactions"
   - List of last 5 transactions
   - Each row: category icon, note, amount (+/-), date
   - "See All" link to Transactions tab
5. Bottom Navigation: Home | Transactions | Budgets | Settings
```

---

### Screen 3: Accounts List

```markdown
## Accounts Screen

**Purpose:** List all accounts in household

**Layout (top to bottom):**
1. Header: "Accounts" (H1, left aligned)
2. Filter chips: All | Cash | Bank | E-Wallet | Credit Card
3. Account list:
   - Each card: account name, type icon, balance (thousand separator)
   - Swipe left → Edit | Delete
4. FAB (Floating Action Button): plus icon → Create Account
5. Empty state: illustration of empty wallet → "No accounts yet" → "Add your first account to start tracking" → [Add Account]
```

---

### Screen 4: Create/Edit Account

```markdown
## Create Account Screen

**Purpose:** Add new account

**Layout (top to bottom):**
1. Header: "Create Account" (H1, left aligned)
2. TextInput: placeholder "Account name" (full width, 48px height)
3. Dropdown: Account type (Cash | Bank | E-Wallet | Credit Card)
4. TextInput: placeholder "Opening balance (optional)" (number input, thousand separator)
5. Button: "Create Account" (full width, solid primary, 48px height)

**On Submit:** Create account → auto-create initial balance transaction → navigate to Accounts

**Edit Account Screen:**
- Same as Create, pre-filled with existing data
- Header: "Edit Account"
- Button: "Save Changes"
```

---

### Screen 5: Transactions List

```markdown
## Transactions Screen

**Purpose:** View all transactions with filters

**Layout (top to bottom):**
1. Header: "Transactions" (H1, left aligned)
2. Date filter: This Month | Last Month | Custom Range
3. Summary card: total income (green), total expense (red), net (neutral)
4. Transaction list grouped by date:
   - Date header: "August 7, 2026"
   - Transaction row: category icon, note, amount (+ green / - red), time
5. FAB: plus icon → Create Transaction
6. Empty state: illustration of empty notebook → "No transactions yet" → "Start by recording your first transaction" → [Add Transaction]
```

---

### Screen 6: Create/Edit Transaction

```markdown
## Create Transaction Screen

**Purpose:** Record income or expense

**Layout (top to bottom):**
1. Header: "New Transaction" (H1, left aligned)
2. Type toggle: Income | Expense (segmented control, default Expense)
3. Amount input: large number display (28px, centered), thousand separator
4. Dropdown: Select Account (list of accounts)
5. Dropdown: Select Category (list of visible categories)
6. DatePicker: Transaction date (default today)
7. TextInput: placeholder "Note (optional)"
8. Button: "Save Transaction" (full width, solid primary, 48px height)

**On Submit:** Create transaction → update account balance → navigate to Transactions
```

---

### Screen 7: Categories List

```markdown
## Categories Screen

**Purpose:** Manage transaction categories

**Layout (top to bottom):**
1. Header: "Categories" (H1, left aligned)
2. Filter chips: All | Income | Expense
3. Category list:
   - Each row: category name, type badge (income/expense), visibility toggle (eye icon)
   - Swipe left → Edit | Delete
4. FAB: plus icon → Create Category
5. Empty state: illustration of empty tags → "No categories yet" → "Create categories to organize your transactions" → [Add Category]
```

---

### Screen 8: Create/Edit Category

```markdown
## Create Category Screen

**Purpose:** Add new category

**Layout (top to bottom):**
1. Header: "Create Category" (H1, left aligned)
2. TextInput: placeholder "Category name" (full width, 48px height)
3. Type toggle: Income | Expense (segmented control, default Expense)
4. Toggle: "Visible to members" (default on, with description below)
5. Button: "Create Category" (full width, solid primary, 48px height)

**On Submit:** Create category → navigate to Categories

**Edit Category Screen:**
- Same as Create, pre-filled with existing data
- Header: "Edit Category"
- Button: "Save Changes"
```

---

### Screen 9: Budgets List

```markdown
## Budgets Screen

**Purpose:** View and manage monthly budgets

**Layout (top to bottom):**
1. Header: "Budgets" (H1, left aligned)
2. Month selector: < August 2026 >
3. Summary card: total budgeted vs total spent (progress bar)
4. Budget list:
   - Each row: category name, progress bar, budget amount, spent amount
   - Tap → Edit Budget
5. FAB: plus icon → Create Budget
6. Empty state: illustration of empty chart → "No budgets yet" → "Set budgets to control your spending" → [Set Budget]
```

---

### Screen 10: Create/Edit Budget

```markdown
## Create Budget Screen

**Purpose:** Set budget for a category

**Layout (top to bottom):**
1. Header: "Set Budget" (H1, left aligned)
2. Dropdown: Select Category (list of visible categories)
3. Amount input: large number display (28px, centered), thousand separator
4. Period: Monthly (disabled, MVP)
5. Button: "Set Budget" (full width, solid primary, 48px height)

**On Submit:** Create budget → navigate to Budgets

**Edit Budget Screen:**
- Same as Create, pre-filled with existing data
- Header: "Edit Budget"
- Button: "Save Changes"
```

---

### Screen 11: Settings

```markdown
## Settings Screen

**Purpose:** Household management and account settings

**Layout (top to bottom):**
1. Header: "Settings" (H1, left aligned)
2. Section: "Household"
   - Row: Household Name → Edit (owner only)
   - Row: Members → View/Invite (owner only)
3. Section: "Account"
   - Row: Profile (name, email)
   - Row: Sign Out
4. Section: "About"
   - Row: Version
```

---

### Screen 12: Household Members

```markdown
## Household Members Screen

**Purpose:** Manage household members

**Layout (top to bottom):**
1. Header: "Household Members" (H1, left aligned)
2. Member list:
   - Each row: avatar, name, email, role badge (Owner/Member)
3. Section: "Invite"
   - Generate invite code button
   - Code display with copy button
   - Share button (native share sheet)
4. Empty state (no other members): illustration of single person → "You're the only member" → "Invite family members to manage finances together" → [Invite Member]
```

---

### Screen 13: Join Household (Member)

```markdown
## Join Household Screen

**Purpose:** Member joins existing household

**Layout (top to bottom):**
1. Large illustration: warm line art of connected people (centered, ~200px)
2. Title: "Join a Household" (H1, centered)
3. Description: "Enter the invite code shared with you." (Body, centered, text-secondary)
4. TextInput: placeholder "Invite code" (full width, 48px height, uppercase)
5. Button: "Join Household" (full width, solid primary, 48px height)

**On Submit:** Join household → navigate to Home
```

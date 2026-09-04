import streamlineData from "@/constants/streamlineIconData.json";

export type AccountType = "cash" | "bank" | "ewallet" | "credit_card";
export const DEFAULT_CATEGORY_ICON = "other" as const;
export const ALL_CATEGORY_ICONS = [
  "shopping_bag",
  "groceries",
  "serving_dish",
  "coffee",
  "bubble_tea",
  "cutlery",
  "pizza",
  "burger",
  "milk_fruit",
  "bread",
  "birthday_cake",
  "donut",
  "household_goods",
  "clothing",
  "shoes",
  "shopping_cart",
  "home",
  "electricity",
  "water",
  "gas",
  "internet",
  "phone",
  "entertainment",
  "insurance",
  "car",
  "motorcycle",
  "fuel",
  "train",
  "bus",
  "flight",
  "parking",
  "taxi",
  "health",
  "medicine",
  "doctor",
  "fitness",
  "education",
  "graduation",
  "work",
  "laptop",
  "wallet",
  "savings",
  "piggy_bank",
  "income",
  "investment",
  "gift",
  "travel_ticket",
  "vacation",
  "mosque",
  "charity",
  "cash_wallet",
  "bank",
  "family",
  "pet",
  "plant",
  "other",
] as const;
export type CategoryIconName = (typeof ALL_CATEGORY_ICONS)[number];
export function isValidCategoryIcon(name: string): name is CategoryIconName {
  return (ALL_CATEGORY_ICONS as readonly string[]).includes(name);
}

// Unified maps — single source, no duplication
export const CATEGORY_STREAMLINE_MAP: Record<CategoryIconName, string> = {
  shopping_bag: "shopping-bag-check",
  groceries: "shopping-basket-3",
  serving_dish: "pasta-bowl-warm",
  coffee: "coffee-espresso-machine",
  bubble_tea: "cocktail-glass-1",
  cutlery: "kitchenware-spatula-1",
  pizza: "fruit-watermelon",
  burger: "barbecue-grill",
  milk_fruit: "fruit-banana",
  bread: "bread-loaf",
  birthday_cake: "party-balloon",
  donut: "ice-cream-cone",
  household_goods: "warehouse-cart-package-ribbon",
  clothing: "e-commerce-apparel",
  shoes: "shopping-bag-duty-free",
  shopping_cart: "shopping-cart-full",
  home: "house-4",
  electricity: "electronics-led-light",
  water: "water-bottle-glass",
  gas: "gas-f",
  internet: "wifi-signal-2",
  phone: "phone-actions-call",
  entertainment: "amusement-park-ferris-wheel",
  insurance: "insurance-hand",
  car: "car-4",
  motorcycle: "scooter-3",
  fuel: "gas-e",
  train: "railroad-metro",
  bus: "bus-1",
  flight: "aircraft-hot-air-balloon-2",
  parking: "road-sign-stop",
  taxi: "taxi",
  health: "medical-hospital",
  medicine: "pill-laptop",
  doctor: "medical-hospital-1",
  fitness: "fitness-bicycle-1",
  education: "book-open-bookmark",
  graduation: "notes-book",
  work: "office-business-card",
  laptop: "laptop",
  wallet: "money-wallet-open",
  savings: "saving-bank-1",
  piggy_bank: "saving-bank-international",
  income: "money-bag-dollar",
  investment: "analytics-graph-lines",
  gift: "gift-box-1",
  travel_ticket: "ticket-1",
  vacation: "amusement-park-castle",
  mosque: "building-2",
  charity: "love-it-flag",
  cash_wallet: "cash-payment-bill",
  bank: "saving-bank-1",
  family: "multiple-users-1",
  pet: "circus-elephant",
  plant: "vegetables-beet-1",
  other: "tags-1",
};

export const ACCOUNT_STREAMLINE_MAP: Record<AccountType, string> = {
  bank: "saving-bank-1",
  cash: "cash-payment-bill",
  ewallet: "wireless-payment-credit-card-dollar",
  credit_card: "credit-card-1",
};

export function isAccountType(x: string): x is AccountType {
  return (["bank", "cash", "ewallet", "credit_card"] as string[]).includes(x);
}

// Lazy streamline data behind seam — no eager 50KB parse cost until first Icon render
let _icons: Record<string, { body: string }> | null = null;
let _width = 24;
let _height = 24;
function ensureData() {
  if (_icons) return;
  const d = streamlineData as { width?: number; height?: number; icons: Record<string, { body: string }> };
  _width = d.width ?? 24;
  _height = d.height ?? 24;
  _icons = d.icons;
}
export function getIconData() {
  ensureData();
  return { icons: _icons!, width: _width, height: _height };
}
export function getBody(iconName: string): string | undefined {
  ensureData();
  return _icons![iconName]?.body;
}
export function getStreamlineIconName(name?: string): string {
  if (name && (name as CategoryIconName) in CATEGORY_STREAMLINE_MAP) {
    return CATEGORY_STREAMLINE_MAP[name as CategoryIconName];
  }
  return CATEGORY_STREAMLINE_MAP.other;
}
export function getAccountIconName(type?: string): string {
  if (type && isAccountType(type)) return ACCOUNT_STREAMLINE_MAP[type];
  return ACCOUNT_STREAMLINE_MAP.bank;
}
export function resolveIconName(ref?: string | null): string {
  if (!ref) return CATEGORY_STREAMLINE_MAP.other;
  if (isAccountType(ref)) return ACCOUNT_STREAMLINE_MAP[ref as AccountType];
  if ((ref as CategoryIconName) in CATEGORY_STREAMLINE_MAP) return CATEGORY_STREAMLINE_MAP[ref as CategoryIconName];
  // fallback: try category map, else other
  return getStreamlineIconName(ref);
}

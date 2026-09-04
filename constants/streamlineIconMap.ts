import type { CategoryIconName } from "./categoryIconNames";

// Streamline Ultimate Color via Iconify — CC BY 4.0
// Source: https://icon-sets.iconify.design/streamline-ultimate-color/
// License: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) — attribution to Streamline (webalys-hq/streamline-vectors)
// 998 icons, palette:true, 24x24. Offline bundle via https://api.iconify.design/streamline-ultimate-color.json
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

export function getStreamlineIconName(name?: string): string {
  if (name && name in CATEGORY_STREAMLINE_MAP) {
    return CATEGORY_STREAMLINE_MAP[name as CategoryIconName];
  }
  return CATEGORY_STREAMLINE_MAP.other;
}

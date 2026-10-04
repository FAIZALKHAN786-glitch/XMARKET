/* Mock dataset powering the UI until the real backend is wired up.
   Every value here maps 1:1 to what the API contracts in lib/api.js return. */

export const USER = {
  name: "Jordan Dane",
  initials: "JD",
};

export const TRENDING_SEARCHES = [
  "Nokia 3310",
  "iPhone 15 Pro",
  "Samsung Galaxy S24",
  "MacBook Air M3",
  "Sony WH-1000XM5",
];

export const PRODUCTS = [
  { id: "p1", name: "Nokia 3310 (2024)", category: "Mobile Phones", price: "~$30–$80", icon: "phone" },
  { id: "p2", name: "Nokia 3310 4G", category: "Mobile Phones", price: "~$40–$90", icon: "phone" },
  { id: "p3", name: "iPhone 15 Pro", category: "Mobile Phones", price: "~$900–$1,100", icon: "phone" },
  { id: "p4", name: "Samsung Galaxy S24", category: "Mobile Phones", price: "~$700–$850", icon: "phone" },
  { id: "p5", name: "MacBook Air M3", category: "Laptops", price: "~$1,000–$1,300", icon: "box" },
  { id: "p6", name: "Sony WH-1000XM5", category: "Audio", price: "~$300–$400", icon: "box" },
  { id: "p7", name: "Google Pixel 8", category: "Mobile Phones", price: "~$550–$700", icon: "phone" },
  { id: "p8", name: "Nothing Phone (2)", category: "Mobile Phones", price: "~$450–$600", icon: "phone" },
];

export const MATCHES = [
  {
    id: "o1",
    provider: "TechMart Pro",
    price: 74.99,
    deliveryDays: 3,
    condition: "New",
    rating: 4.8,
    transactions: "200+",
    score: 96,
    tags: [
      { type: "pos", text: "Within budget" },
      { type: "pos", text: "Fast delivery" },
      { type: "pos", text: "Brand new" },
    ],
    why:
      "This offer meets your budget requirement of under $80 and promises delivery within your 3-day window. The seller has a 4.8/5 trust score with 200+ completed transactions.",
  },
  {
    id: "o2",
    provider: "QuickShip Co",
    price: 79.0,
    deliveryDays: 3,
    condition: "Refurbished",
    rating: 4.6,
    transactions: "150+",
    score: 91,
    tags: [
      { type: "pos", text: "Within budget" },
      { type: "pos", text: "Fast delivery" },
      { type: "warn", text: "Refurbished" },
    ],
    why:
      "Priced right at your ceiling and delivered inside the 3-day window. Condition is refurbished — certified by the provider with a 90-day warranty.",
  },
  {
    id: "o3",
    provider: "CityCellars",
    price: 77.25,
    deliveryDays: 2,
    condition: "New",
    rating: 4.7,
    transactions: "210+",
    score: 88,
    tags: [
      { type: "pos", text: "Within budget" },
      { type: "pos", text: "Fastest delivery" },
    ],
    why:
      "Beats your deadline by a full day and stays comfortably under budget. New unit, sealed box, local courier in the New York area.",
  },
  {
    id: "o4",
    provider: "Nordic Devices",
    price: 68.5,
    deliveryDays: 5,
    condition: "New",
    rating: 4.9,
    transactions: "320+",
    score: 89,
    tags: [
      { type: "pos", text: "Within budget" },
      { type: "pos", text: "Top-rated seller" },
      { type: "warn", text: "5-day delivery" },
    ],
    why:
      "The highest-rated provider in this match set at 4.9/5 with 320+ transactions. $11 under budget, but delivery slips two days past your target.",
  },
  {
    id: "o5",
    provider: "RefurbKing",
    price: 52.0,
    deliveryDays: 4,
    condition: "Refurbished",
    rating: 4.4,
    transactions: "98",
    score: 84,
    tags: [
      { type: "pos", text: "Lowest new-ish price" },
      { type: "warn", text: "Refurbished" },
    ],
    why:
      "The cheapest credible offer — $28 under your cap. Refurbished grade A, one-day slip on delivery. Solid option if price outweighs condition.",
  },
  {
    id: "o6",
    provider: "PrimeTraders",
    price: 84.99,
    deliveryDays: 3,
    condition: "New",
    rating: 4.5,
    transactions: "175+",
    score: 78,
    tags: [
      { type: "pos", text: "Fast delivery" },
      { type: "warn", text: "Slightly over budget" },
    ],
    why:
      "Meets your 3-day deadline with a brand-new unit, but asks $4.99 above your stated cap. Included: 1-year extended warranty.",
  },
  {
    id: "o7",
    provider: "GadgetGrid",
    price: 71.99,
    deliveryDays: 6,
    condition: "New",
    rating: 4.3,
    transactions: "64",
    score: 76,
    tags: [
      { type: "pos", text: "Within budget" },
      { type: "warn", text: "Slower delivery" },
    ],
    why:
      "Comfortably under budget and new, but the 6-day lead time doubles your requested window. Ships from a regional warehouse.",
  },
  {
    id: "o8",
    provider: "EchoRetail",
    price: 76.0,
    deliveryDays: 4,
    condition: "Open-box",
    rating: 4.2,
    transactions: "41",
    score: 74,
    tags: [
      { type: "pos", text: "Within budget" },
      { type: "warn", text: "Open-box" },
    ],
    why:
      "Open-box unit — inspected and repackaged by the provider. One day past deadline, $4 under budget, 30-day return policy included.",
  },
  {
    id: "o9",
    provider: "MobileMint",
    price: 64.99,
    deliveryDays: 7,
    condition: "Refurbished",
    rating: 4.6,
    transactions: "129",
    score: 72,
    tags: [
      { type: "pos", text: "Well under budget" },
      { type: "warn", text: "7-day delivery" },
    ],
    why:
      "Strong price and a trustworthy seller, but the 7-day shipping estimate misses your deadline by four days.",
  },
  {
    id: "o10",
    provider: "StockRoom Direct",
    price: 79.99,
    deliveryDays: 8,
    condition: "New",
    rating: 4.1,
    transactions: "33",
    score: 65,
    tags: [
      { type: "pos", text: "Within budget" },
      { type: "warn", text: "Slow delivery" },
    ],
    why:
      "A new unit at the edge of your budget, but 8-day fulfillment and a thinner transaction history pull the match score down.",
  },
  {
    id: "o11",
    provider: "TradePost Ltd",
    price: 59.0,
    deliveryDays: 10,
    condition: "Used",
    rating: 3.9,
    transactions: "27",
    score: 58,
    tags: [
      { type: "pos", text: "Low price" },
      { type: "warn", text: "Used condition" },
      { type: "warn", text: "10-day delivery" },
    ],
    why:
      "Cheap, but used condition and a 10-day timeline conflict with two of your three hard constraints.",
  },
  {
    id: "o12",
    provider: "BulkBay",
    price: 49.99,
    deliveryDays: 14,
    condition: "Used",
    rating: 3.7,
    transactions: "19",
    score: 51,
    tags: [
      { type: "pos", text: "Lowest price" },
      { type: "warn", text: "14-day delivery" },
      { type: "warn", text: "Used condition" },
    ],
    why:
      "The floor price in this market — but only worth considering if your deadline is flexible. Used, untested-grade listing.",
  },
];

export const REQUIREMENTS = [
  {
    id: "r1",
    title: "Nokia 3310 under $80",
    category: "Electronics",
    icon: "phone",
    budget: "$0–$80",
    budgetMax: 80,
    deadline: "3 days",
    location: "New York, NY",
    posted: "2 hours ago",
  },
  {
    id: "r2",
    title: "Ergonomic standing desk, adjustable height",
    category: "Furniture",
    icon: "home",
    budget: "$150–$400",
    budgetMax: 400,
    deadline: "2 weeks",
    location: "Austin, TX",
    posted: "5 hours ago",
  },
  {
    id: "r3",
    title: "Website redesign for bakery",
    category: "Services",
    icon: "box",
    budget: "$500–$1,200",
    budgetMax: 1200,
    deadline: "3 weeks",
    location: "Remote",
    posted: "8 hours ago",
  },
  {
    id: "r4",
    title: "iPhone 15 Pro, 256GB, unlocked",
    category: "Electronics",
    icon: "phone",
    budget: "$700–$950",
    budgetMax: 950,
    deadline: "5 days",
    location: "Chicago, IL",
    posted: "1 day ago",
  },
  {
    id: "r5",
    title: "Mid-century lounge chair",
    category: "Furniture",
    icon: "home",
    budget: "$80–$250",
    budgetMax: 250,
    deadline: "10 days",
    location: "Portland, OR",
    posted: "1 day ago",
  },
  {
    id: "r6",
    title: "Logo + brand kit for startup",
    category: "Services",
    icon: "box",
    budget: "$200–$600",
    budgetMax: 600,
    deadline: "7 days",
    location: "Remote",
    posted: "2 days ago",
  },
];

export const MY_OFFERS = [
  {
    id: "m1",
    requirement: "Nokia 3310 under $80",
    price: 74.99,
    delivery: "1–3 days",
    submitted: "Today, 9:41 AM",
    status: "Shortlisted",
  },
  {
    id: "m2",
    requirement: "Ergonomic standing desk, adjustable height",
    price: 320.0,
    delivery: "4–7 days",
    submitted: "Yesterday",
    status: "Pending",
  },
  {
    id: "m3",
    requirement: "iPhone 15 Pro, 256GB, unlocked",
    price: 899.0,
    delivery: "4–7 days",
    submitted: "Sep 30",
    status: "Selected",
  },
  {
    id: "m4",
    requirement: "Logo + brand kit for startup",
    price: 450.0,
    delivery: "8–14 days",
    submitted: "Sep 28",
    status: "Rejected",
  },
];

export const PROVIDER_PROFILE = {
  name: "Alex Rivera",
  initials: "AR",
  rating: 4.8,
};

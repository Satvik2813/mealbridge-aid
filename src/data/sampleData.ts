import type { Urgency } from "@/components/UrgencyBadge";

export interface Listing {
  id: string;
  donor: string;
  donorType: "Restaurant" | "Event" | "Home" | "Bakery" | "Catering";
  items: string[];
  meals: number;
  vegType: "Veg" | "Non-Veg" | "Mixed";
  urgency: Urgency;
  timeLeft: string;
  distanceKm: number;
  address: string;
  cookedMinsAgo: number;
  status?: "Available" | "Requested" | "Assigned" | "Delivered" | "Expired";
}

export const sampleListings: Listing[] = [
  {
    id: "L-2041",
    donor: "Spice Garden",
    donorType: "Restaurant",
    items: ["Vegetable Biryani", "Mixed Raita", "Gulab Jamun"],
    meals: 42,
    vegType: "Veg",
    urgency: "critical",
    timeLeft: "1h 12m",
    distanceKm: 1.4,
    address: "Banjara Hills, Road No. 12",
    cookedMinsAgo: 285,
    status: "Available",
  },
  {
    id: "L-2042",
    donor: "Oberoi Wedding Hall",
    donorType: "Event",
    items: ["Paneer Butter Masala", "Naan", "Jeera Rice", "Dal Tadka"],
    meals: 120,
    vegType: "Veg",
    urgency: "high",
    timeLeft: "2h 40m",
    distanceKm: 3.8,
    address: "Madhapur, HITEC City",
    cookedMinsAgo: 180,
    status: "Requested",
  },
  {
    id: "L-2043",
    donor: "Sharma Household",
    donorType: "Home",
    items: ["Rajma Chawal", "Roti", "Aloo Sabzi"],
    meals: 14,
    vegType: "Veg",
    urgency: "medium",
    timeLeft: "4h 05m",
    distanceKm: 0.8,
    address: "Jubilee Hills",
    cookedMinsAgo: 95,
    status: "Assigned",
  },
  {
    id: "L-2044",
    donor: "Karachi Bakery",
    donorType: "Bakery",
    items: ["Dilkush", "Veg Puff", "Plum Cake"],
    meals: 60,
    vegType: "Veg",
    urgency: "low",
    timeLeft: "5h 50m",
    distanceKm: 5.2,
    address: "Mozamjahi Market",
    cookedMinsAgo: 30,
    status: "Available",
  },
  {
    id: "L-2045",
    donor: "Paradise Catering",
    donorType: "Catering",
    items: ["Chicken Biryani", "Mirchi Ka Salan", "Bagara Baingan"],
    meals: 80,
    vegType: "Non-Veg",
    urgency: "high",
    timeLeft: "2h 20m",
    distanceKm: 6.1,
    address: "Secunderabad",
    cookedMinsAgo: 210,
    status: "Available",
  },
];

export interface Recipient {
  id: string;
  name: string;
  type: string;
  beneficiaries: number;
  area: string;
  needToday: number;
  verified: boolean;
}

export const sampleRecipients: Recipient[] = [
  { id: "R-101", name: "Sunshine Children's Home", type: "Orphanage", beneficiaries: 120, area: "Kukatpally", needToday: 100, verified: true },
  { id: "R-102", name: "Anand Old Age Home", type: "Senior Care", beneficiaries: 60, area: "Begumpet", needToday: 50, verified: true },
  { id: "R-103", name: "Ashraya Night Shelter", type: "Shelter", beneficiaries: 200, area: "Charminar", needToday: 180, verified: true },
  { id: "R-104", name: "Hope Community Kitchen", type: "Community", beneficiaries: 90, area: "Gachibowli", needToday: 70, verified: false },
];

export interface Partner {
  id: string;
  name: string;
  vehicle: string;
  rating: number;
  distanceKm: number;
  trips: number;
}

export const samplePartners: Partner[] = [
  { id: "P-301", name: "Priya N.", vehicle: "2-wheeler", rating: 4.9, distanceKm: 0.6, trips: 142 },
  { id: "P-302", name: "Rahul K.", vehicle: "Auto", rating: 4.7, distanceKm: 1.2, trips: 88 },
  { id: "P-303", name: "Anjali D.", vehicle: "Mini Truck", rating: 4.8, distanceKm: 2.4, trips: 211 },
];

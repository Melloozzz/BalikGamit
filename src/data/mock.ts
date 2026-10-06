// Sample data for demo mode (no Supabase keys set). Names, dates and IDs match the
// Figma screens so the app and the design tell the same story.
import type {
  Claim,
  FlaggedPost,
  FoundItem,
  LostReport,
  Match,
  Message,
  Notification,
  Profile,
} from "./types";
import umbrellaFound from "../assets/items/umbrella-found.jpg";
import wallet from "../assets/items/wallet.jpg";
import phone from "../assets/items/phone.jpg";
import keys from "../assets/items/keys.jpg";
import umbrellaLost from "../assets/items/umbrella-lost.jpg";
import earbuds from "../assets/items/earbuds.jpg";

export const CATEGORIES = [
  "Bags",
  "Clothing",
  "Electronics",
  "ID & Cards",
  "Jewelry & Accessories",
  "Keys",
  "School supplies",
  "Tumblers & Containers",
  "Umbrella",
  "Wallet",
  "Others",
];

// [Confirm with the office] Replace with the campus's real building list.
export const LOCATIONS = [
  "MAE Building",
  "RND Building",
  "Library",
  "Canteen",
  "Gym",
  "Room 304",
  "Main gate",
  "Other",
];

/** [Office name, Building] and pickup rules are placeholders until the office interview. */
export const OFFICE = {
  name: "[Office name, Building]",
  pickupDays: 5,
  reportExpiryDays: 90,
};

export const profiles: Profile[] = [
  { id: "u-angela", fullName: "Angela Reyes", email: "angela.reyes@rtu.edu.ph", role: "student", active: true, joinedOn: "2026-09-14" },
  { id: "u-paolo", fullName: "Paolo Santos", email: "paolo.santos@rtu.edu.ph", role: "student", active: true },
  { id: "u-mika", fullName: "Mika Dela Cruz", email: "mika.delacruz@rtu.edu.ph", role: "student", active: true },
  { id: "u-maria", fullName: "Maria Santos", email: "maria.santos@rtu.edu.ph", role: "super_admin", active: true, joinedOn: "2026-09-01" },
  { id: "u-jose", fullName: "Jose Ramirez", email: "jose.ramirez@rtu.edu.ph", role: "admin", active: true },
  { id: "u-liza", fullName: "Liza Mendoza", email: "liza.mendoza@rtu.edu.ph", role: "admin", active: false },
];

export const foundItems: FoundItem[] = [
  {
    id: "BG-1048",
    title: "Navy folding umbrella",
    category: "Umbrella",
    location: "MAE Building",
    locationDetail: "Ground floor lobby",
    foundOn: "2026-09-26",
    description: "Compact navy umbrella with a black wrist strap.",
    photo: umbrellaFound,
    status: "ready_for_pickup",
    shelfTag: "C-07",
    privateDetails: "Small tear near one rib. A strip of white tape on the handle.",
    loggedBy: "Jose Ramirez",
  },
  {
    id: "BG-1042",
    title: "Black leather wallet",
    category: "Wallet",
    location: "Library",
    locationDetail: "Window-side tables",
    foundOn: "2026-09-24",
    description: "Black bifold wallet found near the window-side tables.",
    photo: wallet,
    status: "claim_pending",
    shelfTag: "A-14",
    privateDetails:
      'Brown stitching. Inside: an old cinema ticket in the back slot and a stamped "AR" on the inner flap. No cash.',
    loggedBy: "Maria Santos",
  },
  {
    id: "BG-1039",
    title: "White iPhone",
    category: "Electronics",
    location: "Canteen",
    foundOn: "2026-09-22",
    description: "White iPhone with a clear case.",
    photo: phone,
    status: "claim_pending",
    shelfTag: "A-09",
    privateDetails: "Lock screen shows a photo of a gray cat. Small crack on the lower-left corner.",
    loggedBy: "Jose Ramirez",
  },
  {
    id: "BG-1053",
    title: "Dark blue umbrella, large",
    category: "Umbrella",
    location: "Library",
    foundOn: "2026-09-28",
    description: "Full-size dark blue umbrella with a curved black handle.",
    status: "in_custody",
    shelfTag: "C-11",
    privateDetails: "Name tag removed; adhesive residue on the handle.",
  },
  {
    id: "BG-1036",
    title: "Black umbrella with wooden handle",
    category: "Umbrella",
    location: "Canteen",
    foundOn: "2026-09-25",
    description: "Black umbrella with a hooked wooden handle.",
    status: "in_custody",
    shelfTag: "C-03",
  },
  {
    id: "BG-1031",
    title: "Keys with blue tag",
    category: "Keys",
    location: "RND Building",
    foundOn: "2026-09-16",
    description: "Three silver keys on a blue fabric tag.",
    photo: keys,
    status: "ready_for_pickup",
    shelfTag: "B-03",
    privateDetails: "One key is stamped 41. The tag has a small burn mark on the back.",
  },
  {
    id: "BG-1027",
    title: "Scientific calculator",
    category: "Electronics",
    location: "Room 304",
    foundOn: "2026-09-18",
    description: "Gray scientific calculator with a slide-on cover.",
    status: "in_custody",
    shelfTag: "A-02",
  },
  {
    id: "BG-1011",
    title: "House keys with red keychain",
    category: "Keys",
    location: "Gym",
    foundOn: "2026-09-10",
    description: "Two brass keys on a red rubber keychain.",
    status: "returned",
  },
];

export const lostReports: LostReport[] = [
  {
    id: "LR-214",
    ownerId: "u-angela",
    title: "Navy blue umbrella",
    category: "Umbrella",
    location: "MAE Building",
    lostOn: "2026-09-26",
    description: "Compact navy umbrella with a black wrist strap.",
    photo: umbrellaLost,
    status: "active",
    privateDetails: "White tape on the handle.",
    matchCount: 3,
  },
  {
    id: "LR-219",
    ownerId: "u-angela",
    title: "Brown coin purse",
    category: "Wallet",
    location: "Canteen",
    lostOn: "2026-10-01",
    description: "Small brown leather coin purse with a zipper and a keychain.",
    status: "active",
    matchCount: 0,
  },
  {
    id: "LR-188",
    ownerId: "u-angela",
    title: "RTU student ID",
    category: "ID & Cards",
    location: "Library",
    lostOn: "2026-09-18",
    description: "Student ID with a blue RTU lanyard.",
    status: "resolved",
    matchCount: 0,
    statusNote: "Returned to you on September 30, 2026.",
  },
  {
    id: "LR-150",
    ownerId: "u-angela",
    title: "Blue steel tumbler",
    category: "Tumblers & Containers",
    location: "Gym",
    lostOn: "2026-06-20",
    description: "500 ml blue tumbler with a dent near the bottom.",
    status: "expired",
    matchCount: 0,
    statusNote: "This report expired after 90 days. Renew it to keep looking.",
  },
  {
    id: "LR-221",
    ownerId: "u-angela",
    title: "White wireless earbuds",
    category: "Electronics",
    location: "Room 304",
    lostOn: "2026-10-02",
    description: "White earbuds in a round charging case.",
    status: "hidden",
    matchCount: 0,
    statusNote: "Hidden by the office: the description included a phone number. Edit the report to remove it.",
  },
  {
    id: "LR-210",
    ownerId: "u-paolo",
    title: "Silver ring",
    category: "Jewelry & Accessories",
    location: "Library",
    lostOn: "2026-09-22",
    description: "A diamond heart-shaped ring.",
    status: "active",
    matchCount: 0,
  },
  {
    id: "LR-205",
    ownerId: "u-mika",
    title: "Wireless earbuds",
    category: "Electronics",
    location: "LGBTQIA+ restroom",
    lostOn: "2026-09-20",
    description: "White JBL earbuds.",
    photo: earbuds,
    status: "active",
    matchCount: 0,
  },
];

const PROOF = [
  "Describe any unique marks, damage, or features.",
  "What was inside or attached to the item?",
  "Where and when did you last have it?",
];

export const claims: Claim[] = [
  {
    id: "CL-512",
    itemId: "BG-1042",
    claimantId: "u-angela",
    status: "needs_info",
    filedOn: "2026-10-02T09:14:00+08:00",
    linkedReportId: undefined,
    answers: [
      { question: PROOF[0], answer: "Brown stitching around the edges." },
      { question: PROOF[1], answer: "A faded movie ticket behind the card slot and a small initials stamp inside." },
      { question: PROOF[2], answer: "Library, second floor, around September 24 in the afternoon." },
    ],
    history: [
      { status: "submitted", at: "2026-10-02T09:14:00+08:00" },
      { status: "under_review", at: "2026-10-02T13:40:00+08:00" },
      { status: "needs_info", at: "2026-10-03T14:18:00+08:00" },
    ],
  },
  {
    id: "CL-515",
    itemId: "BG-1042",
    claimantId: "u-paolo",
    status: "pending",
    filedOn: "2026-10-03T11:02:00+08:00",
    answers: [
      { question: PROOF[0], answer: "It's black and a bit worn." },
      { question: PROOF[1], answer: "Some cards." },
      { question: PROOF[2], answer: "Library, last week." },
    ],
    history: [{ status: "submitted", at: "2026-10-03T11:02:00+08:00" }],
  },
  {
    id: "CL-516",
    itemId: "BG-1039",
    claimantId: "u-angela",
    status: "pending",
    filedOn: "2026-10-04T10:30:00+08:00",
    answers: [
      { question: PROOF[0], answer: "Small crack on the lower-left corner of the screen." },
      { question: PROOF[1], answer: "Clear case, and the lock screen is a photo of my cat." },
      { question: PROOF[2], answer: "Canteen, lunch time on September 22." },
    ],
    history: [{ status: "submitted", at: "2026-10-04T10:30:00+08:00" }],
  },
  {
    id: "CL-497",
    itemId: "BG-1048",
    claimantId: "u-angela",
    status: "approved",
    filedOn: "2026-09-28T15:20:00+08:00",
    linkedReportId: "LR-214",
    pickupBy: "2026-10-09",
    answers: [
      { question: PROOF[0], answer: "A small tear near one rib, and white tape on the handle." },
      { question: PROOF[1], answer: "Nothing inside. It has a black wrist strap." },
      { question: PROOF[2], answer: "MAE Building lobby, morning of September 26." },
    ],
    history: [
      { status: "submitted", at: "2026-09-28T15:20:00+08:00" },
      { status: "under_review", at: "2026-09-29T09:00:00+08:00" },
      { status: "approved", at: "2026-10-05T16:30:00+08:00" },
    ],
  },
  {
    id: "CL-491",
    itemId: "BG-1031",
    claimantId: "u-mika",
    status: "approved",
    filedOn: "2026-09-23T08:45:00+08:00",
    pickupBy: "2026-10-07",
    answers: [
      { question: PROOF[0], answer: "One key has the number 41 stamped on it." },
      { question: PROOF[1], answer: "A blue fabric tag with a small burn mark." },
      { question: PROOF[2], answer: "RND Building, September 16." },
    ],
    history: [
      { status: "submitted", at: "2026-09-23T08:45:00+08:00" },
      { status: "approved", at: "2026-09-30T10:00:00+08:00" },
    ],
  },
  {
    id: "CL-488",
    itemId: "BG-1027",
    claimantId: "u-angela",
    status: "rejected",
    filedOn: "2026-09-20T13:00:00+08:00",
    decisionReason: "Your answers didn't match the item's details.",
    answers: [
      { question: PROOF[0], answer: "Black calculator with my name on the back." },
      { question: PROOF[1], answer: "No cover." },
      { question: PROOF[2], answer: "Room 304." },
    ],
    history: [
      { status: "submitted", at: "2026-09-20T13:00:00+08:00" },
      { status: "rejected", at: "2026-09-22T09:30:00+08:00" },
    ],
  },
  {
    id: "CL-472",
    itemId: "BG-1011",
    claimantId: "u-angela",
    status: "completed",
    filedOn: "2026-09-12T10:00:00+08:00",
    answers: [],
    history: [
      { status: "submitted", at: "2026-09-12T10:00:00+08:00" },
      { status: "approved", at: "2026-09-15T10:00:00+08:00" },
      { status: "completed", at: "2026-09-25T14:00:00+08:00" },
    ],
  },
];

export const messages: Message[] = [
  { id: "m1", claimId: "CL-512", from: "office", body: "Thanks for your claim. We're reviewing your answers now.", at: "2026-10-02T13:40:00+08:00" },
  {
    id: "m2",
    claimId: "CL-512",
    from: "office",
    body: "Can you describe anything inside the wallet besides cards, like a receipt, a photo, or coins?",
    at: "2026-10-03T10:05:00+08:00",
  },
  {
    id: "m3",
    claimId: "CL-512",
    from: "owner",
    body: "Yes. There's a faded movie ticket behind the card slot and a small stamp with my initials inside.",
    at: "2026-10-03T10:22:00+08:00",
  },
  {
    id: "m4",
    claimId: "CL-512",
    from: "office",
    body: "Thank you. One more: what color is the stitching on the wallet?",
    at: "2026-10-03T14:18:00+08:00",
  },
];

// Claimant <-> office threads on other claims, so the Messages tab has more than one conversation.
messages.push(
  { id: "m5", claimId: "CL-497", from: "office", body: "Your claim is approved. Bring your RTU ID when you pick it up.", at: "2026-10-05T16:31:00+08:00" },
  { id: "m6", claimId: "CL-497", from: "owner", body: "Thank you! Can I pick it up on Thursday afternoon?", at: "2026-10-05T17:02:00+08:00" },
  { id: "m7", claimId: "CL-497", from: "office", body: "Yes, the office is open until 5:00 PM on Thursday.", at: "2026-10-06T08:15:00+08:00" },
  { id: "m8", claimId: "CL-515", from: "office", body: "Thanks for your claim. We're reviewing your answers now.", at: "2026-10-03T15:10:00+08:00" },
  { id: "m9", claimId: "CL-515", from: "owner", body: "Okay. The wallet also has a small tear on the coin pocket.", at: "2026-10-04T09:41:00+08:00" },
);

/** Office-side notifications (admins and super admins). */
export const adminNotifications: Notification[] = [
  { id: "a1", kind: "reply", title: "A claimant replied", detail: "Black leather wallet · Claim CL-515", at: "2026-10-06T09:41:00+08:00", read: false, href: "/admin/claims/CL-515" },
  { id: "a2", kind: "new_claim", title: "New claim filed", detail: "White iPhone · Claim CL-516", at: "2026-10-04T11:20:00+08:00", read: false, href: "/admin/claims/CL-516" },
  { id: "a3", kind: "flagged", title: "A lost report was flagged", detail: "White wireless earbuds · contains a phone number", at: "2026-10-03T08:50:00+08:00", read: false, href: "/admin/flagged" },
  { id: "a4", kind: "pickup_due", title: "Pickup deadline tomorrow", detail: "Keys with blue tag · Claim CL-491 · Mika Dela Cruz", at: "2026-10-06T07:00:00+08:00", read: true, href: "/admin/claims/CL-491/release" },
  { id: "a5", kind: "new_claim", title: "New claim filed", detail: "Black leather wallet · Claim CL-512", at: "2026-10-02T09:14:00+08:00", read: true, href: "/admin/claims/CL-512" },
];

export const notifications: Notification[] = [
  {
    id: "n1",
    kind: "question",
    title: "The office has a question about your claim",
    detail: "Black leather wallet · Claim CL-512",
    at: "2026-10-06T14:18:00+08:00",
    read: false,
    href: "/claims/CL-512",
  },
  {
    id: "n2",
    kind: "matches",
    title: "3 possible matches for your report",
    detail: "Navy blue umbrella · tap to review them",
    at: "2026-10-06T09:04:00+08:00",
    read: false,
    href: "/reports/LR-214/matches",
  },
  {
    id: "n3",
    kind: "approved",
    title: "Your claim was approved",
    detail: "Navy folding umbrella · pick up by October 9, 2026 with your RTU ID",
    at: "2026-10-05T16:30:00+08:00",
    read: true,
    href: "/claims/CL-497",
  },
  {
    id: "n4",
    kind: "expiring",
    title: "A report expires in 3 days",
    detail: "Brown coin purse · renew it to keep looking",
    at: "2026-10-01T08:00:00+08:00",
    read: true,
    href: "/reports",
  },
  {
    id: "n5",
    kind: "hidden",
    title: "A report was hidden by the office",
    detail: "White wireless earbuds · the description included a phone number",
    at: "2026-09-30T11:00:00+08:00",
    read: true,
    href: "/reports",
  },
];

export type MatchSeed = Omit<Match, "item"> & { itemId: string };

export const matchesByReport: Record<string, MatchSeed[]> = {
  "LR-214": [
    {
      rank: 1,
      itemId: "BG-1048",
      likelihood: "high",
      why: "same color and category, found in the same building on the day you lost yours, and both mention a black wrist strap.",
    },
    {
      rank: 2,
      itemId: "BG-1053",
      likelihood: "medium",
      why: "similar color and found two days later.",
      but: "described as a full-size umbrella, not a folding one.",
    },
    {
      rank: 3,
      itemId: "BG-1036",
      likelihood: "low",
      why: "same category, found around the same time.",
      but: "a different color and a wooden handle you didn't mention.",
    },
  ],
};

export const flaggedPosts: FlaggedPost[] = [
  {
    id: "FP-31",
    reportId: "LR-221",
    title: "White wireless earbuds",
    reporterLabel: "a•••@rtu.edu.ph",
    reason: "Contains a personal phone number",
    visible: false,
  },
  {
    id: "FP-32",
    reportId: "LR-210",
    title: "Silver ring",
    reporterLabel: "p•••@rtu.edu.ph",
    reason: "Reported as possibly a duplicate post",
    visible: true,
  },
  {
    id: "FP-33",
    reportId: "LR-205",
    title: "Wireless earbuds",
    reporterLabel: "m•••@rtu.edu.ph",
    reason: "Description may include a social media handle",
    visible: true,
  },
];

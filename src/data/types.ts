// Domain types. Status values mirror the workflow in the project plan and the
// database enums, so swapping the mock data layer for Supabase changes no UI code.

export type Role = "student" | "admin" | "super_admin";

export type LostReportStatus = "active" | "resolved" | "closed" | "expired" | "hidden";
export type FoundItemStatus = "in_custody" | "claim_pending" | "ready_for_pickup" | "returned";
export type ClaimStatus =
  | "pending"
  | "needs_info"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "completed"
  | "expired";
export type Likelihood = "high" | "medium" | "low";

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
  /** ISO date the account was created */
  joinedOn?: string;
}

export interface FoundItem {
  /** Public reference, e.g. BG-1042 */
  id: string;
  title: string;
  category: string;
  location: string;
  /** Where exactly it was found, shown on the item page */
  locationDetail?: string;
  foundOn: string; // ISO date
  description: string;
  photo?: string;
  status: FoundItemStatus;
  shelfTag?: string;
  /** Admin-only. Never rendered on student pages and never sent to the AI service. */
  privateDetails?: string;
  loggedBy?: string;
}

export interface LostReport {
  /** e.g. LR-201 */
  id: string;
  ownerId: string;
  title: string;
  category: string;
  location: string;
  lostOn: string;
  description: string;
  photo?: string;
  status: LostReportStatus;
  /** Owner and admins only */
  privateDetails?: string;
  matchCount: number;
  statusNote?: string;
}

export interface ClaimAnswer {
  question: string;
  answer: string;
}

export interface Claim {
  /** e.g. CL-512 */
  id: string;
  itemId: string;
  claimantId: string;
  status: ClaimStatus;
  filedOn: string; // ISO datetime
  answers: ClaimAnswer[];
  linkedReportId?: string;
  decisionReason?: string;
  pickupBy?: string;
  history: { status: ClaimStatus | "submitted" | "under_review"; at: string }[];
}

export interface Message {
  id: string;
  claimId: string;
  /** Aliases only: students see "Office", staff see "Owner". */
  from: "owner" | "office";
  body: string;
  at: string;
}

export interface Notification {
  id: string;
  kind:
    | "question"
    | "matches"
    | "approved"
    | "expiring"
    | "hidden"
    | "rejected"
    // office-side
    | "new_claim"
    | "reply"
    | "flagged"
    | "pickup_due";
  title: string;
  detail: string;
  at: string;
  read: boolean;
  href: string;
}

export interface Match {
  rank: number;
  item: FoundItem;
  likelihood: Likelihood;
  /** Plain-language reason from the AI, public fields only */
  why: string;
  but?: string;
}

export interface FlaggedPost {
  id: string;
  reportId: string;
  title: string;
  reporterLabel: string;
  reason: string;
  visible: boolean;
}

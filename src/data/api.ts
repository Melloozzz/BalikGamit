// Data access layer. Pages import from here; each area lives in its own module:
//   - plain reads/writes  -> supabase.from(...) under row-level security
//   - status changes      -> supabase.rpc(...) database functions (they check allowed transitions)
//   - office invites and account deletion -> the Cloudflare Worker (it holds the service key)
import { todayIso } from "../lib/format";

/** Dropdown options for a record: an archived category or location it already uses stays selectable. */
export const withCurrent = (list: string[], value: string) => (value && !list.includes(value) ? [...list, value] : list);

// Reference lists and office settings come from the database (src/data/reference.ts).
export { CATEGORIES, LOCATIONS, OFFICE } from "./reference";
// Found items (slice 1): src/data/foundItems.ts.
export {
  listFoundItems,
  getFoundItem,
  listAllFoundItems,
  logFoundItem,
  updateFoundItem,
  daysHeld,
  holdEnds,
  isUnclaimed,
  listUnclaimed,
  listDisposed,
  disposeItem,
  extendHold,
  type ItemFilters,
  type FoundItemInput,
  type FoundItemPatch,
} from "./foundItems";
// Lost reports, matches and moderation (slice 2): src/data/lostReports.ts.
export {
  listPublicLostReports,
  getPublicLostReport,
  listMyReports,
  getMyReport,
  createReport,
  updateReport,
  setReportStatus,
  getMatches,
  listAllLostReports,
  getReport,
  countFlaggedReports,
  flagReport,
  listFlaggedPosts,
  setFlaggedVisible,
  type ReportInput,
  type OfficeLostReport,
} from "./lostReports";
// Claims, messages and notifications (slice 3): src/data/claims.ts.
export {
  listMyClaims,
  listAllClaims,
  listClaimsForItem,
  getClaim,
  listProofQuestions,
  createClaim,
  withdrawClaim,
  decideClaim,
  confirmRelease,
  returnToCustody,
  listMessages,
  sendMessage,
  subscribeToMessages,
  listThreads,
  listNotifications,
  unreadCount,
  markNotificationsRead,
  subscribeToNotifications,
  isClaimable,
  type Thread,
} from "./claims";
// Office overview (slice 4): src/data/office.ts.
export {
  getDashboardCounts,
  getOfficeReport,
  computeOfficeReport,
  listActivity,
  getProfileStats,
  type DashboardCounts,
  type OfficeReport,
} from "./office";
// Super admin and account settings (slice 5): src/data/admin.ts.
export { listPlaces, addPlace, renamePlace, setPlaceArchived, listAdmins, inviteAdmin, setAdminActive, updateMyName, deleteMyAccount } from "./admin";
export { useDataVersion } from "./events";

export { todayIso };

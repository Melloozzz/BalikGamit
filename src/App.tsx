import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, type Location } from "react-router";
import { useAuth, isAdmin } from "./auth/AuthContext";
import { MarketingLayout } from "./layouts/MarketingLayout";
import { StudentLayout } from "./layouts/StudentLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import { Loading } from "./components/ui";

import { Landing } from "./pages/public/Landing";
import { About } from "./pages/public/About";
import { Privacy } from "./pages/public/Privacy";
import { Terms } from "./pages/public/Terms";
import { NotFound } from "./pages/public/NotFound";

import { Login } from "./pages/auth/Login";
import { SignUp } from "./pages/auth/SignUp";
import { CheckEmail } from "./pages/auth/CheckEmail";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { ResetLinkSent } from "./pages/auth/ResetLinkSent";
import { ResetPassword } from "./pages/auth/ResetPassword";
import { LinkExpired } from "./pages/auth/LinkExpired";

import { Home } from "./pages/student/Home";
import { ClaimForm } from "./pages/student/ClaimForm";
import { ClaimSubmitted } from "./pages/student/ClaimSubmitted";
import { MyClaims } from "./pages/student/MyClaims";
import { ClaimStatusPage } from "./pages/student/ClaimStatus";
import { ReportLost } from "./pages/student/ReportLost";
import { ReportSubmitted } from "./pages/student/ReportSubmitted";
import { MyReports } from "./pages/student/MyReports";
import { MatchSuggestions } from "./pages/student/MatchSuggestions";
import { AllItems } from "./pages/student/AllItems";
import { Inbox } from "./pages/shared/Inbox";
import { ProfilePage } from "./pages/shared/ProfilePage";
import { Settings } from "./pages/student/Settings";
import { Account } from "./pages/student/Account";

import { Dashboard } from "./pages/admin/Dashboard";
import { LogFoundItem } from "./pages/admin/LogFoundItem";
import { ClaimQueue } from "./pages/admin/ClaimQueue";
import { ClaimReview } from "./pages/admin/ClaimReview";
import { ReleaseItem } from "./pages/admin/ReleaseItem";
import { FlaggedPosts } from "./pages/admin/FlaggedPosts";
import { ManageAdmins } from "./pages/admin/ManageAdmins";
import { FoundItems } from "./pages/admin/FoundItems";
import { EditFoundItem } from "./pages/admin/EditFoundItem";
import { Unclaimed } from "./pages/admin/Unclaimed";
import { LostReports } from "./pages/admin/LostReports";
import { Places } from "./pages/admin/Places";
import { Reports } from "./pages/admin/Reports";
import { ActivityLog } from "./pages/admin/ActivityLog";
import { detailFallback } from "./components/Modal";
import { FoundItemModal, LostItemModal } from "./pages/details/StudentDetailModals";
import { AdminFoundItemModal, AdminLostReportModal } from "./pages/details/AdminDetailModals";

/** Pages behind sign-in. Admins and students get separate areas; the database enforces the same rule with RLS. */
function Guard({ area, children }: { area: "student" | "admin" | "super"; children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (area === "student" && isAdmin(user)) return <Navigate to="/admin" replace />;
  if (area !== "student" && !isAdmin(user)) return <Navigate to="/home" replace />;
  if (area === "super" && user.role !== "super_admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname, state } = useLocation();
  const isPopup = !!(state as { background?: unknown } | null)?.background;
  useEffect(() => {
    if (!isPopup) window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}

export function App() {
  const location = useLocation();
  // When a details link was clicked, keep the page underneath and show the details as a popup.
  // Details always open as a popup. Direct visits get a list page behind them.
  const fallback = detailFallback(location.pathname);
  const background =
    (location.state as { background?: Location } | null)?.background ??
    (fallback ? { pathname: fallback, search: "", hash: "", state: null, key: "detail-fallback" } : undefined);
  return (
    <>
      <ScrollToTop />
      <Routes location={background ?? location}>
        <Route element={<MarketingLayout />}>
          <Route index element={<Landing />} />
          <Route path="about" element={<About />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
        </Route>

        <Route path="login" element={<Login />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="check-email" element={<CheckEmail />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-link-sent" element={<ResetLinkSent />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="reset-password/expired" element={<LinkExpired />} />

        <Route
          element={
            <Guard area="student">
              <StudentLayout />
            </Guard>
          }
        >
          <Route path="home" element={<Home />} />
          <Route path="items" element={<AllItems kind="found" />} />
          <Route path="lost" element={<AllItems kind="lost" />} />
          <Route path="items/:itemId/claim" element={<ClaimForm />} />
          <Route path="claims" element={<MyClaims />} />
          <Route path="claims/:claimId" element={<ClaimStatusPage />} />
          <Route path="claims/:claimId/submitted" element={<ClaimSubmitted />} />
          <Route path="report" element={<ReportLost />} />
          <Route path="report/submitted" element={<ReportSubmitted />} />
          <Route path="reports" element={<MyReports />} />
          <Route path="reports/:reportId/matches" element={<MatchSuggestions />} />
          <Route path="notifications" element={<Inbox who="student" />} />
          <Route path="messages" element={<Inbox who="student" only="messages" />} />
          <Route path="account" element={<Account />} />
          <Route path="profile" element={<ProfilePage area="student" />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route
          path="admin"
          element={
            <Guard area="admin">
              <AdminLayout />
            </Guard>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="log-item" element={<LogFoundItem />} />
          <Route path="claims" element={<ClaimQueue />} />
          <Route path="claims/:claimId" element={<ClaimReview />} />
          <Route path="claims/:claimId/release" element={<ReleaseItem />} />
          <Route path="items" element={<FoundItems />} />
          <Route path="items/:itemId/edit" element={<EditFoundItem />} />
          <Route path="unclaimed" element={<Unclaimed />} />
          <Route path="lost" element={<LostReports />} />
          <Route path="reports" element={<Reports />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="flagged" element={<FlaggedPosts />} />
          <Route path="notifications" element={<Inbox who="office" />} />
          <Route path="messages" element={<Inbox who="office" only="messages" />} />
          <Route path="profile" element={<ProfilePage area="office" />} />
          <Route path="settings" element={<Settings area="office" />} />
          <Route
            path="places"
            element={
              <Guard area="super">
                <Places />
              </Guard>
            }
          />
          <Route
            path="admins"
            element={
              <Guard area="super">
                <ManageAdmins />
              </Guard>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      {background && (
        <Routes>
          <Route path="items/:itemId" element={<Guard area="student"><FoundItemModal /></Guard>} />
          <Route path="lost/:reportId" element={<Guard area="student"><LostItemModal /></Guard>} />
          <Route path="admin/items/:itemId" element={<Guard area="admin"><AdminFoundItemModal /></Guard>} />
          <Route path="admin/lost/:reportId" element={<Guard area="admin"><AdminLostReportModal /></Guard>} />
          <Route path="*" element={null} />
        </Routes>
      )}
    </>
  );
}

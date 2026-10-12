import { Outlet } from "react-router";
import { SiteFooter } from "../components/Footer";
import { SiteHeader } from "../components/SiteHeader";

/** Landing, About, Privacy Notice and Terms of Use. */
export function MarketingLayout() {
  return (
    <div className="site">
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </div>
  );
}

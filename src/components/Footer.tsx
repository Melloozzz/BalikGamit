import { Link } from "react-router";
import { LogoTile, Wordmark } from "./Brand";

/** Slim footer for signed-in pages. */
export function AppFooter() {
  return (
    <footer className="app-footer">
      <span>© 2026 BalikGamit · A BSIT student project, Institute of Computer Studies, RTU–Pasig</span>
      <nav aria-label="Legal">
        <Link to="/privacy">Privacy Notice</Link>
        <Link to="/terms">Terms of Use</Link>
      </nav>
    </footer>
  );
}

/** Full navy footer for the landing, About, Privacy and Terms pages. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div className="site-footer__brand">
          <Link to="/" className="site-footer__logo" aria-label="BalikGamit home">
            <LogoTile size={86} />
            <Wordmark size={53} />
          </Link>
          <p className="site-footer__tag">Lost something on campus? Find it here.</p>
          <address>
            Rizal Technological University – Pasig Campus
            <br />
            Institute of Computer Studies
            <br />
            Eusebio Avenue, Maybunga, Pasig City
          </address>
        </div>
        <nav aria-labelledby="ql">
          <h2 id="ql" className="site-footer__heading">
            QUICK LINKS
          </h2>
          <Link to="/">Home</Link>
          <Link to="/about#how-it-works">How it Works</Link>
          <Link to="/login">Sign In</Link>
          <Link to="/signup">Create an Account</Link>
        </nav>
        <nav aria-labelledby="lp">
          <h2 id="lp" className="site-footer__heading">
            LEGAL &amp; PRIVACY
          </h2>
          <Link to="/privacy">Privacy Notice</Link>
          <Link to="/terms">Terms of Use</Link>
          <a href="https://privacy.gov.ph/data-privacy-act/" target="_blank" rel="noreferrer">
            Data Privacy Act of 2012 (RA 10173)
          </a>
        </nav>
      </div>
      <div className="site-footer__base">
        <span>© 2026 BalikGamit · A BSIT student project, Institute of Computer Studies, RTU–Pasig</span>
        <span>
          Item listings are visible only to signed-in RTU users. Report descriptions are processed by a third-party AI service to
          suggest possible matches.
        </span>
      </div>
    </footer>
  );
}

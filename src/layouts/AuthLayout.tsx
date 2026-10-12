import type { ReactNode } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/Footer";
import { Icon } from "../components/Icon";
import { PhotoBg } from "../components/PhotoBg";

const steps = [
  { icon: "search", title: "1. Search", text: "Browse items reported around campus." },
  { icon: "checkCircle", title: "2. Verify", text: "Confirm it is yours with a few details." },
  { icon: "bagUp", title: "3. Recover", text: "Collect it from the office that holds it." },
] as const;

/** Shared frame for Login, Sign Up, password reset and email checks: site header, hero + form card, How it Works, site footer. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <PhotoBg photo="sky" className="auth__photo" />
      <SiteHeader />
      <div className="auth__top">
        <div className="auth__left">
          <div className="auth__hero">
            <h1 className="hero-title">
              Lost something on campus? <span className="gold">Find it here.</span>
            </h1>
            <p className="hero-lead">
              BalikGamit is the university’s shared campus space for reporting lost items, browsing what has been found, and
              returning belongings safely to the people they belong to.
            </p>
          </div>
        </div>
        <main className="auth__card">{children}</main>
      </div>
      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title" className="how__title">
          HOW IT WORKS
        </h2>
        <ol className="how__steps">
          {steps.map((s) => (
            <li key={s.title}>
              <Icon name={s.icon} size={36} strokeWidth={1.7} className="how__icon" />
              <div>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <SiteFooter />
    </div>
  );
}

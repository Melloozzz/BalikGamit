import type { ReactNode } from "react";
import { BrandLockup } from "../components/Brand";
import { Icon } from "../components/Icon";
import bg from "../assets/rtu-building.jpg";

const steps = [
  { icon: "search", title: "1. Search", text: "Browse items reported around campus." },
  { icon: "checkCircle", title: "2. Verify", text: "Confirm it is yours with a few details." },
  { icon: "bagUp", title: "3. Recover", text: "Collect it from the office that holds it." },
] as const;

/** Shared frame for Login, Sign Up, password reset and email checks (Figma "Login Page"). */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <img src={bg} alt="" className="auth__photo" />
      <div className="auth__top">
        <div className="auth__left">
          <BrandLockup />
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
              <Icon name={s.icon} size={52} strokeWidth={1.7} className="how__icon" />
              <div>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <footer className="auth__banner">
        <Icon name="info" size={28} />
        <p>
          BalikGamit only asks for the details needed to confirm a belonging is yours. Item listings are visible only to signed-in
          RTU users.
        </p>
      </footer>
    </div>
  );
}

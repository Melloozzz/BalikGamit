import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { Icon } from "../../components/Icon";

export interface LegalSection {
  title: string;
  body: ReactNode;
}

export function LegalPage({ title, effective, sections, footnote }: { title: string; effective: string; sections: LegalSection[]; footnote?: ReactNode }) {
  const navigate = useNavigate();
  const phone = typeof window !== "undefined" && window.matchMedia("(max-width: 600px)").matches;
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  return (
    <article className="legal container">
      <header className="legal__head">
        <h1 className="legal__title">{title}</h1>
        <p className="legal__sub">Rizal Technological University · Institute of Computer Studies · Pasig Campus</p>
        <p className="legal__date">Effective {effective}</p>
      </header>
      <nav className="legal__toc" aria-label="Sections">
        <ol>
          {sections.map((s, i) => (
            <li key={s.title}>
              <a href={`#s${i + 1}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((s, i) =>
        phone ? (
          // Phones: every section is its own dropdown, closed until tapped.
          <details key={s.title} id={`s${i + 1}`} className="legal__section legal__acc" open={hash === `#s${i + 1}`}>
            <summary>
              <span className="legal__acc-n">{i + 1}</span>
              <h2>{s.title}</h2>
              <Icon name="chevronDown" size={20} className="legal__acc-chev" />
            </summary>
            <div className="legal__acc-body">{s.body}</div>
          </details>
        ) : (
          <section key={s.title} id={`s${i + 1}`} className="legal__section">
            <h2>
              {i + 1}. {s.title}
            </h2>
            {s.body}
          </section>
        ),
      )}
      {footnote && <p className="legal__foot">{footnote}</p>}
      <button type="button" className="btn btn--gold legal__back" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"))}>
        Go Back
      </button>
    </article>
  );
}

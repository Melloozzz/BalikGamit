import { Link } from "react-router";
import { Icon, type IconName } from "../../components/Icon";

const problems: { icon: IconName; label: string }[] = [
  { icon: "flag", label: "Scattered" },
  { icon: "search", label: "Hard to search" },
  { icon: "report", label: "No record" },
];

const steps = [
  { n: 1, title: "Report", icon: "report" as IconName, text: "Lost something? Post a short description of it, and your report goes live right away." },
  {
    n: 2,
    title: "Match",
    icon: "sparkle" as IconName,
    text: "Found items are logged by the office when they're handed in. BalikGamit suggests possible matches, even when they're described in different words.",
  },
  {
    n: 3,
    title: "Claim",
    icon: "shield" as IconName,
    text: "Answer a few questions to show the item is yours. Once the office approves your claim, pick it up with your RTU ID.",
  },
];

const principles = [
  { title: "Privacy first", icon: "lock" as IconName, text: "Sensitive item details are never shown publicly. Only the office sees them, and only to verify claims." },
  { title: "People decide", icon: "users" as IconName, text: "AI suggests possible matches, but a person reviews and approves every claim." },
  { title: "Safe handovers", icon: "release" as IconName, text: "Items are returned at the office, never in meetups between strangers." },
];

const team = [
  { initials: "MB", name: "Mark Vincent A. Bartolay", role: "Project Lead" },
  { initials: "JR", name: "Jenwille John V. Robias", role: "AI/LLM Engineer" },
  { initials: "LJ", name: "Lyca Mae V. Jangas", role: "UI/UX Designer & QA" },
  { initials: "HB", name: "Havena Angel P. Balderama", role: "Database Developer" },
];

export function About() {
  return (
    <div className="about">
      <section className="container about__hero">
        <p className="eyebrow eyebrow--gold">ABOUT US</p>
        <h1 className="about__title">
          Returning belongings to the people they <span className="gold">belong to.</span>
        </h1>
        <p className="about__lead">
          BalikGamit is a web-based lost and found system for the RTU–Pasig Campus community. It gives students, faculty, and staff one
          place to report lost items, check what has been found, and get their belongings back safely.
        </p>
      </section>

      <section className="about__name">
        <p className="eyebrow eyebrow--gold">THE NAME</p>
        <div className="name-eq">
          <span>
            <b className="gold">Balik</b>
            <small>return</small>
          </span>
          <span className="name-eq__plus">+</span>
          <span>
            <b className="gold">Gamit</b>
            <small>belongings</small>
          </span>
        </div>
        <p>BalikGamit means returning belongings to the people they belong to.</p>
      </section>

      <section className="container about__split">
        <div>
          <p className="eyebrow eyebrow--gold">THE PROBLEM</p>
          <h2 className="about__h2">Why we built it</h2>
        </div>
        <div>
          <p>
            At RTU–Pasig, recovering a lost item means asking around, checking social media posts, or visiting different offices. These
            channels are scattered, hard to search, and don't record whether an item was ever returned. BalikGamit brings them together
            in one place.
          </p>
          <ul className="problem-tags">
            {problems.map((p) => (
              <li key={p.label}>
                <Icon name={p.icon} size={18} className="gold" />
                {p.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container" id="how-it-works">
        <p className="eyebrow eyebrow--gold">HOW IT WORKS</p>
        <h2 className="about__h2">Three steps from lost to returned</h2>
        <div className="about__cards">
          {steps.map((s) => (
            <article key={s.n} className="glass-card">
              <div className="glass-card__row">
                <Icon name={s.icon} size={28} className="gold" />
                <span className="step-tag">STEP {s.n}</span>
              </div>
              <h3 className="glass-card__title">{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container">
        <p className="eyebrow eyebrow--gold">OUR PRINCIPLES</p>
        <h2 className="about__h2">What we stand for</h2>
        <div className="about__cards">
          {principles.map((p) => (
            <article key={p.title} className="glass-card">
              <Icon name={p.icon} size={28} className="gold" />
              <h3 className="glass-card__title">{p.title}</h3>
              <p>{p.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container">
        <p className="eyebrow eyebrow--gold">THE TEAM</p>
        <h2 className="about__h2">The people behind BalikGamit</h2>
        <ul className="team">
          {team.map((m) => (
            <li key={m.name} className="team__card">
              <span className="team__avatar">{m.initials}</span>
              <strong>{m.name}</strong>
              <span>{m.role}</span>
            </li>
          ))}
        </ul>
        <p className="adviser">
          <span className="eyebrow eyebrow--gold">PROJECT ADVISER</span> Prof. Ronel D. Paglomutan, MEng-CpE
        </p>
        <p className="about__note">
          BalikGamit is a software development project of BSIT students at the Institute of Computer Studies, RTU–Pasig Campus. It is a
          student project, not an official university service.
        </p>
      </section>

      <section className="cta-band cta-band--plain">
        <h2>Lost something on campus?</h2>
        <Link to="/signup" className="btn btn--gold btn--lg">
          Report a lost item
        </Link>
        <Link to="/terms" className="cta-band__link">
          How claiming works
        </Link>
      </section>
    </div>
  );
}

import { Link } from "react-router";
import { Icon, type IconName } from "../../components/Icon";
import bg from "../../assets/rtu-building.jpg";

const steps: { icon: IconName; title: string; text: string }[] = [
  { icon: "search", title: "1. Search", text: "Browse items reported around campus." },
  { icon: "checkCircle", title: "2. Verify", text: "Confirm it is yours with a few details." },
  { icon: "bagUp", title: "3. Recover", text: "Collect it from the office that holds it." },
];

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: "search", title: "Smart matching", text: "Find your item even when it’s described differently." },
  { icon: "shield", title: "Private by design", text: "Sensitive details are never shown publicly." },
  { icon: "user", title: "Verified claims", text: "Every claim is reviewed by a real person." },
  { icon: "checkCircle", title: "Status Tracking", text: "Know where your item is at every step." },
];

export function Landing() {
  return (
    <>
      <section className="landing-hero">
        <img src={bg} alt="" className="landing-hero__photo" />
        <div className="container landing-hero__inner">
          <h1 className="hero-title hero-title--landing">
            Lost something on campus? <span className="gold">Find it here.</span>
          </h1>
          <p className="hero-lead">
            BalikGamit is the university’s shared campus space for reporting lost items, browsing what has been found, and returning
            belongings safely to the people they belong to.
          </p>
          <div className="landing-hero__cta">
            <Link to="/signup" className="btn btn--gold btn--lg">
              Create your account
            </Link>
            <Link to="/login" className="btn btn--ghost-light btn--lg">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="how">
        <div className="container">
          <h2 id="how" className="band__title">
            How it Works
          </h2>
          <ol className="steps-row">
            {steps.map((s) => (
              <li key={s.title}>
                <Icon name={s.icon} size={34} className="gold" />
                <div>
                  <strong>{s.title}</strong>
                  <span>{s.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="audience">
        <div className="container audience__grid">
          <div className="glass-card">
            <h2 className="glass-card__title">For students</h2>
            <ul>
              <li>Report a lost item in seconds.</li>
              <li>Get notified of possible matches.</li>
              <li>Track your claim from report to recovery.</li>
            </ul>
          </div>
          <div className="glass-card">
            <h2 className="glass-card__title">For the office</h2>
            <ul>
              <li>Log found items as they come in.</li>
              <li>Review claims against private verification details.</li>
              <li>Keep one auditable record of every item.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="why">
        <div className="container">
          <h2 id="why" className="section-title">
            Why <span className="gold">BalikGamit</span>
          </h2>
          <div className="features">
            {features.map((f) => (
              <div key={f.title} className="feature">
                <Icon name={f.icon} size={34} className="gold" />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <h2>Ready to find what you lost?</h2>
        <Link to="/signup" className="btn btn--gold btn--lg">
          Create your account
        </Link>
      </section>
    </>
  );
}

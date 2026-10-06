import { Link } from "react-router";
import { LogoTile, Wordmark } from "../../components/Brand";

export function NotFound() {
  return (
    <main className="notfound">
      <LogoTile size={72} />
      <Wordmark size={36} />
      <h1>We couldn't find that page.</h1>
      <p>The link may be old, or the page may have moved.</p>
      <Link to="/" className="btn btn--gold btn--lg">
        Go to the home page
      </Link>
    </main>
  );
}

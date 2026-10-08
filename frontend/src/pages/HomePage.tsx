import { Link } from "react-router-dom";
import { Button } from "../components/Button";

export function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center">
      <h1 className="text-4xl font-bold text-brand-800">Plan your wedding, anywhere in India</h1>
      <p className="max-w-xl text-neutral-600">
        Discover and book trusted wedding vendors — venues, decorators, photographers and more, across India.
        Booking and payments are coming in a later phase; for now, browse vendors, save your favorites and plan
        your wedding details.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/vendors">
          <Button>Browse vendors</Button>
        </Link>
        <Link to="/register">
          <Button variant="secondary">Get started</Button>
        </Link>
        <Link to="/login">
          <Button variant="secondary">I already have an account</Button>
        </Link>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold text-brand-800">Page not found</h1>
      <Link to="/" className="text-brand-700 hover:underline">
        Go back home
      </Link>
    </div>
  );
}

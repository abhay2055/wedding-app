import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUnreadMessageCount } from "../hooks/useUnreadMessageCount";
import { Button } from "./Button";
import { NotificationBell } from "./NotificationBell";

function MessagesLink({ to }: { to: string }) {
  const unread = useUnreadMessageCount();
  return (
    <Link to={to} className="relative text-neutral-700 hover:text-brand-700">
      Messages
      {unread > 0 && (
        <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-medium text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="border-b border-neutral-200 bg-white">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-brand-700">
          VivahSetu
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link to="/vendors" className="text-neutral-700 hover:text-brand-700">
            Vendors
          </Link>
          {user ? (
            <>
              <span className="hidden text-neutral-600 sm:inline">
                {user.name} <span className="text-neutral-400">({user.role})</span>
              </span>
              <Link to="/dashboard" className="text-neutral-700 hover:text-brand-700">
                Dashboard
              </Link>
              {user.role === "CUSTOMER" && (
                <>
                  <Link to="/dashboard/bookings" className="text-neutral-700 hover:text-brand-700">
                    Bookings
                  </Link>
                  <Link to="/dashboard/payments" className="text-neutral-700 hover:text-brand-700">
                    Payments
                  </Link>
                  <Link to="/dashboard/reviews" className="text-neutral-700 hover:text-brand-700">
                    Reviews
                  </Link>
                  <MessagesLink to="/dashboard/messages" />
                  <Link to="/favorites" className="text-neutral-700 hover:text-brand-700">
                    Saved
                  </Link>
                </>
              )}
              {user.role === "VENDOR" && (
                <>
                  <Link to="/vendor" className="text-neutral-700 hover:text-brand-700">
                    Vendor
                  </Link>
                  <Link to="/vendor/bookings" className="text-neutral-700 hover:text-brand-700">
                    Bookings
                  </Link>
                  <Link to="/vendor/payments" className="text-neutral-700 hover:text-brand-700">
                    Payments
                  </Link>
                  <Link to="/vendor/reviews" className="text-neutral-700 hover:text-brand-700">
                    Reviews
                  </Link>
                  <MessagesLink to="/vendor/messages" />
                </>
              )}
              {user.role === "ADMIN" && (
                <>
                  <Link to="/admin" className="text-neutral-700 hover:text-brand-700">
                    Admin
                  </Link>
                  <Link to="/admin/customers" className="text-neutral-700 hover:text-brand-700">
                    Customers
                  </Link>
                  <Link to="/admin/bookings" className="text-neutral-700 hover:text-brand-700">
                    Bookings
                  </Link>
                  <Link to="/admin/payments" className="text-neutral-700 hover:text-brand-700">
                    Payments
                  </Link>
                  <Link to="/admin/reviews" className="text-neutral-700 hover:text-brand-700">
                    Reviews
                  </Link>
                  <Link to="/admin/analytics" className="text-neutral-700 hover:text-brand-700">
                    Analytics
                  </Link>
                </>
              )}
              <NotificationBell />
              <Button variant="secondary" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-neutral-700 hover:text-brand-700">
                Login
              </Link>
              <Link to="/register" className="text-neutral-700 hover:text-brand-700">
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

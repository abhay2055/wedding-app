import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { Role } from "../types/api";
import { LoadingState } from "../components/LoadingState";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Role[];
}

// This only controls what the UI renders. The backend independently
// enforces the same rules on every request, since a client can always be
// bypassed or tampered with.
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState label="Checking your session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

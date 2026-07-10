import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isUserAccessDisabled } from "@/lib/accessStatus";

export function ProtectedRoute({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || isUserAccessDisabled(user)) return <Navigate to="/login" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

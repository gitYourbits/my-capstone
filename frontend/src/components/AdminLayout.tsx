import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUser, getAuthToken } from "@/lib/api";
import {
  LayoutDashboard,
  FileText,
  ArrowLeft,
  ShieldCheck,
  Users,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/grievances", label: "Grievances", icon: FileText },
  { to: "/admin/spam", label: "Spam", icon: ShieldAlert },
  { to: "/admin/assignment", label: "Assignment", icon: Users },
];

export const AdminLayout = () => {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const check = async () => {
      if (!getAuthToken()) {
        navigate("/login", { replace: true });
        return;
      }
      const user = await getCurrentUser();
      if (!user?.is_staff) {
        navigate("/", { replace: true });
        return;
      }
      setAllowed(true);
    };
    check();
  }, [navigate]);

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Checking access...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center gap-4 px-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to site</span>
          </Link>
          <div className="flex h-8 items-center gap-2 border-l border-border pl-4">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Admin</span>
          </div>
          <nav className="ml-8 flex items-center gap-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to}>
                <Button
                  variant={location.pathname === to ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("gap-2", location.pathname === to && "bg-primary/10 text-primary hover:bg-primary/20")}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="container py-6 px-4">
        <Outlet />
      </main>
    </div>
  );
};

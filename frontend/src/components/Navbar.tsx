import { useState, useEffect } from "react";
import { Search, Upload, User, Menu, LogOut, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { getAuthToken, clearAuthTokens, getCurrentUser } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Navbar = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const token = getAuthToken();
    setIsAuthenticated(!!token);
    if (token) {
      getCurrentUser().then((user) => setIsStaff(!!user?.is_staff));
    } else {
      setIsStaff(false);
    }
  }, []);

  const handleLogout = () => {
    clearAuthTokens();
    setIsAuthenticated(false);
    navigate("/");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/feed?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 dark:bg-background/90 backdrop-blur-md shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-accent shadow-md group-hover:scale-105 transition-all">
              <span className="text-lg font-bold text-primary-foreground">V</span>
            </div>
            <span className="text-xl font-bold text-foreground">VoiceUp</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <Link to="/feed" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Explore
            </Link>
            <Link to="/feed?sort_by=trending" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Trending
            </Link>
          </div>
        </div>

        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search issues..."
              className="w-full pl-10 bg-muted/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <Link to="/create">
                <Button variant="default" size="sm" className="hidden md:flex gap-2 shadow-md hover:shadow-lg hover:scale-105 transition-all">
                  <Upload className="h-4 w-4" />
                  Post Issue
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    My Issues
                  </DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/create">
                <Button variant="default" size="sm" className="hidden md:flex gap-2 shadow-md hover:shadow-lg hover:scale-105 transition-all">
                  <Upload className="h-4 w-4" />
                  Post Issue
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Search className="h-5 w-5" />
              </Button>
              <Link to="/login">
                <Button variant="outline" size="sm" className="hidden md:inline-flex">
                  Login
                </Button>
                <Button variant="outline" size="icon" className="md:hidden">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import MobileBottomNav from "@/components/dashboard/MobileBottomNav";

/**
 * Wrapper for pages that have to open without an account (support, help,
 * terms, privacy — the App Store links to them). Signed-in people still get
 * the bottom nav, so it feels like the rest of the app.
 */
const PublicPage = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  return (
    <div className="willo-bg min-h-screen" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Each page brings its own horizontal padding, so this only frames them */}
      <div className="w-full pb-24 pt-2 md:pb-8">{children}</div>
      {user && <MobileBottomNav />}
    </div>
  );
};

export default PublicPage;

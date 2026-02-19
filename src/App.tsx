import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { InstallGate } from "@/components/InstallGate";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { NotificationGate } from "@/components/NotificationGate";

import LoginPage from "./pages/LoginPage";
import ClientDashboard from "./pages/ClientDashboard";
import MissionsPage from "./pages/MissionsPage";
import ReferralsPage from "./pages/ReferralsPage";
import WithdrawalsPage from "./pages/WithdrawalsPage";
import HistoryPage from "./pages/HistoryPage";
import IptvInfoPage from "./pages/IptvInfoPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminMissionsPage from "./pages/admin/AdminMissionsPage";
import AdminWithdrawalsPage from "./pages/admin/AdminWithdrawalsPage";
import AdminReferralsPage from "./pages/admin/AdminReferralsPage";
import AdminContentPage from "./pages/admin/AdminContentPage";
import AdminBannersPage from "./pages/admin/AdminBannersPage";
import AdminReportsPage from "./pages/admin/AdminReportsPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminCreditsPage from "./pages/admin/AdminCreditsPage";
import CreditsStorePage from "./pages/CreditsStorePage";
import CreditsChallengesPage from "./pages/CreditsChallengesPage";
import ScratchCardPage from "./pages/ScratchCardPage";
import PrizeBoxPage from "./pages/PrizeBoxPage";
import CupGamePage from "./pages/CupGamePage";
import RoulettePage from "./pages/RoulettePage";
import AdminRoulettePage from "./pages/admin/AdminRoulettePage";
import AdminIptvPage from "./pages/admin/AdminIptvPage";
import AdminGamesPage from "./pages/admin/AdminGamesPage";
import MemoryGamePage from "./pages/MemoryGamePage";
import TvGuidePage from "./pages/TvGuidePage";
import AdminTvGuidePage from "./pages/admin/AdminTvGuidePage";
import AdminNotificationsPage from "./pages/admin/AdminNotificationsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function HomeRedirect() {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <PWAUpdatePrompt />
        <NotificationGate>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Client Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><ClientDashboard /></ProtectedRoute>} />
            <Route path="/missions" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
            <Route path="/referrals" element={<ProtectedRoute><ReferralsPage /></ProtectedRoute>} />
            <Route path="/withdrawals" element={<ProtectedRoute><WithdrawalsPage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
            <Route path="/iptv-info" element={<ProtectedRoute><IptvInfoPage /></ProtectedRoute>} />
            <Route path="/credits" element={<ProtectedRoute><CreditsStorePage /></ProtectedRoute>} />
            <Route path="/challenges" element={<ProtectedRoute><CreditsChallengesPage /></ProtectedRoute>} />
            <Route path="/scratch" element={<ProtectedRoute><ScratchCardPage /></ProtectedRoute>} />
            <Route path="/prize-box" element={<ProtectedRoute><PrizeBoxPage /></ProtectedRoute>} />
            <Route path="/cup-game" element={<ProtectedRoute><CupGamePage /></ProtectedRoute>} />
            <Route path="/roulette" element={<ProtectedRoute><RoulettePage /></ProtectedRoute>} />
            <Route path="/memory-game" element={<ProtectedRoute><MemoryGamePage /></ProtectedRoute>} />
            <Route path="/tv-guide" element={<ProtectedRoute><TvGuidePage /></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsersPage /></ProtectedRoute>} />
            <Route path="/admin/missions" element={<ProtectedRoute requireAdmin><AdminMissionsPage /></ProtectedRoute>} />
            <Route path="/admin/withdrawals" element={<ProtectedRoute requireAdmin><AdminWithdrawalsPage /></ProtectedRoute>} />
            <Route path="/admin/referrals" element={<ProtectedRoute requireAdmin><AdminReferralsPage /></ProtectedRoute>} />
            <Route path="/admin/content" element={<ProtectedRoute requireAdmin><AdminContentPage /></ProtectedRoute>} />
            <Route path="/admin/banners" element={<ProtectedRoute requireAdmin><AdminBannersPage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute requireAdmin><AdminReportsPage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminSettingsPage /></ProtectedRoute>} />
            <Route path="/admin/credits" element={<ProtectedRoute requireAdmin><AdminCreditsPage /></ProtectedRoute>} />
            <Route path="/admin/roulette" element={<ProtectedRoute requireAdmin><AdminRoulettePage /></ProtectedRoute>} />
            <Route path="/admin/iptv" element={<ProtectedRoute requireAdmin><AdminIptvPage /></ProtectedRoute>} />
            <Route path="/admin/games" element={<ProtectedRoute requireAdmin><AdminGamesPage /></ProtectedRoute>} />
            <Route path="/admin/tv-guide" element={<ProtectedRoute requireAdmin><AdminTvGuidePage /></ProtectedRoute>} />
            <Route path="/admin/notifications" element={<ProtectedRoute requireAdmin><AdminNotificationsPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </NotificationGate>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

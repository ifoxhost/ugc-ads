import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import UGCGenerator from "./pages/UGCGenerator";
import Library from "./pages/Library";
import Help from "./pages/Help";
import Account from "./pages/Account";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Payments from "./pages/Payments";
import Dashboard from "./pages/Dashboard";
import Trash from "./pages/Trash";
import NotificationPreferences from "./pages/NotificationPreferences";
import About from "./pages/About";
import Changelog from "./pages/Changelog";
import Careers from "./pages/Careers";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import CookiePolicy from "./pages/CookiePolicy";
import AcceptableUse from "./pages/AcceptableUse";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import EmailVerificationBanner from "./components/EmailVerificationBanner";
import SessionProvider from "./components/SessionProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { CreateSubmitProvider } from "./hooks/useCreateSubmit";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isHomePage = location.pathname === "/";
  const authPages = ["/login", "/signup", "/forgot-password", "/reset-password"];
  const isAuthPage = authPages.includes(location.pathname);
  const showSidebar = !isHomePage && !isAuthPage && location.pathname !== "/pricing";
  const showVerificationBanner = !isHomePage && !isAuthPage;

  return (
    <div className="min-h-screen w-full bg-background overflow-x-hidden">
      {showSidebar && <Sidebar />}
      <Header />
      {showVerificationBanner && (
        <div className={showSidebar ? "ml-0 md:ml-16 pt-14 md:pt-16" : "pt-14 sm:pt-16"}>
          <EmailVerificationBanner />
        </div>
      )}
      <main className={showSidebar ? `ml-0 md:ml-16 ${showVerificationBanner ? "" : "pt-14 md:pt-16"} pb-16 md:pb-0` : showVerificationBanner ? "" : "pt-14 sm:pt-0"}>
        {children}
      </main>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CreateSubmitProvider>
          <SessionProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Layout>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/changelog" element={<Changelog />} />
                  <Route path="/careers" element={<Careers />} />
                   <Route path="/terms" element={<Terms />} />
                   <Route path="/privacy" element={<Privacy />} />
                   <Route path="/cookies" element={<CookiePolicy />} />
                   <Route path="/acceptable-use" element={<AcceptableUse />} />
                  
                  {/* Guest only routes (redirect to dashboard if logged in) */}
                  <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                  <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
                  <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  
                  {/* Protected routes */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/create" element={<ProtectedRoute><UGCGenerator /></ProtectedRoute>} />
                  <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
                  <Route path="/trash" element={<ProtectedRoute><Trash /></ProtectedRoute>} />
                  <Route path="/help" element={<ProtectedRoute><Help /></ProtectedRoute>} />
                  <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
                  <Route path="/account/notifications" element={<ProtectedRoute><NotificationPreferences /></ProtectedRoute>} />
                  <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                  <Route path="/payments/success" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                  <Route path="/payments/cancel" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                  
                  {/* Admin only route */}
                  <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            </BrowserRouter>
          </SessionProvider>
        </CreateSubmitProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

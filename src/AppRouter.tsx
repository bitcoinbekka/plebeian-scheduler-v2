import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { AppLayout } from "./components/AppLayout";

import Index from "./pages/Index";
import Compose from "./pages/Compose";
import Drafts from "./pages/Drafts";
import QueuePage from "./pages/QueuePage";
import CalendarView from "./pages/CalendarView";
import SettingsPage from "./pages/SettingsPage";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppLayout>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/compose" element={<Compose />} />
          <Route path="/drafts" element={<Drafts />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
          <Route path="/:nip19" element={<NIP19Page />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
export default AppRouter;


import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ScrollToTop } from '@/components/ScrollToTop';
import { FloatingChat } from '@/components/chat/FloatingChat';
import { PendingTasksProvider } from '@/contexts/PendingTasksContext';
import Index from '@/pages/Index';
import { AuthPage } from '@/components/auth/AuthPage';
import { ResetPasswordPage } from '@/components/auth/ResetPasswordPage';
import { Users } from '@/pages/Users';
import { ClientDetails } from '@/pages/ClientDetails';
import { RunbookDetails } from '@/pages/RunbookDetails';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PendingTasksProvider>
        <Router>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/clients" element={<Index />} />
            <Route path="/clients/:id" element={<Index />} />
            <Route path="/runbooks" element={<Index />} />
            <Route path="/runbooks/:id" element={<Index />} />
            <Route path="/users" element={<Index />} />
            <Route path="/settings" element={<Index />} />
            <Route path="/executions" element={<Index />} />
            <Route path="/executions/:id" element={<Index />} />
            <Route path="/knowledge-base" element={<Index />} />
          </Routes>
          <FloatingChat />
          <Toaster />
        </Router>
      </PendingTasksProvider>
    </QueryClientProvider>
  );
}

export default App;

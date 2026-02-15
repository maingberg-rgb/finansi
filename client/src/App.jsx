import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './components/Dashboard';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans" dir="rtl">
        <header className="bg-white shadow-sm border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <h1 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent tracking-tight">
              FinansiMS
            </h1>
            <div className="text-sm font-bold text-stone-500 bg-stone-100 px-4 py-1.5 rounded-full">
              ניהול חשבון הבית
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Dashboard />
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;

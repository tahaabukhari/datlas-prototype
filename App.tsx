import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import LeftSideBar from './components/LeftSideBar';
import ChatInterface from './pages/ChatInterface';
import HistoryPage from './pages/HistoryPage';
import { AuthProvider } from './context/AuthContext';
import { FileProvider } from './context/FileContext';
import { UIProvider } from './context/UIContext';
import { DashboardProvider } from './context/DashboardContext';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <FileProvider>
        <UIProvider>
          <DashboardProvider>
            <HashRouter>
              <div className="flex h-full bg-zinc-950 text-gray-100 font-sans antialiased">
                <LeftSideBar />
                <main className="flex-1 flex flex-col min-w-0">
                  <Routes>
                    <Route path="/" element={<ChatInterface />} />
                    <Route path="/history/:id" element={<HistoryPage />} />
                  </Routes>
                </main>
              </div>
            </HashRouter>
          </DashboardProvider>
        </UIProvider>
      </FileProvider>
    </AuthProvider>
  );
};

export default App;
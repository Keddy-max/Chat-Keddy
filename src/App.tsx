/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, X, Sparkles } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import LiveDashboard from './components/LiveDashboard';
import Sidebar from './components/Sidebar';
import SplashIntro from './components/SplashIntro';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './components/Login';
import { db } from './lib/firebase';
import { collection, doc, deleteDoc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestoreError';

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [showIntro, setShowIntro] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('keddy_current_session');
      return saved || null;
    } catch (e) {
      console.warn("localStorage access denied", e);
      return null;
    }
  });

  // Close sidebar on session select on mobile
  const handleSelectSession = useCallback((id: string) => {
    setCurrentSessionId(id);
    setIsSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, 'users', user.uid, 'sessions'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedSessions: ChatSession[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        loadedSessions.push({
          id: doc.id,
          title: data.title || 'New Chat',
          updatedAt: data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now()
        });
      });
      setSessions(loadedSessions);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/sessions`);
    });
    
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('keddy_current_session', currentSessionId);
    } else {
      localStorage.removeItem('keddy_current_session');
    }
  }, [currentSessionId]);

  const handleNewSession = async () => {
    if (!user) return;
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      updatedAt: Date.now(),
    };
    
    try {
      await setDoc(doc(db, 'users', user.uid, 'sessions', newId), {
        title: newSession.title,
        updatedAt: new Date(newSession.updatedAt).toISOString(),
        messages: JSON.stringify([
          {
            id: 'welcome',
            role: 'model',
            text: 'Hello. I am **Keddy**, your advanced AI assistant. How can I help you today?'
          }
        ])
      });
      setCurrentSessionId(newId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/sessions/${newId}`);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'sessions', id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/sessions/${id}`);
    }
  };

  const handleUpdateSessionTitle = async (id: string, title: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'sessions', id), {
        title,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/sessions/${id}`);
    }
  };

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
  }, []);

  if (showIntro) {
    return <SplashIntro onComplete={handleIntroComplete} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-green-600/30 overflow-hidden relative">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50 lg:relative lg:z-0 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={() => {
            handleNewSession();
            setIsSidebarOpen(false);
          }}
          onDeleteSession={handleDeleteSession}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>

      <div className="flex-1 relative flex flex-col min-w-0">
        {currentSessionId ? (
          <ChatInterface
            key={currentSessionId}
            sessionId={currentSessionId}
            onUpdateTitle={(title) => handleUpdateSessionTitle(currentSessionId, title)}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            onToggleDashboard={() => setIsDashboardOpen(!isDashboardOpen)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500 flex-col gap-4 p-4 text-center">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden absolute top-4 left-4 p-2 text-zinc-400 hover:text-zinc-100"
            >
              <MessageSquare size={24} />
            </button>
            <div className="text-2xl font-light">Welcome to Keddy AI</div>
            <button
              onClick={handleNewSession}
              className="bg-green-700 hover:bg-green-600 text-white py-2 px-6 rounded-xl transition-colors font-medium"
            >
              Start a New Chat
            </button>
          </div>
        )}
      </div>

      {/* Dashboard Overlay for Mobile */}
      {isDashboardOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsDashboardOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 right-0 z-50 md:relative md:z-0 transform transition-transform duration-300 ease-in-out
        w-80 lg:w-96 flex-shrink-0 bg-zinc-950 border-l border-zinc-900
        ${isDashboardOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        ${!isDashboardOpen ? 'hidden md:block' : 'block'}
      `}>
        <div className="h-full relative">
          <button 
            onClick={() => setIsDashboardOpen(false)}
            className="md:hidden absolute top-4 right-4 z-10 p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-zinc-100"
          >
            <X size={20} />
          </button>
          <LiveDashboard />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

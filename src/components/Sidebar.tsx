import React from 'react';
import { MessageSquare, Plus, Trash2, LogOut, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
}

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onClose?: () => void;
}

export default function Sidebar({ sessions, currentSessionId, onSelectSession, onNewSession, onDeleteSession, onClose }: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <div className="w-72 lg:w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col h-full shadow-2xl lg:shadow-none">
      <div className="p-4 border-b border-zinc-900 flex items-center gap-2">
        <button
          onClick={onNewSession}
          className="flex-1 flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white py-2 px-4 rounded-xl transition-colors font-medium text-sm"
        >
          <Plus size={16} />
          New Chat
        </button>
        {onClose && (
          <button 
            onClick={onClose}
            className="lg:hidden p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg"
          >
            <X size={20} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
              currentSessionId === session.id
                ? 'bg-zinc-800 text-zinc-100'
                : 'hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <MessageSquare size={16} className="flex-shrink-0" />
              <span className="text-sm truncate">{session.title}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession(session.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded-md transition-all text-zinc-500 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="text-center text-zinc-600 text-sm mt-10 px-4">
            No recent chats. Start a new conversation!
          </div>
        )}
      </div>
      {user && (
        <div className="p-4 border-t border-zinc-900">
          <div className="flex items-center gap-3 mb-4">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                {user.email?.[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-zinc-200 truncate">{user.displayName || user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 py-2 px-4 rounded-xl transition-colors font-medium text-sm border border-zinc-800"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

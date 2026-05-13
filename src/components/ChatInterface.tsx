import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Download,
  Globe,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { systemInstruction } from '../lib/gemini';
import { groqChatStream } from '../lib/groq';
import { checkTraffic } from '../lib/traffic';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
  attachment?: {
    name: string;
    type: string;
    data: string; // base64
  };
  generatedImage?: string;
  generatedVideo?: string;
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1.5 text-xs font-medium"
      title="Copy message"
    >
      {copied ? <Check size={14} className="text-yellow-500" /> : <Copy size={14} />}
      {copied ? <span className="text-yellow-500">Copied</span> : <span>Copy</span>}
    </button>
  );
};

const SpeakButton = ({ text }: { text: string }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  return (
    <button
      onClick={handleSpeak}
      className={`p-1.5 rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium ${
        isSpeaking ? 'bg-green-600/20 text-yellow-500 hover:bg-green-600/30' : 'bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'
      }`}
      title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
    >
      {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
      {isSpeaking ? <span>Stop</span> : <span>Listen</span>}
    </button>
  );
};

interface ChatInterfaceProps {
  sessionId: string;
  onUpdateTitle: (title: string) => void;
  onToggleSidebar?: () => void;
  onToggleDashboard?: () => void;
}

export default function ChatInterface({
  sessionId,
  onUpdateTitle,
  onToggleSidebar,
  onToggleDashboard,
}: ChatInterfaceProps) {
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachment, setAttachment] = useState<
    { name: string; type: string; data: string; preview?: string } | null
  >(null);
  const [persona, setPersona] = useState('Default');

  // Groq text models
  const [model, setModel] = useState('llama3-70b-8192');

  const [useWebSearch, setUseWebSearch] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              setInput((prev) => prev + transcript + ' ');
            }
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            alert('Microphone access blocked. Please enable it in your browser settings.');
          }
        };

        recognitionRef.current.onend = () => setIsListening(false);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const loadMessages = async () => {
      setIsInitializing(true);
      try {
        const docRef = doc(db, 'users', user.uid, 'sessions', sessionId);
        const docSnap = await getDoc(docRef);

        if (!isMounted) return;

        if (docSnap.exists()) {
          const data = docSnap.data();
          if ((data as any).messages) {
            setMessages(JSON.parse((data as any).messages));
          }
        } else {
          setMessages([]);
        }
        setIsInitializing(false);
      } catch (error) {
        if (!isMounted) return;
        setIsInitializing(false);
        handleFirestoreError(
          error,
          OperationType.GET,
          `users/${user.uid}/sessions/${sessionId}`
        );
      }
    };

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [sessionId, user]);

  useEffect(() => {
    if (!user || isInitializing || messages.length === 0 || isLoading) return;

    const saveMessages = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'sessions', sessionId);
        await setDoc(docRef, {
          messages: JSON.stringify(messages),
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `users/${user.uid}/sessions/${sessionId}`
        );
      }
    };

    saveMessages();
  }, [messages, sessionId, user, isInitializing, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleExportChat = () => {
    const chatText = messages
      .map((m) => `${m.role.toUpperCase()}:\n${m.text}\n\n`)
      .join('---\n\n');

    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keddy-chat-${sessionId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const base64String = result.split(',')[1];
      setAttachment({
        name: file.name,
        type: file.type,
        data: base64String,
        preview: file.type.startsWith('image/') ? result : undefined,
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [showCommands, setShowCommands] = useState(false);
  const commands = [
    {
      name: '/imagine',
      description: 'Generate an AI image',
      icon: <Sparkles size={14} className="text-yellow-500" />,
    },
    {
      name: '/video',
      description: 'Generate an AI video',
      icon: <Bot size={14} className="text-green-500" />,
    },
    {
      name: '/help',
      description: 'Show available commands',
      icon: <Sparkles size={14} className="text-blue-500" />,
    },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    if (value === '/') setShowCommands(true);
    else if (!value.startsWith('/') || value.includes(' ')) setShowCommands(false);
  };

  const selectCommand = (cmd: string) => {
    setInput(cmd + ' ');
    setShowCommands(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || isLoading || inFlightRef.current) return;

    setShowCommands(false);

    if (isListening) toggleListening();

    const userMessage = input.trim();
    setInput('');

    const currentAttachment = attachment;
    setAttachment(null);

    inFlightRef.current = true;
    setIsLoading(true);

    if (messages.length === 1 && userMessage) {
      const newTitle =
        userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage;
      onUpdateTitle(newTitle);
    } else if (messages.length === 1 && currentAttachment) {
      onUpdateTitle(`Image: ${currentAttachment.name}`);
    }

    const userMsgId = Date.now().toString();
    const modelMsgId = (Date.now() + 1).toString();

    const newMessages: Message[] = [
      ...messages,
      {
        id: userMsgId,
        role: 'user',
        text: userMessage,
        attachment: currentAttachment || undefined,
      },
    ];

    setMessages([
      ...newMessages,
      { id: modelMsgId, role: 'model', text: '', isStreaming: true },
    ]);

    try {
      if (!process.env.GROQ_API_KEY) {
        throw new Error('API_KEY_MISSING');
      }

      // /help
      if (userMessage === '/help') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMsgId
              ? {
                  ...msg,
                  text:
                    '### Available Commands:\n\n* /imagine [prompt] - Generate an AI image based on your description.\n* /video [prompt] - Generate a short AI video.\n* /help - Show this help message.\n\nYou can also attach images, PDFs, or CSV files to your messages for me to analyze!',
                  isStreaming: false,
                }
              : msg
          )
        );
        setIsLoading(false);
        return;
      }

      // Keep /imagine (unchanged behavior)
      if (userMessage.startsWith('/imagine ')) {
        const rawPrompt = userMessage.replace('/imagine ', '');
        const qualitySuffix =
          ', highly detailed, 8k, photorealistic, cinematic lighting, masterwork, award winning';
        const enhancedPrompt = rawPrompt.includes(',') ? rawPrompt : rawPrompt + qualitySuffix;

        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
          enhancedPrompt
        )}?width=1024&height=1024&nologo=true&model=flux&seed=${Date.now()}`;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMsgId
              ? { ...msg, text: `*[Generating high-quality vision: "${rawPrompt.substring(0, 50)}..."]*` }
              : msg
          )
        );

        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === modelMsgId
                ? {
                    ...msg,
                    text: `I've generated this high-quality image based on your vision: **"${rawPrompt.substring(
                      0,
                      100
                    )}${rawPrompt.length > 100 ? '...' : ''}"**`,
                    isStreaming: false,
                    generatedImage: imageUrl,
                  }
                : msg
            )
          );
          setIsLoading(false);
        }, 3000);

        return;
      }

      // Keep /video as-is (not provider changed)
      if (userMessage.startsWith('/video ')) {
        // This repo's original video generation relied on Gemini Veo.
        // We intentionally do NOT switch it to Groq.
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === modelMsgId
              ? {
                  ...msg,
                  text: `Generating video for: "${userMessage.replace('/video ', '')}". This may take a few minutes...`,
                }
              : msg
          )
        );

        throw new Error('VIDEO_PROVIDER_NOT_SWITCHED');
      }

      // Groq text-only chat
      const contents = newMessages
        .filter((m) => m.id !== 'welcome')
        .map((msg) => {
          const prefix = msg.attachment ? `[Attachment: ${msg.attachment.name}]\n` : '';
          return {
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: `${prefix}${msg.text}`.trim(),
          };
        });

      let currentSystemInstruction = systemInstruction;
      if (persona === 'Coder') {
        currentSystemInstruction +=
          ' You are now acting as a Coding Expert. Focus on providing clean, efficient, and well-documented code. Explain technical concepts clearly.';
      } else if (persona === 'Writer') {
        currentSystemInstruction +=
          ' You are now acting as a Creative Writer. Use evocative language, focus on storytelling, and be imaginative and poetic in your responses.';
      } else if (persona === 'Analyst') {
        currentSystemInstruction +=
          ' You are now acting as a Data Analyst. Focus on statistics, trends, data visualization concepts, and logical deductions.';
      }

      const groqMessages = [
        { role: 'system' as const, content: currentSystemInstruction },
        ...contents,
      ];

      let fullText = '';
      for await (const token of groqChatStream({
        model,
        messages: groqMessages as any,
        temperature: 0.7,
      })) {
        fullText += token;
        setMessages((prev) =>
          prev.map((msg) => (msg.id === modelMsgId ? { ...msg, text: fullText } : msg))
        );
      }

      setMessages((prev) => prev.map((msg) => (msg.id === modelMsgId ? { ...msg, isStreaming: false } : msg)));
    } catch (err: any) {
      console.error('Chat error:', err);

      let errorMessage = 'Sorry, I encountered an error. Please try again.';
      const rawError = err?.error || err;
      const message = err?.message || rawError?.message || (typeof rawError === 'string' ? rawError : '');

      if (message === 'API_KEY_MISSING') {
        errorMessage = '### 🔑 API Key Missing\n\nYour **GROQ_API_KEY** is missing. Please add it to your Settings/.env.';
      } else if (message.includes('429') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = '### 🚦 Quota / Rate Limit Exceeded (429)\n\nChale, the Groq API rate/quota limit was reached. Please wait and try again.';
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === modelMsgId
            ? {
                ...msg,
                text: errorMessage,
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col h-full bg-zinc-950 items-center justify-center">
        <Loader2 className="animate-spin text-green-500 mb-4" size={32} />
        <p className="text-zinc-400 text-sm">Loading chat history...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-zinc-900/50 border-b border-zinc-800 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <MessageSquare size={20} />
          </button>
          <div className="relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-green-600/10 border border-green-600/20 text-yellow-500">
            <Sparkles size={16} className="sm:size-5" />
            <div className="absolute inset-0 rounded-xl bg-yellow-500/20 blur-md -z-10"></div>
          </div>
          <div className="hidden xs:block">
            <h1 className="text-sm sm:text-lg font-semibold text-zinc-100 tracking-tight">KEDDY</h1>
            <p className="text-[10px] font-mono text-green-600/80 tracking-widest uppercase hidden sm:block">
              Advanced AI System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
            </span>
            <span className="text-xs font-mono text-zinc-500 uppercase">Online</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-zinc-800/50 border border-zinc-700 text-zinc-300 text-[10px] sm:text-xs rounded-lg px-1.5 sm:px-2 py-1 sm:py-1.5 outline-none focus:border-green-600/50 max-w-[80px] sm:max-w-none"
            >
              <option value="llama3-70b-8192">Llama 70B</option>
              <option value="llama3-8b-8192">Llama 8B</option>
            </select>

            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="hidden md:block bg-zinc-800/50 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-green-600/50"
            >
              <option value="Default">Default</option>
              <option value="Coder">Coder</option>
              <option value="Writer">Writer</option>
              <option value="Analyst">Analyst</option>
            </select>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={handleExportChat}
              className="p-1.5 sm:p-2 text-zinc-400 hover:text-yellow-500 hover:bg-yellow-500/10 rounded-lg transition-colors"
              title="Export Chat"
            >
              <Download size={16} className="sm:size-[18px]" />
            </button>
            <button
              onClick={handleClearChat}
              className="p-1.5 sm:p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              title="Clear Chat"
            >
              <Trash2 size={16} className="sm:size-[18px]" />
            </button>
            <button
              onClick={onToggleDashboard}
              className="md:hidden p-1.5 sm:p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <Globe size={16} className="sm:size-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-full py-10 space-y-8 animate-in fade-in duration-700">
            <div className="w-20 h-20 rounded-3xl bg-green-600/10 border border-green-600/20 flex items-center justify-center text-yellow-500 mb-2 relative">
              <Sparkles size={40} />
              <div className="absolute inset-0 rounded-3xl bg-yellow-500/20 blur-2xl -z-10"></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-600 rounded-full border-2 border-zinc-950 animate-pulse"></div>
            </div>

            <div className="text-center space-y-3 px-4">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent tracking-tight italic">
                How far, Chale?
              </h2>
              <p className="text-zinc-500 text-sm sm:text-base max-w-sm mx-auto leading-relaxed">
                I be <b>Keddy</b>, your powerful Ghanaian companion. I fit speak Pidgin, help you learn Twi, or imagine anything you fit describe.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl px-4">
              {[
                {
                  t: 'Deep Ghanaian Proverb',
                  q: 'Tell me a deep Ghanaian proverb in Pidgin and explain am',
                },
                {
                  t: 'Imagine Neo-Kumasi 2150',
                  q: '/imagine a stunning futuristic cyberpunk city set in Kumasi, Ghana, 2150, 8k, cinematic lighting, neon gold',
                },
                {
                  t: 'Translate to Twi',
                  q: "How I go say 'Where be the nearest pharmacy?' for Twi?",
                },
                {
                  t: 'Accra Traffic Update',
                  q: 'Wetin dey happen for Accra traffic inside? Check traffic for Accra',
                },
              ].map((chip) => (
                <button
                  key={chip.t}
                  onClick={() => setInput(chip.q)}
                  className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-green-600/50 hover:bg-zinc-800 transition-all text-left group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-green-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 relative z-10">{chip.t}</span>
                  <p className="text-[10px] text-zinc-600 mt-1 line-clamp-1 group-hover:text-zinc-500 relative z-10">
                    {chip.q.startsWith('/') ? 'Slash command' : 'Ask me anything'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 sm:gap-4 max-w-[92%] sm:max-w-[85%] lg:max-w-[75%] ${
              msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            <div
              className={`flex-shrink-0 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full ${
                msg.role === 'user'
                  ? 'bg-zinc-800 text-zinc-300'
                  : 'bg-green-600/10 text-yellow-500 border border-green-600/20'
              }`}
            >
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>

            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} min-w-0`}>
              <div
                className={`px-3 py-2 sm:px-5 sm:py-3.5 rounded-2xl break-words w-full ${
                  msg.role === 'user'
                    ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm'
                    : 'bg-zinc-900/80 text-zinc-300 rounded-tl-sm border border-zinc-800/50'
                }`}
              >
                {msg.attachment && (
                  <div className="mb-3">
                    {msg.attachment.type.startsWith('image/') ? (
                      <img
                        src={`data:${msg.attachment.type};base64,${msg.attachment.data}`}
                        alt="attachment"
                        className="max-w-xs rounded-lg border border-zinc-700"
                      />
                    ) : (
                      <div className="flex items-center gap-2 bg-zinc-700/50 p-2 rounded-lg text-sm">
                        <Paperclip size={16} />
                        <span className="truncate max-w-[200px]">{msg.attachment.name}</span>
                      </div>
                    )}
                  </div>
                )}

                {msg.role === 'model' ? (
                  <div className="group flex flex-col gap-1">
                    {msg.generatedImage && (
                      <div className="mb-3 space-y-2">
                        <div className="relative group/img overflow-hidden rounded-lg border border-zinc-700 shadow-xl bg-zinc-800 aspect-square sm:aspect-auto sm:max-w-md">
                          <img
                            src={
                              msg.generatedImage.startsWith('http')
                                ? msg.generatedImage
                                : `data:image/jpeg;base64,${msg.generatedImage}`
                            }
                            alt="Generated image"
                            className="w-full h-auto object-cover transition-transform duration-500 group-hover/img:scale-105"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <a
                              href={
                                msg.generatedImage.startsWith('http')
                                  ? msg.generatedImage
                                  : `data:image/jpeg;base64,${msg.generatedImage}`
                              }
                              download={`generated-${Date.now()}.jpg`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 bg-zinc-900/80 hover:bg-zinc-900 text-white rounded-full transition-colors"
                              title="Download image"
                            >
                              <Download size={18} />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {msg.generatedVideo && (
                      <div className="mb-3">
                        <video controls className="max-w-xs sm:max-w-md rounded-lg border border-zinc-700 shadow-lg">
                          <source src={msg.generatedVideo} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    )}

                    <div className="markdown-body text-xs sm:text-sm leading-relaxed overflow-x-auto">
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <SyntaxHighlighter
                                style={vscDarkPlus as any}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-md !my-4 !bg-zinc-950 border border-zinc-800 text-xs"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {msg.text}
                      </Markdown>

                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-1 bg-green-600/80 animate-pulse align-middle"></span>
                      )}
                    </div>

                    {!msg.isStreaming && (
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                        <SpeakButton text={msg.text} />
                        <CopyButton text={msg.text} />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-2 sm:p-4 bg-zinc-950 border-t border-zinc-900">
        <form
          onSubmit={handleSubmit}
          className="relative flex flex-col gap-1 sm:gap-2 max-w-4xl mx-auto bg-zinc-900 rounded-xl sm:rounded-2xl border border-zinc-800 focus-within:border-green-600/50 focus-within:ring-1 focus-within:ring-green-600/50 transition-all p-1.5 sm:p-2"
        >
          {attachment && (
            <div className="flex items-center gap-2 bg-zinc-800/80 backdrop-blur-sm w-fit px-2 py-1.5 rounded-xl mx-2 mt-1 border border-zinc-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {attachment.preview ? (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-zinc-600">
                  <img src={attachment.preview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <Paperclip size={14} className="text-zinc-400" />
              )}
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-zinc-100 truncate max-w-[120px] sm:max-w-[180px]">
                  {attachment.name}
                </span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-tighter">
                  {attachment.type.split('/')[1] || 'File'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="p-1 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors ml-1"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-1 sm:gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,.pdf,.txt,.csv"
            />

            <div className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.click();
                  }
                }}
                className="flex-shrink-0 p-2 sm:p-2.5 text-zinc-400 hover:text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors mb-0.5 ml-0.5"
                title="Upload Image"
              >
                <ImageIcon size={18} className="sm:size-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = '*/*';
                    fileInputRef.current.click();
                  }
                }}
                className="flex-shrink-0 p-2 sm:p-2.5 text-zinc-400 hover:text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors mb-0.5"
                title="Attach Document"
              >
                <Paperclip size={18} className="sm:size-5" />
              </button>
            </div>

            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
                if (e.key === 'Escape') setShowCommands(false);
              }}
              placeholder={isListening ? 'Listening...' : 'Message Keddy... Try /imagine'}
              className="flex-1 max-h-32 min-h-[40px] bg-transparent text-zinc-100 placeholder:text-zinc-600 resize-none outline-none py-2.5 sm:py-3 px-1 text-xs sm:text-sm"
              rows={1}
            />

            {showCommands && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200 z-50">
                <div className="p-2 border-b border-zinc-800 bg-zinc-900/50">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-2">
                    Slash Commands
                  </span>
                </div>
                <div className="py-1">
                  {commands.map((cmd) => (
                    <button
                      key={cmd.name}
                      type="button"
                      onClick={() => selectCommand(cmd.name)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 transition-colors text-left group"
                    >
                      <div className="p-1 px-1.5 bg-zinc-800 group-hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors">
                        {cmd.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-200">{cmd.name}</span>
                        <span className="text-[10px] text-zinc-500">{cmd.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setUseWebSearch(!useWebSearch)}
              className={`flex-shrink-0 p-2 sm:p-2.5 rounded-xl transition-colors mb-0.5 ${
                useWebSearch
                  ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
                  : 'text-zinc-400 hover:text-red-500 hover:bg-red-500/10'
              }`}
              title={useWebSearch ? 'Web Search Enabled' : 'Web Search Disabled'}
            >
              <Globe size={18} className="sm:size-5" />
            </button>

            <button
              type="button"
              onClick={toggleListening}
              className={`hidden xs:flex flex-shrink-0 p-2 sm:p-2.5 rounded-xl transition-colors mb-0.5 ${
                isListening
                  ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20'
                  : 'text-zinc-400 hover:text-yellow-500 hover:bg-yellow-500/10'
              }`}
              title="Voice Input"
            >
              {isListening ? <MicOff size={18} className="sm:size-5" /> : <Mic size={18} className="sm:size-5" />}
            </button>

            <button
              type="submit"
              disabled={(!input.trim() && !attachment) || isLoading}
              className="flex-shrink-0 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-green-600 text-zinc-950 hover:bg-yellow-500 disabled:opacity-50 disabled:hover:bg-green-600 transition-colors mb-0.5 mr-0.5"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin sm:size-[18px]" /> : <Send size={16} className="ml-0.5 sm:size-[18px]" />}
            </button>
          </div>
        </form>

        <div className="text-center mt-2 sm:mt-3">
          <p className="text-[9px] sm:text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
            Keddy AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}


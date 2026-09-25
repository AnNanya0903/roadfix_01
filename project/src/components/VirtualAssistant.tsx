import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Bot,
  Map as MapIcon,
  FileText,
  ChevronRight,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions?: { label: string; route: string }[];
}

interface QuickReply {
  label: string;
  query: string;
}

const QUICK_REPLIES: QuickReply[] = [
  { label: 'How do I report a road issue?', query: 'How do I report a road issue?' },
  { label: 'What is AI grievance drafting?', query: 'What is AI grievance drafting?' },
  { label: 'Where can I see all reports?', query: 'Where can I see all reports?' },
  { label: 'How do I file on CPGRAMS?', query: 'How do I file on CPGRAMS?' },
  { label: 'What types of issues can I report?', query: 'What types of issues can I report?' },
  { label: 'How do upvotes work?', query: 'How do upvotes work?' },
];

function generateResponse(query: string): Message {
  const q = query.toLowerCase();
  const id = crypto.randomUUID();

  if (q.includes('report') && (q.includes('how') || q.includes('create') || q.includes('submit') || q.includes('file'))) {
    return {
      id,
      role: 'assistant',
      text: "Reporting a road issue is easy! Here's how:\n\n1. Click \"Report\" in the top navigation\n2. Select the issue type (pothole, waterlogging, etc.)\n3. Upload a photo if you have one\n4. Describe the issue in detail\n5. Mark the location on the map\n6. Click \"Generate AI Draft\" to create a formal grievance letter\n7. Submit the report\n\nThe whole process takes under 2 minutes!",
      actions: [{ label: 'Go to Report Form', route: '/report' }],
    };
  }

  if (q.includes('ai') || q.includes('draft') || q.includes('grievance') || q.includes('letter')) {
    return {
      id,
      role: 'assistant',
      text: "Our AI-powered grievance drafting feature:\n\n• Automatically classifies your complaint by severity (low/medium/high)\n• Suggests the appropriate government department (State PWD, Municipal Corporation, etc.)\n• Writes a formal grievance letter ready for submission\n\nJust describe the issue in plain words, and the AI transforms it into a professional letter you can copy and submit on official portals like CPGRAMS.",
      actions: [{ label: 'Try AI Drafting', route: '/report' }],
    };
  }

  if (q.includes('cpgrams') || q.includes('portal') || q.includes('official') || q.includes('government')) {
    return {
      id,
      role: 'assistant',
      text: "Filing on CPGRAMS (Centralized Public Grievance Redress and Monitoring System):\n\n1. After generating your AI draft, click \"Copy\" on the grievance letter\n2. Visit pgportal.gov.in and create/login to your account\n3. Select the relevant ministry or department\n4. Paste the AI-drafted letter into the grievance description\n5. Submit and note the reference number\n6. Come back to RoadFix and add the reference number to your report to track progress\n\nYou can also file on your state's PWD portal following the same steps.",
      actions: [{ label: 'Visit CPGRAMS', route: 'https://pgportal.gov.in' }],
    };
  }

  if (q.includes('dashboard') || q.includes('map') || q.includes('view') || q.includes('see') || q.includes('browse')) {
    return {
      id,
      role: 'assistant',
      text: "The Dashboard shows all reported road issues on an interactive map and list. You can:\n\n• Filter by category, status, or search by keyword\n• Switch between split, list, and map views\n• Click any report to see full details\n• Upvote issues that affect you\n\nAll reports are public — no account needed to browse!",
      actions: [{ label: 'Open Dashboard', route: '/dashboard' }],
    };
  }

  if (q.includes('upvote') || q.includes('vote')) {
    return {
      id,
      role: 'assistant',
      text: "Upvoting helps prioritize the most impactful issues:\n\n• Click the upvote arrow on any report card\n• Each browser gets one vote per report (you can undo by clicking again)\n• Reports with more upvotes get more visibility on the dashboard\n• Upvoting is anonymous — no account needed\n\nUpvote issues that affect you or your community to help them get attention!",
    };
  }

  if (q.includes('type') || q.includes('category') || q.includes('categories') || q.includes('kind') || q.includes('what can i report')) {
    return {
      id,
      role: 'assistant',
      text: "You can report six types of road issues:\n\n• Pothole — a hole or depression in the road surface\n• Broken Road — damaged or crumbling road surface\n• Waterlogging — flooding or water accumulation on roads\n• Road Signage — missing, damaged, or faded road signs\n• Streetlight — broken or non-functional streetlights\n• Other — any other road infrastructure problem\n\nChoose the closest match — the AI will handle the rest!",
    };
  }

  if (q.includes('track') || q.includes('status') || q.includes('resolve') || q.includes('progress')) {
    return {
      id,
      role: 'assistant',
      text: "Tracking your report's progress:\n\nEvery report has a status that moves through three stages:\n\n1. \"Submitted Locally\" — reported on RoadFix\n2. \"Filed on Portal\" — you've submitted it on CPGRAMS or state PWD and added the reference number\n3. \"Resolved\" — the issue has been fixed\n\nYou can update the status anytime from the report's detail page. Adding a grievance reference number automatically marks it as \"Filed on Portal.\"",
      actions: [{ label: 'View Dashboard', route: '/dashboard' }],
    };
  }

  if (q.includes('photo') || q.includes('upload') || q.includes('image') || q.includes('picture')) {
    return {
      id,
      role: 'assistant',
      text: "Adding a photo to your report is optional but highly recommended!\n\n• Photos help authorities understand the severity of the issue\n• You can upload JPG or PNG files up to 10 MB\n• On mobile, you can take a photo directly from the camera\n• Photos appear on the dashboard and report detail page for everyone to see",
      actions: [{ label: 'Upload a Photo', route: '/report' }],
    };
  }

  if (q.includes('location') || q.includes('map') || q.includes('pin') || q.includes('where') || q.includes('gps')) {
    return {
      id,
      role: 'assistant',
      text: "Marking the location of a road issue:\n\nOn the report form, you have three ways to set the location:\n\n1. Search — type an address or landmark and press Search\n2. Click on the map — drop a pin at the exact spot\n3. Use my current location — uses your device's GPS\n\nThe more precise the location, the easier it is for authorities to find and fix the issue!",
      actions: [{ label: 'Report an Issue', route: '/report' }],
    };
  }

  if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q.includes('start') || q.includes('help')) {
    return {
      id,
      role: 'assistant',
      text: "Hi! I'm your RoadFix assistant. I can help you:\n\n• Report a road issue\n• Understand AI grievance drafting\n• Navigate the dashboard\n• Learn how to file on CPGRAMS\n• Track your report's progress\n\nWhat would you like to know?",
    };
  }

  return {
    id,
    role: 'assistant',
    text: "I'm here to help with RoadFix! I can assist with:\n\n• How to report road issues\n• AI grievance letter drafting\n• Filing complaints on CPGRAMS\n• Using the dashboard and map\n• Upvoting and tracking reports\n\nTry one of the quick questions below, or ask me anything about the platform.",
  };
}

export default function VirtualAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: "Hi! I'm your RoadFix assistant. I can help you report road issues, understand AI grievance drafting, file on CPGRAMS, and more. What can I help you with?",
        },
      ]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setHasInteracted(true);
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
    };
    const response = generateResponse(trimmed);
    setMessages((prev) => [...prev, userMsg, response]);
    setInput('');
  }, []);

  const handleAction = (route: string) => {
    if (route.startsWith('http')) {
      window.open(route, '_blank', 'noopener,noreferrer');
    } else {
      navigate(route);
      setOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2.5 pl-4 pr-5 py-3.5 rounded-full bg-teal-600 text-white shadow-xl hover:bg-teal-700 hover:shadow-2xl transition-all duration-300 group animate-fade-in-scale"
          aria-label="Open assistant"
        >
          <div className="relative">
            <MessageCircle className="w-5 h-5" />
            {!hasInteracted && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-teal-600 animate-pulse" />
            )}
          </div>
          <span className="text-sm font-semibold">Ask Assistant</span>
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 sm:w-[400px] sm:h-[560px] w-full h-[100vh] sm:rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in-scale sm:max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">RoadFix Assistant</p>
                <p className="text-xs text-teal-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full" />
                  Online · Ready to help
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Close assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/50"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-teal-600" />
                      </div>
                      <span className="text-xs font-medium text-slate-500">Assistant</span>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-teal-600 text-white rounded-br-md'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {msg.actions.map((action) => (
                        <button
                          key={action.label + action.route}
                          onClick={() => handleAction(action.route)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-sm font-medium transition-colors w-full justify-between group"
                        >
                          <span className="flex items-center gap-1.5">
                            {action.route === '/dashboard' && <MapIcon className="w-4 h-4" />}
                            {action.route === '/report' && <FileText className="w-4 h-4" />}
                            {action.route.startsWith('http') && <ChevronRight className="w-4 h-4" />}
                            {action.label}
                          </span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Quick Replies */}
            {messages.length <= 2 && !hasInteracted && (
              <div className="pt-2">
                <p className="text-xs text-slate-400 mb-2 px-1">Quick questions:</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr.label}
                      onClick={() => handleSend(qr.query)}
                      className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50/30 transition-all"
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-3 bg-white border-t border-slate-200">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question…"
                className="flex-1 px-4 py-2.5 rounded-full bg-slate-100 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:bg-white focus:border-teal-500 border border-transparent transition-all"
              />
              <button
                onClick={() => handleSend(input)}
                disabled={!input.trim()}
                className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

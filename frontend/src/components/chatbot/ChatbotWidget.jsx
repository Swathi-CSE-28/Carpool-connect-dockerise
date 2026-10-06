import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { chatbotService } from '../../services/chatbotService';

export default function ChatbotWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ from: 'bot', text: t('chatbot.greeting'), suggestions: ['How do I book a ride?', 'What is the SOS button?', 'How does Eco Impact work?'] }]);
    }
  }, [open, messages.length, t]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = useCallback(
    async (text) => {
      const trimmed = (text ?? input).trim();
      if (!trimmed || sending) return;
      setMessages((prev) => [...prev, { from: 'user', text: trimmed }]);
      setInput('');
      setSending(true);
      try {
        const data = await chatbotService.sendMessage(trimmed);
        setMessages((prev) => [...prev, { from: 'bot', text: data.reply, suggestions: data.suggestions }]);
      } catch {
        setMessages((prev) => [...prev, { from: 'bot', text: "Sorry, I couldn't reach the assistant service. Please try again." }]);
      } finally {
        setSending(false);
      }
    },
    [input, sending]
  );

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
          <div className="flex items-center justify-between bg-gradient-to-r from-brand-600 to-accent-cyan px-4 py-3 text-white">
            <span className="flex items-center gap-2 font-semibold">
              <Bot className="h-4.5 w-4.5" /> {t('chatbot.title')}
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close chat">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.from === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.from === 'user'
                      ? 'bg-brand-600 text-white rounded-br-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
                {m.suggestions?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-full border border-brand-200 dark:border-brand-800 px-2.5 py-1 text-xs text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && <div className="text-xs text-slate-400">Typing...</div>}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-slate-200 dark:border-slate-800 p-2"
          >
            <input
              className="input !py-2"
              placeholder={t('chatbot.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="btn-primary !px-3 !py-2" aria-label={t('chatbot.send')} disabled={sending}>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-cyan text-white shadow-card transition hover:opacity-90"
        aria-label="Open chat assistant"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}

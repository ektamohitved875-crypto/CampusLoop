import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Flag, Send } from 'lucide-react';
import { CustomerLayout } from '../components/CustomerLayout';
import { useAuth } from '../lib/authContext';
import {
  formatTimestamp,
  markConversationRead,
  sendMessageToConversation,
  submitReport,
  subscribeConversationMessages,
  subscribeUserConversations,
} from '../lib/firestoreService';
import type { ChatMessage, Conversation } from '../types/campusloop';

export function MessagesPage() {
  const { firebaseUser, userRecord } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>(searchParams.get('thread') || '');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeUserConversations(firebaseUser.uid, (items) => {
      setConversations(items);
      if (!selectedId && items.length > 0) {
        setSelectedId(items[0].conversationId);
      }
    });
    return () => unsub();
  }, [firebaseUser, selectedId]);

  const activeConv = conversations.find((c) => c.conversationId === selectedId) || null;

  useEffect(() => {
    if (!activeConv || !firebaseUser) {
      setMessages([]);
      return;
    }
    const isBuyer = activeConv.buyerId === firebaseUser.uid;
    if ((isBuyer && activeConv.unreadByBuyer) || (!isBuyer && activeConv.unreadBySeller)) {
      void markConversationRead(activeConv.conversationId, isBuyer);
    }
    const unsub = subscribeConversationMessages(activeConv.conversationId, setMessages);
    return () => unsub();
  }, [activeConv?.conversationId, firebaseUser]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !activeConv || !draft.trim()) return;
    setSending(true);
    setErrorMsg(null);
    const isBuyer = activeConv.buyerId === firebaseUser.uid;
    const recipientId = isBuyer ? activeConv.sellerId : activeConv.buyerId;

    try {
      await sendMessageToConversation({
        conversationId: activeConv.conversationId,
        senderId: firebaseUser.uid,
        senderName: userRecord?.name || firebaseUser.displayName || 'Student',
        recipientId,
        isBuyerSender: isBuyer,
        text: draft,
        listingTitle: activeConv.listingTitle,
      });
      setDraft('');
    } catch {
      setErrorMsg('Cloud save failed. Please retry.');
    } finally {
      setSending(false);
    }
  };

  const handleReportConversation = async () => {
    if (!firebaseUser || !activeConv) return;
    try {
      await submitReport({
        reporterId: firebaseUser.uid,
        reporterName: userRecord?.name || firebaseUser.displayName || 'Student',
        targetType: 'conversation',
        targetId: activeConv.conversationId,
        targetTitle: `Chat: ${activeConv.listingTitle}`,
        reason: 'Inappropriate or suspicious conversation',
        details: 'Reported directly from in-app messaging thread for admin moderation review.',
      });
      setReportNotice('Conversation flagged for administrator moderation review.');
    } catch {
      setErrorMsg('Cloud save failed. Please retry.');
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-display font-bold text-slate-900 mb-6">Messages</h1>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[560px]">
          {/* Threads List */}
          <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No active chats yet. Open any listing and click &ldquo;Message Seller&rdquo; to start a conversation.
              </div>
            ) : (
              conversations.map((conv) => {
                const isBuyer = conv.buyerId === firebaseUser?.uid;
                const unread = isBuyer ? conv.unreadByBuyer : conv.unreadBySeller;
                const peerName = isBuyer ? conv.sellerName : conv.buyerName;
                const selected = conv.conversationId === activeConv?.conversationId;
                return (
                  <button
                    key={conv.conversationId}
                    type="button"
                    onClick={() => {
                      setSelectedId(conv.conversationId);
                      setSearchParams({ thread: conv.conversationId });
                      setReportNotice(null);
                    }}
                    className={`w-full text-left p-4 transition-colors cursor-pointer ${
                      selected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {peerName || 'CampusLoop Student'}
                      </span>
                      {unread && (
                        <span className="text-[11px] font-semibold text-teal-700 shrink-0">
                          Unread
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-teal-800 truncate mt-0.5">
                      {conv.listingTitle}
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-1">{conv.lastMessage}</p>
                  </button>
                );
              })
            )}
          </aside>

          {/* Active Chat Panel */}
          <section className="lg:col-span-8 flex flex-col">
            {!activeConv ? (
              <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-500">
                Select a conversation to view messages.
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {activeConv.buyerId === firebaseUser?.uid
                        ? activeConv.sellerName
                        : activeConv.buyerName}
                    </p>
                    <Link
                      to={`/listing/${activeConv.listingId}`}
                      className="text-xs text-teal-700 hover:underline truncate block"
                    >
                      Listing: {activeConv.listingTitle}
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={handleReportConversation}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:text-red-700 hover:border-red-200 cursor-pointer shrink-0"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Report Chat
                  </button>
                </div>

                {reportNotice && (
                  <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
                    {reportNotice}
                  </div>
                )}

                <div className="flex-1 p-6 space-y-3 overflow-y-auto max-h-[400px] bg-slate-50/50">
                  {messages.map((msg) => {
                    const isMine = msg.senderId === firebaseUser?.uid;
                    return (
                      <div
                        key={msg.messageId}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            isMine
                              ? 'bg-[#0B192C] text-white'
                              : 'bg-white border border-slate-200 text-slate-900'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                          {msg.senderName} · {formatTimestamp(msg.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {errorMsg && (
                  <div className="px-6 py-2 bg-red-50 text-xs text-red-700">{errorMsg}</div>
                )}

                <form
                  onSubmit={handleSend}
                  className="p-4 border-t border-slate-200 bg-white flex items-center gap-3"
                >
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a message about pickup, rental dates, or condition..."
                    className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-600 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </CustomerLayout>
  );
}

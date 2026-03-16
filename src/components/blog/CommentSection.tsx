'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Loader2, LogIn, ChevronDown } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import type { BlogComment } from '../../types/WordPress';

interface CommentSectionProps {
  postId: number;
  onAuthClick: () => void;
}

const CommentSection = ({ postId, onAuthClick }: CommentSectionProps) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.user);

  const [comments, setComments] = useState<BlogComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const fetchComments = useCallback(async (pageNum: number, append = false) => {
    try {
      if (append) setLoadingMore(true); else setLoading(true);

      const res = await fetch(`/api/comments?post_id=${postId}&page=${pageNum}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok) {
        setComments(prev => append ? [...prev, ...data.comments] : data.comments);
        setTotal(data.total);
        setTotalPages(data.pages);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments(1);
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = content.trim();
    if (trimmed.length < 2) {
      setError('Yorum en az 2 karakter olmalı');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ post_id: postId, content: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Yorum gönderilemedi');
        return;
      }

      // Prepend the new comment
      setComments(prev => [data.comment, ...prev]);
      setTotal(prev => prev + 1);
      setContent('');
    } catch {
      setError('Bir hata oluştu');
    } finally {
      setSubmitting(false);
    }
  };

  const loadMore = () => {
    if (page < totalPages) {
      const next = page + 1;
      setPage(next);
      fetchComments(next, true);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <section className="mt-10 border-t border-gray-200 pt-8">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-brand-soft-blue mb-6">
        <MessageSquare size={22} />
        Yorumlar {total > 0 && <span className="text-sm font-normal text-gray-500">({total})</span>}
      </h2>

      {/* Comment Form or Auth Prompt */}
      {isAuthenticated && user ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-orange text-white flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Yorumunuzu yazın..."
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-colors"
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{content.length}/2000</span>
                <button
                  type="submit"
                  disabled={submitting || content.trim().length < 2}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-orange text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Gönder
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8 bg-gray-50 rounded-xl p-5 text-center">
          <p className="text-sm text-gray-600 mb-3">Yorum yapmak için giriş yapın veya üye olun</p>
          <button
            onClick={onAuthClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-orange text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            <LogIn size={16} />
            Giriş Yap / Üye Ol
          </button>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">Henüz yorum yapılmamış. İlk yorumu siz yazın!</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-3">
              {comment.avatar_url ? (
                <img
                  src={comment.avatar_url}
                  alt=""
                  className="w-9 h-9 rounded-full flex-shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {comment.author?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-900">{comment.author}</span>
                  <span className="text-xs text-gray-400">{formatDate(comment.date)}</span>
                </div>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-line break-words">{comment.content}</p>
              </div>
            </div>
          ))}

          {/* Load more */}
          {page < totalPages && (
            <div className="text-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-1 text-sm text-brand-orange hover:text-orange-600 font-medium transition-colors"
              >
                {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                Daha fazla yorum
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default CommentSection;

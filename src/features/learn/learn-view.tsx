'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Search, Clock, ArrowLeft, ArrowRight, X, PhoneCall } from 'lucide-react';
import { Surface } from '@/components/ui/surface';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/state';
import { ARTICLES, ARTICLE_TOPICS, DEFAULT_ARTICLE_ID, type ArticleTopic } from '@/lib/learn/articles';
import { searchArticles, type ArticleSearchDoc } from '@/lib/learn/search';
import { cn } from '@/lib/utils/cn';

type TopicFilter = ArticleTopic | 'all';

function isTopic(id: string, value: ArticleTopic): boolean {
  return ARTICLES.find((a) => a.id === id)?.topic === value;
}

export const LearnView: React.FC = () => {
  const t = useTranslations('learn');

  const [query, setQuery] = React.useState('');
  const [topic, setTopic] = React.useState<TopicFilter>('all');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Where focus should return to when the reader is closed.
  const cardRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const listRef = React.useRef<HTMLDivElement>(null);
  const lastOpenedId = React.useRef<string | null>(null);
  const shouldRestoreFocus = React.useRef(false);

  // Localised text for the search index, resolved once per locale.
  const docs = React.useMemo<ArticleSearchDoc[]>(
    () =>
      ARTICLES.map((article) => ({
        id: article.id,
        title: t(`articles.${article.id}.title`),
        summary: t(`articles.${article.id}.summary`),
        body: t(`articles.${article.id}.body`)
          .split('||')
          .map((p) => p.trim())
          .join(' '),
      })),
    [t]
  );

  const docById = React.useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);

  // Deterministic ordering, then narrowed by the active topic.
  const rankedIds = React.useMemo(() => {
    const ordered = searchArticles(docs, query).map((r) => r.id);
    return topic === 'all' ? ordered : ordered.filter((id) => isTopic(id, topic));
  }, [docs, query, topic]);

  const hasQuery = query.trim().length > 0;
  const isFiltering = hasQuery || topic !== 'all';
  const selected = selectedId ? ARTICLES.find((a) => a.id === selectedId) : null;

  function handleResetFilters() {
    setQuery('');
    setTopic('all');
  }

  function handleOpenArticle(id: string) {
    lastOpenedId.current = id;
    setSelectedId(id);
  }

  function handleBack() {
    // The library is unmounted while the reader is open, so the focus can only
    // be handed back once the list is back in the DOM.
    shouldRestoreFocus.current = true;
    setSelectedId(null);
  }

  React.useEffect(() => {
    if (!shouldRestoreFocus.current || selectedId) return;
    shouldRestoreFocus.current = false;

    const previous = lastOpenedId.current;
    const target = previous ? cardRefs.current.get(previous) : undefined;
    if (target) {
      target.focus();
      return;
    }
    // The article was filtered out while it was being read: land on the
    // results list rather than dropping focus back to the browser chrome.
    listRef.current?.focus();
  }, [selectedId, rankedIds]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {!selected && (
        <header>
          <h1 className="text-2xl font-bold text-[#2D1B2D] sm:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-[#5A5A66]">{t('subtitle')}</p>
        </header>
      )}

      {/* ---- Reader ---- */}
      {selected ? (
        <ArticleReader
          articleId={selected.id}
          onBack={handleBack}
          onSelectArticle={handleOpenArticle}
        />
      ) : (
        <>
          {/* ---- Search + filters ---- */}
          <Surface variant="bordered" className="space-y-4 p-4 sm:p-5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5A5A66]"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchLabel')}
                className="pl-12 pr-12"
              />
              {hasQuery && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={t('clearSearch')}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#5A5A66] transition-colors hover:bg-[#F9EBEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label={t('filterLabel')}>
              <button
                type="button"
                onClick={() => setTopic('all')}
                aria-pressed={topic === 'all'}
                className={cn(
                  'min-h-[40px] rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  topic === 'all'
                    ? 'border-[#2D1B2D] bg-[#2D1B2D] text-[#FDFBF7]'
                    : 'border-[#E2D8D0] bg-[#FFFFFF] text-[#1E1E24] hover:bg-[#F9EBEA]'
                )}
              >
                {t('topicAll')}
              </button>
              {ARTICLE_TOPICS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTopic(value)}
                  aria-pressed={topic === value}
                  className={cn(
                    'min-h-[40px] rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                    topic === value
                      ? 'border-[#2D1B2D] bg-[#2D1B2D] text-[#FDFBF7]'
                      : 'border-[#E2D8D0] bg-[#FFFFFF] text-[#1E1E24] hover:bg-[#F9EBEA]'
                  )}
                >
                  {t(`topics.${value}`)}
                </button>
              ))}
            </div>
          </Surface>

          {/* ---- Results ---- */}
          {rankedIds.length === 0 ? (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title={isFiltering ? t('noResultsTitle') : t('emptyTitle')}
              description={isFiltering ? t('noResultsDescription') : t('emptyDescription')}
              action={
                isFiltering ? (
                  <Button variant="outline" onClick={handleResetFilters}>
                    <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {t('clearFilters')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div ref={listRef} tabIndex={-1} className="space-y-3 focus:outline-none">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5A5A66]">
                {isFiltering
                  ? t('resultCount', { count: rankedIds.length })
                  : t('articleCount', { count: rankedIds.length })}
              </p>

              <ul className="space-y-3">
                {rankedIds.map((id) => {
                  const article = ARTICLES.find((a) => a.id === id);
                  const doc = docById.get(id);
                  if (!article || !doc) return null;

                  return (
                    <li key={id}>
                      <button
                        type="button"
                        ref={(node) => {
                          if (node) cardRefs.current.set(id, node);
                          else cardRefs.current.delete(id);
                        }}
                        onClick={() => handleOpenArticle(id)}
                        className="w-full rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-5 text-left transition-colors hover:bg-[#F9EBEA]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="neutral">{t(`topics.${article.topic}`)}</Badge>
                          <span className="inline-flex items-center gap-1 text-xs text-[#5A5A66]">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('readMinutes', { minutes: article.readMinutes })}
                          </span>
                        </div>
                        <h2 className="mb-1.5 text-base font-bold text-[#2D1B2D]">{doc.title}</h2>
                        <p className="text-sm leading-relaxed text-[#5A5A66]">{doc.summary}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface ArticleReaderProps {
  articleId: string;
  onBack: () => void;
  onSelectArticle: (id: string) => void;
}

const ArticleReader: React.FC<ArticleReaderProps> = ({ articleId, onBack, onSelectArticle }) => {
  const t = useTranslations('learn');
  const article =
    ARTICLES.find((a) => a.id === articleId) ??
    ARTICLES.find((a) => a.id === DEFAULT_ARTICLE_ID)!;

  // Opening an article moves the reading position to the top of it.
  const bodyRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    bodyRef.current?.focus();
  }, [articleId]);

  const paragraphs = React.useMemo(
    () =>
      t(`articles.${article.id}.body`)
        .split('||')
        .map((p) => p.trim())
        .filter(Boolean),
    [t, article.id]
  );

  const nextArticle = React.useMemo(() => {
    const index = ARTICLES.findIndex((a) => a.id === article.id);
    if (index < 0 || ARTICLES.length < 2) return null;
    return ARTICLES[(index + 1) % ARTICLES.length];
  }, [article.id]);

  return (
    <article
      ref={bodyRef}
      tabIndex={-1}
      className="mx-auto max-w-3xl space-y-6 focus:outline-none"
    >
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {t('backToLibrary')}
      </Button>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{t(`topics.${article.topic}`)}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-[#5A5A66]">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {t('readMinutes', { minutes: article.readMinutes })}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-[#2D1B2D] sm:text-3xl">
          {t(`articles.${article.id}.title`)}
        </h1>
        <p className="text-sm leading-relaxed text-[#5A5A66]">
          {t(`articles.${article.id}.summary`)}
        </p>
      </header>

      <div className="space-y-4">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="max-w-prose text-sm leading-7 text-[#1E1E24]">
            {paragraph}
          </p>
        ))}
      </div>

      <Surface variant="flat" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C94A46]/10 text-[#C94A46]">
          <PhoneCall className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-[#2D1B2D]">{t('escalationTitle')}</h2>
          <p className="text-xs leading-relaxed text-[#5A5A66]">{t('escalationBody')}</p>
        </div>
      </Surface>

      {nextArticle && (
        <button
          type="button"
          onClick={() => onSelectArticle(nextArticle.id)}
          className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-4 text-left transition-colors hover:bg-[#F9EBEA]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
        >
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wider text-[#5A5A66]">
              {t('nextArticle')}
            </span>
            <span className="mt-1 block text-sm font-semibold text-[#2D1B2D]">
              {t(`articles.${nextArticle.id}.title`)}
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-[#2D1B2D]" aria-hidden="true" />
        </button>
      )}

      <div className="flex items-center gap-2 text-xs text-[#5A5A66]">
        <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t('offlineNote')}</span>
      </div>
    </article>
  );
};

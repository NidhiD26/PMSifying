'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { BookOpen, Search, Clock, ArrowLeft, X, PhoneCall } from 'lucide-react';
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

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-[#2D1B2D]">{t('title')}</h1>
        <p className="text-sm text-[#5A5A66] mt-1">{t('subtitle')}</p>
      </header>

      {/* ---- Reader ---- */}
      {selected ? (
        <ArticleReader
          articleId={selected.id}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <>
          {/* ---- Search + filters ---- */}
          <Surface variant="bordered" className="p-5 space-y-4">
            <div className="relative">
              <Search
                className="h-5 w-5 text-[#5A5A66] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchLabel')}
                className="pl-12"
              />
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label={t('filterLabel')}>
              <button
                type="button"
                onClick={() => setTopic('all')}
                aria-pressed={topic === 'all'}
                className={cn(
                  'min-h-[40px] px-4 py-1.5 rounded-full border text-sm font-medium transition-colors',
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
                    'min-h-[40px] px-4 py-1.5 rounded-full border text-sm font-medium transition-colors',
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
                    <X className="h-4 w-4 mr-1.5" aria-hidden="true" />
                    {t('clearFilters')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
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
                        onClick={() => setSelectedId(id)}
                        className="w-full text-left rounded-2xl border border-[#E2D8D0] bg-[#FFFFFF] p-5 hover:bg-[#F9EBEA]/40 transition-colors focus-visible:outline-none"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge variant="neutral">{t(`topics.${article.topic}`)}</Badge>
                          <span className="inline-flex items-center gap-1 text-xs text-[#5A5A66]">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            {t('readMinutes', { minutes: article.readMinutes })}
                          </span>
                        </div>
                        <h2 className="text-base font-bold text-[#2D1B2D] mb-1.5">{doc.title}</h2>
                        <p className="text-sm text-[#5A5A66] leading-relaxed">{doc.summary}</p>
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
}

const ArticleReader: React.FC<ArticleReaderProps> = ({ articleId, onBack }) => {
  const t = useTranslations('learn');
  const article = ARTICLES.find((a) => a.id === articleId) ?? ARTICLES.find((a) => a.id === DEFAULT_ARTICLE_ID)!;

  const paragraphs = React.useMemo(
    () =>
      t(`articles.${article.id}.body`)
        .split('||')
        .map((p) => p.trim())
        .filter(Boolean),
    [t, article.id]
  );

  return (
    <article className="space-y-6 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
        <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden="true" />
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
        <h1 className="text-3xl font-bold text-[#2D1B2D]">{t(`articles.${article.id}.title`)}</h1>
        <p className="text-sm text-[#5A5A66] leading-relaxed">{t(`articles.${article.id}.summary`)}</p>
      </header>

      <Surface variant="bordered" className="space-y-4">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-sm text-[#1E1E24] leading-7">
            {paragraph}
          </p>
        ))}
      </Surface>

      <Surface variant="bordered" className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-[#C94A46]/10 flex items-center justify-center text-[#C94A46] shrink-0">
          <PhoneCall className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-[#2D1B2D]">{t('escalationTitle')}</h2>
          <p className="text-xs text-[#5A5A66] leading-relaxed">{t('escalationBody')}</p>
        </div>
      </Surface>

      <div className="flex items-center gap-2 text-xs text-[#5A5A66]">
        <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t('offlineNote')}</span>
      </div>
    </article>
  );
};

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bot,
  BookOpen,
  Database,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingState, ErrorState } from '@/components/ui/state';
import { CycleRepository } from '@/lib/db/repositories/cycle-repository';
import { DailyLogRepository } from '@/lib/db/repositories/daily-log-repository';
import { computeHealthAnalytics } from '@/lib/analytics';
import { getInsights } from '@/lib/insights';
import { ARTICLES } from '@/lib/learn/articles';
import { isValidLocale } from '@/i18n/config';
import {
  CRISIS_RESOURCES,
  buildRedactedContext,
  classifyIntent,
  composeOfflineReply,
  retrieveEducationSources,
  type AssistantReply,
  type AssistantTurn,
  type EducationDoc,
  type EducationSource,
  type RedactedAssistantContext,
} from '@/lib/assistant';
import { cn } from '@/lib/utils/cn';

/**
 * The AI Health Assistant.
 *
 * Design rule: the deterministic answer is always produced locally, first, and
 * unconditionally. The optional gateway is an enhancement applied afterwards.
 * That ordering is what makes the assistant usable with no AI configuration
 * and no network — the screen never waits on a provider to say something useful.
 *
 * The privacy story is shown, not just claimed. The panel near the top states
 * exactly what can be sent, and the figures beside it are the same aggregates
 * the context builder would transmit. A reader can verify the boundary rather
 * than trust it.
 */

type GatewayState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'unavailable' };

const SUGGESTION_KEYS = ['cycle', 'symptoms', 'records', 'articles'] as const;

export const AssistantView: React.FC = () => {
  const t = useTranslations('assistant');
  const tLearn = useTranslations('learn');
  const rawLocale = useLocale();

  const [turns, setTurns] = React.useState<AssistantTurn[]>([]);
  const [draft, setDraft] = React.useState('');
  const [context, setContext] = React.useState<RedactedAssistantContext | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [isThinking, setIsThinking] = React.useState(false);
  const [gateway, setGateway] = React.useState<GatewayState>({ status: 'idle' });
  const transcriptRef = React.useRef<HTMLDivElement>(null);

  const locale = isValidLocale(rawLocale) ? rawLocale : 'en';

  /**
   * The education corpus, resolved in the reader's language.
   *
   * Built from the same `ARTICLES` catalogue and the same translation keys
   * `LearnView` uses, so the assistant can only ever surface an article the
   * reader can also open and read in full.
   */
  const docs = React.useMemo<EducationDoc[]>(
    () =>
      ARTICLES.map((article) => ({
        id: article.id,
        topic: article.topic,
        titleKey: `articles.${article.id}.title`,
        summaryKey: `articles.${article.id}.summary`,
        title: tLearn(`articles.${article.id}.title`),
        summary: tLearn(`articles.${article.id}.summary`),
        body: tLearn(`articles.${article.id}.body`),
      })),
    [tLearn]
  );

  /* ---- Load local records and build the redacted context once ---- */
  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [cycles, dailyLogs] = await Promise.all([
          CycleRepository.getAllCyclesChronological(),
          DailyLogRepository.getAllDailyLogs(),
        ]);
        if (!active) return;

        const today = new Date().toISOString().slice(0, 10);
        const analytics = computeHealthAnalytics({ cycles, dailyLogs, today });
        const insights = getInsights({
          analytics,
          recordedDates: dailyLogs.map((log) => log.date),
          limit: 3,
        });

        setContext(buildRedactedContext({ locale, today, cycles, dailyLogs, insights }));
        setLoadFailed(false);
      } catch {
        if (active) setLoadFailed(true);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [locale]);

  /* ---- Keep the newest turn in view ---- */
  React.useEffect(() => {
    const node = transcriptRef.current;
    // jsdom does not implement Element.scrollTo, and the transcript is
    // decorative there, so the guard keeps tests from tripping over it.
    if (node && typeof node.scrollTo === 'function') {
      node.scrollTo({ top: node.scrollHeight });
    }
  }, [turns, isThinking]);

  const send = React.useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || !context || isThinking) return;

      const turn = turns.length;
      setDraft('');
      setIsThinking(true);

      // Prediction questions are pointed at cycle-basics material so a shared
      // word cannot drag in an unrelated article. Classifying first also keeps
      // the intent available to the composer, which re-derives it independently.
      const intent = classifyIntent(text);
      const sources = retrieveEducationSources(
        docs,
        text,
        intent === 'prediction' ? { topic: 'cycleBasics' } : {}
      );

      const localReply = composeOfflineReply({ text, turn, context, sources });

      const userTurn: AssistantTurn = {
        id: `user-${turn}`,
        role: 'user',
        text,
      };
      const assistantTurn: AssistantTurn = {
        id: localReply.id,
        role: 'assistant',
        text: localReply.messageKey,
        reply: localReply,
      };

      setTurns((previous) => [...previous, userTurn, assistantTurn]);

      // The gateway is an optional upgrade. A refusal is never forwarded, and a
      // failure leaves the local reply exactly as it is.
      if (!localReply.isRefusal) {
        setGateway({ status: 'checking' });
        try {
          const response = await fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, context, sources }),
          });
          const payload = (await response.json()) as {
            ok?: boolean;
            mode?: string;
            text?: string;
          };

          if (payload.ok && payload.mode === 'gateway' && payload.text) {
            const enhanced: AssistantReply = {
              ...localReply,
              source: 'gateway',
              providerText: payload.text,
            };
            setTurns((previous) =>
              previous.map((entry) =>
                entry.id === localReply.id ? { ...entry, reply: enhanced } : entry
              )
            );
            setGateway({ status: 'idle' });
          } else {
            // 200 + mode 'offline' is the expected default, not a failure.
            setGateway({ status: 'unavailable' });
          }
        } catch {
          setGateway({ status: 'unavailable' });
        }
      }

      setIsThinking(false);
    },
    [context, docs, isThinking, turns.length]
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void send(draft);
  };

  const handleClear = () => {
    setTurns([]);
    setDraft('');
    setGateway({ status: 'idle' });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header />
        <LoadingState className="py-16 text-center text-sm text-[#5A5A66]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Header />

      {loadFailed ? (
        <ErrorState message={t('loadError')} onRetry={() => window.location.reload()} />
      ) : (
        <>
          {/* ---- What this assistant is, and is not ---- */}
          <Surface variant="bordered" className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-xl bg-[#2E8B57]/10 flex items-center justify-center text-[#2E8B57] shrink-0">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-[#2D1B2D]">{t('disclaimerTitle')}</h2>
                <p className="text-sm text-[#5A5A66] leading-relaxed">{t('disclaimerBody')}</p>
              </div>
            </div>
          </Surface>

          {/* ---- The privacy boundary, stated and verifiable ---- */}
          <ContextPanel context={context} />

          {/* ---- Gateway status: offline is the default, not a fault ---- */}
          {gateway.status === 'unavailable' && (
            <div
              className="flex items-start gap-2 rounded-xl border border-[#E2D8D0] bg-[#F9EBEA]/50 px-4 py-3 text-xs text-[#5A5A66]"
              role="status"
            >
              <WifiOff className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t('fallbackNotice')}</span>
            </div>
          )}

          {/* ---- Conversation ---- */}
          {turns.length === 0 ? (
            <EmptyConversation
              onPick={(key) => void send(t(`suggestions.${key}`))}
            />
          ) : (
            <>
              <div
                ref={transcriptRef}
                role="log"
                aria-live="polite"
                aria-label={t('transcriptLabel')}
                className="space-y-4 max-h-[52vh] overflow-y-auto pr-1"
              >
                {turns.map((turn) =>
                  turn.role === 'user' ? (
                    <UserBubble key={turn.id} text={turn.text} />
                  ) : (
                    <AssistantBubble key={turn.id} reply={turn.reply} />
                  )
                )}

                {isThinking && (
                  <p className="text-sm text-[#5A5A66]" role="status">
                    {t('thinkingLabel')}
                  </p>
                )}
              </div>

              <Button variant="ghost" size="sm" onClick={handleClear} className="self-start">
                <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
                {t('clearAction')}
              </Button>
            </>
          )}

          {/* ---- Composer ---- */}
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <Input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('inputPlaceholder')}
              aria-label={t('inputLabel')}
              label={t('inputLabel')}
              maxLength={500}
              disabled={isThinking}
            />
            <Button type="submit" disabled={draft.trim().length === 0 || isThinking} className="w-full sm:w-auto">
              <Send className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {t('sendAction')}
            </Button>
          </form>
        </>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

const Header: React.FC = () => {
  const t = useTranslations('assistant');
  return (
    <header>
      <h1 className="text-3xl font-bold text-[#2D1B2D]">{t('title')}</h1>
      <p className="text-sm text-[#5A5A66] mt-1">{t('subtitle')}</p>
    </header>
  );
};

/**
 * Shows the exact aggregates the context builder would transmit.
 *
 * Rendering the real figures, rather than a vague assurance, is the point: the
 * reader can see that the boundary carries averages and counts, and carries
 * nothing they typed.
 */
const ContextPanel: React.FC<{ context: RedactedAssistantContext | null }> = ({ context }) => {
  const t = useTranslations('assistant');

  return (
    <Surface variant="bordered" className="p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="h-9 w-9 rounded-xl bg-[#2D1B2D]/5 flex items-center justify-center text-[#2D1B2D] shrink-0">
          <Database className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-[#2D1B2D]">{t('contextTitle')}</h2>
          <p className="text-sm text-[#5A5A66] leading-relaxed">{t('contextBody')}</p>
        </div>
      </div>

      {context && context.recordedCycles + context.recordedDailyLogs > 0 ? (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Fact label={t('factCycles')} value={String(context.recordedCycles)} />
          <Fact label={t('factDays')} value={String(context.daily.recordedDays)} />
          <Fact
            label={t('factAverageCycle')}
            value={
              context.cycle.averageCycleLengthDays !== null
                ? t('daysValue', { days: context.cycle.averageCycleLengthDays })
                : t('notAvailable')
            }
          />
          <Fact
            label={t('factAveragePeriod')}
            value={
              context.cycle.averagePeriodLengthDays !== null
                ? t('daysValue', { days: context.cycle.averagePeriodLengthDays })
                : t('notAvailable')
            }
          />
        </dl>
      ) : (
        <p className="text-sm text-[#5A5A66]">{t('contextEmpty')}</p>
      )}

      <p className="text-xs text-[#5A5A66] leading-relaxed flex items-start gap-1.5">
        <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        {t('contextPrivacyNote')}
      </p>
    </Surface>
  );
};

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-[#F9EBEA]/40 px-3 py-2">
    <dt className="text-[11px] uppercase tracking-wide text-[#5A5A66]">{label}</dt>
    <dd className="text-sm font-bold text-[#2D1B2D] mt-0.5">{value}</dd>
  </div>
);

const EmptyConversation: React.FC<{ onPick: (key: (typeof SUGGESTION_KEYS)[number]) => void }> = ({
  onPick,
}) => {
  const t = useTranslations('assistant');
  return (
    <Surface variant="bordered" className="p-6 space-y-4">
      <div className="space-y-1.5">
        <h2 className="text-base font-bold text-[#2D1B2D]">{t('emptyTitle')}</h2>
        <p className="text-sm text-[#5A5A66] leading-relaxed">{t('emptyDescription')}</p>
      </div>

      <ul className="space-y-2">
        {SUGGESTION_KEYS.map((key) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onPick(key)}
              className="w-full text-left rounded-xl border border-[#E2D8D0] bg-[#FFFFFF] px-4 py-3 text-sm text-[#1E1E24] hover:bg-[#F9EBEA]/40 transition-colors min-h-[48px]"
            >
              {t(`suggestions.${key}`)}
            </button>
          </li>
        ))}
      </ul>

      <Link
        href="/learn"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2D1B2D] underline underline-offset-2 min-h-[40px]"
      >
        <BookOpen className="h-4 w-4" aria-hidden="true" />
        {t('browseLibraryAction')}
      </Link>
    </Surface>
  );
};

const UserBubble: React.FC<{ text: string }> = ({ text }) => {
  const t = useTranslations('assistant');
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#2D1B2D] px-4 py-2.5 text-[#FDFBF7]">
        <span className="sr-only">{t('youLabel')}: </span>
        <p className="text-sm leading-relaxed break-words">{text}</p>
      </div>
    </div>
  );
};

const AssistantBubble: React.FC<{ reply?: AssistantReply }> = ({ reply }) => {
  const t = useTranslations('assistant');

  if (!reply) return null;

  const isCrisis = reply.intent === 'crisis';

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'max-w-[92%] rounded-2xl rounded-bl-sm border px-4 py-3 space-y-3',
          isCrisis
            ? 'border-[#C94A46]/40 bg-[#C94A46]/5'
            : 'border-[#E2D8D0] bg-[#FFFFFF]'
        )}
      >
        <span className="sr-only">{t('assistantLabel')}: </span>

        <div className="flex flex-wrap items-center gap-2">
          <Bot
            className={cn('h-4 w-4', isCrisis ? 'text-[#C94A46]' : 'text-[#2D1B2D]')}
            aria-hidden="true"
          />
          {reply.source === 'gateway' && (
            <Badge variant="neutral">
              <Sparkles className="h-3 w-3 mr-1" aria-hidden="true" />
              {t('enhancedBadge')}
            </Badge>
          )}
        </div>

        <p className="text-sm text-[#1E1E24] leading-relaxed whitespace-pre-line">
          {reply.providerText ?? t(reply.messageKey, reply.params)}
        </p>

        {isCrisis && <CrisisResources />}

        {reply.citations.length > 0 && <Citations sources={reply.citations} />}

        {reply.isRefusal && (
          <p className="text-xs text-[#5A5A66] flex items-start gap-1.5">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            {t('refusalNote')}
          </p>
        )}
      </div>
    </div>
  );
};

const CrisisResources: React.FC = () => {
  const t = useTranslations('assistant');
  return (
    <div className="rounded-xl bg-[#C94A46]/10 p-3 space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[#C94A46]">
        {t('crisisTitle')}
      </h3>
      <ul className="space-y-1.5">
        {CRISIS_RESOURCES.map((resource) => (
          <li key={resource.id} className="text-sm text-[#1E1E24]">
            <span className="font-medium">{t(resource.labelKey)}</span>
            <span className="text-[#5A5A66]"> — </span>
            <a
              href={`tel:${resource.value}`}
              className="font-semibold underline underline-offset-2"
            >
              {resource.value}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Citations: React.FC<{ sources: EducationSource[] }> = ({ sources }) => {
  const t = useTranslations('assistant');
  return (
    <div className="space-y-2 border-t border-[#E2D8D0] pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5A5A66]">
        {t('sourcesHeading')}
      </h3>
      <ul className="space-y-1.5">
        {sources.map((source) => (
          <li key={source.articleId} className="text-sm text-[#1E1E24]">
            <span className="text-[#5A5A66]">{t('sourceFrom')}</span> {source.title}
          </li>
        ))}
      </ul>
    </div>
  );
};

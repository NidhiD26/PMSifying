import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Smartphone, Users, Stethoscope, Lock, CloudOff, FileDown } from 'lucide-react';
import { withLocale } from '@/lib/navigation/locale-path';
import { isValidLocale } from '@/i18n/config';
import { DEFAULT_LOCALE } from '@/types/i18n';

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations('privacy');
  const tNav = await getTranslations('nav');

  const { locale: rawLocale } = await params;
  const locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const settingsHref = withLocale('/settings', locale);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold text-[#2D1B2D]">{t('charterTitle')}</h1>
        <p className="text-sm text-[#5A5A66] mt-1">{t('charterSubtitle')}</p>
      </header>

      {/* ---- The three systems, and what each one does with your data ---- */}
      <section className="space-y-4">
        <BoundaryCard
          icon={<Smartphone className="h-5 w-5" aria-hidden="true" />}
          tone="local"
          title={t('systems.localTitle')}
          summary={t('systems.localSummary')}
          points={[
            t('systems.localPointStorage'),
            t('systems.localPointNoAccount'),
            t('systems.localPointExport'),
          ]}
          action={
            <Link href={settingsHref}>
              <Button variant="outline" size="sm">
                {tNav('settings')}
              </Button>
            </Link>
          }
        />

        <BoundaryCard
          icon={<Users className="h-5 w-5" aria-hidden="true" />}
          tone="community"
          title={t('systems.communityTitle')}
          summary={t('systems.communitySummary')}
          points={[
            t('systems.communityPointAlias'),
            t('systems.communityPointNoLocal'),
            t('systems.communityPointRequiresNetwork'),
          ]}
        />

        <BoundaryCard
          icon={<Stethoscope className="h-5 w-5" aria-hidden="true" />}
          tone="healthcare"
          title={t('systems.healthcareTitle')}
          summary={t('systems.healthcareSummary')}
          points={[
            t('systems.healthcarePointRoleScoped'),
            t('systems.healthcarePointConsent'),
            t('systems.healthcarePointAudit'),
          ]}
        />
      </section>

      {/* ---- What is guaranteed about the personal system ---- */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#2E8B57]/10 flex items-center justify-center text-[#2E8B57] shrink-0">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-[#2D1B2D]">{t('guaranteesTitle')}</h2>
        </div>

        <Surface variant="bordered" className="space-y-4">
          <p className="text-sm text-[#5A5A66] leading-relaxed">{t('localStorageBody')}</p>

          <ul className="space-y-3 pt-2">
            <Guarantee icon={<CloudOff className="h-4 w-4" aria-hidden="true" />}>
              {t('guaranteeNoCloudSync')}
            </Guarantee>
            <Guarantee icon={<Lock className="h-4 w-4" aria-hidden="true" />}>
              {t('guaranteeNoTelemetry')}
            </Guarantee>
            <Guarantee icon={<FileDown className="h-4 w-4" aria-hidden="true" />}>
              {t('guaranteeExport')}
            </Guarantee>
          </ul>
        </Surface>
      </section>

      {/* ---- Honest limits: what a local lock does and does not do ---- */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#2D1B2D]">{t('limitsTitle')}</h2>

        <Surface variant="bordered" className="p-5 space-y-3">
          <h3 className="text-sm font-bold text-[#2D1B2D]">{t('pinLockTitle')}</h3>
          <p className="text-sm text-[#5A5A66] leading-relaxed">{t('pinLockBody')}</p>
          <p className="text-sm text-[#5A5A66] leading-relaxed">{t('pinLockRecoveryBody')}</p>
          <div className="pt-2">
            <Link href={settingsHref}>
              <Button variant="outline" size="sm">
                {t('pinLockAction')}
              </Button>
            </Link>
          </div>
        </Surface>
      </section>

      {/* ---- Separation guarantees between the three systems ---- */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[#2D1B2D]">{t('separationTitle')}</h2>

        <Surface variant="bordered" className="space-y-4">
          <p className="text-sm text-[#5A5A66] leading-relaxed">{t('separationBody')}</p>
          <ul className="space-y-3">
            <Guarantee icon={<Smartphone className="h-4 w-4" aria-hidden="true" />}>
              {t('separationLocalToCommunity')}
            </Guarantee>
            <Guarantee icon={<Users className="h-4 w-4" aria-hidden="true" />}>
              {t('separationCommunityToHealthcare')}
            </Guarantee>
            <Guarantee icon={<Stethoscope className="h-4 w-4" aria-hidden="true" />}>
              {t('separationLocalToHealthcare')}
            </Guarantee>
          </ul>
        </Surface>
      </section>

      <div className="p-3.5 rounded-xl bg-[#F9EBEA]/60 border border-[#E2D8D0] flex items-center gap-2 text-xs text-[#5A5A66]">
        <ShieldCheck className="h-4 w-4 text-[#2E8B57] shrink-0" aria-hidden="true" />
        <span>{t('offlineNotice')}</span>
      </div>
    </div>
  );
}

type BoundaryTone = 'local' | 'community' | 'healthcare';

const TONE_STYLES: Record<BoundaryTone, { chip: string; icon: string }> = {
  local: { chip: 'bg-[#2E8B57]/15 text-[#2E8B57]', icon: 'bg-[#2E8B57]/10 text-[#2E8B57]' },
  community: { chip: 'bg-[#B8860B]/15 text-[#B8860B]', icon: 'bg-[#B8860B]/10 text-[#B8860B]' },
  healthcare: { chip: 'bg-[#C94A46]/15 text-[#C94A46]', icon: 'bg-[#C94A46]/10 text-[#C94A46]' },
};

const BoundaryCard: React.FC<{
  icon: React.ReactNode;
  tone: BoundaryTone;
  title: string;
  summary: string;
  points: string[];
  action?: React.ReactNode;
}> = ({ icon, tone, title, summary, points, action }) => (
  <Surface variant="bordered" className="p-5 space-y-4">
    <div className="flex items-start gap-3">
      <div
        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${TONE_STYLES[tone].icon}`}
      >
        {icon}
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-[#2D1B2D]">{title}</h2>
        <p className="text-sm text-[#5A5A66] leading-relaxed">{summary}</p>
      </div>
    </div>

    <ul className="space-y-2">
      {points.map((point) => (
        <li key={point} className="flex items-start gap-2 text-sm text-[#1E1E24]">
          <span
            className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${TONE_STYLES[tone].chip}`}
            aria-hidden="true"
          />
          <span className="leading-relaxed">{point}</span>
        </li>
      ))}
    </ul>

    {action}
  </Surface>
);

const Guarantee: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({
  icon,
  children,
}) => (
  <li className="flex items-start gap-3 text-sm text-[#1E1E24]">
    <span className="mt-0.5 shrink-0 text-[#2E8B57]" aria-hidden="true">
      {icon}
    </span>
    <span className="leading-relaxed">{children}</span>
  </li>
);

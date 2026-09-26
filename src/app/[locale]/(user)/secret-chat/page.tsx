import * as React from 'react';
import { getTranslations } from 'next-intl/server';
import { Surface } from '@/components/ui/surface';
import { MessageSquare } from 'lucide-react';

export default async function SecretChatPage() {
  const tNav = await getTranslations('nav');
  const tPrivacy = await getTranslations('privacy');

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold text-[#2D1B2D]">{tNav('secretChat')}</h1>
        <p className="mt-1 text-sm text-[#5A5A66]">
          {tPrivacy('systems.communitySummary')}
        </p>
      </header>

      <Surface variant="bordered" className="space-y-4">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2D1B2D]/5 text-[#2D1B2D]"
            aria-hidden="true"
          >
            <MessageSquare className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-[#5A5A66]">{tPrivacy('comingSoon')}</p>
        </div>

        <ul className="space-y-2 border-t border-[#E2D8D0] pt-4">
          {[
            tPrivacy('systems.communityPointAlias'),
            tPrivacy('systems.communityPointNoLocal'),
            tPrivacy('systems.communityPointRequiresNetwork'),
          ].map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm text-[#1E1E24]">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2E8B57]"
                aria-hidden="true"
              />
              <span className="leading-relaxed">{point}</span>
            </li>
          ))}
        </ul>
      </Surface>
    </div>
  );
}

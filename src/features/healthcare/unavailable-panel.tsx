'use client';

import * as React from 'react';
import { ShieldQuestion } from 'lucide-react';
import { Surface } from '@/components/ui/surface';

/**
 * A record the server would not show, and why that is not an error.
 *
 * Healthcare pages answer "not found" for a row that is absent *and* for a row that
 * belongs to somebody else, and a page that turned the second into an error screen
 * would leak the existence of another worker's household through an error message. So
 * a refused record lands here: a sentence, and a way back to the list the reader is
 * allowed to see.
 *
 * The message is passed in already translated by the page, because the page is a server
 * component and this one is not, and the code that knows the difference between a
 * missing row and an unexpected failure is the service's answer rather than anything
 * the client should re-derive.
 */
export const UnavailablePanel: React.FC<{
  message: string;
  backHref: string;
  backLabel: string;
}> = ({ message, backHref, backLabel }) => (
  <Surface variant="bordered" className="mx-auto max-w-2xl">
    <div className="flex items-start gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F9EBEA] text-[#2D1B2D]"
        aria-hidden="true"
      >
        <ShieldQuestion className="h-5 w-5" />
      </span>
      <div className="space-y-2">
        <h1 className="text-lg font-bold text-[#2D1B2D]">{message}</h1>
        <p>
          <a
            href={backHref}
            className="inline-flex min-h-[40px] items-center rounded-xl px-1 text-sm font-medium text-[#2D1B2D] underline decoration-[#E8837D] underline-offset-4 hover:bg-[#F9EBEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8837D]"
          >
            {backLabel}
          </a>
        </p>
      </div>
    </div>
  </Surface>
);

import { CalendarDays, Mail } from 'lucide-react';

import { LEGAL_INFO } from './legal-info';

/**
 * Shared document view for the legal pages: title banner, sticky table of
 * contents (desktop) and one card per section.
 */

export interface LegalSectionData {
  id: string;
  heading: string;
  content: React.ReactNode;
}

interface LegalDocumentProps {
  title: string;
  summary: string;
  icon: React.ReactNode;
  sections: LegalSectionData[];
}

export function LegalDocument({ title, summary, icon, sections }: LegalDocumentProps) {
  return (
    <>
      {/* Title banner */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">{icon}</div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-base text-primary-foreground/85">{summary}</p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-primary-foreground/80">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> Effective {LEGAL_INFO.effectiveDate}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-4 w-4" /> {LEGAL_INFO.contactEmail}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[240px_1fr]">
        {/* Table of contents */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-xl border bg-background p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
            <ol className="space-y-1 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <span className="w-5 shrink-0 tabular-nums">{i + 1}.</span>
                    <span>{s.heading}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 rounded-xl border bg-background p-6 shadow-sm">
              <h2 className="mb-3 flex items-center gap-3 text-lg font-semibold text-foreground">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                {s.heading}
              </h2>
              <div className="space-y-3 text-[15px] leading-relaxed text-foreground/85 [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">
                {s.content}
              </div>
            </section>
          ))}

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-sm text-foreground/85">
            Questions about this page? Contact us at{' '}
            <a href={`mailto:${LEGAL_INFO.contactEmail}`} className="font-medium text-primary underline">
              {LEGAL_INFO.contactEmail}
            </a>
            .
          </div>
        </div>
      </div>
    </>
  );
}

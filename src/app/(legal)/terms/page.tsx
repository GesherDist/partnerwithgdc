import type { Metadata } from 'next';
import { FileText } from 'lucide-react';

import { LEGAL_INFO } from '../legal-info';
import { LegalDocument, type LegalSectionData } from '../legal-section';

export const metadata: Metadata = {
  title: 'Terms of Use (EULA)',
};

/**
 * End User License Agreement — public page (registered with Intuit as the EULA URL)
 */
export default function TermsPage() {
  const { companyName, appName, contactEmail } = LEGAL_INFO;

  const sections: LegalSectionData[] = [
    {
      id: 'use',
      heading: 'Use of the application',
      content: (
        <p>
          {appName} is the internal business application of {companyName}. Only users authorized by {companyName} may
          use it, and only for {companyName}&apos;s business.
        </p>
      ),
    },
    {
      id: 'accounts',
      heading: 'Your account',
      content: <p>Keep your login details private. You are responsible for activity under your account.</p>,
    },
    {
      id: 'quickbooks',
      heading: 'QuickBooks Online',
      content: (
        <p>
          An administrator can connect QuickBooks Online to sync invoices, customers and financial reports, and can
          disconnect it at any time. See our <a href="/privacy">Privacy Policy</a>.
        </p>
      ),
    },
    {
      id: 'warranty',
      heading: 'No warranty',
      content: (
        <p>
          The application is provided &quot;as is&quot;. {companyName} is not liable for indirect damages or data loss
          from its use.
        </p>
      ),
    },
    {
      id: 'contact',
      heading: 'Contact',
      content: (
        <p>
          Questions: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      ),
    },
  ];

  return (
    <LegalDocument
      title="Terms of Use"
      summary={`The terms for using ${appName}.`}
      icon={<FileText className="h-6 w-6" />}
      sections={sections}
    />
  );
}

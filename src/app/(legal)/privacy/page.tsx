import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

import { LEGAL_INFO } from '../legal-info';
import { LegalDocument, type LegalSectionData } from '../legal-section';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

/**
 * Privacy Policy — public page (registered with Intuit as the Privacy Policy URL)
 */
export default function PrivacyPage() {
  const { companyName, appName, contactEmail } = LEGAL_INFO;

  const sections: LegalSectionData[] = [
    {
      id: 'collect',
      heading: 'What we collect',
      content: (
        <p>
          User names and emails, and the business data used in {appName} (customers, orders, invoices, inventory and
          shipments).
        </p>
      ),
    },
    {
      id: 'quickbooks',
      heading: 'QuickBooks Online data',
      content: (
        <p>
          When connected, {appName} reads and writes {companyName}&apos;s QuickBooks data (customers, items, invoices,
          accounts and financial reports) only to run {companyName}&apos;s own operations. An administrator can
          disconnect QuickBooks at any time.
        </p>
      ),
    },
    {
      id: 'sharing',
      heading: 'Sharing',
      content: (
        <p>
          We do not sell or share your data. It is used only to run {appName}, with our service providers (hosting, email and AI email reading).
        </p>
      ),
    },
    {
      id: 'security',
      heading: 'Security',
      content: <p>Data is sent over HTTPS, and access requires a login.</p>,
    },
    {
      id: 'contact',
      heading: 'Contact',
      content: (
        <p>
          Questions or data requests: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      ),
    },
  ];

  return (
    <LegalDocument
      title="Privacy Policy"
      summary={`How ${companyName} uses information in ${appName}.`}
      icon={<ShieldCheck className="h-6 w-6" />}
      sections={sections}
    />
  );
}

import { LegalPage, type LegalSection } from "./LegalPage";

const sections: LegalSection[] = [
  {
    title: "Who this notice covers",
    body: (
      <p>
        This notice explains how BalikGamit (“the System”), developed by Mark Vincent A. Bartolay, Jenwille John V. Robias, Lyca Mae V.
        Jangas, and Havena Angel P. Balderama as a software development project for the Institute of Computer Studies, Rizal
        Technological University – Pasig Campus, collects, uses, and protects personal information belonging to students, faculty, and
        staff of RTU–Pasig Campus who use the System, in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and its
        Implementing Rules and Regulations.
      </p>
    ),
  },
  {
    title: "What information we collect",
    body: (
      <>
        <table className="legal__table">
          <thead>
            <tr>
              <th>Information</th>
              <th>Details</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Account information</td><td>Full name, RTU institutional email address</td><td>When you register</td></tr>
            <tr><td>Lost item reports</td><td>Description, category, location, date, photos you upload</td><td>When you report a lost item</td></tr>
            <tr><td>Found item records</td><td>Public description, category, location, date, photos (logged by office staff only)</td><td>When an item is handed in at the office</td></tr>
            <tr><td>Claim information</td><td>Your answers to proof-of-ownership questions</td><td>When you file a claim (“This is mine”)</td></tr>
            <tr><td>Messages</td><td>Messages exchanged with office staff about a specific claim</td><td>During claim review</td></tr>
            <tr><td>Usage data</td><td>Notifications, claim status history</td><td>Automatically, as you use the System</td></tr>
          </tbody>
        </table>
        <p>
          We ask that you not include ID numbers, serial numbers, or other sensitive identifiers in report descriptions or messages. The
          System includes basic checks to catch and block common ID-number patterns before they're saved or sent anywhere.
        </p>
      </>
    ),
  },
  {
    title: "What we do not collect or use for matching",
    body: (
      <ul>
        <li>We do not require or store any government-issued ID number.</li>
        <li>Photos are stored and displayed, but are not analyzed or processed by any AI system.</li>
        <li>
          Private verification details recorded by office staff at intake (for example, a specific mark, a passcode, or an item's
          contents) are visible only to office administrators. They are never shown publicly and never sent to any AI service.
        </li>
      </ul>
    ),
  },
  {
    title: "Why we collect this information (Purpose)",
    body: (
      <>
        <p>We process your personal information to:</p>
        <ul>
          <li>Let you report, browse, and search for lost and found items on campus</li>
          <li>Match your lost report against found items in the office's custody, including through AI-assisted suggestions (see Section 6)</li>
          <li>Verify your claim to an item before releasing it</li>
          <li>Notify you about your reports, claims, and messages</li>
          <li>Maintain an auditable record for the office in charge of lost and found items</li>
          <li>Evaluate and improve the System as part of an academic research study</li>
        </ul>
      </>
    ),
  },
  {
    title: "Legal basis for processing",
    body: (
      <ul>
        <li>
          Your consent, given when you register and again if you participate in the study's survey, interview, or pilot testing (which you
          may withdraw at any time, as described in Section 10)
        </li>
        <li>
          Legitimate interest, specifically the University's interest in helping its community recover lost belongings and maintain
          accountability over items in its custody
        </li>
      </ul>
    ),
  },
  {
    title: "AI use and third-party processing",
    body: (
      <>
        <p>
          To suggest possible matches between lost and found reports, BalikGamit sends the public description text of your report (never
          your name, contact details, ID numbers, or private verification details) to a third-party AI service (Groq, running the
          gpt-oss-120b model) for analysis. This service returns suggested matches with plain-language explanations.
        </p>
        <p>
          <strong>Important:</strong> the AI only suggests possible matches. It never confirms a match or makes a claim decision. A human
          administrator reviews every claim and makes the final decision.
        </p>
      </>
    ),
  },
  {
    title: "Who we share your information with",
    body: (
      <>
        <ul>
          <li>Office administrators, who review claims and manage found items as part of their role</li>
          <li>The AI service described in Section 6, limited strictly to public report text</li>
        </ul>
        <p>We do not sell, rent, or share your personal information with any other third party, and we do not use it for advertising.</p>
      </>
    ),
  },
  {
    title: "How long we keep your information",
    body: (
      <ul>
        <li>
          Records of returned or closed items are kept for one (1) academic year after closure, then deleted, unless University records
          policy requires a longer period.
        </li>
        <li>Survey and interview responses collected for the research study are anonymized and retained only for the purposes of the study.</li>
        <li>You may request earlier deletion of your account and associated reports, subject to Section 9.</li>
      </ul>
    ),
  },
  {
    title: "Your rights under the Data Privacy Act",
    body: (
      <>
        <p>As a data subject, you have the right to:</p>
        <ul>
          <li>Be informed that your personal information is being processed (this notice)</li>
          <li>Access your personal information held by the System</li>
          <li>Request correction of inaccurate information</li>
          <li>Object to processing, or withdraw consent, without penalty (though this may limit your ability to use certain features)</li>
          <li>Request erasure or blocking of your information, where legally permitted</li>
          <li>Lodge a complaint with the National Privacy Commission (NPC)</li>
        </ul>
        <p>To exercise any of these rights, contact the individuals listed in Section 12.</p>
      </>
    ),
  },
  {
    title: "Consent for research participation",
    body: (
      <p>
        If you participate in the study's survey, interview, or user testing, your participation is voluntary. You may decline to
        participate or withdraw at any time without any effect on your ability to use the BalikGamit system itself.
      </p>
    ),
  },
  {
    title: "Security measures",
    body: (
      <ul>
        <li>All data is transmitted over encrypted (HTTPS) connections.</li>
        <li>Access to your information is restricted by account role (student, faculty, staff, or administrator) and enforced at the database level.</li>
        <li>API keys and other credentials are never stored in the application code accessible to your browser.</li>
        <li>Photos are stored in access-controlled storage, not publicly browsable links.</li>
        <li>
          No system can guarantee perfect security, and BalikGamit is a student research project rather than a University-certified
          production system. Please avoid including highly sensitive information in your reports or messages beyond what is needed to
          identify your item.
        </li>
      </ul>
    ),
  },
  {
    title: "Contact us",
    body: (
      <>
        <p>For questions about this notice or to exercise your data privacy rights, contact:</p>
        <ul>
          <li>Project Lead: Mark Vincent A. Bartolay, [email]</li>
          <li>Subject Adviser: Prof. Ronel D. Paglomutan, MEng-CpE</li>
          <li>[If RTU has a registered Data Protection Officer for student projects, add their contact here]</li>
        </ul>
      </>
    ),
  },
];

export function Privacy() {
  return <LegalPage title="Privacy Notice" effective="[date]" sections={sections} />;
}

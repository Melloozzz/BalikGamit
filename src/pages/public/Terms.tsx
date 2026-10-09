import { Link } from "react-router";
import { LegalPage, type LegalSection } from "./LegalPage";
import { OFFICE } from "../../data/api";

const sections: LegalSection[] = [
  {
    title: "About these terms",
    body: (
      <p>
        These Terms of Use govern your use of BalikGamit ("the System"), a web-based lost and found system developed by BSIT students of
        the Institute of Computer Studies, RTU–Pasig Campus, as a software development project. By creating an account or using the
        System, you agree to these terms and to the <Link to="/privacy">Privacy Notice</Link>.
      </p>
    ),
  },
  {
    title: "Who can use the System",
    body: (
      <ul>
        <li>The System is for students, faculty, and staff of RTU–Pasig Campus.</li>
        <li>You must register with a valid RTU institutional email address.</li>
        <li>Administrator accounts are created only by the System's super administrator. Nobody can register as an administrator.</li>
      </ul>
    ),
  },
  {
    title: "Your account",
    body: (
      <ul>
        <li>Keep your password private. You are responsible for activity under your account.</li>
        <li>Give your real name when you register.</li>
        <li>Tell the office right away if you think someone else has used your account.</li>
      </ul>
    ),
  },
  {
    title: "Reporting lost items",
    body: (
      <ul>
        <li>Lost item reports go live as soon as you submit them, without prior approval.</li>
        <li>Describe only items that you personally lost.</li>
        <li>
          Do not include ID numbers, student numbers, serial numbers, or other people's personal details in descriptions. The System
          blocks common ID formats.
        </li>
        <li>Administrators may hide reports that break these terms. You will see the reason.</li>
        <li>Reports expire after [{OFFICE.reportExpiryDays} days]. You may renew them.</li>
      </ul>
    ),
  },
  {
    title: "Found items",
    body: (
      <ul>
        <li>If you find an item, hand it to {OFFICE.name}. Users cannot post found items themselves.</li>
        <li>Only office staff log found items in the System, after physically receiving them.</li>
        <li>The office keeps found items for [holding period]. After that, unclaimed items are handled according to university policy.</li>
      </ul>
    ),
  },
  {
    title: "Claiming an item",
    body: (
      <ul>
        <li>You may claim only an item that genuinely belongs to you.</li>
        <li>
          To claim, answer proof-of-ownership questions. The office compares your answers with private details recorded when the item was
          handed in.
        </li>
        <li>An administrator makes every claim decision. The office may approve or reject a claim, or ask you for more information.</li>
        <li>Each item may have up to [3] pending claims at a time, and each user gets [2] claim attempts per item.</li>
        <li>
          If your claim is approved, pick the item up at the office within [{OFFICE.pickupDays} working days] and present your RTU ID.
          Items not collected in that time return to the listing.
        </li>
        <li>Making a false claim is a violation of these terms and may be reported under university rules.</li>
      </ul>
    ),
  },
  {
    title: "AI-assisted matching",
    body: (
      <ul>
        <li>The System uses an AI service to suggest possible matches between lost reports and found items.</li>
        <li>Suggestions are labeled by likelihood. They are not confirmations and may be wrong.</li>
        <li>The AI never approves claims or changes an item's status. A person makes every decision.</li>
      </ul>
    ),
  },
  {
    title: "Messaging",
    body: (
      <ul>
        <li>Messaging is available only within a claim, between you and the office.</li>
        <li>
          Keep messages relevant to the claim. Do not share phone numbers, email addresses, or social media accounts. The System blocks
          common contact details.
        </li>
        <li>Administrators can read all claim messages. Threads close when the claim ends.</li>
      </ul>
    ),
  },
  {
    title: "Prohibited conduct",
    body: (
      <>
        <p>You may not:</p>
        <ul>
          <li>Submit false reports or claims, or claim items that are not yours</li>
          <li>Harass, threaten, or impersonate others</li>
          <li>Upload offensive, unlawful, or unrelated content</li>
          <li>Attempt to access other users' accounts, private details, or administrator functions</li>
          <li>Disrupt the System or try to bypass its security or limits</li>
        </ul>
      </>
    ),
  },
  {
    title: "Suspension and removal",
    body: (
      <p>
        The office may hide content, restrict features, or suspend accounts that violate these terms. Serious violations may be referred to
        the appropriate university office.
      </p>
    ),
  },
  {
    title: "Limitations",
    body: (
      <ul>
        <li>BalikGamit is a student project. It is not an official RTU service, and it does not guarantee that any item will be recovered.</li>
        <li>The System records item status but does not control physical storage. Items are held and released by the office.</li>
        <li>The System depends on third-party services and may be unavailable at times, especially during testing.</li>
        <li>The System is provided as is, for the duration of the project.</li>
      </ul>
    ),
  },
  {
    title: "Privacy",
    body: (
      <p>
        How we collect, use, and protect your information is explained in the <Link to="/privacy">Privacy Notice</Link>, in line with the
        Data Privacy Act of 2012 (RA 10173).
      </p>
    ),
  },
  {
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms during the project. The effective date at the top shows the latest version. Significant changes will be
        announced in the System.
      </p>
    ),
  },
  {
    title: "Contact",
    body: (
      <p>
        For questions about these terms, contact {OFFICE.name} or the project team through the Institute of Computer Studies, RTU–Pasig
        Campus.
      </p>
    ),
  },
];

export function Terms() {
  return (
    <LegalPage
      title="Terms of Use"
      effective="[date]"
      sections={sections}
      footnote="You can read this anytime from the Terms of Use link at the bottom of every page."
    />
  );
}

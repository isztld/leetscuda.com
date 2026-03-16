import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung / Privacy Policy — leetscuda.com',
}

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl mx-auto py-16 px-6 prose prose-slate">
      <h1>Datenschutzerklärung</h1>
      <p>
        <em>
          Deutsche Version (gesetzlich vorgeschrieben). English translation follows below.
        </em>
      </p>

      <h2>1. Verantwortlicher</h2>
      <p>
        [YOUR FULL LEGAL NAME]
        <br />
        [YOUR STREET ADDRESS]
        <br />
        [YOUR POSTAL CODE] [YOUR CITY]
        <br />
        Deutschland
        <br />
        E-Mail: [YOUR EMAIL ADDRESS]
      </p>

      <h2>2. Erhobene Daten</h2>
      <h3>Kontodaten</h3>
      <p>
        Bei der Registrierung via GitHub oder Google OAuth erheben wir: E-Mail-Adresse, Anzeigename
        und Avatar-URL. Diese Daten werden zur Bereitstellung des Kontos verwendet.
      </p>
      <h3>Nutzungsdaten</h3>
      <p>
        Gelöste Aufgaben, Einsendungen, XP-Punkte und Streak. Diese Daten werden gespeichert, um den
        Dienst bereitzustellen und den Fortschritt nachzuverfolgen.
      </p>
      <h3>Sitzungsdaten</h3>
      <p>
        NextAuth-Sitzungstoken als httpOnly-Cookie — notwendig für die Authentifizierung.
      </p>
      <h3>Technische Logs</h3>
      <p>
        Server-Logs für Sicherheit und Fehlerdiagnose. Diese werden nach 30 Tagen gelöscht.
      </p>

      <h2>3. Rechtsgrundlage</h2>
      <p>
        Art. 6 Abs. 1 lit. b DSGVO — Vertragserfüllung (Bereitstellung des Dienstes).
      </p>

      <h2>4. Auftragsverarbeiter</h2>
      <ul>
        <li>
          <strong>Vercel</strong> (Hosting, EU-Region soweit möglich) —{' '}
          <a href="https://vercel.com/legal/dpa" target="_blank" rel="noopener noreferrer">
            Vercel DPA
          </a>
        </li>
        <li>
          <strong>Supabase</strong> (PostgreSQL-Datenbank) —{' '}
          <a href="https://supabase.com/legal/dpa" target="_blank" rel="noopener noreferrer">
            Supabase DPA
          </a>
        </li>
        <li>
          <strong>GitHub / Google</strong> (OAuth-Anbieter — Nutzerwahl)
        </li>
      </ul>

      <h2>5. Speicherdauer</h2>
      <p>
        Kontodaten werden bis zur Kontolöschung gespeichert. Server-Logs werden nach 30 Tagen
        gelöscht.
      </p>

      <h2>6. Betroffenenrechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Datenübertragbarkeit und
        Widerspruch. Anfragen an: [YOUR EMAIL ADDRESS]
      </p>

      <h2>7. Cookies</h2>
      <p>
        Wir setzen ausschließlich technisch notwendige Cookies. Keine Tracking-Cookies, keine
        Analyse-Cookies, keine Werbe-Cookies. Details finden Sie in unserer{' '}
        <a href="/cookies">Cookie-Richtlinie</a>.
      </p>

      <h2>8. Keine Datenweitergabe</h2>
      <p>
        Ihre Daten werden nicht verkauft oder an Werbetreibende weitergegeben.
      </p>

      <h2>9. Beschwerderecht</h2>
      <p>
        Sie haben das Recht, sich bei der zuständigen Datenschutzaufsichtsbehörde zu beschweren.
        Für Deutschland ist dies die jeweilige Landesdatenschutzbehörde.
      </p>

      <hr />

      <h1>Privacy Policy (English)</h1>
      <p>
        <em>
          Courtesy translation. The German text above is the legally binding version.
        </em>
      </p>

      <h2>1. Controller</h2>
      <p>
        [YOUR FULL LEGAL NAME]
        <br />
        [YOUR STREET ADDRESS], [YOUR POSTAL CODE] [YOUR CITY], Germany
        <br />
        Email: [YOUR EMAIL ADDRESS]
      </p>

      <h2>2. Data collected</h2>
      <p>
        <strong>Account data:</strong> email, name, avatar URL from GitHub/Google OAuth — to provide
        your account.
      </p>
      <p>
        <strong>Usage data:</strong> problems solved, submissions, XP, streak — stored to provide
        the service.
      </p>
      <p>
        <strong>Session data:</strong> NextAuth session token in an httpOnly cookie — essential for
        authentication.
      </p>
      <p>
        <strong>Technical logs:</strong> server logs for security and debugging, deleted after 30
        days.
      </p>

      <h2>3. Legal basis</h2>
      <p>Art. 6(1)(b) GDPR — performance of contract (providing the service).</p>

      <h2>4. Data processors</h2>
      <ul>
        <li>
          <strong>Vercel</strong> (hosting, EU region where possible) —{' '}
          <a href="https://vercel.com/legal/dpa" target="_blank" rel="noopener noreferrer">
            Vercel DPA
          </a>
        </li>
        <li>
          <strong>Supabase</strong> (PostgreSQL database) —{' '}
          <a href="https://supabase.com/legal/dpa" target="_blank" rel="noopener noreferrer">
            Supabase DPA
          </a>
        </li>
        <li>
          <strong>GitHub / Google</strong> (OAuth provider — user's choice)
        </li>
      </ul>

      <h2>5. Retention</h2>
      <p>Account data retained until account deletion. Server logs deleted after 30 days.</p>

      <h2>6. Your rights</h2>
      <p>
        Access, rectification, erasure, portability, objection. Contact: [YOUR EMAIL ADDRESS]
      </p>

      <h2>7. Cookies</h2>
      <p>
        Essential cookies only. No tracking, no analytics, no advertising cookies. See our{' '}
        <a href="/cookies">Cookie Policy</a>.
      </p>

      <h2>8. No data selling</h2>
      <p>Your data is never sold or shared with advertisers.</p>

      <h2>9. Right to lodge a complaint</h2>
      <p>
        You have the right to lodge a complaint with the relevant supervisory authority. In Germany,
        this is the relevant state DPA (Landesdatenschutzbehörde).
      </p>
    </article>
  )
}

import { useState } from 'react'

const TOKEN = import.meta.env.VITE_LOGO_DEV_TOKEN as string | undefined

/** logo.dev image URL by website host when known, else by name; null without a token. */
export const logoUrl = (company: string, domain: string | null | undefined, size: number) =>
  TOKEN ? `https://img.logo.dev/${domain || `name/${encodeURIComponent(company.trim())}`}?token=${TOKEN}&size=${size * 2}&format=webp&fallback=404` : null

/** Company logo from logo.dev, by website host when known, else by name; a monogram when neither resolves. */
export function CompanyLogo({ company, domain, size = 40 }: { company: string; domain?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }
  if (!TOKEN || failed) {
    return (
      <span className="logo logo--mono" style={{ ...style, fontSize: size * 0.5 }} aria-hidden="true">
        {company.trim().charAt(0).toUpperCase() || '?'}
      </span>
    )
  }
  return <img className="logo" style={style} src={logoUrl(company, domain, size)!} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />
}

/** logo.dev's free tier asks for a link back. */
export function LogoCredit() {
  if (!TOKEN) return null
  return (
    <p className="logo-credit">
      <a href="https://logo.dev" target="_blank" rel="noopener noreferrer">
        Logos by Logo.dev
      </a>
    </p>
  )
}

import { Link } from 'react-router-dom'
import { ButtonLink } from './ButtonLink'

type SiteHeaderProps = {
  dark?: boolean
}

export function SiteHeader({ dark = false }: SiteHeaderProps) {
  return (
    <header className={`site-header ${dark ? 'site-header--dark' : ''}`}>
      <Link aria-label="Case Study Studio home" className="brand" to="/">
        <span aria-hidden="true" className="brand__mark">
          <span />
          <span />
          <span />
        </span>
        <span className="brand__name">case study studio</span>
      </Link>
      <nav aria-label="Main navigation" className="site-header__nav">
        <Link className="site-header__how" to="/#how-it-works">
          How it works?
        </Link>
        <ButtonLink className="site-header__cta" to="/try-now" variant="bright">
          Try now
        </ButtonLink>
      </nav>
    </header>
  )
}

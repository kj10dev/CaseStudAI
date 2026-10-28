import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from './Icons'

type ButtonLinkProps = {
  children: ReactNode
  to: string
  variant?: 'bright' | 'outline' | 'text'
  arrow?: boolean
  className?: string
}

export function ButtonLink({
  children,
  to,
  variant = 'bright',
  arrow = true,
  className = '',
}: ButtonLinkProps) {
  return (
    <Link
      className={`button-link button-link--${variant} shrink-0 ${className}`}
      to={to}
    >
      <span>{children}</span>
      {arrow && <ArrowUpRight className="button-link__arrow" />}
    </Link>
  )
}

import React from 'react'
import { Link as WouterLink } from 'wouter'

// Mock for next/link -- uses wouter Link in non-Next.js environments
interface LinkProps {
  href: string
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
  shallow?: boolean
  passHref?: boolean
}

const NextLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, children, className, style, onClick }, ref) => {
    return (
      <WouterLink href={href}>
        <a ref={ref} className={className} style={style} onClick={onClick}>
          {children}
        </a>
      </WouterLink>
    )
  }
)
NextLink.displayName = 'NextLink'

export default NextLink
export function useLinkStatus() {
  return { pending: false }
}

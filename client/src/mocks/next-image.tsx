import React from 'react'

// Mock for next/image -- renders a plain <img> tag in non-Next.js environments
interface ImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  style?: React.CSSProperties
  fill?: boolean
  priority?: boolean
  quality?: number
  placeholder?: string
  blurDataURL?: string
  sizes?: string
}

const NextImage = React.forwardRef<HTMLImageElement, ImageProps>(
  ({ src, alt, width, height, className, style, fill }, ref) => {
    const imgStyle: React.CSSProperties = fill
      ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }
      : style || {}
    return (
      <img
        ref={ref}
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        className={className}
        style={imgStyle}
      />
    )
  }
)
NextImage.displayName = 'NextImage'

export default NextImage
export function getImageProps({ src, alt, ...props }: ImageProps) {
  return { props: { src, alt, ...props } }
}

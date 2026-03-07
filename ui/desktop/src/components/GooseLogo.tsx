import brandIcon from '../images/logo-transparent.png';
import { cn } from '../utils';

interface GooseLogoProps {
  className?: string;
  size?: 'default' | 'small';
  hover?: boolean;
}

export default function GooseLogo({
  className = '',
  size = 'default',
  hover = true,
}: GooseLogoProps) {
  const sizes = {
    default: {
      frame: 'w-28 h-9',
      icon: 'w-full h-full',
    },
    small: {
      frame: 'w-16 h-5',
      icon: 'w-full h-full',
    },
  } as const;

  const currentSize = sizes[size];

  return (
    <div
      className={cn(
        className,
        currentSize.frame,
        'relative overflow-hidden',
        hover && 'group/with-hover'
      )}
    >
        <img
        src={brandIcon}
        alt="Agent Core logo"
        className={cn(
          currentSize.icon,
          'absolute left-0 bottom-0 z-2 transition-transform duration-300 object-contain object-left',
          hover && 'group-hover/with-hover:scale-105'
        )}
      />
    </div>
  );
}

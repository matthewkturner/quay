interface IconProps {
  size?: number;
}

export function CloseIcon({ size = 10 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10">
      <line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="1.2" />
      <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function MinimizeIcon() {
  return (
    <svg width="10" height="1" viewBox="0 0 10 1">
      <rect width="10" height="1" fill="currentColor" />
    </svg>
  );
}

export function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <rect
        x="0.5"
        y="0.5"
        width="9"
        height="9"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

export function SplitHorizontalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12">
      <rect
        x="0.5"
        y="0.5"
        width="11"
        height="11"
        rx="1"
        stroke="currentColor"
        fill="none"
        strokeWidth="1"
      />
      <line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function SplitVerticalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12">
      <rect
        x="0.5"
        y="0.5"
        width="11"
        height="11"
        rx="1"
        stroke="currentColor"
        fill="none"
        strokeWidth="1"
      />
      <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12">
      <line
        x1="6"
        y1="1"
        x2="6"
        y2="11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="1"
        y1="6"
        x2="11"
        y2="6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GitBranchIcon() {
  return (
    <svg className="git-branch-icon" width="10" height="10" viewBox="0 0 16 16">
      <circle cx="5" cy="4" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="11" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 6 C5 8 9 8 9 8" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.5",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "w-5 h-5",
};

export const IconPersonal = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

export const IconTreball = () => (
  <svg {...svgProps}>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <line x1="12" y1="12" x2="12" y2="16" />
    <line x1="10" y1="14" x2="14" y2="14" />
  </svg>
);

export const IconActivitat = () => (
  <svg {...svgProps}>
    <path d="M3 21V8l9-6 9 6v13" />
    <path d="M9 21v-6h6v6" />
    <path d="M3 10h18" />
  </svg>
);

export const IconImmobiliari = () => (
  <svg {...svgProps}>
    <path d="M3 12L12 3l9 9" />
    <path d="M9 21V12h6v9" />
    <path d="M3 21h18" />
  </svg>
);

export const IconMobiliari = () => (
  <svg {...svgProps}>
    <path d="M3 20V14h4v6H3z" />
    <path d="M9 20V8h4v12H9z" />
    <path d="M15 20V4h4v16h-4z" />
  </svg>
);

export const IconCapital = () => (
  <svg {...svgProps}>
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
  </svg>
);

export const IconReduccions = () => (
  <svg {...svgProps}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

export const IconInforme = () => (
  <svg {...svgProps}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
    <line x1="8" y1="9" x2="10" y2="9" />
  </svg>
);

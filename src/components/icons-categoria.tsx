import type { SVGProps } from "react";

/**
 * Íconos de línea para las categorías del catálogo de trámites — mismo
 * lenguaje visual que src/components/icons.tsx (trazo 1.75, sin relleno,
 * formas simples). Reemplazan a los emojis (💧🌳🦉…) que se veían como una
 * app de consumo en vez de una entidad ambiental seria — ver feedback del
 * usuario: "los iconos no son los adecuados ni los colores".
 */

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconGota(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3c-3.2 4.2-6 8-6 11.2a6 6 0 0 0 12 0C18 11 15.2 7.2 12 3Z" />
    </svg>
  );
}

export function IconArbol(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="9" r="5" />
      <path d="M12 14v7M9 21h6" />
    </svg>
  );
}

export function IconHuella(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="7.5" r="1.4" />
      <circle cx="12" cy="6" r="1.4" />
      <circle cx="16" cy="7.5" r="1.4" />
      <ellipse cx="12" cy="14" rx="4.5" ry="3.6" />
    </svg>
  );
}

export function IconViento(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 8h10.5a2.25 2.25 0 1 0-2.2-2.75" />
      <path d="M3 12.5h15a2.25 2.25 0 1 1-2.2 2.75" />
      <path d="M3 17h9" />
    </svg>
  );
}

export function IconReciclaje(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 10.5a7.5 7.5 0 0 1 13-5" />
      <path d="M19.5 13.5a7.5 7.5 0 0 1-13 5" />
      <path d="M14.5 2.7l3 2.8-2.2 3.4M9.5 21.3l-3-2.8 2.2-3.4" />
    </svg>
  );
}

export function IconCamion(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="9.5" width="11" height="6.5" rx="1" />
      <path d="M13.5 12h4l3 3v1h-2" />
      <circle cx="7" cy="18" r="1.7" />
      <circle cx="16.5" cy="18" r="1.7" />
    </svg>
  );
}

export function IconBalanza(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4v16M8 20h8M5 8h14" />
      <path d="M5 8l-2.5 5h5L5 8ZM19 8l-2.5 5h5L19 8Z" />
    </svg>
  );
}

export function IconMontana(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 19l5.5-10.5L12 15l2.5-4L21 19H3Z" />
    </svg>
  );
}

export function IconOficina(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="4" width="14" height="17" rx="1" />
      <path d="M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M9 16h1.5M13.5 16H15" />
    </svg>
  );
}

export function IconMoneda(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 6.5v11M9.7 9.3c0-1.3 1.4-1.8 2.3-1.8s2.3.5 2.3 1.8c0 2.7-4.6 1.8-4.6 4.5 0 1.3 1.4 1.9 2.3 1.9s2.3-.6 2.3-1.9" />
    </svg>
  );
}

export function IconDocumento(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3h7l4 4v14H7Z" />
      <path d="M14 3v4h4" />
      <path d="M9.5 12.5h5M9.5 15.5h5" />
    </svg>
  );
}

export function IconFrasco(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9.5 3h5M10 3v6.2l-5 8.6a1.8 1.8 0 0 0 1.6 2.7h10.8a1.8 1.8 0 0 0 1.6-2.7l-5-8.6V3" />
      <path d="M8.3 15h7.4" />
    </svg>
  );
}

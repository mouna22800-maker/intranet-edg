/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface EdgLogoProps {
  className?: string;
}

/**
 * Logo officiel de l'Électricité de Guinée : tuile jaune arrondie, « G » vert (serif),
 * traversé par un éclair rouge. Recréation vectorielle nette et redimensionnable.
 */
export default function EdgLogo({ className = 'w-9 h-9' }: EdgLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Logo Électricité de Guinée"
    >
      {/* Tuile jaune arrondie */}
      <rect x="4" y="4" width="152" height="152" rx="30" fill="#FCE500" />
      {/* Lettre G verte (typographie serif grasse) */}
      <text
        x="82"
        y="122"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="bold"
        fontSize="132"
        fill="#1C8A2E"
      >
        G
      </text>
      {/* Éclair rouge, contour jaune pour le détacher du G */}
      <path
        d="M88 34 L63 88 H78 L71 126 L99 72 H84 L93 34 Z"
        fill="#E21B23"
        stroke="#FCE500"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CSSProperties } from 'react';

/**
 * Convertit la valeur "image" d'un article/projet (dégradé CSS, couleur, ou
 * chemin/URL d'une image téléversée) en style CSS de fond utilisable directement.
 * Un chemin réel (ex: "/uploads/img_xyz.jpg") ne peut pas être passé tel quel
 * à `background` (CSS invalide) : il doit être enveloppé dans `url(...)`.
 */
export const getMediaBgStyle = (imgStr?: string): CSSProperties => {
  if (!imgStr) return { background: 'linear-gradient(135deg, #048343 0%, #10b981 100%)' };
  if (imgStr.startsWith('linear-gradient') || imgStr.startsWith('radial-gradient') || imgStr.startsWith('#') || imgStr.startsWith('rgb')) {
    return { background: imgStr };
  }
  return {
    backgroundImage: `url('${imgStr}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Lucide from 'lucide-react';

interface LucideIconProps {
  name: string;
  className?: string;
  size?: number;
}

export default function LucideIcon({ name, className = '', size = 20 }: LucideIconProps) {
  // Safe lookup for individual Lucide icon from the module
  const IconComponent = (Lucide as any)[name];

  if (!IconComponent) {
    // Return a fallback HelpCircle icon if not found
    return <Lucide.HelpCircle className={className} size={size} />;
  }

  return <IconComponent className={className} size={size} />;
}

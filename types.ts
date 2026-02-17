
import React from 'react';

export interface GeneratedWebsite {
  html: string;
  css: string;
  js: string;
  metadata: {
    title: string;
    description: string;
  };
}

export interface SavedProject {
  id: string;
  timestamp: number;
  prompt: string;
  site: GeneratedWebsite;
}

export type GenerationStatus = 'idle' | 'analyzing' | 'structuring' | 'coding' | 'polishing' | 'completed' | 'error';

export interface ToolItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

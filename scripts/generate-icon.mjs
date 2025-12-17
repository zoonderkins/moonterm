#!/usr/bin/env node
/**
 * Generates a terminal-style icon for Better Agent Terminal
 * Run with: node scripts/generate-icon.mjs
 */

import { writeFileSync } from 'fs'
import { execSync } from 'child_process'

// SVG icon design - modern terminal with AI sparkle
const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>

    <!-- Terminal window gradient -->
    <linearGradient id="termGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#2d2d44"/>
      <stop offset="100%" style="stop-color:#1f1f33"/>
    </linearGradient>

    <!-- Accent gradient for prompt -->
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>

    <!-- AI sparkle gradient -->
    <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f59e0b"/>
      <stop offset="100%" style="stop-color:#ef4444"/>
    </linearGradient>

    <!-- Drop shadow -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="20" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <!-- Background with rounded corners -->
  <rect x="0" y="0" width="1024" height="1024" rx="180" ry="180" fill="url(#bgGrad)"/>

  <!-- Terminal window -->
  <g filter="url(#shadow)">
    <rect x="120" y="180" width="784" height="664" rx="24" ry="24" fill="url(#termGrad)"/>

    <!-- Title bar -->
    <rect x="120" y="180" width="784" height="56" rx="24" ry="24" fill="#383850"/>
    <rect x="120" y="212" width="784" height="24" fill="#383850"/>

    <!-- Window controls -->
    <circle cx="172" cy="208" r="14" fill="#ff5f57"/>
    <circle cx="220" cy="208" r="14" fill="#febc2e"/>
    <circle cx="268" cy="208" r="14" fill="#28c840"/>
  </g>

  <!-- Terminal content -->
  <g>
    <!-- Prompt line 1 -->
    <text x="160" y="320" font-family="Monaco, Consolas, monospace" font-size="42" font-weight="bold" fill="url(#accentGrad)">$</text>
    <text x="200" y="320" font-family="Monaco, Consolas, monospace" font-size="42" fill="#e2e8f0">claude --help</text>

    <!-- Output line -->
    <text x="160" y="390" font-family="Monaco, Consolas, monospace" font-size="36" fill="#94a3b8">Better Agent Terminal v1.0</text>

    <!-- Prompt line 2 with cursor -->
    <text x="160" y="480" font-family="Monaco, Consolas, monospace" font-size="42" font-weight="bold" fill="url(#accentGrad)">$</text>
    <rect x="200" y="450" width="24" height="40" fill="#e2e8f0">
      <animate attributeName="opacity" values="1;0;1" dur="1.2s" repeatCount="indefinite"/>
    </rect>
  </g>

  <!-- AI Sparkle icon (top right) -->
  <g transform="translate(760, 120)">
    <path d="M64 0 L80 48 L128 64 L80 80 L64 128 L48 80 L0 64 L48 48 Z"
          fill="url(#sparkleGrad)"/>
  </g>

  <!-- Multiple terminals indicator (bottom) -->
  <g transform="translate(360, 720)">
    <rect x="0" y="0" width="80" height="60" rx="8" fill="#4a5568" opacity="0.7"/>
    <rect x="100" y="0" width="80" height="60" rx="8" fill="#6366f1"/>
    <rect x="200" y="0" width="80" height="60" rx="8" fill="#4a5568" opacity="0.7"/>
  </g>
</svg>`

// Write SVG file
const svgPath = 'src-tauri/icons/app-icon.svg'
writeFileSync(svgPath, svgIcon)
console.log(`✅ Created SVG icon: ${svgPath}`)

// Convert SVG to PNG using sips (macOS built-in) or other tools
// For now, we'll create a simple PNG placeholder and use tauri icon command

console.log('\n📝 To generate all icon sizes, run:')
console.log('   npx tauri icon src-tauri/icons/app-icon.png')
console.log('\nNote: You may need to convert the SVG to PNG first using:')
console.log('   - Online tool: https://svgtopng.com/')
console.log('   - Or: brew install librsvg && rsvg-convert -w 1024 -h 1024 src-tauri/icons/app-icon.svg > src-tauri/icons/app-icon.png')

import './styles.css';

// The original single-file app, moved over unchanged. It will be split into
// src/engine (pure maths), src/render and src/ui step by step, with tests.
import './legacy/app.js';

import { initThemeToggle } from './ui/theme';
initThemeToggle(document.getElementById('themeBtn')!);

import { initSpot } from './ui/spot';
initSpot();

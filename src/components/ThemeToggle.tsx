import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex bg-white/50 dark:bg-black/20 backdrop-blur-sm p-1 rounded-full border border-white/20 shadow-sm">
      <button
        onClick={() => setTheme('light')}
        className={`p-1.5 rounded-full transition-all ${
          theme === 'light' ? 'bg-white text-[#2D5A27] shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
        title="Light Mode"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-1.5 rounded-full transition-all ${
          theme === 'dark' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'
        }`}
        title="Dark Mode"
      >
        <Moon className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-1.5 rounded-full transition-all ${
          theme === 'system' ? 'bg-[#2D5A27] text-white shadow-sm' : 'text-gray-500 hover:text-gray-400'
        }`}
        title="System Preference"
      >
        <Laptop className="w-4 h-4" />
      </button>
    </div>
  );
}

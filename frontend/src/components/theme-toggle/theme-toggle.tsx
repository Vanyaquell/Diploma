import { useTheme } from '../theme-provider/theme-provider';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" role="group" aria-label="Переключение темы сайта">
      <button
        className={theme === 'light' ? 'theme-toggle__option theme-toggle__option--active' : 'theme-toggle__option'}
        type="button"
        aria-pressed={theme === 'light'}
        onClick={() => setTheme('light')}
      >
        Светлая
      </button>
      <button
        className={theme === 'dark' ? 'theme-toggle__option theme-toggle__option--active' : 'theme-toggle__option'}
        type="button"
        aria-pressed={theme === 'dark'}
        onClick={() => setTheme('dark')}
      >
        Тёмная
      </button>
    </div>
  );
}

export { ThemeToggle };

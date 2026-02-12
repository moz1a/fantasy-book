export type ThemeOption = {
  id: string;
  label: string;
  href: string;
};

type ThemeSwitcherProps = {
  themes: ThemeOption[];
  onSwitch: (href: string) => void;
};

export function ThemeSwitcher({ themes, onSwitch }: ThemeSwitcherProps) {
  return (
    <div className="theme-switcher">
      {themes.map((theme) => (
        <button
          key={theme.id}
          className="theme-switcher__button"
          onClick={() => onSwitch(theme.href)}
        >
          {theme.label}
        </button>
      ))}
    </div>
  );
}

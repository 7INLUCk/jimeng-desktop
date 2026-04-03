import { MessageSquare, ListTodo, Settings, Download, PawPrint } from 'lucide-react';
import { useStore } from '../store';

export function Sidebar() {
  const { activePanel, setActivePanel, tasks, isSubmitting } = useStore();

  const activeTaskCount = tasks.filter(t =>
    ['generating', 'queued', 'pending', 'uploading'].includes(t.status)
  ).length;

  const navItems = [
    { id: 'chat' as const, icon: MessageSquare, label: '对话', badge: isSubmitting ? '...' : null },
    { id: 'results' as const, icon: ListTodo, label: '任务', badge: activeTaskCount > 0 ? String(activeTaskCount) : null },
    { id: 'settings' as const, icon: Settings, label: '设置', badge: null },
  ];

  return (
    <aside className="w-[60px] bg-surface-1 border-r border-border flex flex-col items-center py-3 flex-shrink-0">
      {/* Logo */}
      <div className="w-9 h-9 rounded-lg bg-brand-gradient flex items-center justify-center text-white shadow-[var(--shadow-brand)] mb-5">
        <PawPrint size={18} strokeWidth={2.2} />
      </div>

      {/* Navigation */}
      <nav className="flex flex-col items-center gap-1 w-full px-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              className={`
                relative w-full h-10 rounded-lg flex items-center justify-center transition-all duration-150
                ${isActive
                  ? 'bg-brand-gradient-subtle text-brand'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-2'
                }
              `}
              title={item.label}
            >
              {/* Left indicator line */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-brand animate-fade-in" />
              )}

              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />

              {item.badge && (
                <span className={`
                  absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-medium flex items-center justify-center
                  ${isActive
                    ? 'bg-brand text-white'
                    : 'bg-surface-3 text-text-secondary'
                  }
                `}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto flex flex-col items-center gap-1 w-full px-1.5">
        <button
          onClick={() => window.api.openDownloadDir()}
          className="w-full h-10 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-2 flex items-center justify-center transition-all duration-150"
          title="打开下载目录"
        >
          <Download size={18} strokeWidth={1.8} />
        </button>

        {/* Version indicator */}
        <div className="mt-1 mb-0.5">
          <span className="text-[9px] text-text-disabled font-mono">v0.1</span>
        </div>
      </div>
    </aside>
  );
}

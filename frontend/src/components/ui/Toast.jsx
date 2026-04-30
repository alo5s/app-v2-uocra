import { useToastStore } from '../../store/uiStore';

export function Toast() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => {
        const icons = {
          success: 'bi-check-circle',
          error: 'bi-x-circle',
          warning: 'bi-exclamation-triangle',
          info: 'bi-info-circle',
        };
        const colors = {
          success: 'bg-green-500',
          error: 'bg-red-500',
          warning: 'bg-yellow-500',
          info: 'bg-blue-500',
        };

        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-white shadow-lg ${colors[toast.type]} animate-slide-in`}
          >
            <i className={`bi ${icons[toast.type]}`}></i>
            <span>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="ml-2 hover:opacity-80">
              <i className="bi bi-x"></i>
            </button>
          </div>
        );
      })}
    </div>
  );
}
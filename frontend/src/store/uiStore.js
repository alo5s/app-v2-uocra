import { create } from 'zustand';

export const useToastStore = create((set, get) => ({
  toasts: [],

  addToast: (message, type = 'info', duration = 4000) => {
    const id = Date.now();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },

  success: (message, duration) => get().addToast(message, 'success', duration),
  error: (message, duration) => get().addToast(message, 'error', duration),
  warning: (message, duration) => get().addToast(message, 'warning', duration),
  info: (message, duration) => get().addToast(message, 'info', duration),
}));

export const useModalStore = create((set) => ({
  modals: {},

  openModal: (name, data = null) => {
    set((state) => ({
      modals: { ...state.modals, [name]: { open: true, data } }
    }));
  },

  closeModal: (name) => {
    set((state) => ({
      modals: { ...state.modals, [name]: { open: false, data: null } }
    }));
  },

  isOpen: (name) => !!get().modals[name]?.open,
  getData: (name) => get().modals[name]?.data,
}));
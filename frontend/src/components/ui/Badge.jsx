import { clsx } from 'clsx';

const variants = {
  primary: 'bg-primary/10 text-primary border border-primary/20',
  success: 'bg-green-100 text-green-800 border border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  danger: 'bg-red-100 text-red-800 border border-red-200',
  info: 'bg-blue-100 text-blue-800 border border-blue-200',
  gray: 'bg-gray-100 text-gray-800 border border-gray-200',
};

export function Badge({ children, variant = 'primary', className, ...props }) {
  return (
    <span
      className={clsx('badge', variants[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const variants = {
    si: { variant: 'success', label: 'Afiliado' },
    fue: { variant: 'warning', label: 'Fue afiliado' },
    no: { variant: 'gray', label: 'No afiliado' },
    aprovado: { variant: 'success', label: 'Aprobado' },
    pendiente: { variant: 'warning', label: 'Pendiente' },
    rechazado: { variant: 'danger', label: 'Rechazado' },
  };

  const config = variants[status] || { variant: 'gray', label: status };

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
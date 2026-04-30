import { clsx } from 'clsx';

export function Table({ children, className, ...props }) {
  return (
    <div className={clsx('overflow-x-auto scrollbar-thin', className)}>
      <table className="w-full" {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className, ...props }) {
  return (
    <thead className={clsx('bg-gray-50', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className, ...props }) {
  return (
    <tbody className={clsx('divide-y divide-gray-200', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className, clickable, onClick, ...props }) {
  return (
    <tr
      className={clsx(
        'hover:bg-gray-50 transition-colors',
        clickable && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHeader({ children, className, ...props }) {
  return (
    <th
      className={clsx(
        'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className, ...props }) {
  return (
    <td
      className={clsx('px-4 py-3 text-sm text-gray-700', className)}
      {...props}
    >
      {children}
    </td>
  );
}

export function TableCheckbox({ checked, onChange, ...props }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
      {...props}
    />
  );
}
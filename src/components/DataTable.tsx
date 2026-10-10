import { useState } from 'react';

interface DataTableProps<T> {
  columns: Array<{
    key: keyof T;
    label: string;
    format?: (value: any) => string;
  }>;
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  showActions?: boolean;
  actions?: Array<{
    label: string;
    onClick: (item: any) => void;
    variant?: 'default' | 'destructive';
  }>;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyMessage = 'Nenhum registro encontrado',
  onRowClick,
  showActions = false,
  actions = []
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: 'asc' | 'desc' } | null>(null);

  const sortedData = Array.isArray(data) ? [...data].sort((a, b) => {
    if (!sortConfig) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  }) : [];

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, idx) => (
                <th
                  key={`${String(column.key)}-header-${idx}`}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer ${
                    sortConfig?.key === column.key
                      ? 'text-gray-900'
                      : 'text-gray-500'
                  }`}
                  onClick={() => {
                    let direction: 'asc' | 'desc' = 'asc';
                    if (sortConfig?.key === column.key && sortConfig.direction === 'asc') {
                      direction = 'desc';
                    }
                    setSortConfig({ key: column.key, direction });
                  }}
                >
                  {column.label}
                  {sortConfig?.key === column.key && (
                    <span className="ml-1 h-4 w-4 inline-block">
                      {sortConfig.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
              {showActions && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((item, rowIdx) => (
              <tr
                key={`row-${rowIdx}`}
                className={`bg-white border-b border-gray-200 hover:bg-gray-50 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
                onClick={() => onRowClick && onRowClick(item)}
              >
                {columns.map((column, colIdx) => {
                  const value = item[column.key];
                  const formattedValue = column.format
                    ? column.format(value)
                    : value === null || value === undefined
                      ? '-'
                      : String(value);

                  return (
                    <td key={`cell-${rowIdx}-${colIdx}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formattedValue}
                    </td>
                  );
                })}
                {showActions && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right flex justify-end gap-2">
                    {actions.map((action, actionIdx) => (
                      <button
                        key={`action-${actionIdx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          action.onClick(item);
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded ${
                          action.variant === 'destructive'
                            ? 'bg-red-100 text-red-800 hover:bg-red-200'
                            : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
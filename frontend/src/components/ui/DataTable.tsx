import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  // Pagination
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  // Sorting
  sorting?: {
    sortBy: string;
    sortDir: 'ASC' | 'DESC';
    onSortChange: (sortBy: string, sortDir: 'ASC' | 'DESC') => void;
  };
}

export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  pagination,
  sorting,
}: DataTableProps<T>) {
  const handleSort = (columnKey: string) => {
    if (!sorting) return;
    
    const newDir = 
      sorting.sortBy === columnKey && sorting.sortDir === 'ASC' 
        ? 'DESC' 
        : 'ASC';
    
    sorting.onSortChange(columnKey, newDir);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-8 text-center text-slate-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          <p className="mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-slate-100' : ''
                  } ${column.className || ''}`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && sorting && sorting.sortBy === column.key && (
                      <span className="text-brand-600">
                        {sorting.sortDir === 'ASC' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className={`${
                    onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''
                  } transition-colors`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-2.5 whitespace-nowrap text-sm text-slate-700 tabular-nums ${
                        column.className || ''
                      }`}
                    >
                      {column.render
                        ? column.render(item)
                        : String((item as Record<string, unknown>)[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="px-4 py-2.5 border-t border-slate-200 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 0}
            icon={<ChevronLeft className="w-4 h-4" />}
          >
            Previous
          </Button>

          <span className="text-sm text-slate-700">
            Page {pagination.currentPage + 1} of {pagination.totalPages}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage >= pagination.totalPages - 1}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}

import { type InputHTMLAttributes, forwardRef } from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onSearch: _onSearch, className = '', ...props }, ref) => {
    return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <input
          ref={ref}
          type="text"
          className={`w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus:border-transparent ${className}`}
          {...props}
        />
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;

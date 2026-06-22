import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons/Icons";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const ITEMS_PER_PAGE = 10;

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 px-4 py-2 border-t border-slate-200 dark:border-slate-700">
      <span className="text-sm text-slate-500 dark:text-slate-400">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Previous Page"
        >
          <ChevronLeftIcon />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Next Page"
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
};

export default PaginationControls;

import React, { Component, ErrorInfo, ReactNode } from "react";
import { XCircleIcon } from './icons/Icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4">
             <div className="text-center bg-white dark:bg-slate-800 p-8 rounded-lg shadow-2xl max-w-lg w-full">
                <XCircleIcon className="mx-auto h-16 w-16 text-red-500" />
                <h1 className="mt-4 text-2xl font-bold text-slate-800 dark:text-slate-100">Something went wrong</h1>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                    An unexpected error occurred. Please try refreshing the page.
                </p>
                <details className="mt-4 text-left bg-slate-100 dark:bg-slate-700 p-3 rounded-md">
                  <summary className="cursor-pointer font-semibold text-sm">Error Details</summary>
                  <pre className="mt-2 text-xs text-red-500 dark:text-red-400 overflow-auto whitespace-pre-wrap break-words">
                    {this.state.error?.toString()}
                  </pre>
                </details>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

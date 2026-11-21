import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6 py-12 text-white">
          <div className="w-full max-w-lg border border-white/15 bg-[#111111] p-8">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]">
              Application Notice
            </p>
            <h1 className="mt-3 font-display text-2xl font-bold uppercase tracking-tight text-white">
              Something went wrong
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#A0A0A0]">
              {this.state.message}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="bg-[#AEDD00] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#050505] hover:bg-[#c2f216]"
              >
                Try Again
              </button>
              <a
                href="/"
                className="border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:border-[#AEDD00] hover:text-[#AEDD00]"
              >
                Return Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

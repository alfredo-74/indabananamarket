import { Component, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="p-6 h-full flex items-center justify-center" data-testid="container-error">
          <div className="text-center space-y-3">
            <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
            <div>
              <h3 className="text-lg font-semibold">Chart Error</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Unable to render chart. Refresh the page to try again.
              </p>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}

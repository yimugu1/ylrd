"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { hasError: boolean; message: string };

export class ClientErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || "未知错误",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ClientErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-4 rounded-2xl border border-red-500/30 bg-red-950/30 p-8 text-red-100">
          <p className="text-lg font-semibold">页面渲染出错</p>
          <p className="text-sm opacity-90">{this.state.message}</p>
          <p className="text-xs text-zinc-500">
            请尝试刷新；若仍白屏，在项目目录执行 npm run clean 后重新 npm run dev，并尽量使用英文路径下的副本（如
            C:\Users\你的用户名\daima-app）。
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

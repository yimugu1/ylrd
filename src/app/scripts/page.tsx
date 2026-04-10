import dynamic from "next/dynamic";

const ScriptsClient = dynamic(() => import("./ScriptsClient"), {
  ssr: false,
  loading: () => (
    <div className="space-y-2 py-16 text-center text-zinc-400">
      <p>正在加载脚本制作区…</p>
      <p className="text-xs text-zinc-600">若长时间停留在此，请刷新或执行 npm run clean 后重试</p>
    </div>
  ),
});

export default function ScriptsPage() {
  return <ScriptsClient />;
}

import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wider text-cyan-400/90">
          Hotspot · Script Studio
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
          把「今日热点」变成可投放的信息流脚本
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-zinc-400">
          自动从 RSS 资讯源拉取实时条目并沉淀为按日期归档的热点库；上传产品后分析卖点与受众，与热点库智能匹配，一键生成短视频/信息流广告脚本。无匹配热点时，仍可独立编撰脚本。
        </p>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <Link
          href="/hotspots"
          className="group rounded-2xl border border-white/10 bg-[#131820] p-6 transition hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10"
        >
          <h2 className="text-xl font-semibold text-white group-hover:text-cyan-300">
            热点库
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            手动或定时同步 RSS 热点，按时间节点浏览、检索。支持通过环境变量自定义订阅源与每日定时抓取。
          </p>
          <span className="mt-4 inline-block text-sm text-cyan-400">进入 →</span>
        </Link>

        <Link
          href="/scripts"
          className="group rounded-2xl border border-white/10 bg-[#131820] p-6 transition hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10"
        >
          <h2 className="text-xl font-semibold text-white group-hover:text-cyan-300">
            脚本制作区
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            输入产品信息，AI 分析卖点与人群；与热点库打分匹配后生成脚本，或选择「独立编撰」绕过热点。
          </p>
          <span className="mt-4 inline-block text-sm text-cyan-400">进入 →</span>
        </Link>
      </div>
    </div>
  );
}

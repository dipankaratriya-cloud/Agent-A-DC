import { Box } from "lucide-react";

export function Header() {
  return (
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-700 rounded-xl p-6 mb-6 shadow-lg shadow-indigo-500/20">
      <div className="flex items-center gap-4">
        <div className="bg-white/15 rounded-lg p-3 flex items-center justify-center">
          <Box className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            DC Metadata Extractor
          </h1>
          <p className="text-white/80 text-sm mt-0.5">
            Automated dataset metadata extraction powered by Groq Compound + LangGraph
          </p>
        </div>
      </div>
    </div>
  );
}

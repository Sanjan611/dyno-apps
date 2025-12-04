"use client";

export default function CodeViewer() {
  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Code Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">App.tsx</span>
        </div>
      </div>

      {/* Code Content */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Coming soon!</p>
      </div>
    </div>
  );
}

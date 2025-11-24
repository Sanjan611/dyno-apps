"use client";

export default function AppPreview() {
  return (
    <div className="h-full flex items-center justify-center bg-muted/30 p-8">
      {/* Mobile Phone Frame */}
      <div className="relative w-[375px] h-[667px] bg-white rounded-[3rem] shadow-2xl border-[14px] border-gray-800 overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-gray-800 rounded-b-2xl z-10"></div>

        {/* Status Bar */}
        <div className="h-11 bg-white flex items-center justify-between px-6 pt-2">
          <span className="text-xs font-semibold">9:41</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 text-xs">📶</div>
            <div className="w-4 h-4 text-xs">📡</div>
            <div className="w-4 h-4 text-xs">🔋</div>
          </div>
        </div>

        {/* App Content */}
        <div className="h-[calc(100%-44px)] bg-gradient-to-br from-blue-50 to-indigo-100 overflow-y-auto">
          <div className="p-6 text-center mt-20">
            <div className="w-24 h-24 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">
              📱
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Your App Preview
            </h3>
            <p className="text-gray-600 text-sm">
              Start describing your app in the chat, and see it come to life here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

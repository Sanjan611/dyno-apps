"use client";

import { useState } from "react";

interface AppPreviewProps {
  previewUrl: string | null;
}

export default function AppPreview({ previewUrl }: AppPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="w-full h-full bg-white">
      {previewUrl ? (
        <>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading preview...</p>
              </div>
            </div>
          )}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="text-center p-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-sm text-gray-600">
                  Failed to load preview. Please try again.
                </p>
              </div>
            </div>
          )}
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            onLoad={() => {
              setIsLoading(false);
              setHasError(false);
            }}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            title="Expo App Preview"
          />
        </>
      ) : (
        <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="p-6 text-center">
            <div className="w-20 h-20 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-4xl">📱</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Your App Preview
            </h3>
            <p className="text-gray-600 text-sm max-w-[200px] mx-auto">
              Start describing your app in the chat, and see it come to life here
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

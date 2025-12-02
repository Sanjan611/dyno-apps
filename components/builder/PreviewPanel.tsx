"use client";

import { useState, useEffect } from "react";
import AppPreview from "./AppPreview";
import CodeViewer from "./CodeViewer";
import ExpoQRCode from "./ExpoQRCode";
import { useBuilderStore } from "@/lib/store";
import { Smartphone, Code2, ExternalLink, RefreshCw, Battery, Wifi, Signal, QrCode, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PreviewPanel() {
  const [activeView, setActiveView] = useState<"preview" | "code" | "test">("preview");
  const [isLoadingConnection, setIsLoadingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { previewUrl, projectId, expoConnectionUrl, setExpoConnectionUrl } = useBuilderStore();

  // Fetch Expo connection URL when test view is active
  useEffect(() => {
    // Only fetch if we're in test view, have a preview URL, have a project ID,
    // don't already have a connection URL, and aren't currently loading
    if (activeView === "test" && previewUrl && projectId && !expoConnectionUrl && !isLoadingConnection && !connectionError) {
      setIsLoadingConnection(true);
      setConnectionError(null);
      
      fetch(`/api/projects/${projectId}/sandbox/expo-connection`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.expoConnectionUrl) {
            setExpoConnectionUrl(data.expoConnectionUrl);
          } else {
            setConnectionError(data.error || "Failed to get Expo connection URL");
          }
        })
        .catch((error) => {
          console.error("Error fetching Expo connection URL:", error);
          setConnectionError("Failed to load connection information");
        })
        .finally(() => {
          setIsLoadingConnection(false);
        });
    }
  }, [activeView, previewUrl, projectId, expoConnectionUrl, setExpoConnectionUrl]);

  return (
    <div className="flex flex-col h-full bg-slate-100/50">
      {/* Toolbar */}
      <div className="h-14 border-b bg-white px-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveView("preview")}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              activeView === "preview"
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={() => setActiveView("code")}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              activeView === "code"
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50"
            }`}
          >
            <Code2 className="w-4 h-4" />
            Code
          </button>
          <button
            onClick={() => setActiveView("test")}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              activeView === "test"
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50"
            }`}
          >
            <QrCode className="w-4 h-4" />
            Test on Device
          </button>
        </div>

        {activeView === "preview" && previewUrl && (
           <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary" onClick={() => {
                 const iframe = document.querySelector('iframe');
                 if (iframe) iframe.src = iframe.src;
              }}>
                 <RefreshCw className="w-4 h-4 mr-2" />
                 Reload
              </Button>
              <Button variant="outline" size="sm" className="text-xs" asChild>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  Open in New Tab <ExternalLink className="w-3 h-3 ml-2" />
                </a>
              </Button>
           </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
        {activeView === "preview" ? (
          <div className="relative w-full h-full max-w-[375px] max-h-[812px] flex flex-col shadow-2xl rounded-[3rem] border-[8px] border-gray-900 bg-black overflow-hidden my-4 mx-auto transform transition-transform hover:scale-[1.01]">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[30px] w-[150px] bg-black rounded-b-2xl z-20 flex items-center justify-center">
               <div className="w-16 h-1.5 bg-gray-800 rounded-full mb-1" />
            </div>
            
            {/* Status Bar */}
            <div className="h-[44px] bg-white w-full z-10 relative flex items-center justify-between px-6 pt-2 select-none">
              <span className="text-xs font-semibold ml-2">9:41</span>
              <div className="flex items-center gap-1.5 mr-1">
                <Signal className="w-3.5 h-3.5" />
                <Wifi className="w-3.5 h-3.5" />
                <Battery className="w-4 h-4" />
              </div>
            </div>

            <div className="flex-1 bg-white relative overflow-hidden rounded-b-[2.5rem]">
               <AppPreview previewUrl={previewUrl} />
            </div>
            
            {/* Home Indicator */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[120px] h-1 bg-gray-100 rounded-full opacity-50 z-20" />
          </div>
        ) : activeView === "code" ? (
          <div className="w-full h-full overflow-auto bg-[#1e1e1e] p-0">
            <CodeViewer />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-8 bg-slate-50/50 backdrop-blur-sm overflow-auto">
            <div className="text-center space-y-6 max-w-md w-full mx-auto p-10 bg-white rounded-3xl shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
               <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <QrCode className="w-10 h-10 text-primary" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-2xl font-bold text-slate-900">Test on your device</h3>
                 <p className="text-slate-500 text-base">Scan the QR code with Expo Go to view the app on your device.</p>
               </div>
               
               {!previewUrl ? (
                 <div className="aspect-square w-64 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 mx-auto flex flex-col items-center justify-center gap-3">
                   <AlertCircle className="w-12 h-12 text-slate-400" />
                   <p className="text-sm font-medium text-slate-400">No preview available yet</p>
                   <p className="text-xs text-slate-400">Start building your app to generate a QR code</p>
                 </div>
               ) : isLoadingConnection ? (
                 <div className="aspect-square w-64 bg-slate-50 rounded-2xl border-2 border-slate-200 mx-auto flex flex-col items-center justify-center gap-3">
                   <Loader2 className="w-12 h-12 text-primary animate-spin" />
                   <p className="text-sm font-medium text-slate-600">Loading QR code...</p>
                 </div>
               ) : connectionError ? (
                 <div className="space-y-4">
                   <div className="aspect-square w-64 bg-red-50 rounded-2xl border-2 border-red-200 mx-auto flex flex-col items-center justify-center gap-3">
                     <AlertCircle className="w-12 h-12 text-red-400" />
                     <p className="text-sm font-medium text-red-600">Failed to load QR code</p>
                     <p className="text-xs text-red-500 px-4">{connectionError}</p>
                   </div>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => {
                       setConnectionError(null);
                       setIsLoadingConnection(false);
                       setExpoConnectionUrl(null);
                     }}
                   >
                     Retry
                   </Button>
                 </div>
               ) : expoConnectionUrl ? (
                 <div className="space-y-4">
                   <ExpoQRCode expoUrl={expoConnectionUrl} size={256} />
                   
                   <div className="space-y-3 pt-2">
                     <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                       <p className="text-sm font-semibold text-blue-900 mb-2">For iOS users:</p>
                       <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                         <li>Install <strong>Expo Go</strong> from the App Store</li>
                         <li>Open the Expo Go app</li>
                         <li>Tap &quot;Scan QR Code&quot; in the app</li>
                         <li>Scan this QR code</li>
                       </ol>
                     </div>
                     
                     <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                       <p className="text-sm font-semibold text-green-900 mb-2">For Android users:</p>
                       <ol className="text-xs text-green-800 space-y-1 list-decimal list-inside">
                         <li>Install <strong>Expo Go</strong> from Google Play Store</li>
                         <li>Open the Expo Go app</li>
                         <li>Tap &quot;Scan QR Code&quot; in the app</li>
                         <li>Scan this QR code</li>
                       </ol>
                     </div>
                     
                     <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left">
                       <p className="text-xs font-medium text-slate-700 mb-1">Connection URL:</p>
                       <code className="text-xs text-slate-600 break-all">{expoConnectionUrl}</code>
                     </div>
                   </div>
                 </div>
               ) : (
                 <div className="aspect-square w-64 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 mx-auto flex flex-col items-center justify-center gap-3">
                   <QrCode className="w-12 h-12 text-slate-400" />
                   <p className="text-sm font-medium text-slate-400">Preparing QR code...</p>
                 </div>
               )}

               {previewUrl && !expoConnectionUrl && !isLoadingConnection && !connectionError && (
                 <div className="pt-2">
                   <p className="text-xs text-slate-400">Requires Expo Go app installed on your device</p>
                 </div>
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

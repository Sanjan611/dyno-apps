"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import AppPreview from "./AppPreview";
import CodeViewer from "./CodeViewer";
import { useBuilderStore } from "@/lib/store";
import { Smartphone, Code2, RefreshCw, Battery, Wifi, Signal, QrCode, Copy, Check, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { API_ENDPOINTS } from "@/lib/constants";

export default function PreviewPanel() {
  const [activeView, setActiveView] = useState<"preview" | "code" | "test" | "logs">("preview");
  const [copied, setCopied] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const [viewingLogs, setViewingLogs] = useState(false);
  const [logs, setLogs] = useState<any>(null);
  const {
    previewUrl,
    projectId,
    sandboxId,
    sandboxStarted,
    sandboxProgressMessages,
    sandboxCurrentProgress,
    sandboxError,
    isStartingSandbox,
  } = useBuilderStore();

  const fetchLogs = async () => {
    if (!sandboxId || !projectId) return;
    setViewingLogs(true);
    setActiveView("logs");
    try {
      const response = await fetch(API_ENDPOINTS.PROJECT_SANDBOX_LOGS(projectId));
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setViewingLogs(false);
    }
  };
  
  // Generate the Expo tunnel URL for QR code
  const expoTunnelUrl = projectId ? `exp://${projectId}.ngrok.io` : null;
  
  const copyToClipboard = async () => {
    if (expoTunnelUrl) {
      await navigator.clipboard.writeText(expoTunnelUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
            onClick={() => sandboxStarted && setActiveView("test")}
            disabled={!sandboxStarted}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              !sandboxStarted
                ? "text-muted-foreground/50 cursor-not-allowed"
                : activeView === "test"
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50"
            }`}
          >
            <QrCode className="w-4 h-4" />
            Test on Device
          </button>
          <button
            onClick={fetchLogs}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
              activeView === "logs"
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50"
            }`}
            disabled={!sandboxId || !projectId}
          >
            {viewingLogs ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
            Logs
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
           </div>
        )}
      </div>

      {/* Content Area - All tabs always mounted, CSS controls visibility */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Setting Up Environment Overlay */}
        {!sandboxStarted && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-40 flex items-center justify-center">
            <Card className="max-w-md w-full mx-4 shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl">Setting Up Environment</CardTitle>
                <CardDescription>
                  Preparing your development sandbox and initializing Expo. This may take a moment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sandboxError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">{sandboxError}</p>
                  </div>
                )}
                {(sandboxProgressMessages.length > 0 || sandboxCurrentProgress || isStartingSandbox) && (
                  <div className="space-y-2 pt-2">
                    {sandboxProgressMessages.map((message, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-muted-foreground">{message}</span>
                      </div>
                    ))}
                    {(sandboxCurrentProgress || isStartingSandbox) && (
                      <div className="flex items-center gap-2 text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                        <span className="font-medium">{sandboxCurrentProgress || "Setting up..."}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Preview - always mounted, hidden when not active */}
        <div className={`${activeView === "preview" ? "flex" : "hidden"} flex-col items-center justify-center h-full w-full py-4`}>
          <div className="relative w-full max-w-[375px] max-h-[812px] flex-1 flex flex-col shadow-2xl rounded-[3rem] border-[8px] border-gray-900 bg-black overflow-hidden transform transition-transform hover:scale-[1.01]">
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

          {/* Preview Disclaimer */}
          <p className="mt-3 text-xs text-slate-400">
            Web preview may differ from device.{" "}
            <button
              onClick={() => setActiveView("test")}
              className="text-primary hover:underline"
            >
              Test on device
            </button>
            {" "}for accuracy.
          </p>
        </div>

        {/* Code - always mounted, hidden when not active */}
        <div className={`${activeView === "code" ? "block" : "hidden"} w-full h-full overflow-auto bg-[#1e1e1e] p-0`}>
          <CodeViewer />
        </div>

        {/* Logs - always mounted, hidden when not active */}
        <div className={`${activeView === "logs" ? "block" : "hidden"} w-full h-full overflow-auto p-4`}>
          <div className="p-4 bg-black/90 text-green-400 rounded-xl font-mono text-xs overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
              <div className="font-bold flex items-center gap-2">
                <Terminal className="w-3 h-3" /> Sandbox Logs
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchLogs}
                disabled={viewingLogs}
                className="h-6 px-2 text-white/50 hover:text-white hover:bg-white/10"
              >
                {viewingLogs ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span className="ml-1">Refresh</span>
              </Button>
            </div>
            {logs && logs.success ? (
              <div className="overflow-auto max-h-[calc(100vh-200px)] space-y-4">
                {logs.logs.expoLogs && (
                  <div>
                    <div className="font-bold text-white/70 mb-1">Expo Output:</div>
                    <pre className="whitespace-pre-wrap">{logs.logs.expoLogs}</pre>
                  </div>
                )}
                {logs.logs.processCheck && (
                  <div>
                    <div className="font-bold text-white/70 mb-1">Processes:</div>
                    <pre className="whitespace-pre-wrap">{logs.logs.processCheck}</pre>
                  </div>
                )}
                {!logs.logs.expoLogs && !logs.logs.processCheck && (
                  <div className="text-white/50">No logs available</div>
                )}
              </div>
            ) : logs && !logs.success ? (
              <div className="text-red-400">Failed to fetch logs: {logs.error || "Unknown error"}</div>
            ) : viewingLogs ? (
              <div className="flex items-center gap-2 text-white/50">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading logs...
              </div>
            ) : (
              <div className="text-white/50">Click refresh to load logs</div>
            )}
          </div>
        </div>

        {/* Test on Device - always mounted, hidden when not active */}
        <div className={`${activeView === "test" ? "flex" : "hidden"} w-full h-full items-start justify-center p-8 bg-slate-50/50 backdrop-blur-sm overflow-auto`}>
          <div className="text-center space-y-6 max-w-md w-full mx-auto my-auto p-10 bg-white rounded-3xl shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
             <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <QrCode className="w-10 h-10 text-primary" />
             </div>
             <div className="space-y-2">
               <h3 className="text-2xl font-bold text-slate-900">Test on your device</h3>
               <p className="text-slate-500 text-base">Scan the QR code with your phone to view the app in Expo Go.</p>
             </div>

             {expoTunnelUrl ? (
               <>
                 <div className="bg-white p-4 rounded-2xl border border-slate-200 mx-auto inline-block shadow-sm">
                   <QRCodeSVG
                     value={expoTunnelUrl}
                     size={200}
                     level="M"
                     includeMargin={true}
                     bgColor="#ffffff"
                     fgColor="#1e293b"
                   />
                 </div>

                 <div className="flex items-center justify-center gap-2 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
                   <code className="text-sm text-slate-600 font-mono truncate max-w-[240px]">
                     {expoTunnelUrl}
                   </code>
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={copyToClipboard}
                     className="h-8 w-8 p-0 shrink-0"
                   >
                     {copied ? (
                       <Check className="w-4 h-4 text-green-500" />
                     ) : (
                       <Copy className="w-4 h-4 text-slate-400" />
                     )}
                   </Button>
                 </div>
               </>
             ) : (
               <div className="aspect-square w-64 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 mx-auto flex flex-col items-center justify-center gap-3 group hover:border-primary/30 transition-colors">
                 <div className="w-12 h-12 rounded-lg bg-slate-200/50 flex items-center justify-center">
                   <QrCode className="w-6 h-6 text-slate-400" />
                 </div>
                 <p className="text-sm font-medium text-slate-400">Start building to generate QR code</p>
               </div>
             )}

             <div className="pt-2 w-full">
               <button
                 onClick={() => setShowInstallInstructions(!showInstallInstructions)}
                 className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-primary transition-colors mx-auto"
               >
                 Need Expo Go?
                 {showInstallInstructions ? (
                   <ChevronUp className="w-3 h-3" />
                 ) : (
                   <ChevronDown className="w-3 h-3" />
                 )}
               </button>

               <div
                 className={`overflow-hidden transition-all duration-300 ease-in-out ${
                   showInstallInstructions ? "max-h-64 opacity-100 mt-4" : "max-h-0 opacity-0"
                 }`}
               >
                 <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left space-y-3">
                   <p className="text-sm font-medium text-slate-700">How to install Expo Go:</p>
                   <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside">
                     <li>Download Expo Go from your app store</li>
                     <li>Open the Expo Go app</li>
                     <li>Scan the QR code above (or enter URL manually)</li>
                   </ol>
                   <div className="flex gap-2 pt-2">
                     <a
                       href="https://apps.apple.com/app/expo-go/id982107779"
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-black text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
                     >
                       <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                         <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                       </svg>
                       App Store
                     </a>
                     <a
                       href="https://play.google.com/store/apps/details?id=host.exp.exponent"
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-black text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
                     >
                       <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                         <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.25-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm3.35-4.31c.34.27.56.69.56 1.19s-.22.92-.56 1.19l-2.11 1.24-2.5-2.5 2.5-2.5 2.11 1.38zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/>
                       </svg>
                       Google Play
                     </a>
                   </div>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

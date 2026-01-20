"use client";

import Editor from "@monaco-editor/react";
import { Loader2 } from "lucide-react";

interface CodeEditorProps {
  content: string;
  language: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function CodeEditor({
  content,
  language,
  onChange,
  readOnly = false,
}: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      onChange={(value) => onChange(value || "")}
      theme="vs-dark"
      loading={
        <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      }
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        renderLineHighlight: "line",
        tabSize: 2,
        padding: { top: 8, bottom: 8 },
      }}
    />
  );
}

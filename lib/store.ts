import { create } from "zustand";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface BuilderState {
  projectName: string;
  projectId: string | null;
  messages: Message[];
  generatedCode: string;
  sandboxId: string | null;
  previewUrl: string | null;
  expoConnectionUrl: string | null;
  setProjectName: (name: string) => void;
  setProjectId: (id: string | null) => void;
  addMessage: (message: Message) => void;
  setGeneratedCode: (code: string) => void;
  setSandboxId: (id: string | null) => void;
  setPreviewUrl: (url: string | null) => void;
  setExpoConnectionUrl: (url: string | null) => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  projectName: "Untitled Project",
  projectId: null,
  messages: [],
  generatedCode: "",
  sandboxId: null,
  previewUrl: null,
  expoConnectionUrl: null,
  setProjectName: (name) => set({ projectName: name }),
  setProjectId: (id) => set({ projectId: id }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setGeneratedCode: (code) => set({ generatedCode: code }),
  setSandboxId: (id) => set({ sandboxId: id }),
  setPreviewUrl: (url) => set({ previewUrl: url }),
  setExpoConnectionUrl: (url) => set({ expoConnectionUrl: url }),
}));

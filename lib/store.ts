import { create } from "zustand";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface BuilderState {
  projectName: string;
  messages: Message[];
  generatedCode: string;
  setProjectName: (name: string) => void;
  addMessage: (message: Message) => void;
  setGeneratedCode: (code: string) => void;
}

export const useBuilderStore = create<BuilderState>((set) => ({
  projectName: "Untitled Project",
  messages: [],
  generatedCode: "",
  setProjectName: (name) => set({ projectName: name }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setGeneratedCode: (code) => set({ generatedCode: code }),
}));

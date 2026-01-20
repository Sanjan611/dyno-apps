"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuthStore();

  // Only render for authenticated users
  if (!user) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-gradient-to-r from-primary to-secondary text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
        aria-label="Send feedback"
      >
        <MessageSquarePlus className="w-6 h-6" />
      </button>

      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userEmail={user.email}
      />
    </>
  );
}

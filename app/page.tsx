"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [appIdea, setAppIdea] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (appIdea.trim()) {
      router.push("/builder");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="text-center w-full max-w-2xl">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
          Dyno Apps
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-12">
          Build mobile applications using natural language with AI
        </p>
        
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="mb-4">
            <label htmlFor="app-idea" className="block text-left text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              What would you like to build?
            </label>
            <textarea
              id="app-idea"
              value={appIdea}
              onChange={(e) => setAppIdea(e.target.value)}
              placeholder="Describe your app idea... e.g., 'A fitness tracker app with workout logging and progress charts'"
              className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
              rows={4}
            />
          </div>
          <button
            type="submit"
            disabled={!appIdea.trim()}
            className="w-full px-6 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Start Building
          </button>
        </form>

        <div className="flex gap-4 justify-center">
          <Link
            href="/project-gallery"
            className="px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            View Project Gallery
          </Link>
        </div>
      </div>
    </div>
  );
}

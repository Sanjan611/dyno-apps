"use client";

import { MessageSquare, Code2, Smartphone } from "lucide-react";
import { useInView } from "@/hooks/use-in-view";

const steps = [
  {
    number: 1,
    title: "Describe Your App",
    subtitle: "Tell us what you want in plain English",
    example: '"I want a fitness tracker that logs my daily workouts and shows progress charts"',
    icon: MessageSquare,
    color: "from-primary to-secondary",
  },
  {
    number: 2,
    title: "AI Generates Code",
    subtitle: "Production-ready React Native code",
    example: "Our AI writes clean, maintainable code with proper structure and best practices",
    icon: Code2,
    color: "from-secondary to-pink-500",
  },
  {
    number: 3,
    title: "Test on Your Phone",
    subtitle: "Scan QR code to run instantly",
    example: "Preview your app on your physical device in seconds, no app store needed",
    icon: Smartphone,
    color: "from-pink-500 to-orange-400",
  },
];

export function HowItWorks() {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.2 });

  return (
    <section
      ref={ref}
      className="max-w-6xl mx-auto scroll-mt-24 py-16"
    >
      <div
        className={`text-center mb-16 transition-all duration-700 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
          How It Works
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          From idea to working app in three simple steps
        </p>
      </div>

      <div className="relative">
        {/* Connecting line - desktop only */}
        <div className="hidden md:block absolute top-24 left-[16.66%] right-[16.66%] h-0.5 bg-gradient-to-r from-primary via-secondary to-pink-500 opacity-20" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={`relative transition-all duration-700 ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: inView ? `${index * 150}ms` : "0ms" }}
            >
              {/* Step card */}
              <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/50 backdrop-blur-sm border border-white/40 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                {/* Number badge */}
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-bold text-lg shadow-lg mb-4`}
                >
                  {step.number}
                </div>

                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
                  <step.icon className="w-7 h-7 text-gray-700" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-sm font-medium text-primary mb-3">
                  {step.subtitle}
                </p>
                <p className="text-sm text-muted-foreground italic">
                  {step.example}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

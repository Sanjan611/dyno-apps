"use client";

import { ArrowDownRight, ArrowUpRight, CreditCard, PiggyBank, TrendingUp, Wallet } from "lucide-react";

export function PhoneMockup() {
  return (
    <div className="relative" style={{ transform: "perspective(1000px) rotateY(-8deg) rotateX(2deg)" }}>
      {/* Glow effect behind phone */}
      <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full scale-75" />

      {/* Phone Frame */}
      <div className="relative w-[280px] rounded-[2.5rem] border-4 border-gray-800 bg-gray-900 shadow-2xl overflow-hidden">
        {/* Phone Notch */}
        <div className="h-7 bg-gray-900 flex items-center justify-center z-10">
          <div className="w-20 h-5 bg-gray-800 rounded-full" />
        </div>

        {/* Phone Content */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col h-[480px]">
          {/* Fixed Header */}
          <div className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-[10px] text-slate-400">Good morning</p>
              <p className="text-sm font-semibold text-white">Alex</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
          </div>

          {/* Scrolling Content Area */}
          <div className="flex-1 overflow-hidden px-4 py-2">
            <div className="animate-phone-scroll space-y-3">
              {/* Balance Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-secondary">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-white/80" />
                    <span className="text-xs text-white/80">Total Balance</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-300">
                    <TrendingUp className="w-3 h-3" />
                    +12.5%
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">$24,562.00</p>
                <div className="flex gap-3 mt-4">
                  <div className="flex-1 bg-white/20 rounded-xl py-2 text-center">
                    <ArrowDownRight className="w-4 h-4 text-white mx-auto mb-0.5" />
                    <span className="text-[10px] text-white/80">Receive</span>
                  </div>
                  <div className="flex-1 bg-white/20 rounded-xl py-2 text-center">
                    <ArrowUpRight className="w-4 h-4 text-white mx-auto mb-0.5" />
                    <span className="text-[10px] text-white/80">Send</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-slate-700/50 border border-slate-600/50">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <ArrowDownRight className="w-3 h-3 text-green-400" />
                    </div>
                    <span className="text-[10px] text-slate-400">Income</span>
                  </div>
                  <p className="text-sm font-bold text-white">$8,240</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-700/50 border border-slate-600/50">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                      <ArrowUpRight className="w-3 h-3 text-red-400" />
                    </div>
                    <span className="text-[10px] text-slate-400">Expenses</span>
                  </div>
                  <p className="text-sm font-bold text-white">$3,820</p>
                </div>
              </div>

              {/* Spending Chart */}
              <div className="p-3 rounded-xl bg-slate-700/30 border border-slate-600/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-white">Weekly Spending</span>
                  <span className="text-[10px] text-slate-400">This week</span>
                </div>
                <div className="flex items-end gap-1.5 h-16">
                  {[45, 65, 40, 80, 55, 70, 50].map((height, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all duration-700 ${
                        i === 3 ? "bg-gradient-to-t from-primary to-secondary" : "bg-slate-600"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2">
                  {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                    <span key={i} className={`text-[8px] flex-1 text-center ${i === 3 ? "text-primary" : "text-slate-500"}`}>
                      {day}
                    </span>
                  ))}
                </div>
              </div>

              {/* Savings Goals */}
              <div className="p-3 rounded-xl bg-slate-700/30 border border-slate-600/30">
                <div className="flex items-center gap-2 mb-3">
                  <PiggyBank className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-white">Savings Goals</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-300">Vacation</span>
                      <span className="text-slate-400">$2,400 / $5,000</span>
                    </div>
                    <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                      <div className="h-full w-[48%] bg-gradient-to-r from-primary to-secondary rounded-full" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-300">New Car</span>
                      <span className="text-slate-400">$12,000 / $30,000</span>
                    </div>
                    <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                      <div className="h-full w-[40%] bg-gradient-to-r from-green-400 to-emerald-500 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="p-3 rounded-xl bg-slate-700/30 border border-slate-600/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-white">Recent Transactions</span>
                  <span className="text-[10px] text-primary">See all</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-white">Netflix</p>
                      <p className="text-[10px] text-slate-400">Entertainment</p>
                    </div>
                    <span className="text-xs font-medium text-red-400">-$15.99</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                      <ArrowDownRight className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-white">Salary</p>
                      <p className="text-[10px] text-slate-400">Income</p>
                    </div>
                    <span className="text-xs font-medium text-green-400">+$4,200</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="px-4 py-3 border-t border-slate-700/50">
            <div className="flex justify-around">
              <div className="flex flex-col items-center">
                <Wallet className="w-5 h-5 text-primary" />
                <span className="text-[8px] text-primary mt-0.5">Home</span>
              </div>
              <div className="flex flex-col items-center">
                <TrendingUp className="w-5 h-5 text-slate-500" />
                <span className="text-[8px] text-slate-500 mt-0.5">Stats</span>
              </div>
              <div className="flex flex-col items-center">
                <CreditCard className="w-5 h-5 text-slate-500" />
                <span className="text-[8px] text-slate-500 mt-0.5">Cards</span>
              </div>
              <div className="flex flex-col items-center">
                <PiggyBank className="w-5 h-5 text-slate-500" />
                <span className="text-[8px] text-slate-500 mt-0.5">Save</span>
              </div>
            </div>
          </div>
        </div>

        {/* Phone Home Indicator */}
        <div className="h-6 bg-gray-900 flex items-center justify-center">
          <div className="w-28 h-1 bg-gray-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}

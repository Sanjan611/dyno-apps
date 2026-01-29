"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Wallet,
  CheckCircle2,
  Circle,
  Clock,
  Star,
  ListTodo,
  Target,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Home,
  Search,
  Bell,
  User,
} from "lucide-react";

// Finance Tracker App
function FinanceApp() {
  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col h-full">
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
        <div className="space-y-3">
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
  );
}

// Task Manager App
function TaskApp() {
  const tasks = [
    { id: 1, title: "Design new landing page", priority: "high", done: true },
    { id: 2, title: "Review pull requests", priority: "medium", done: true },
    { id: 3, title: "Update documentation", priority: "low", done: false },
    { id: 4, title: "Team standup meeting", priority: "high", done: false },
    { id: 5, title: "Fix login bug", priority: "high", done: false },
  ];

  const priorityColors = {
    high: "bg-red-500",
    medium: "bg-yellow-500",
    low: "bg-blue-500",
  };

  return (
    <div className="bg-gradient-to-b from-indigo-950 to-slate-900 flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] text-indigo-300">Today&apos;s Tasks</p>
            <p className="text-lg font-bold text-white">My Day</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <ListTodo className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Progress Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/80">Daily Progress</span>
            <span className="text-xs font-bold text-white">2/5 done</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full w-[40%] bg-white rounded-full" />
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3 text-white/60" />
              <span className="text-[10px] text-white/60">3 remaining</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-white/60" />
              <span className="text-[10px] text-white/60">~2h left</span>
            </div>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-hidden px-4">
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`p-3 rounded-xl border transition-all ${
                task.done
                  ? "bg-slate-800/30 border-slate-700/30"
                  : "bg-slate-800/50 border-slate-700/50"
              }`}
            >
              <div className="flex items-center gap-3">
                {task.done ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs ${
                      task.done ? "text-slate-500 line-through" : "text-white"
                    }`}
                  >
                    {task.title}
                  </p>
                </div>
                <div
                  className={`w-2 h-2 rounded-full ${
                    priorityColors[task.priority as keyof typeof priorityColors]
                  }`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add Task Button */}
        <button className="w-full mt-3 p-3 rounded-xl border border-dashed border-slate-600 text-slate-400 text-xs flex items-center justify-center gap-2 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
          <span className="text-lg leading-none">+</span> Add new task
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-t border-slate-700/50">
        <div className="flex justify-around">
          <div className="text-center">
            <p className="text-lg font-bold text-white">12</p>
            <p className="text-[8px] text-slate-400">This Week</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-400">8</p>
            <p className="text-[8px] text-slate-400">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-indigo-400">4</p>
            <p className="text-[8px] text-slate-400">In Progress</p>
          </div>
          <div className="text-center flex flex-col items-center">
            <Star className="w-4 h-4 text-yellow-400" />
            <p className="text-[8px] text-slate-400">Streak: 7</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Social Feed App
function SocialApp() {
  const posts = [
    {
      id: 1,
      user: "Sarah",
      avatar: "S",
      avatarColor: "from-pink-500 to-rose-500",
      time: "2h",
      content: "Just launched my new portfolio! Check it out and let me know what you think.",
      likes: 234,
      comments: 45,
      liked: true,
    },
    {
      id: 2,
      user: "Mike",
      avatar: "M",
      avatarColor: "from-blue-500 to-cyan-500",
      time: "4h",
      content: "Working on something exciting. Can't wait to share it with everyone!",
      likes: 156,
      comments: 23,
      liked: false,
    },
  ];

  return (
    <div className="bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-white">Feed</p>
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-slate-400" />
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">Y</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stories */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex gap-3">
          {[
            { name: "You", color: "from-primary to-secondary", add: true },
            { name: "Sarah", color: "from-pink-500 to-rose-500" },
            { name: "Mike", color: "from-blue-500 to-cyan-500" },
            { name: "Emma", color: "from-green-500 to-emerald-500" },
          ].map((story, i) => (
            <div key={i} className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full p-0.5 bg-gradient-to-br ${story.color}`}
              >
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                  {story.add ? (
                    <span className="text-white text-lg">+</span>
                  ) : (
                    <span className="text-white text-xs font-bold">
                      {story.name[0]}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[8px] text-slate-400 mt-1">{story.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="flex-1 overflow-hidden">
        <div className="space-y-4 p-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden"
            >
              {/* Post Header */}
              <div className="flex items-center gap-3 p-3">
                <div
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${post.avatarColor} flex items-center justify-center`}
                >
                  <span className="text-white text-xs font-bold">{post.avatar}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-white">{post.user}</p>
                  <p className="text-[10px] text-slate-400">{post.time} ago</p>
                </div>
              </div>

              {/* Post Content */}
              <div className="px-3 pb-3">
                <p className="text-xs text-slate-200 leading-relaxed">{post.content}</p>
              </div>

              {/* Post Actions */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700/50">
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-1">
                    <Heart
                      className={`w-4 h-4 ${
                        post.liked ? "text-red-500 fill-red-500" : "text-slate-400"
                      }`}
                    />
                    <span className="text-[10px] text-slate-400">{post.likes}</span>
                  </button>
                  <button className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4 text-slate-400" />
                    <span className="text-[10px] text-slate-400">{post.comments}</span>
                  </button>
                  <button>
                    <Share2 className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
                <button>
                  <Bookmark className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="flex justify-around">
          <Home className="w-5 h-5 text-primary" />
          <Search className="w-5 h-5 text-slate-500" />
          <div className="w-8 h-8 -mt-2 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="text-white text-lg leading-none">+</span>
          </div>
          <Heart className="w-5 h-5 text-slate-500" />
          <User className="w-5 h-5 text-slate-500" />
        </div>
      </div>
    </div>
  );
}

const apps = [
  { component: FinanceApp, name: "Finance" },
  { component: TaskApp, name: "Tasks" },
  { component: SocialApp, name: "Social" },
];

export function PhoneMockup() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % apps.length);
        setIsTransitioning(false);
      }, 500);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleDotClick = (index: number) => {
    if (index === activeIndex) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveIndex(index);
      setIsTransitioning(false);
    }, 500);
  };

  const ActiveApp = apps[activeIndex].component;

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative"
        style={{ transform: "perspective(1000px) rotateY(-8deg) rotateX(2deg)" }}
      >
        {/* Glow effect behind phone */}
        <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full animate-subtle-pulse" />

        {/* Phone Frame */}
        <div className="relative w-[280px] rounded-[2.5rem] border-4 border-gray-800 bg-gray-900 shadow-2xl overflow-hidden">
          {/* Phone Notch */}
          <div className="h-7 bg-gray-900 flex items-center justify-center z-10">
            <div className="w-20 h-5 bg-gray-800 rounded-full" />
          </div>

          {/* Phone Content */}
          <div
            className={`h-[480px] transition-opacity duration-500 ${
              isTransitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            <ActiveApp />
          </div>

          {/* Phone Home Indicator */}
          <div className="h-6 bg-gray-900 flex items-center justify-center">
            <div className="w-28 h-1 bg-gray-600 rounded-full" />
          </div>
        </div>
      </div>

      {/* Indicator Dots */}
      <div className="flex gap-2 mt-6">
        {apps.map((app, index) => (
          <button
            key={app.name}
            onClick={() => handleDotClick(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === activeIndex
                ? "bg-primary w-6"
                : "bg-gray-300 hover:bg-gray-400"
            }`}
            aria-label={`View ${app.name} app`}
          />
        ))}
      </div>
    </div>
  );
}

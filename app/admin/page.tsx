"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Check,
  Clock,
  Coins,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";

interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  use_case: string | null;
  status: "pending" | "approved" | "rejected";
  invited_at: string | null;
  created_at: string;
}

interface UserCredits {
  userId: string;
  balance: number;
  totalCreditsAdded: number;
  totalCreditsUsed: number;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type AdminTab = "waitlist" | "credits";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("waitlist");

  // Waitlist state
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

  // Credits state
  const [creditUsers, setCreditUsers] = useState<UserCredits[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [creditSearch, setCreditSearch] = useState("");
  const [topupUserId, setTopupUserId] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const url =
        filter === "all"
          ? "/api/admin/waitlist"
          : `/api/admin/waitlist?status=${filter}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        if (response.status === 403) {
          router.push("/");
          return;
        }
        setError(data.error || "Failed to fetch waitlist");
        return;
      }

      setEntries(data.entries);
    } catch (err) {
      setError("Failed to fetch waitlist");
    } finally {
      setLoading(false);
    }
  }, [filter, router]);

  const fetchCredits = useCallback(async () => {
    setCreditsLoading(true);
    setCreditsError(null);

    try {
      const url = creditSearch
        ? `/api/admin/credits?search=${encodeURIComponent(creditSearch)}`
        : "/api/admin/credits";
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        if (response.status === 403) {
          router.push("/");
          return;
        }
        setCreditsError(data.error || "Failed to fetch credits");
        return;
      }

      setCreditUsers(data.users);
    } catch (err) {
      setCreditsError("Failed to fetch credits");
    } finally {
      setCreditsLoading(false);
    }
  }, [creditSearch, router]);

  useEffect(() => {
    if (activeTab === "waitlist") {
      fetchEntries();
    } else {
      fetchCredits();
    }
  }, [activeTab, fetchEntries, fetchCredits]);

  const sendInvite = async (id: string) => {
    setSendingInvite(id);

    try {
      const response = await fetch(`/api/admin/waitlist/${id}/invite`, {
        method: "POST",
      });
      const data = await response.json();

      if (!data.success) {
        alert(data.error || "Failed to send invite");
        return;
      }

      // Refresh the list
      await fetchEntries();
    } catch (err) {
      alert("Failed to send invite");
    } finally {
      setSendingInvite(null);
    }
  };

  const handleTopup = async (userId: string) => {
    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive amount");
      return;
    }

    setTopupLoading(true);

    try {
      const response = await fetch(`/api/admin/credits/${userId}/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json();

      if (!data.success) {
        alert(data.error || "Failed to add credits");
        return;
      }

      // Reset form and refresh
      setTopupUserId(null);
      setTopupAmount("");
      await fetchCredits();
    } catch (err) {
      alert("Failed to add credits");
    } finally {
      setTopupLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string, invitedAt: string | null) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <Check className="w-3 h-3" />
            {invitedAt ? "Invited" : "Approved"}
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <X className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
    }
  };

  const stats = {
    total: entries.length,
    pending: entries.filter((e) => e.status === "pending").length,
    approved: entries.filter((e) => e.status === "approved").length,
    rejected: entries.filter((e) => e.status === "rejected").length,
  };

  const creditStats = {
    totalUsers: creditUsers.length,
    totalBalance: creditUsers.reduce((sum, u) => sum + u.balance, 0),
    totalUsed: creditUsers.reduce((sum, u) => sum + u.totalCreditsUsed, 0),
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={activeTab === "waitlist" ? fetchEntries : fetchCredits}
            disabled={activeTab === "waitlist" ? loading : creditsLoading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${(activeTab === "waitlist" ? loading : creditsLoading) ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "waitlist" ? "default" : "outline"}
            onClick={() => setActiveTab("waitlist")}
          >
            <Users className="w-4 h-4 mr-2" />
            Waitlist
          </Button>
          <Button
            variant={activeTab === "credits" ? "default" : "outline"}
            onClick={() => setActiveTab("credits")}
          >
            <Coins className="w-4 h-4 mr-2" />
            Credits
          </Button>
        </div>

        {activeTab === "waitlist" ? (
          <>
            {/* Waitlist Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card
                className={`cursor-pointer transition-colors ${
                  filter === "all" ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setFilter("all")}
              >
                <CardHeader className="pb-2">
                  <CardDescription>Total</CardDescription>
                  <CardTitle className="text-3xl">{stats.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card
                className={`cursor-pointer transition-colors ${
                  filter === "pending" ? "ring-2 ring-yellow-500" : ""
                }`}
                onClick={() => setFilter("pending")}
              >
                <CardHeader className="pb-2">
                  <CardDescription>Pending</CardDescription>
                  <CardTitle className="text-3xl text-yellow-600">
                    {stats.pending}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card
                className={`cursor-pointer transition-colors ${
                  filter === "approved" ? "ring-2 ring-green-500" : ""
                }`}
                onClick={() => setFilter("approved")}
              >
                <CardHeader className="pb-2">
                  <CardDescription>Approved</CardDescription>
                  <CardTitle className="text-3xl text-green-600">
                    {stats.approved}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card
                className={`cursor-pointer transition-colors ${
                  filter === "rejected" ? "ring-2 ring-red-500" : ""
                }`}
                onClick={() => setFilter("rejected")}
              >
                <CardHeader className="pb-2">
                  <CardDescription>Rejected</CardDescription>
                  <CardTitle className="text-3xl text-red-600">
                    {stats.rejected}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Waitlist Table */}
            <Card>
              <CardHeader>
                <CardTitle>Waitlist Entries</CardTitle>
                <CardDescription>
                  {filter === "all"
                    ? "All waitlist entries"
                    : `Showing ${filter} entries`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error ? (
                  <div className="p-4 text-center text-destructive">{error}</div>
                ) : loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : entries.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No entries found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Invited</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {entry.email}
                          </TableCell>
                          <TableCell>{entry.name || "-"}</TableCell>
                          <TableCell>{entry.company || "-"}</TableCell>
                          <TableCell>
                            {getStatusBadge(entry.status, entry.invited_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(entry.created_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {entry.invited_at ? formatDate(entry.invited_at) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.status === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => sendInvite(entry.id)}
                                disabled={sendingInvite === entry.id}
                              >
                                {sendingInvite === entry.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Mail className="w-4 h-4 mr-2" />
                                    Approve & Notify
                                  </>
                                )}
                              </Button>
                            )}
                            {entry.status === "approved" && !entry.invited_at && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendInvite(entry.id)}
                                disabled={sendingInvite === entry.id}
                              >
                                {sendingInvite === entry.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Mail className="w-4 h-4 mr-2" />
                                    Send Notification
                                  </>
                                )}
                              </Button>
                            )}
                            {entry.status === "approved" && entry.invited_at && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => sendInvite(entry.id)}
                                disabled={sendingInvite === entry.id}
                              >
                                {sendingInvite === entry.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Mail className="w-4 h-4 mr-2" />
                                    Resend Notification
                                  </>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Use Case Details (expandable in future) */}
            {entries.some((e) => e.use_case) && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Use Cases</CardTitle>
                  <CardDescription>
                    What users want to build
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {entries
                    .filter((e) => e.use_case)
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="p-4 bg-muted/50 rounded-lg space-y-2"
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span>{entry.email}</span>
                          {getStatusBadge(entry.status, entry.invited_at)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.use_case}
                        </p>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <>
            {/* Credits Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Users with Credits</CardDescription>
                  <CardTitle className="text-3xl">{creditStats.totalUsers}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Balance</CardDescription>
                  <CardTitle className="text-3xl text-amber-600">
                    {creditStats.totalBalance.toFixed(2)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Credits Used</CardDescription>
                  <CardTitle className="text-3xl text-slate-600">
                    {creditStats.totalUsed.toFixed(2)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Credits Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Credits</CardTitle>
                    <CardDescription>
                      Manage user credit balances
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email..."
                      value={creditSearch}
                      onChange={(e) => setCreditSearch(e.target.value)}
                      className="pl-9 w-[250px]"
                      onKeyDown={(e) => e.key === "Enter" && fetchCredits()}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {creditsError ? (
                  <div className="p-4 text-center text-destructive">{creditsError}</div>
                ) : creditsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : creditUsers.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No users with credits found
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Total Added</TableHead>
                        <TableHead className="text-right">Total Used</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditUsers.map((user) => (
                        <TableRow key={user.userId}>
                          <TableCell className="font-medium">
                            {user.email || user.userId.slice(0, 8) + "..."}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={user.balance <= 0 ? "text-red-600" : "text-green-600"}>
                              {user.balance.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {user.totalCreditsAdded.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {user.totalCreditsUsed.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(user.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {topupUserId === user.userId ? (
                              <div className="flex items-center gap-2 justify-end">
                                <Input
                                  type="number"
                                  placeholder="Amount"
                                  value={topupAmount}
                                  onChange={(e) => setTopupAmount(e.target.value)}
                                  className="w-24 h-8"
                                  min="0"
                                  step="0.1"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleTopup(user.userId)}
                                  disabled={topupLoading}
                                >
                                  {topupLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    "Add"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setTopupUserId(null);
                                    setTopupAmount("");
                                  }}
                                  disabled={topupLoading}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setTopupUserId(user.userId)}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Credits
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

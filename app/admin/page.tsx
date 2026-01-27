"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  Loader2,
  Mail,
  RefreshCw,
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

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function AdminPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

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

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

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
            onClick={fetchEntries}
            disabled={loading}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
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
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

type Role = "owner" | "admin" | "finance_reviewer" | "viewer";

export interface Member {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: Role;
  status: "active" | "invited";
}

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  finance_reviewer: "Finance Reviewer",
  viewer: "Viewer",
};

const INVITABLE_ROLES = (Object.entries(ROLE_LABEL) as [Role, string][]).filter(
  ([value]) => value !== "owner",
);

function initials(name: string) {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MembersTable({
  members,
  orgId,
  currentUserId,
  canManage,
}: {
  members: Member[];
  orgId: string;
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  async function handleInvite() {
    if (!inviteEmail) return;

    setInviting(true);
    setInviteError(null);

    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-member`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setInviteError(result.error ?? "Failed to send invite.");
      setInviting(false);
      return;
    }

    setInviting(false);
    setInviteEmail("");
    setInviteRole("viewer");
    setInviteOpen(false);
    router.refresh();
  }

  async function updateRole(memberId: string, role: Role) {
    setBusyMemberId(memberId);
    const supabase = createClient();
    await supabase.from("organization_members").update({ role }).eq("id", memberId).eq("org_id", orgId);
    setBusyMemberId(null);
    router.refresh();
  }

  async function removeMember(memberId: string) {
    setBusyMemberId(memberId);
    const supabase = createClient();
    await supabase.from("organization_members").delete().eq("id", memberId).eq("org_id", orgId);
    setBusyMemberId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage who has access to this organization and what they can do.
        </p>
        {canManage && (
          <Dialog
            open={inviteOpen}
            onOpenChange={(open) => {
              setInviteOpen(open);
              if (!open) {
                setInviteEmail("");
                setInviteRole("viewer");
                setInviteError(null);
              }
            }}
          >
            <DialogTrigger render={<Button />}>
              <UserPlus /> Invite member
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a member</DialogTitle>
                <DialogDescription>Send an invitation to join this organization.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="name@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole((value as Role) ?? "viewer")}>
                    <SelectTrigger id="invite-role" className="w-full">
                      <SelectValue>{(value: Role) => ROLE_LABEL[value]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {INVITABLE_ROLES.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
              </div>
              <DialogFooter>
                <Button disabled={!inviteEmail || inviting} onClick={handleInvite}>
                  {inviting ? "Sending..." : "Send invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback>{initials(member.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">
                          {member.full_name}
                          {member.user_id === currentUserId && (
                            <span className="text-muted-foreground"> (you)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {member.role === "owner" || !canManage || member.user_id === currentUserId ? (
                      <Badge variant="outline">{ROLE_LABEL[member.role]}</Badge>
                    ) : (
                      <Select
                        value={member.role}
                        onValueChange={(value) => value && updateRole(member.id, value as Role)}
                        disabled={busyMemberId === member.id}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue>{(value: Role) => ROLE_LABEL[value]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {INVITABLE_ROLES.map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.status === "active" ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                        Invited
                      </Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      {member.role !== "owner" && member.user_id !== currentUserId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => removeMember(member.id)}
                              disabled={busyMemberId === member.id}
                            >
                              Remove member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

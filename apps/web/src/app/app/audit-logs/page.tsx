import Link from "next/link";
import { Link2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { LinkButton } from "@/components/shared/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/supabase/org";

const PAGE_SIZE = 50;

const ENTITY_ROUTES: Record<string, string> = {
  invoice: "invoices",
  vendor: "vendors",
  po: "purchase-orders",
  wallet: "settings/wallet",
  user: "settings/members",
  organization: "settings/organization",
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId, userId } = await getOrgContext();
  const supabase = await createClient();
  const params = await searchParams;

  const page = Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { data: logRows, count } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, created_at, actor_id", { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const logs = logRows ?? [];
  const total = count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit Logs"
        description="A complete, immutable record of every action taken on invoices, vendors, and validation requests."
        actions={
          <LinkButton href="/api/export/audit-logs" variant="outline" size="sm">
            Export CSV
          </LinkButton>
        }
      />

      <Card>
        <CardContent className="px-0">
          {logs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((entry) => {
                    const onChain = entry.action.startsWith("genlayer.");
                    const entityRoute = ENTITY_ROUTES[entry.entity_type] ?? entry.entity_type;
                    const actor = entry.actor_id === userId ? "You" : entry.actor_id ? "Team member" : "System";

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-sm">{actor}</TableCell>
                        <TableCell className="font-medium capitalize">
                          {entry.action.replaceAll(".", " ").replaceAll("_", " ")}
                        </TableCell>
                        <TableCell>
                          {entry.entity_id ? (
                            <Link
                              href={`/app/${entityRoute}/${entry.entity_id}`}
                              className="text-sm text-primary hover:underline"
                            >
                              {entry.entity_type}:{entry.entity_id.slice(0, 8)}
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {onChain ? (
                            <Badge variant="outline" className="bg-genlayer/10 text-genlayer border-genlayer/20">
                              <Link2 /> On-chain
                            </Badge>
                          ) : (
                            <Badge variant="outline">Off-chain</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="border-t border-border px-4 py-3">
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  buildHref={(p) => `/app/audit-logs${p > 1 ? `?page=${p}` : ""}`}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

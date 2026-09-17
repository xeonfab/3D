"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Send, UserMinus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MemberView } from "@/lib/members";

import { inviteMemberAction, removeMemberAction, type FormState } from "./settings-actions";

export function MembersSection({
  members,
  currentUserId,
  isOwner,
}: {
  members: MemberView[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(inviteMemberAction, {});
  const [removeState, setRemoveState] = useState<FormState>({});
  const [removing, startRemove] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm">
                {m.email}
                {m.userId === currentUserId ? (
                  <span className="text-muted-foreground"> (vous)</span>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={m.role === "owner" ? "secondary" : "outline"}>
                {m.role === "owner" ? "Propriétaire" : "Membre"}
              </Badge>
              {isOwner && m.role !== "owner" ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Retirer ${m.email}`}
                  disabled={removing}
                  onClick={() =>
                    startRemove(async () => {
                      if (!window.confirm(`Retirer ${m.email} de la marque ?`)) return;
                      setRemoveState(await removeMemberAction(m.id));
                    })
                  }
                >
                  <UserMinus aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {removeState.error ? (
        <p role="alert" className="text-sm text-destructive">
          {removeState.error}
        </p>
      ) : null}

      {isOwner ? (
        <form action={action} className="flex flex-col gap-3" noValidate>
          <Label htmlFor="invite-email">Inviter par email</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="collegue@votre-marque.fr"
              className="sm:max-w-sm"
            />
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              Envoyer l&apos;invitation
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            La personne reçoit un email pour se connecter et retrouve vos produits. Les membres
            peuvent éditer les produits ; seul le propriétaire gère la marque et l&apos;abonnement.
          </p>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p role="status" className="text-sm text-success">
              {state.success}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

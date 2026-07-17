"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

export type AdminUserRow = {
  id: string;
  email: string | null;
  username: string | null;
  login: string;
  name: string | null;
  active: boolean;
  isAdmin: boolean;
  createdAt: string;
  itemsAdded: number;
  soldCount: number;
  soldRevenue: number;
};

export function AdminAccessPanel({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [users, setUsers] = useState(initialUsers);
  const [showCreate, setShowCreate] = useState(false);

  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [confirmTarget, setConfirmTarget] = useState<{
    user: AdminUserRow;
    action: "revoke" | "restore" | "delete" | "promote" | "demote";
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [editTarget, setEditTarget] = useState<AdminUserRow | null>(null);
  const [editLogin, setEditLogin] = useState("");
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function openEdit(user: AdminUserRow) {
    setEditTarget(user);
    setEditLogin(user.login);
    setEditName(user.name ?? "");
    setEditPassword("");
    setEditError(null);
  }

  async function saveEdit() {
    if (!editTarget) return;
    setEditError(null);
    setEditBusy(true);

    const payload: {
      login?: string;
      name?: string;
      password?: string;
    } = {};

    if (editLogin.trim() !== editTarget.login) {
      payload.login = editLogin.trim();
    }
    if (editName.trim() !== (editTarget.name ?? "")) {
      payload.name = editName.trim();
    }
    if (editPassword) {
      payload.password = editPassword;
    }

    if (Object.keys(payload).length === 0) {
      setEditBusy(false);
      setEditTarget(null);
      return;
    }

    const res = await fetch(`/api/admin/users/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setEditBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEditError(data.error ?? "Could not update account.");
      return;
    }

    const updated: AdminUserRow = await res.json();
    setUsers((prev) =>
      prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
    );
    toast.success(`Updated ${updated.login}`);
    setEditTarget(null);
    router.refresh();
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, name: name || undefined, password }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCreateError(data.error ?? "Could not create account.");
      return;
    }
    const user: AdminUserRow = await res.json();
    setUsers((prev) => [
      ...prev,
      { ...user, itemsAdded: 0, soldCount: 0, soldRevenue: 0 },
    ]);
    setLogin("");
    setName("");
    setPassword("");
    setShowCreate(false);
    toast.success(`Account created for ${user.login}`);
    router.refresh();
  }

  async function confirmAction() {
    if (!confirmTarget) return;
    setConfirmBusy(true);

    let res: Response;
    if (confirmTarget.action === "delete") {
      res = await fetch(`/api/admin/users/${confirmTarget.user.id}`, {
        method: "DELETE",
      });
    } else if (confirmTarget.action === "promote") {
      res = await fetch(`/api/admin/users/${confirmTarget.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: true }),
      });
    } else if (confirmTarget.action === "demote") {
      res = await fetch(`/api/admin/users/${confirmTarget.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: false }),
      });
    } else {
      const active = confirmTarget.action === "restore";
      res = await fetch(`/api/admin/users/${confirmTarget.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
    }

    setConfirmBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not update account.");
      return;
    }

    if (confirmTarget.action === "delete") {
      setUsers((prev) => prev.filter((u) => u.id !== confirmTarget.user.id));
      toast.success(`${confirmTarget.user.login} deleted`);
    } else {
      const updated: AdminUserRow = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
      );
      const labels = {
        revoke: "revoked",
        restore: "restored",
        promote: "promoted to admin",
        demote: "removed from admin",
      };
      toast.success(`${updated.login} ${labels[confirmTarget.action]}`);
    }

    setConfirmTarget(null);
    router.refresh();
  }

  const confirmCopy = {
    revoke: {
      title: "Revoke access?",
      body: "They won't be able to sign in until you restore access.",
      btn: "Revoke",
      danger: true,
    },
    restore: {
      title: "Restore access?",
      body: "They can sign in again with their password.",
      btn: "Restore",
      danger: false,
    },
    delete: {
      title: "Delete this account?",
      body: "This permanently removes the account. Their past inventory activity stays, but shows as unassigned.",
      btn: "Delete",
      danger: true,
    },
    promote: {
      title: "Make admin?",
      body: "They'll be able to manage the team and see admin pages.",
      btn: "Make admin",
      danger: false,
    },
    demote: {
      title: "Remove admin?",
      body: "They'll lose access to Team and admin features.",
      btn: "Remove admin",
      danger: true,
    },
  };

  const confirm = confirmTarget ? confirmCopy[confirmTarget.action] : null;

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Team</h2>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="btn-secondary text-sm"
          >
            {showCreate ? "Cancel" : "+ Add person"}
          </button>
        </div>

        {showCreate ? (
          <form
            onSubmit={createUser}
            className="border-b border-slate-200 bg-slate-50 px-4 py-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <input
                type="text"
                required
                placeholder="Email or username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="input"
                autoComplete="off"
              />
              <input
                type="text"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                autoComplete="new-password"
              />
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
            {createError ? (
              <p className="mt-2 text-sm text-red-700">{createError}</p>
            ) : null}
          </form>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Added</th>
                <th className="px-3 py-2 text-right">Sold</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.map((u) => {
                const isMe = u.id === currentUserId;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-slate-900">
                          {u.name?.trim() || u.login}
                        </span>
                        {isMe ? (
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                            you
                          </span>
                        ) : null}
                        {u.isAdmin ? (
                          <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                            admin
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">{u.login}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold " +
                          (u.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600")
                        }
                      >
                        {u.active ? "Active" : "Revoked"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {u.itemsAdded}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className="text-slate-900">{u.soldCount}</div>
                      <div className="text-xs text-slate-500">
                        {formatCurrency(u.soldRevenue)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="text-xs font-medium text-brand-700 hover:text-brand-600"
                        >
                          Edit
                        </button>
                        {u.isAdmin ? (
                          !isMe ? (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmTarget({ user: u, action: "demote" })
                              }
                              className="text-xs font-medium text-amber-700 hover:text-amber-600"
                            >
                              Remove admin
                            </button>
                          ) : null
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmTarget({ user: u, action: "promote" })
                            }
                            className="text-xs font-medium text-amber-700 hover:text-amber-600"
                          >
                            Make admin
                          </button>
                        )}
                        {!u.isAdmin && u.active ? (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmTarget({ user: u, action: "revoke" })
                            }
                            className="text-xs font-medium text-red-700 hover:text-red-600"
                          >
                            Revoke
                          </button>
                        ) : !u.isAdmin && !u.active ? (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmTarget({ user: u, action: "restore" })
                            }
                            className="text-xs font-medium text-brand-700 hover:text-brand-600"
                          >
                            Restore
                          </button>
                        ) : null}
                        {!isMe ? (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmTarget({ user: u, action: "delete" })
                            }
                            className="text-xs font-medium text-red-700 hover:text-red-600"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={confirmTarget !== null}
        onClose={() => !confirmBusy && setConfirmTarget(null)}
        busy={confirmBusy}
        size="sm"
        title={confirm?.title ?? ""}
        description={confirmTarget?.user.login}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmTarget(null)}
              disabled={confirmBusy}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmAction}
              disabled={confirmBusy}
              className={confirm?.danger ? "btn-danger" : "btn-primary"}
            >
              {confirmBusy ? "Saving…" : confirm?.btn}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{confirm?.body}</p>
      </Modal>

      <Modal
        open={editTarget !== null}
        onClose={() => !editBusy && setEditTarget(null)}
        busy={editBusy}
        size="sm"
        title="Edit account"
        description={editTarget?.login}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              disabled={editBusy}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={editBusy}
              className="btn-primary"
            >
              {editBusy ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="edit-login" className="label">
              Email or username
            </label>
            <input
              id="edit-login"
              type="text"
              required
              value={editLogin}
              onChange={(e) => setEditLogin(e.target.value)}
              className="input mt-1"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="edit-name" className="label">
              Name (optional)
            </label>
            <input
              id="edit-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label htmlFor="edit-password" className="label">
              New password
            </label>
            <input
              id="edit-password"
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              className="input mt-1"
              autoComplete="new-password"
              placeholder="Leave blank to keep current"
            />
          </div>
          {editError ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {editError}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

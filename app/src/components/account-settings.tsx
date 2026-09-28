"use client";
import { useActionState, useId, useState } from "react";
import { AlertTriangle, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { changePasswordAction, deleteAccountAction } from "@/lib/auth-actions";
import { Modal } from "./modal";

export function AccountSettings({ demo }: { demo?: boolean }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePasswordAction,
    {},
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const currentPasswordId = useId();
  const newPasswordId = useId();
  return (
    <>
      <div className="account-password">
        <h3>Change password</h3>
        <form action={passwordAction}>
          <div className="form-grid">
            <label htmlFor={currentPasswordId}>
              Current password
              <input
                id={currentPasswordId}
                type="password"
                name="currentPassword"
                autoComplete="current-password"
                spellCheck={false}
                required
                minLength={1}
                maxLength={128}
              />
            </label>
            <label htmlFor={newPasswordId}>
              New password
              <input
                id={newPasswordId}
                type="password"
                name="newPassword"
                autoComplete="new-password"
                spellCheck={false}
                required
                minLength={10}
                maxLength={128}
                placeholder="At least 10 characters"
              />
            </label>
          </div>
          {passwordState.error && (
            <p role="alert" className="notice error">
              {passwordState.error}
            </p>
          )}
          {passwordState.success && (
            <p role="status" className="notice">
              {passwordState.success}
            </p>
          )}
          <button className="button" disabled={demo || passwordPending}>
            {passwordPending ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <ShieldCheck size={16} />
            )}
            Update password
          </button>
        </form>
      </div>
      <div className="account-danger">
        <h3>
          <AlertTriangle size={16} /> Danger zone
        </h3>
        <p className="muted">
          Permanently delete your account and all associated data: profile,
          matches, applications, letters and CVs. This cannot be undone.
        </p>
        <button
          type="button"
          className="button danger"
          disabled={demo}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 size={16} />
          Delete account
        </button>
      </div>
      {confirmingDelete && (
        <DeleteAccountModal onClose={() => setConfirmingDelete(false)} />
      )}
    </>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(deleteAccountAction, {});
  const [confirmation, setConfirmation] = useState("");
  const passwordId = useId();
  const confirmationId = useId();
  return (
    <Modal title="Delete account" onClose={onClose}>
      <p role="alert" className="notice error">
        This permanently deletes your account and all of your data. This
        cannot be undone.
      </p>
      <form action={action}>
        <label htmlFor={passwordId}>
          Password
          <input
            id={passwordId}
            type="password"
            name="password"
            autoComplete="current-password"
            spellCheck={false}
            required
            minLength={1}
            maxLength={128}
          />
        </label>
        <label htmlFor={confirmationId}>
          Type DELETE to confirm
          <input
            id={confirmationId}
            name="confirmation"
            autoComplete="off"
            spellCheck={false}
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        {state.error && (
          <p role="alert" className="notice error">
            {state.error}
          </p>
        )}
        <button
          className="button danger"
          disabled={pending || confirmation !== "DELETE"}
        >
          {pending ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Trash2 size={16} />
          )}
          Permanently delete my account
        </button>
      </form>
    </Modal>
  );
}

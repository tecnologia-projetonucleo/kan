import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { t } from "@lingui/core/macro";
import { useState } from "react";

import { authClient } from "@kan/auth/client";

import Button from "~/components/Button";
import Input from "~/components/Input";
import { PageHead } from "~/components/PageHead";
import PatternedBackground from "~/components/PatternedBackground";

const MIN_LENGTH = 8;

/**
 * Sets a new password from the link a workspace admin created in Members
 * (member.createPasswordResetLink). The token is single use.
 */
export default function ResetPasswordView() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(t`The password must have at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError(t`The passwords do not match.`);
      return;
    }
    setIsPending(true);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setIsPending(false);
    if (resetError) {
      setError(
        resetError.code === "INVALID_TOKEN"
          ? t`This link is invalid or has expired. Ask an admin for a new one.`
          : (resetError.message ?? t`Could not change the password.`),
      );
      return;
    }
    setIsDone(true);
  };

  return (
    <>
      <PageHead title={t`New password | kan.bn`} />
      <main className="h-screen bg-light-100 pt-20 dark:bg-dark-50 sm:pt-0">
        <div className="justify-top flex h-full flex-col items-center px-4 sm:justify-center">
          <div className="z-10 flex w-full flex-col items-center">
            <Link href="/">
              <h1 className="mb-6 text-lg font-bold tracking-tight text-light-1000 dark:text-dark-1000">
                kan.bn
              </h1>
            </Link>
            <p className="mb-10 text-3xl font-bold tracking-tight text-light-1000 dark:text-dark-1000">
              {t`Set a new password`}
            </p>
            <div className="w-full rounded-lg border border-light-500 bg-light-300 px-4 py-10 dark:border-dark-400 dark:bg-dark-200 sm:max-w-md lg:px-10">
              <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                {!token ? (
                  <p className="text-center text-sm text-light-1000 dark:text-dark-1000">
                    {t`This link is invalid or has expired. Ask an admin for a new one.`}
                  </p>
                ) : isDone ? (
                  <div className="flex flex-col items-center gap-6">
                    <p className="text-center text-sm text-light-1000 dark:text-dark-1000">
                      {t`Your password has been changed.`}
                    </p>
                    <Link href="/login" className="w-full">
                      <Button fullWidth size="lg" variant="secondary">
                        {t`Go to login`}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={submit} className="flex flex-col gap-2">
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t`New password`}
                    />
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder={t`Confirm new password`}
                    />
                    {error && (
                      <p className="mt-2 text-xs text-red-400">{error}</p>
                    )}
                    <div className="mt-4">
                      <Button
                        isLoading={isPending}
                        fullWidth
                        size="lg"
                        variant="secondary"
                      >
                        {t`Save password`}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
          <PatternedBackground />
        </div>
      </main>
    </>
  );
}

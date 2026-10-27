import { Button } from "@k22i/ui/components/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@k22i/ui/components/card";
import { Field, FieldError, FieldLabel } from "@k22i/ui/components/field";
import { Input } from "@k22i/ui/components/input";
import { toastManager } from "@k22i/ui/components/toast";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { invalidateSession } from "@/lib/session";

const routeApi = getRouteApi("/_auth/settings/");

const MIN_NAME_LENGTH = 2;

const RouteComponent = () => {
  const { session } = routeApi.useRouteContext();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: { name: session.user.name },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.updateUser({ name: value.name });
      if (error) {
        toastManager.add({
          title: error.message ?? "Could not save your profile",
          type: "error",
        });
        return;
      }
      // The session renders the name, so its cached copy has to be refreshed.
      await invalidateSession(queryClient);
      toastManager.add({ title: "Profile updated", type: "success" });
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .min(
            MIN_NAME_LENGTH,
            `Name must be at least ${MIN_NAME_LENGTH} characters`
          ),
      }),
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear across the app.</CardDescription>
        </CardHeader>
        <CardPanel>
          <form
            className="max-w-sm space-y-4"
            id="profile-form"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <form.Field name="name">
              {(field) => (
                <Field name={field.name}>
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <Input
                    aria-invalid={
                      field.state.meta.errors.length > 0 || undefined
                    }
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((error) => (
                    <FieldError key={error?.message} match>
                      {error?.message}
                    </FieldError>
                  ))}
                </Field>
              )}
            </form.Field>
          </form>
        </CardPanel>
        <CardFooter>
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                disabled={!canSubmit}
                form="profile-form"
                loading={isSubmitting}
                type="submit"
              >
                Save
              </Button>
            )}
          </form.Subscribe>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Used to sign in. Nothing is ever emailed to it.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          <span className="text-sm">{session.user.email}</span>
        </CardPanel>
      </Card>
    </div>
  );
};

export const Route = createFileRoute("/_auth/settings/")({
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Profile" }] }),
});

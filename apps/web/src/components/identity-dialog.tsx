import { Button } from "@trumpet-pods/ui/components/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@trumpet-pods/ui/components/dialog";
import { useState } from "react";
import type { SyntheticEvent } from "react";

import { TextField } from "@/components/text-field";
import { useIdentity } from "@/lib/identity";

const NAME_MAX_LENGTH = 60;

const NameForm = ({ onSaved }: { onSaved?: () => void }) => {
  const { identity, saveName } = useIdentity();
  const [name, setName] = useState(identity?.name ?? "");
  const [error, setError] = useState<string>();

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim() === "") {
      setError("Enter your name");
      return;
    }
    saveName(name);
    onSaved?.();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>What should we call you?</DialogTitle>
        <DialogDescription>
          Your name shows next to what you add. It stays in this browser.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <form onSubmit={submit}>
          <TextField
            autoComplete="name"
            autoFocus
            error={error}
            label="Your name"
            maxLength={NAME_MAX_LENGTH}
            onChange={(event) => {
              setName(event.target.value);
              setError(undefined);
            }}
            value={name}
          />
        </form>
      </DialogPanel>
      <DialogFooter>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </>
  );
};

/** Blocks every route until an identity exists. */
export const IdentityGate = () => {
  const { identity } = useIdentity();

  return (
    // No `onOpenChange`: the controlled `open` ignores Escape until named.
    <Dialog disablePointerDismissal open={!identity}>
      <DialogPopup showCloseButton={false}>
        <NameForm />
      </DialogPopup>
    </Dialog>
  );
};

export const IdentityBadge = () => {
  const { identity } = useIdentity();
  const [open, setOpen] = useState(false);

  if (!identity) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="text-muted-foreground max-w-48 truncate">
        Signed in as {identity.name} ·
      </span>
      <Button
        onClick={() => {
          setOpen(true);
        }}
        size="xs"
        variant="link"
      >
        change
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogPopup>
          <NameForm
            onSaved={() => {
              setOpen(false);
            }}
          />
        </DialogPopup>
      </Dialog>
    </div>
  );
};
